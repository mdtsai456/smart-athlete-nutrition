"""Upgrade preserves unfrozen rows and refuses to guess historical metadata."""
from pathlib import Path
import unittest
import pymysql
from test_schema import connect
from test_concurrency import call
from run_integration import execute_file

ROOT=Path(__file__).resolve().parent.parent


class UpgradeTests(unittest.TestCase):
    def setUp(self):
        self.db=connect()
        with self.db.cursor() as c:
            c.execute('DROP DATABASE IF EXISTS mvp_test_upgrade')
            c.execute('CREATE DATABASE mvp_test_upgrade')
        self.db.select_db('mvp_test_upgrade')
        execute_file(self.db,ROOT/'tests/baseline_v8.sql')
        execute_file(self.db,ROOT/'tests/fixtures.sql')
        with self.db.cursor() as c:
            c.execute("INSERT INTO MealRecord(athlete_id,consumed_at,local_date,timezone,meal_type,status,created_by_account_id,created_at,updated_at) VALUES (1,'2026-10-05 17:00:00','2026-10-06','Asia/Taipei','dinner','draft',1,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))")
            self.meal=c.lastrowid
            c.execute("INSERT INTO MealItem(meal_record_id,food_id,confirmation_status,created_at,updated_at) VALUES (%s,1,'pending',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",(self.meal,))
            self.item=c.lastrowid

    def tearDown(self):
        with self.db.cursor() as c:
            c.execute('DROP DATABASE mvp_test_upgrade')
        self.db.close()

    def test_unfrozen_data_survives_upgrade(self):
        execute_file(self.db,ROOT/'migrations/v8_to_v9.sql')
        call(self.db,'mvp_confirm_item',self.item,1,1,250,'measured')
        with self.db.cursor() as c:
            c.execute('SELECT created_by_account_id FROM MealRecord WHERE meal_record_id=%s',(self.meal,))
            self.assertEqual(c.fetchone()[0],1)
            c.execute('SELECT COUNT(*) FROM MealItemNutrient WHERE meal_item_id=%s',(self.item,))
            self.assertEqual(c.fetchone()[0],3)
            c.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='mvp_test_upgrade' AND table_type='BASE TABLE'")
            self.assertEqual(c.fetchone()[0],16)

    def test_upgrade_refuses_historical_rows_before_altering_schema(self):
        with self.db.cursor() as c:
            c.execute("UPDATE MealRecord SET status='reviewed' WHERE meal_record_id=%s",(self.meal,))
        with self.assertRaises(pymysql.MySQLError) as error:
            execute_file(self.db,ROOT/'migrations/v8_to_v9.sql')
        self.assertEqual(error.exception.args[0],1644)
        with self.db.cursor() as c:
            c.execute('SELECT status FROM MealRecord WHERE meal_record_id=%s',(self.meal,))
            self.assertEqual(c.fetchone()[0],'reviewed')
            c.execute("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='mvp_test_upgrade' AND table_name='MealRecord' AND column_name='status_changed_at'")
            self.assertEqual(c.fetchone()[0],0)
