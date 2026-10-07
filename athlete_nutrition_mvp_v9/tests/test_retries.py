"""DB fault injection proves full rollback/retry after snapshot writes."""
import unittest
from decimal import Decimal
import pymysql
from test_schema import connect
from test_concurrency import call


class RetryTests(unittest.TestCase):
    def setUp(self):
        self.db=connect()
        self.meal=call(self.db,'mvp_create_meal',1,1,'2026-10-05 17:00:00','Asia/Taipei','lunch',None)
        self.item=call(self.db,'mvp_add_item',self.meal,1,1,None,None,None)

    def tearDown(self):
        with self.db.cursor() as c:
            c.execute('DROP TRIGGER IF EXISTS test_snapshot_fault')
        self.db.close()

    def inject(self, failures):
        with self.db.cursor() as c:
            c.execute('SET @mvp_fault_attempt=0')
            c.execute('''CREATE TRIGGER test_snapshot_fault AFTER UPDATE ON MealItem
                FOR EACH ROW FOLLOWS mvp_item_au BEGIN
                SET @mvp_fault_attempt=COALESCE(@mvp_fault_attempt,0)+1;
                IF @mvp_fault_attempt <= %s THEN
                    SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1020,
                        MESSAGE_TEXT='Test-only transient failure after snapshot creation';
                END IF;
                END''',(failures,))

    def test_transient_failure_after_snapshot_write_retries_whole_command(self):
        self.inject(1)
        call(self.db,'mvp_confirm_item',self.item,1,1,250,'measured')
        with self.db.cursor() as c:
            c.execute('SELECT nutrient_id,amount FROM MealItemNutrient WHERE meal_item_id=%s ORDER BY nutrient_id',(self.item,))
            self.assertEqual(c.fetchall(),((1,Decimal('250.0000')),(2,Decimal('25.0000')),(3,Decimal('0.0000'))))

    def test_repeated_failure_exhausts_retry_and_leaves_no_partial_data(self):
        self.inject(10)
        with self.assertRaises(pymysql.MySQLError) as error:
            call(self.db,'mvp_confirm_item',self.item,1,1,250,'measured')
        self.assertEqual(error.exception.args[0],1213)
        with self.db.cursor() as c:
            c.execute('SELECT confirmation_status,confirmed_weight_g FROM MealItem WHERE meal_item_id=%s',(self.item,))
            self.assertEqual(c.fetchone(),('pending',None))
            c.execute('SELECT COUNT(*) FROM MealItemNutrient WHERE meal_item_id=%s',(self.item,))
            self.assertEqual(c.fetchone()[0],0)
