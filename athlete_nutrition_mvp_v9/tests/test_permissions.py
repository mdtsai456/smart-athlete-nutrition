"""A runtime role can call approved commands but cannot bypass triggers/helpers."""
from pathlib import Path
import os
import tempfile
import unittest
import pymysql
from test_schema import connect
from test_concurrency import call
from run_integration import execute_file


class PermissionsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.owner=connect()
        name=os.environ.get('MVP_DB_NAME','mvp_test')
        text=(Path(__file__).resolve().parent.parent/'permissions.sql').read_text()
        text=text.replace('__DATABASE__',name).replace('mvp_api','mvp_test_api').replace('mvp_ai_worker','mvp_test_worker')
        with cls.owner.cursor() as c:
            for role in ('mvp_test_api','mvp_test_worker'):
                c.execute('DROP ROLE IF EXISTS '+role)
            for user in ('mvp_test_api_user','mvp_test_worker_user'):
                for host in ('localhost','%'):
                    c.execute('DROP USER IF EXISTS %s@%s',(user,host))
                    c.execute('CREATE USER %s@%s IDENTIFIED BY %s',(user,host,'test-only'))
        with tempfile.NamedTemporaryFile(mode='w',suffix='.sql') as f:
            f.write(text)
            f.flush()
            execute_file(cls.owner,f.name)
        with cls.owner.cursor() as c:
            for host in ('localhost','%'):
                c.execute("GRANT mvp_test_api TO 'mvp_test_api_user'@%s",(host,))
                c.execute("GRANT mvp_test_worker TO 'mvp_test_worker_user'@%s",(host,))
                c.execute("SET DEFAULT ROLE mvp_test_api FOR 'mvp_test_api_user'@%s",(host,))
                c.execute("SET DEFAULT ROLE mvp_test_worker FOR 'mvp_test_worker_user'@%s",(host,))

    @classmethod
    def tearDownClass(cls):
        with cls.owner.cursor() as c:
            c.execute("DROP USER 'mvp_test_api_user'@'%','mvp_test_worker_user'@'%', 'mvp_test_api_user'@'localhost','mvp_test_worker_user'@'localhost'")
            c.execute('DROP ROLE mvp_test_api,mvp_test_worker')
        cls.owner.close()

    def role_connection(self, user):
        return pymysql.connect(host=os.environ.get('MVP_DB_HOST','127.0.0.1'),
            port=int(os.environ.get('MVP_DB_PORT','3307')),user=user,password='test-only',
            database=os.environ.get('MVP_DB_NAME','mvp_test'),autocommit=True)

    def test_api_commands_work_without_raw_dml_or_helpers(self):
        db=self.role_connection('mvp_test_api_user')
        try:
            meal=call(db,'mvp_create_meal',1,1,'2026-10-05 17:00:00','Asia/Taipei','lunch',None)
            item=call(db,'mvp_add_item',meal,1,1,None,None,None)
            call(db,'mvp_confirm_item',item,1,1,250,'manual')
            with db.cursor() as c:
                c.execute('SELECT COUNT(*) FROM MealItemNutrient WHERE meal_item_id=%s',(item,))
                self.assertEqual(c.fetchone()[0],3)
                for sql in ['UPDATE MealItem SET confirmed_weight_g=1',
                            'DELETE FROM MealItemNutrient',
                            "UPDATE MealRecord SET status='reviewed'",
                            'CALL mvp_build_snapshot(1,1,1,UTC_TIMESTAMP(6),3)',
                            'SELECT password_hash FROM Account',
                            'CALL mvp_start_analysis(1)']:
                    with self.assertRaises(pymysql.MySQLError) as error:
                        c.execute(sql)
                    self.assertIn(error.exception.args[0],(1142,1143,1370))
        finally:
            db.close()

    def test_worker_cannot_modify_meals(self):
        meal=call(self.owner,'mvp_create_meal',1,1,'2026-10-05 17:00:00','Asia/Taipei','lunch',None)
        analysis=call(self.owner,'mvp_queue_analysis',meal,1,'worker-test',None)
        db=self.role_connection('mvp_test_worker_user')
        try:
            call(db,'mvp_start_analysis',analysis)
            call(db,'mvp_finish_analysis',analysis,'succeeded','{}',None)
            with self.assertRaises(pymysql.MySQLError) as error:
                call(db,'mvp_review_meal',meal,2)
            self.assertEqual(error.exception.args[0],1370)
        finally:
            db.close()
