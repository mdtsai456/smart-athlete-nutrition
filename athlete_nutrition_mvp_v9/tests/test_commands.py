"""Command tests catch missing authorization, lifecycle guards and transactions."""
import unittest
from decimal import Decimal
from test_schema import connect
import pymysql


class CommandTests(unittest.TestCase):
    def setUp(self):
        self.db = connect()
        self.c = self.db.cursor()
        self.c.execute("SET time_zone='+00:00'")
        self.meal = self.call('mvp_create_meal',1,1,'2026-10-05 17:00:00','Asia/Taipei','dinner',None)
        self.item = self.call('mvp_add_item',self.meal,1,1,None,None,None)

    def tearDown(self):
        # Cleanup uses an administrative test connection and drops trigger guards
        # only via the final database reset. Each test has independent meal IDs.
        self.db.close()

    def call(self, name, *args):
        self.c.execute('CALL ' + name + '(' + ','.join(['%s']*len(args)) + ')', args)
        result = self.c.fetchone() if self.c.description else None
        while self.c.nextset():
            pass
        return result[0] if result else None

    def confirm(self):
        self.call('mvp_confirm_item',self.item,1,1,250,'measured')

    def test_commands_complete_workflow_and_reopen_requires_reason(self):
        self.confirm()
        self.call('mvp_submit_meal',self.meal,1)
        self.call('mvp_review_meal',self.meal,2)
        with self.assertRaises(pymysql.MySQLError):
            self.call('mvp_confirm_item',self.item,2,1,300,'manual')
        with self.assertRaises(pymysql.MySQLError):
            self.call('mvp_reopen_meal',self.meal,2,' ')
        self.call('mvp_reopen_meal',self.meal,2,'Correct recorded weight')
        self.call('mvp_confirm_item',self.item,2,1,300,'manual')
        self.call('mvp_review_meal',self.meal,2)
        self.c.execute('SELECT amount FROM MealItemNutrient WHERE meal_item_id=%s AND nutrient_id=2',(self.item,))
        self.assertEqual(self.c.fetchone()[0],Decimal('30.0000'))

    def test_athlete_cannot_edit_submitted_or_review(self):
        self.confirm()
        self.call('mvp_submit_meal',self.meal,1)
        with self.assertRaises(pymysql.MySQLError):
            self.call('mvp_reject_item',self.item,1)
        with self.assertRaises(pymysql.MySQLError):
            self.call('mvp_review_meal',self.meal,1)

    def test_pending_item_prevents_submission(self):
        with self.assertRaises(pymysql.MySQLError):
            self.call('mvp_submit_meal',self.meal,1)

    def test_missing_nutrients_rolls_back_confirmation(self):
        with self.assertRaises(pymysql.MySQLError):
            self.call('mvp_confirm_item',self.item,1,3,250,'manual')
        self.c.execute('SELECT confirmation_status,food_id FROM MealItem WHERE meal_item_id=%s',(self.item,))
        self.assertEqual(self.c.fetchone(),('pending',1))

    def test_rejection_clears_snapshot_and_metadata(self):
        self.confirm()
        self.call('mvp_reject_item',self.item,1)
        self.c.execute('SELECT confirmed_weight_g,weight_source,confirmed_by_account_id,confirmed_at,snapshot_nutrient_count FROM MealItem WHERE meal_item_id=%s',(self.item,))
        self.assertEqual(self.c.fetchone(),(None,None,None,None,0))
        self.c.execute('SELECT COUNT(*) FROM MealItemNutrient WHERE meal_item_id=%s',(self.item,))
        self.assertEqual(self.c.fetchone()[0],0)

    def test_snapshot_does_not_change_when_catalog_changes(self):
        self.confirm()
        self.c.execute('UPDATE FoodNutrient SET amount_per_100g=12 WHERE food_id=1 AND nutrient_id=2')
        try:
            self.c.execute('SELECT amount FROM MealItemNutrient WHERE meal_item_id=%s AND nutrient_id=2',(self.item,))
            self.assertEqual(self.c.fetchone()[0],Decimal('25.0000'))
            self.c.execute('SELECT COUNT(*) FROM mvp_snapshot_mismatch WHERE meal_item_id=%s',(self.item,))
            self.assertEqual(self.c.fetchone()[0],0)
        finally:
            self.c.execute('UPDATE FoodNutrient SET amount_per_100g=10 WHERE food_id=1 AND nutrient_id=2')

    def test_disabled_creator_does_not_block_active_nutritionist(self):
        self.c.execute("UPDATE Account SET status='disabled' WHERE account_id=1")
        try:
            self.call('mvp_confirm_item',self.item,2,1,250,'manual')
        finally:
            self.c.execute("UPDATE Account SET status='active' WHERE account_id=1")

    def test_nested_transaction_is_rejected_without_committing_caller(self):
        self.c.execute('START TRANSACTION')
        self.c.execute("UPDATE Athlete SET name='Uncommitted test' WHERE athlete_id=1")
        with self.assertRaises(pymysql.MySQLError):
            self.call('mvp_confirm_item',self.item,1,1,250,'manual')
        self.db.rollback()
        self.c.execute('SELECT name FROM Athlete WHERE athlete_id=1')
        self.assertEqual(self.c.fetchone()[0],'Fixture athlete')

    def test_analysis_lifecycle_and_retry(self):
        aid = self.call('mvp_queue_analysis',self.meal,1,'test','v1')
        self.call('mvp_start_analysis',aid)
        self.call('mvp_finish_analysis',aid,'failed',None,'Worker failure')
        with self.assertRaises(pymysql.MySQLError):
            self.call('mvp_start_analysis',aid)
        other = self.call('mvp_queue_analysis',self.meal,1,'test','v1')
        self.call('mvp_start_analysis',other)
        self.call('mvp_finish_analysis',other,'succeeded','{"items":[]}',None)
        self.assertNotEqual(aid,other)

    def test_cross_org_and_coach_writes_denied(self):
        for actor in (3,4):
            with self.assertRaises(pymysql.MySQLError):
                self.call('mvp_confirm_item',self.item,actor,1,250,'manual')

    def test_confirm_retry_preserves_snapshot_after_catalog_change(self):
        self.confirm()
        self.c.execute('UPDATE FoodNutrient SET amount_per_100g=12 WHERE food_id=1 AND nutrient_id=2')
        try:
            self.confirm()
            self.c.execute('SELECT amount FROM MealItemNutrient WHERE meal_item_id=%s AND nutrient_id=2',(self.item,))
            self.assertEqual(self.c.fetchone()[0],Decimal('25.0000'))
        finally:
            self.c.execute('UPDATE FoodNutrient SET amount_per_100g=10 WHERE food_id=1 AND nutrient_id=2')

    def test_overflow_mid_rebuild_restores_old_snapshot(self):
        self.confirm()
        self.c.execute('UPDATE FoodNutrient SET amount_per_100g=99999999 WHERE food_id=1 AND nutrient_id=2')
        try:
            with self.assertRaises(pymysql.MySQLError):
                self.call('mvp_confirm_item',self.item,1,1,99999999,'manual')
            self.c.execute('SELECT confirmed_weight_g FROM MealItem WHERE meal_item_id=%s',(self.item,))
            self.assertEqual(self.c.fetchone()[0],Decimal('250.00'))
            self.c.execute('SELECT amount FROM MealItemNutrient WHERE meal_item_id=%s ORDER BY nutrient_id',(self.item,))
            self.assertEqual(self.c.fetchall(),((Decimal('250.0000'),),(Decimal('25.0000'),),(Decimal('0.0000'),)))
        finally:
            self.c.execute('UPDATE FoodNutrient SET amount_per_100g=10 WHERE food_id=1 AND nutrient_id=2')

    def test_reviewed_meal_freezes_all_children(self):
        image=self.call('mvp_add_image',self.meal,1,'fixture.jpg','image/jpeg')
        analysis=self.call('mvp_queue_analysis',self.meal,1,'test','v1')
        self.call('mvp_finish_analysis',analysis,'failed',None,'Queue failure')
        self.confirm()
        self.call('mvp_submit_meal',self.meal,1)
        self.call('mvp_review_meal',self.meal,2)
        for sql,args in [
            ('DELETE FROM MealItem WHERE meal_item_id=%s',(self.item,)),
            ('DELETE FROM MealImage WHERE meal_image_id=%s',(image,)),
            ('UPDATE MealItemNutrient SET amount=0 WHERE meal_item_id=%s',(self.item,)),
            ('DELETE FROM MealAnalysis WHERE meal_analysis_id=%s',(analysis,)),
            ('DELETE FROM MealRecord WHERE meal_record_id=%s',(self.meal,))]:
            with self.assertRaises(pymysql.MySQLError):
                self.c.execute(sql,args)

    def test_running_analysis_prevents_submission(self):
        self.confirm()
        aid=self.call('mvp_queue_analysis',self.meal,1,'test',None)
        self.call('mvp_start_analysis',aid)
        with self.assertRaises(pymysql.MySQLError):
            self.call('mvp_submit_meal',self.meal,1)

    def test_terminal_analysis_cannot_be_overwritten(self):
        aid=self.call('mvp_queue_analysis',self.meal,1,'test',None)
        self.call('mvp_start_analysis',aid)
        self.call('mvp_finish_analysis',aid,'succeeded','{}',None)
        with self.assertRaises(pymysql.MySQLError):
            self.call('mvp_finish_analysis',aid,'failed',None,'Overwrite')

    def test_finished_analysis_metadata_must_match_status(self):
        aid=self.call('mvp_queue_analysis',self.meal,1,'test',None)
        self.call('mvp_start_analysis',aid)
        for status,result,error in [('failed',None,None),('succeeded',None,None),('succeeded','{}','Failure'),('failed','{}','Failure')]:
            with self.assertRaises(pymysql.MySQLError):
                self.call('mvp_finish_analysis',aid,status,result,error)

    def test_image_and_item_deletion_commands(self):
        image=self.call('mvp_add_image',self.meal,1,'fixture.jpg','image/jpeg')
        self.call('mvp_delete_image',image,1)
        self.call('mvp_delete_item',self.item,1)
        self.c.execute('SELECT COUNT(*) FROM MealItem WHERE meal_item_id=%s',(self.item,))
        self.assertEqual(self.c.fetchone()[0],0)

    def test_edit_meal_derives_local_date(self):
        self.call('mvp_edit_meal',self.meal,1,'2026-10-06 17:00:00','Asia/Taipei','lunch','Changed')
        self.c.execute('SELECT local_date,note FROM MealRecord WHERE meal_record_id=%s',(self.meal,))
        self.assertEqual(str(self.c.fetchone()[0]),'2026-10-07')


if __name__ == '__main__':
    unittest.main(verbosity=2)
