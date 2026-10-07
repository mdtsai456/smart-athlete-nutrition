"""Real MariaDB integration tests. Run against a disposable database only."""
import os
import unittest
from decimal import Decimal
import pymysql


def connect():
    return pymysql.connect(
        host=os.environ.get('MVP_DB_HOST', '127.0.0.1'),
        port=int(os.environ.get('MVP_DB_PORT', '3307')),
        user=os.environ.get('MVP_DB_USER', 'root'),
        password=os.environ.get('MVP_DB_PASSWORD', ''),
        database=os.environ.get('MVP_DB_NAME', 'mvp_test'), autocommit=True)


class SchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = connect()
        self.c = self.db.cursor()
        self.c.execute("SET time_zone='+00:00'")
        self.c.execute('START TRANSACTION')
        self.c.execute("INSERT INTO MealRecord(athlete_id,consumed_at,local_date,timezone,meal_type,status,created_by_account_id,created_at,updated_at) VALUES (1,'2026-10-05 17:00:00','2026-10-06','Asia/Taipei','dinner','draft',1,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))")
        self.meal = self.c.lastrowid
        self.c.execute("INSERT INTO MealItem(meal_record_id,food_id,confirmation_status,created_at,updated_at) VALUES (%s,1,'pending',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))", (self.meal,))
        self.item = self.c.lastrowid

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def denied(self, sql, args=()):
        with self.assertRaises(pymysql.MySQLError):
            self.c.execute(sql, args)

    def confirm(self):
        self.c.execute("UPDATE MealItem SET confirmation_status='confirmed',confirmed_weight_g=250,weight_source='measured',confirmed_by_account_id=1,confirmed_at=UTC_TIMESTAMP(6) WHERE meal_item_id=%s", (self.item,))

    def test_creator_is_immutable(self):
        self.denied('UPDATE MealRecord SET created_by_account_id=2 WHERE meal_record_id=%s',(self.meal,))

    def test_creation_time_is_immutable(self):
        self.denied("UPDATE MealRecord SET created_at='2020-01-01' WHERE meal_record_id=%s",(self.meal,))

    def test_pending_cannot_have_confirmation_metadata(self):
        self.denied('UPDATE MealItem SET confirmed_weight_g=250 WHERE meal_item_id=%s',(self.item,))

    def test_confirmed_requires_weight_source(self):
        self.denied("UPDATE MealItem SET confirmation_status='confirmed',confirmed_weight_g=250,confirmed_by_account_id=1,confirmed_at=UTC_TIMESTAMP(6) WHERE meal_item_id=%s",(self.item,))

    def test_suspended_actor_is_denied(self):
        self.c.execute("UPDATE Account SET status='suspended' WHERE account_id=2")
        self.denied('CALL mvp_assert_actor(1,2)')

    def test_snapshot_is_complete_and_atomic(self):
        self.confirm()
        self.c.execute('SELECT nutrient_id,amount FROM MealItemNutrient WHERE meal_item_id=%s ORDER BY nutrient_id',(self.item,))
        self.assertEqual(self.c.fetchall(), ((1,Decimal('250.0000')),(2,Decimal('25.0000')),(3,Decimal('0.0000'))))

    def test_draft_cannot_skip_to_reviewed(self):
        self.denied("UPDATE MealRecord SET status='reviewed' WHERE meal_record_id=%s",(self.meal,))

    def test_analysis_succeeded_requires_completion(self):
        self.denied("INSERT INTO MealAnalysis(meal_record_id,model_name,status,created_at) VALUES (%s,'test','succeeded',UTC_TIMESTAMP(6))",(self.meal,))

    def test_wrong_timezone_date_is_denied(self):
        self.denied("UPDATE MealRecord SET local_date='2026-10-05' WHERE meal_record_id=%s",(self.meal,))

    def test_foreign_food_is_denied(self):
        self.denied('UPDATE MealItem SET food_id=2 WHERE meal_item_id=%s',(self.item,))

    def test_partial_snapshot_is_detected(self):
        self.confirm()
        self.c.execute('DELETE FROM MealItemNutrient WHERE meal_item_id=%s AND nutrient_id=2',(self.item,))
        self.c.execute('SELECT problem FROM mvp_snapshot_mismatch WHERE meal_item_id=%s',(self.item,))
        self.assertEqual(self.c.fetchall(),(('snapshot_count_mismatch',),))

    def test_unknown_timezone_is_denied(self):
        self.denied("UPDATE MealRecord SET timezone='Unknown/Place' WHERE meal_record_id=%s",(self.meal,))

    def test_rejected_cannot_retain_source(self):
        self.denied("UPDATE MealItem SET confirmation_status='rejected',weight_source='ai' WHERE meal_item_id=%s",(self.item,))

    def test_cross_org_staff_assignment_denied(self):
        self.denied("INSERT INTO AthleteNutritionTarget(athlete_id,nutritionist_id,nutrient_id,target_basis,target_min,start_date) VALUES (1,2,1,'absolute',100,'2030-01-01')")

    def test_target_period_overlap_and_inclusive_boundaries(self):
        self.c.execute("INSERT INTO AthleteNutritionTarget(athlete_id,nutritionist_id,nutrient_id,target_basis,target_min,start_date,end_date) VALUES (1,1,1,'absolute',100,'2030-01-01','2030-01-31')")
        self.denied("INSERT INTO AthleteNutritionTarget(athlete_id,nutritionist_id,nutrient_id,target_basis,target_min,start_date) VALUES (1,1,1,'absolute',100,'2030-01-31')")
        self.c.execute("INSERT INTO AthleteNutritionTarget(athlete_id,nutritionist_id,nutrient_id,target_basis,target_min,start_date) VALUES (1,1,1,'absolute',100,'2030-02-01')")

    def test_coach_and_restriction_overlap_denied(self):
        for sql in (
            "INSERT INTO AthleteCoach(athlete_id,coach_id,start_date,end_date) VALUES (1,1,'2030-01-01','2030-01-31')",
            "INSERT INTO AthleteFoodRestriction(athlete_id,food_id,nutritionist_id,restriction_type,start_date,end_date) VALUES (1,1,1,'prohibited','2030-01-01','2030-01-31')",
        ):
            self.c.execute(sql)
            self.denied(sql.replace('2030-01-01','2030-01-15'))

    def test_suspended_staff_cannot_get_new_target(self):
        self.c.execute("UPDATE Account SET status='suspended' WHERE account_id=2")
        self.denied("INSERT INTO AthleteNutritionTarget(athlete_id,nutritionist_id,nutrient_id,target_basis,target_min,start_date) VALUES (1,1,1,'absolute',100,'2030-01-01')")

    def test_closing_assignment_with_disabled_staff_is_allowed(self):
        self.c.execute("INSERT INTO AthleteCoach(athlete_id,coach_id,start_date) VALUES (1,1,'2030-01-01')")
        rid=self.c.lastrowid
        self.c.execute("UPDATE Account SET status='disabled' WHERE account_id=4")
        self.c.execute("UPDATE AthleteCoach SET end_date='2030-01-31' WHERE athlete_coach_id=%s",(rid,))

    def test_snapshot_change_requires_active_confirmer(self):
        self.confirm()
        self.c.execute("UPDATE Account SET status='suspended' WHERE account_id=1")
        self.denied('UPDATE MealItem SET confirmed_weight_g=300 WHERE meal_item_id=%s',(self.item,))

    def test_timezone_dst_uses_consumed_utc(self):
        for utc, local in [('2026-03-08 06:30:00','2026-03-08'),('2026-03-08 07:30:00','2026-03-08'),('2026-11-01 05:30:00','2026-11-01'),('2026-11-01 06:30:00','2026-11-01')]:
            self.c.execute('UPDATE MealRecord SET consumed_at=%s,timezone=%s,local_date=%s WHERE meal_record_id=%s',(utc,'America/New_York',local,self.meal))

    def test_catalog_addition_does_not_invalidate_history(self):
        self.confirm()
        self.c.execute("INSERT INTO Nutrient(nutrient_name,unit,status) VALUES ('Extra test nutrient','g','active')")
        nutrient=self.c.lastrowid
        self.c.execute('INSERT INTO FoodNutrient(food_id,nutrient_id,amount_per_100g,updated_at) VALUES (1,%s,4,UTC_TIMESTAMP(6))',(nutrient,))
        self.c.execute('SELECT COUNT(*) FROM mvp_snapshot_mismatch WHERE meal_item_id=%s',(self.item,))
        self.assertEqual(self.c.fetchone()[0],0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
