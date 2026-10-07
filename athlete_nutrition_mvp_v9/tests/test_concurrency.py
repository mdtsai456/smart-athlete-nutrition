"""Independent connections prove lock waits, current reads and rollback."""
from concurrent.futures import ThreadPoolExecutor
import threading
import unittest
from decimal import Decimal
import pymysql
from test_schema import connect


def call(db, name, *args):
    with db.cursor() as c:
        c.execute('CALL '+name+'('+','.join(['%s']*len(args))+')',args)
        result=c.fetchone() if c.description else None
        while c.nextset():
            pass
        return result[0] if result else None


class ConcurrencyTests(unittest.TestCase):
    def test_period_writes_see_committed_overlap_despite_old_read_view(self):
        cases=[
            ('AthleteCoach',"INSERT INTO AthleteCoach(athlete_id,coach_id,start_date,end_date) VALUES (1,1,'2040-01-01','2040-01-31')"),
            ('AthleteNutritionTarget',"INSERT INTO AthleteNutritionTarget(athlete_id,nutritionist_id,nutrient_id,target_basis,target_min,start_date,end_date) VALUES (1,1,1,'absolute',100,'2040-01-01','2040-01-31')"),
            ('AthleteFoodRestriction',"INSERT INTO AthleteFoodRestriction(athlete_id,food_id,nutritionist_id,restriction_type,start_date,end_date) VALUES (1,1,1,'prohibited','2040-01-01','2040-01-31')")]
        for table,sql in cases:
            with self.subTest(table=table):
                owner=connect()
                with owner.cursor() as c:
                    c.execute('START TRANSACTION')
                    c.execute('SELECT athlete_id FROM Athlete WHERE athlete_id=1 FOR UPDATE')
                ready=threading.Event()
                go=threading.Event()

                def competitor():
                    db=connect()
                    try:
                        with db.cursor() as c:
                            c.execute('START TRANSACTION')
                            c.execute('SELECT COUNT(*) FROM '+table)
                            ready.set()
                            if not go.wait(5):
                                raise TimeoutError('Owner did not release competitor')
                            try:
                                c.execute(sql.replace('2040-01-01','2040-01-15'))
                                db.commit()
                                return 'unexpected_commit'
                            except pymysql.MySQLError as e:
                                db.rollback()
                                if e.args[0] == 1020:
                                    # MariaDB can abort a trigger locking read when a
                                    # prior RR view is stale. Retry the whole transaction.
                                    c.execute('START TRANSACTION')
                                    try:
                                        c.execute(sql.replace('2040-01-01','2040-01-15'))
                                        db.commit()
                                        return 'unexpected_retry_commit'
                                    except pymysql.MySQLError as retry_error:
                                        db.rollback()
                                        return retry_error.args
                                return e.args
                    finally:
                        db.close()

                try:
                    with ThreadPoolExecutor(max_workers=1) as pool:
                        future=pool.submit(competitor)
                        self.assertTrue(ready.wait(5))
                        with owner.cursor() as c:
                            c.execute(sql)
                        go.set()
                        # The competing write must wait on the Athlete lock.
                        with self.assertRaises(TimeoutError):
                            future.result(timeout=.15)
                        owner.commit()
                        result=future.result(timeout=5)
                        self.assertEqual(result[0],1644)
                        with owner.cursor() as c:
                            c.execute('SELECT COUNT(*) FROM '+table+" WHERE athlete_id=1 AND start_date BETWEEN '2040-01-01' AND '2040-01-31'")
                            self.assertEqual(c.fetchone()[0],1)
                finally:
                    owner.rollback()
                    with owner.cursor() as c:
                        c.execute('DELETE FROM '+table+" WHERE athlete_id=1 AND start_date='2040-01-01'")
                    owner.close()

    def test_catalog_update_is_serialized_with_complete_confirmation(self):
        owner=connect()
        meal=call(owner,'mvp_create_meal',1,1,'2026-10-05 17:00:00','Asia/Taipei','lunch',None)
        item=call(owner,'mvp_add_item',meal,1,1,None,None,None)
        with owner.cursor() as c:
            c.execute('START TRANSACTION')
            c.execute('SELECT food_id FROM Food WHERE food_id=1 FOR UPDATE')
            c.execute('UPDATE FoodNutrient SET amount_per_100g=12 WHERE food_id=1 AND nutrient_id=2')
        ready=threading.Event()

        def confirm():
            db=connect()
            try:
                ready.set()
                call(db,'mvp_confirm_item',item,1,1,250,'measured')
            finally:
                db.close()

        try:
            with ThreadPoolExecutor(max_workers=1) as pool:
                future=pool.submit(confirm)
                self.assertTrue(ready.wait(5))
                with self.assertRaises(TimeoutError):
                    future.result(timeout=.15)
                owner.commit()
                future.result(timeout=5)
            with owner.cursor() as c:
                c.execute('SELECT nutrient_id,amount FROM MealItemNutrient WHERE meal_item_id=%s ORDER BY nutrient_id',(item,))
                self.assertEqual(c.fetchall(),((1,Decimal('250.0000')),(2,Decimal('30.0000')),(3,Decimal('0.0000'))))
        finally:
            owner.rollback()
            with owner.cursor() as c:
                c.execute('UPDATE FoodNutrient SET amount_per_100g=10 WHERE food_id=1 AND nutrient_id=2')
            owner.close()

    def test_review_waits_for_confirmation_then_sees_complete_snapshot(self):
        owner=connect()
        meal=call(owner,'mvp_create_meal',1,1,'2026-10-05 17:00:00','Asia/Taipei','lunch',None)
        item=call(owner,'mvp_add_item',meal,1,1,None,None,None)
        call(owner,'mvp_confirm_item',item,1,1,250,'measured')
        call(owner,'mvp_submit_meal',meal,1)
        with owner.cursor() as c:
            c.execute('START TRANSACTION')
            c.execute('SELECT meal_record_id FROM MealRecord WHERE meal_record_id=%s FOR UPDATE',(meal,))
            c.execute("UPDATE MealItem SET confirmed_weight_g=300,confirmed_by_account_id=2,confirmed_at=UTC_TIMESTAMP(6) WHERE meal_item_id=%s",(item,))
        ready=threading.Event()

        def review():
            db=connect()
            try:
                ready.set()
                call(db,'mvp_review_meal',meal,2)
            finally:
                db.close()

        try:
            with ThreadPoolExecutor(max_workers=1) as pool:
                future=pool.submit(review)
                self.assertTrue(ready.wait(5))
                with self.assertRaises(TimeoutError):
                    future.result(timeout=.15)
                owner.commit()
                future.result(timeout=5)
            with owner.cursor() as c:
                c.execute('SELECT amount FROM MealItemNutrient WHERE meal_item_id=%s AND nutrient_id=2',(item,))
                self.assertEqual(c.fetchone()[0],Decimal('30.0000'))
                c.execute('SELECT status FROM MealRecord WHERE meal_record_id=%s',(meal,))
                self.assertEqual(c.fetchone()[0],'reviewed')
        finally:
            owner.rollback()
            owner.close()

    def test_effective_date_autocommit_is_rejected(self):
        db=connect()
        try:
            with db.cursor() as c:
                with self.assertRaises(pymysql.MySQLError) as error:
                    c.execute("INSERT INTO AthleteCoach(athlete_id,coach_id,start_date) VALUES (1,1,'2050-01-01')")
                self.assertEqual(error.exception.args[0],1644)
        finally:
            db.close()
