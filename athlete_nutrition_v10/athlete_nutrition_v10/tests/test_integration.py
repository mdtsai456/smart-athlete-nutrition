"""Actual MariaDB behavior tests; never run against a production server."""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import json
from pathlib import Path
import tempfile
import secrets
import uuid
import unittest
import pymysql
from test_schema import connect,call,connection_config
from run_integration import execute_file

class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.db=connect()
        self.meal,self.revision=call(self.db,'mvp_create_meal',1,1,'2026-10-05 17:00:00','Asia/Taipei','dinner',None)

    def tearDown(self): self.db.close()

    def mutate(self,action,payload,reason=None,actor=1):
        result=call(self.db,'mvp_mutate_meal',self.meal,actor,self.revision,action,json.dumps(payload),reason)
        self.revision=result[1]
        return result[2]

    def add(self): return self.mutate('add_item',{'food_id':1})

    def confirm(self,item,weight=250,source='measured',actor=1,reason=None):
        return self.mutate('confirm',{'item_id':item,'food_id':1,'weight_g':weight,'weight_source':source},reason,actor)

    def save(self,items,key=None,expected=None,reason=None):
        if key is None: key=f'request_{self.meal}'
        result=call(self.db,'mvp_save_meal',self.meal,1,self.revision if expected is None else expected,key,json.dumps(items),reason)
        self.revision=result[1]
        return result

    def item(self,id,weight=250): return {'item_id':id,'decision':'confirmed','food_id':1,'weight_g':weight,'weight_source':'measured'}

    def query(self,sql,args=()):
        with self.db.cursor() as c: c.execute(sql,args); return c.fetchall()

    def test_roles_and_new_profile_columns_exist(self):
        self.assertEqual(len(self.query('SELECT * FROM Coach')),1)
        self.assertEqual(len(self.query('SELECT * FROM Nutritionist')),2)
        self.query("UPDATE Athlete SET height_cm=180,body_fat_percent=15,sport='Basketball',weekly_training_count=5,primary_goal='maintain',jersey_number=7,position='Guard',allergies_text='Peanut' WHERE athlete_id=1")
        self.assertEqual(self.query('SELECT height_cm FROM Athlete WHERE athlete_id=1')[0][0],Decimal('180.00'))

    def test_jenny_profile_weight_bounds_keep_unknown_and_zero_jersey(self):
        original=self.query('SELECT weight_kg,jersey_number,dietary_restrictions_text,allergies_text FROM Athlete WHERE athlete_id=1')[0]
        try:
            for weight in (None,10,350):
                self.query('UPDATE Athlete SET weight_kg=%s,jersey_number=0 WHERE athlete_id=1',(weight,))
                self.assertEqual(self.query('SELECT jersey_number FROM Athlete WHERE athlete_id=1')[0][0],0)
            for weight in (9.99,350.01):
                with self.assertRaises(pymysql.MySQLError):
                    self.query('UPDATE Athlete SET weight_kg=%s WHERE athlete_id=1',(weight,))
            before=self.query('SELECT COUNT(*) FROM AthleteFoodRestriction WHERE athlete_id=1')[0][0]
            self.query("UPDATE Athlete SET dietary_restrictions_text='不吃牛肉',allergies_text='花生' WHERE athlete_id=1")
            self.assertEqual(self.query('SELECT COUNT(*) FROM AthleteFoodRestriction WHERE athlete_id=1')[0][0],before)
        finally:
            self.query('UPDATE Athlete SET weight_kg=%s,jersey_number=%s,dietary_restrictions_text=%s,allergies_text=%s WHERE athlete_id=1',original)

    def test_jenny_sex_codes_and_profile_constraints(self):
        original=self.query('SELECT sex,height_cm,body_fat_percent,weekly_training_count,primary_goal,jersey_number FROM Athlete WHERE athlete_id=1')[0]
        try:
            for sex in (None,'male','female','other','undisclosed'):
                self.query('UPDATE Athlete SET sex=%s WHERE athlete_id=1',(sex,))
                self.assertEqual(self.query('SELECT sex FROM Athlete WHERE athlete_id=1')[0][0],sex)
            invalid={'sex':'invalid','height_cm':49.99,'body_fat_percent':100,'weekly_training_count':51,'primary_goal':'invalid','jersey_number':100}
            for field,value in invalid.items():
                with self.subTest(field=field),self.assertRaises(pymysql.MySQLError):
                    self.query('UPDATE Athlete SET '+field+'=%s WHERE athlete_id=1',(value,))
        finally:
            self.query('UPDATE Athlete SET sex=%s,height_cm=%s,body_fat_percent=%s,weekly_training_count=%s,primary_goal=%s,jersey_number=%s WHERE athlete_id=1',original)

    def test_final_batch_and_snapshot_history_are_atomic(self):
        a,b=self.add(),self.add()
        old=self.revision
        self.save([self.item(a),self.item(b)])
        self.assertEqual(self.revision,old+1)
        self.assertEqual(self.query('SELECT SUM(amount) FROM MealItemNutrient WHERE meal_item_id IN (%s,%s) AND nutrient_id=2',(a,b))[0][0],Decimal('50.0000'))
        self.assertEqual(self.query("SELECT COUNT(*) FROM MealRevision WHERE meal_record_id=%s AND action='save'",(self.meal,))[0][0],1)

    def test_daily_food_limit_uses_explicit_grams_and_prohibited_has_no_limit(self):
        self.db.begin()
        try:
            self.query("INSERT INTO AthleteFoodRestriction(athlete_id,food_id,nutritionist_id,restriction_type,max_daily_amount_g,start_date,end_date) VALUES(1,1,1,'limited',125.50,'2045-05-01','2045-05-01')")
            self.assertEqual(self.query("SELECT max_daily_amount_g FROM AthleteFoodRestriction WHERE athlete_id=1 AND start_date='2045-05-01'")[0][0],Decimal('125.50'))
            self.query("UPDATE AthleteFoodRestriction SET max_daily_amount_g=130.25 WHERE athlete_id=1 AND start_date='2045-05-01'")
            self.assertEqual(self.query("SELECT max_daily_amount_g FROM AthleteFoodRestriction WHERE athlete_id=1 AND start_date='2045-05-01'")[0][0],Decimal('130.25'))
            with self.assertRaises(pymysql.MySQLError):
                self.query("INSERT INTO AthleteFoodRestriction(athlete_id,food_id,nutritionist_id,restriction_type,max_daily_amount_g,start_date,end_date) VALUES(1,1,1,'prohibited',1,'2045-05-02','2045-05-02')")
            self.query("INSERT INTO AthleteFoodRestriction(athlete_id,food_id,nutritionist_id,restriction_type,max_daily_amount_g,start_date,end_date) VALUES(1,1,1,'prohibited',NULL,'2045-05-03','2045-05-03')")
        finally:self.db.rollback()

    def test_final_item_failure_rolls_back_batch_and_event(self):
        a,b=self.add(),self.add()
        with self.assertRaises(pymysql.MySQLError): self.save([self.item(a),{**self.item(b),'food_id':3}])
        self.assertEqual(self.query('SELECT status,revision FROM MealRecord WHERE meal_record_id=%s',(self.meal,))[0],('draft',self.revision))
        self.assertEqual(self.query('SELECT COUNT(*) FROM MealItemNutrient WHERE meal_item_id IN (%s,%s)',(a,b))[0][0],0)

    def test_snapshot_overflow_rolls_back_earlier_items_and_history(self):
        a,b=self.add(),self.add()
        before=self.query('SELECT COUNT(*) FROM MealRevision WHERE meal_record_id=%s',(self.meal,))[0][0]
        self.query("INSERT INTO Food(food_name,status,created_at,updated_at) VALUES('Overflow fixture','active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))")
        food=self.query('SELECT LAST_INSERT_ID()')[0][0]
        for nutrient,amount in [(1,10000000),(2,10),(3,15),(4,0)]:
            self.query('INSERT INTO FoodNutrient(food_id,nutrient_id,amount_per_100g,updated_at) VALUES(%s,%s,%s,UTC_TIMESTAMP(6))',(food,nutrient,amount))
        with self.assertRaises(pymysql.MySQLError):
            self.save([self.item(a),{**self.item(b,1000000),'food_id':food}])
        self.assertEqual(self.query('SELECT status,revision FROM MealRecord WHERE meal_record_id=%s',(self.meal,))[0],('draft',self.revision))
        self.assertEqual(self.query('SELECT COUNT(*) FROM MealItemNutrient WHERE meal_item_id IN (%s,%s)',(a,b))[0][0],0)
        self.assertEqual(self.query('SELECT COUNT(*) FROM MealRevision WHERE meal_record_id=%s',(self.meal,))[0][0],before)

    def test_concurrent_same_submission_creates_one_event(self):
        a=self.add(); expected=self.revision; items=json.dumps([self.item(a)])
        def writer():
            db=connect()
            try: return call(db,'mvp_save_meal',self.meal,1,expected,f'concurrent_{self.meal}',items,None)
            finally: db.close()
        with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(lambda _:writer(),range(2)))
        self.assertEqual(results[0][:3],results[1][:3])
        self.assertEqual(sorted(r[3] for r in results),[0,1])
        self.assertEqual(self.query("SELECT COUNT(*) FROM MealRevision WHERE meal_record_id=%s AND action='save'",(self.meal,))[0][0],1)

    def test_missing_macro_is_rejected_but_zero_macro_is_valid(self):
        self.query("INSERT INTO Food(food_name,status,created_at,updated_at) VALUES('Macro coverage fixture','active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))")
        food=self.query('SELECT LAST_INSERT_ID()')[0][0]
        for nutrient,amount in [(1,100),(2,10),(3,15)]:
            self.query('INSERT INTO FoodNutrient(food_id,nutrient_id,amount_per_100g,updated_at) VALUES(%s,%s,%s,UTC_TIMESTAMP(6))',(food,nutrient,amount))
        a=self.mutate('add_item',{'food_id':food})
        payload={**self.item(a),'food_id':food}
        with self.assertRaises(pymysql.MySQLError): self.save([payload])
        self.query('INSERT INTO FoodNutrient(food_id,nutrient_id,amount_per_100g,updated_at) VALUES(%s,4,0,UTC_TIMESTAMP(6))',(food,))
        self.save([payload])
        self.assertEqual(self.query('SELECT amount FROM MealItemNutrient WHERE meal_item_id=%s AND nutrient_id=4',(a,))[0][0],Decimal('0'))

    def test_intake_counts_submitted_snapshots_but_not_drafts(self):
        self.mutate('edit',{'consumed_at':'2050-01-01 04:00:00','timezone':'Asia/Taipei','meal_type':'lunch','note':None})
        a=self.add(); self.confirm(a)
        def protein():
            rows=self.query("SELECT amount FROM mvp_daily_intake WHERE athlete_id=1 AND local_date='2050-01-01' AND nutrient_id=2")
            return rows[0][0] if rows else Decimal('0')
        self.assertEqual(protein(),Decimal('0'))
        self.save([self.item(a)])
        self.assertEqual(protein(),Decimal('25'))
        self.mutate('review',{},actor=2)
        self.assertEqual(protein(),Decimal('25'))

    def test_active_period_policy_warning_requires_acknowledgment(self):
        self.db.begin()
        self.query("INSERT INTO AthleteNutritionTarget(athlete_id,nutritionist_id,nutrient_id,target_basis,target_max,start_date,end_date) VALUES(1,1,2,'per_kg_bw',1,'2035-03-01','2035-03-01')")
        self.db.commit()
        data={'weight':70,'calories':2800,'proteinKg':1.6,'fatUnit':'kg','fatValue':1,'carbMinimum':6,'training':'訓練日','manual':False}
        with self.assertRaises(pymysql.MySQLError): call(self.db,'mvp_save_daily_plan',1,2,'2035-03-01',0,json.dumps(data),0,None)
        result=call(self.db,'mvp_save_daily_plan',1,2,'2035-03-01',0,json.dumps(data),1,None)
        warnings=json.loads(self.query('SELECT warnings_json FROM AthleteDailyNutritionPlan WHERE daily_plan_id=%s',(result[0],))[0][0])
        self.assertIn('policy_range:protein',warnings)

    def test_successful_retry_uses_original_result_before_stale_version_check(self):
        a=self.add(); old=self.revision
        first=self.save([self.item(a)])
        retry=self.save([self.item(a)],expected=old)
        self.assertEqual(first[:3],retry[:3]); self.assertTrue(retry[3])
        with self.assertRaises(pymysql.MySQLError): self.save([self.item(a,300)],expected=old)

    def test_duplicate_and_foreign_item_ids_are_rejected(self):
        a=self.add()
        with self.assertRaises(pymysql.MySQLError): self.save([self.item(a),self.item(a)])
        other=call(self.db,'mvp_create_meal',1,1,'2026-10-05 17:00:00','Asia/Taipei','lunch',None)[0]
        result=call(self.db,'mvp_mutate_meal',other,1,1,'add_item','{"food_id":1}',None)
        with self.assertRaises(pymysql.MySQLError): self.save([self.item(result[2])])

    def test_omitted_pending_and_running_analysis_prevent_save(self):
        a=self.add(); b=self.add()
        with self.assertRaises(pymysql.MySQLError): self.save([self.item(a)])
        analysis=self.mutate('queue_analysis',{'model_name':'fixture'})
        call(self.db,'mvp_start_analysis',analysis)
        with self.assertRaises(pymysql.MySQLError): self.save([self.item(a),self.item(b)])

    def test_negative_macros_cannot_be_hidden_by_rounding(self):
        base={'weight':70,'calories':2800,'proteinKg':1.6,'fatUnit':'kg','fatValue':1,'carbMinimum':0,'training':'訓練日','manual':True,'protein':-0.01,'carbs':542.5,'fat':70}
        with self.assertRaises(pymysql.MySQLError):
            call(self.db,'mvp_save_daily_plan',1,2,'2035-01-04',0,json.dumps(base),1,None)
        auto={**base,'manual':False,'calories':1077.99}
        with self.assertRaises(pymysql.MySQLError):
            call(self.db,'mvp_save_daily_plan',1,2,'2035-01-04',0,json.dumps(auto),1,None)

    def test_correction_preserves_original_ai_and_before_snapshot(self):
        aid=self.mutate('queue_analysis',{'model_name':'fixture'})
        call(self.db,'mvp_start_analysis',aid)
        call(self.db,'mvp_finish_analysis',aid,'succeeded','{"items":[]}',None)
        a=self.mutate('add_item',{'food_id':1,'analysis_id':aid})
        self.confirm(a)
        self.query('UPDATE FoodNutrient SET amount_per_100g=12 WHERE food_id=1 AND nutrient_id=2')
        try:
            self.confirm(a,300,'manual',2,'Correct scale weight')
            before,after=self.query('SELECT before_json,after_json FROM MealRevision WHERE meal_record_id=%s ORDER BY revision DESC LIMIT 1',(self.meal,))[0]
            def protein(doc): return next(n['amount'] for n in json.loads(doc)['items'][0]['nutrients'] if str(n['nutrient_id'])=='2')
            self.assertEqual(Decimal(str(protein(before))),Decimal('25'))
            self.assertEqual(Decimal(str(protein(after))),Decimal('36'))
            self.assertEqual(json.loads(self.query('SELECT raw_result_json FROM MealAnalysis WHERE meal_analysis_id=%s',(aid,))[0][0]),{'items':[]})
        finally: self.query('UPDATE FoodNutrient SET amount_per_100g=10 WHERE food_id=1 AND nutrient_id=2')

    def test_failed_ai_is_terminal_and_does_not_block_manual_meal(self):
        aid=self.mutate('queue_analysis',{'model_name':'mock failure'})
        call(self.db,'mvp_start_analysis',aid)
        call(self.db,'mvp_finish_analysis',aid,'failed',None,'Mock inference unavailable')
        self.assertEqual(self.query('SELECT status,raw_result_json,error_message FROM MealAnalysis WHERE meal_analysis_id=%s',(aid,))[0],('failed',None,'Mock inference unavailable'))
        with self.assertRaises(pymysql.MySQLError):
            self.query("UPDATE MealAnalysis SET error_message='Rewrite original failure' WHERE meal_analysis_id=%s",(aid,))
        with self.assertRaises(pymysql.MySQLError): call(self.db,'mvp_finish_analysis',aid,'succeeded','{"items":[]}',None)
        a=self.add(); self.save([self.item(a)])
        self.assertEqual(self.query('SELECT status FROM MealRecord WHERE meal_record_id=%s',(self.meal,))[0][0],'submitted')

    def test_inactive_food_metadata_correction_preserves_snapshot(self):
        a=self.add(); self.confirm(a)
        self.query("UPDATE Food SET status='inactive' WHERE food_id=1")
        try:
            self.confirm(a,250,'manual',2,'Fix source')
            self.assertEqual(self.query('SELECT amount FROM MealItemNutrient WHERE meal_item_id=%s AND nutrient_id=2',(a,))[0][0],Decimal('25'))
            with self.assertRaises(pymysql.MySQLError): self.confirm(a,300,'manual',2,'Fix weight')
        finally: self.query("UPDATE Food SET status='active' WHERE food_id=1")

    def test_review_reopen_and_noop_history(self):
        a=self.add(); self.confirm(a); old=self.revision; self.confirm(a)
        self.assertEqual(old,self.revision)
        self.save([self.item(a)])
        self.mutate('review',{},actor=2)
        with self.assertRaises(pymysql.MySQLError): self.confirm(a,300,'manual',2,'Fix weight')
        self.mutate('reopen',{},'Correction requested',2)
        self.confirm(a,300,'manual',2,'Scale correction')

    def test_coach_foreign_and_disabled_actors_cannot_write(self):
        a=self.add()
        for actor in (3,4):
            with self.assertRaises(pymysql.MySQLError): self.confirm(a,actor=actor)
        self.query("UPDATE Account SET status='suspended' WHERE account_id=2")
        try:
            with self.assertRaises(pymysql.MySQLError): self.confirm(a,actor=2)
        finally: self.query("UPDATE Account SET status='active' WHERE account_id=2")

    def test_inactive_organization_cannot_write(self):
        a=self.add()
        self.query("UPDATE Organization SET status='inactive' WHERE organization_id=1")
        try:
            for actor in (1,2):
                with self.assertRaises(pymysql.MySQLError): self.confirm(a,actor=actor)
        finally: self.query("UPDATE Organization SET status='active' WHERE organization_id=1")

    def test_all_rejected_cannot_be_submitted(self):
        a=self.add()
        with self.assertRaises(pymysql.MySQLError):
            self.save([{'item_id':a,'decision':'rejected'}],reason='Not eaten')
        self.assertEqual(self.query('SELECT confirmation_status FROM MealItem WHERE meal_item_id=%s',(a,))[0][0],'pending')
        self.assertEqual(self.query('SELECT status FROM MealRecord WHERE meal_record_id=%s',(self.meal,))[0][0],'draft')

    def test_audit_is_append_only_and_created_actor_retained(self):
        a=self.add(); self.confirm(a)
        for sql in ('UPDATE MealRevision SET reason=\'rewrite\' WHERE meal_record_id=%s','DELETE FROM MealRevision WHERE meal_record_id=%s','DELETE FROM MealRecord WHERE meal_record_id=%s'):
            with self.assertRaises(pymysql.MySQLError): self.query(sql,(self.meal,))
        self.assertEqual(self.query('SELECT created_by_account_id FROM MealRecord WHERE meal_record_id=%s',(self.meal,))[0][0],1)

    def test_daily_plan_versions_and_frozen_weight(self):
        date='2035-01-01'
        data={'weight':70,'calories':2800,'proteinKg':1.6,'fatUnit':'kg','fatValue':1,'carbMinimum':6,'training':'訓練日','manual':False}
        first=call(self.db,'mvp_save_daily_plan',1,2,date,0,json.dumps(data),0,None)
        self.assertEqual(self.query('SELECT target_protein_g,target_carbohydrate_g,target_fat_g FROM AthleteDailyNutritionPlan WHERE daily_plan_id=%s',(first[0],))[0],(Decimal('112'),Decimal('430.5'),Decimal('70')))
        self.query('UPDATE Athlete SET weight_kg=75 WHERE athlete_id=1')
        try:
            second=call(self.db,'mvp_save_daily_plan',1,2,date,1,json.dumps({**data,'weight':75}),1,'New training load')
            self.assertEqual(second[1],2)
            self.assertEqual(self.query('SELECT calculation_weight_kg FROM AthleteDailyNutritionPlan WHERE daily_plan_id=%s',(first[0],))[0][0],Decimal('70'))
            with self.assertRaises(pymysql.MySQLError): call(self.db,'mvp_save_daily_plan',1,2,date,1,json.dumps(data),1,'Stale')
            with self.assertRaises(pymysql.MySQLError): self.query('UPDATE AthleteDailyNutritionPlan SET target_energy_kcal=1 WHERE daily_plan_id=%s',(first[0],))
        finally: self.query('UPDATE Athlete SET weight_kg=70 WHERE athlete_id=1')

    def test_plan_invalid_numbers_and_warnings(self):
        data={'weight':70,'calories':2800,'proteinKg':1.6,'fatUnit':'kg','fatValue':1,'carbMinimum':10,'training':'訓練日','manual':False}
        with self.assertRaises(pymysql.MySQLError): call(self.db,'mvp_save_daily_plan',1,2,'2035-01-02',0,json.dumps(data),0,None)
        for field,value in [('weight',0),('proteinKg',-1),('calories','junk'),('fatUnit','other')]:
            with self.assertRaises(pymysql.MySQLError): call(self.db,'mvp_save_daily_plan',1,2,'2035-01-02',0,json.dumps({**data,field:value}),1,None)
        result=call(self.db,'mvp_save_daily_plan',1,2,'2035-01-02',0,json.dumps(data),1,None)
        self.assertTrue(json.loads(self.query('SELECT warnings_json FROM AthleteDailyNutritionPlan WHERE daily_plan_id=%s',(result[0],))[0][0]))

    def test_two_plan_writers_cannot_overwrite_same_day(self):
        data={'weight':70,'calories':2800,'proteinKg':1.6,'fatUnit':'kg','fatValue':1,'carbMinimum':6,'training':'訓練日','manual':False}
        def writer():
            db=connect()
            try:
                try: call(db,'mvp_save_daily_plan',1,2,'2035-01-03',0,json.dumps(data),0,None); return 'saved'
                except pymysql.MySQLError as e: return e.args[0]
            finally: db.close()
        with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(lambda _:writer(),range(2)))
        self.assertEqual(results.count('saved'),1)
        self.assertEqual(results.count(1644),1)

    def test_nested_transaction_does_not_commit_caller(self):
        self.query('START TRANSACTION')
        self.query("UPDATE Athlete SET name='Uncommitted' WHERE athlete_id=1")
        with self.assertRaises(pymysql.MySQLError): self.add()
        self.db.rollback()
        self.assertEqual(self.query('SELECT name FROM Athlete WHERE athlete_id=1')[0][0],'Fixture athlete')

    def test_transient_retry_rolls_back_snapshot_and_history(self):
        a=self.add()
        self.query('SET @test_v10_fault=0')
        self.query('''CREATE TRIGGER test_v10_fault AFTER INSERT ON MealRevision FOR EACH ROW BEGIN
          SET @test_v10_fault=COALESCE(@test_v10_fault,0)+1;
          IF @test_v10_fault=1 THEN SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1020,MESSAGE_TEXT='Test rollback after event'; END IF;
        END''')
        try:
            self.confirm(a)
            self.assertEqual(self.query("SELECT COUNT(*) FROM MealRevision WHERE meal_record_id=%s AND action='confirm'",(self.meal,))[0][0],1)
            self.assertEqual(self.query('SELECT COUNT(*) FROM mvp_snapshot_mismatch WHERE meal_item_id=%s',(a,))[0][0],0)
        finally: self.query('DROP TRIGGER test_v10_fault')

class PermissionsTests(unittest.TestCase):
    def test_runtime_roles_cannot_bypass_history_or_profiles(self):
        db=connect()
        from os import environ
        name=environ.get('MVP_DB_NAME','mvp_test_v10')
        root=Path(__file__).resolve().parents[1]
        suffix=uuid.uuid4().hex[:12]
        api_role='v10_api_'+suffix; worker_role='v10_worker_'+suffix; username='v10_test_'+suffix
        password=secrets.token_urlsafe(24)
        user_created=False; roles_attempted=False
        text=(root/'permissions.sql').read_text(encoding='utf-8').replace('__DATABASE__',name).replace('mvp_api',api_role).replace('mvp_ai_worker',worker_role)
        try:
            with db.cursor() as c:
                c.execute('CREATE USER %s@%s IDENTIFIED BY %s',(username,'%',password)); user_created=True
            with tempfile.TemporaryDirectory() as directory:
                path=Path(directory)/'roles.sql'; path.write_text(text,encoding='utf-8'); roles_attempted=True; execute_file(db,path)
            with db.cursor() as c:
                c.execute('GRANT '+api_role+' TO %s@%s',(username,'%'))
                c.execute('SET DEFAULT ROLE '+api_role+' FOR %s@%s',(username,'%'))
            config={**connection_config(),'user':username,'password':password}
            with pymysql.connect(**config) as runtime:
                meal,revision=call(runtime,'mvp_create_meal',1,1,'2026-10-05 17:00:00','Asia/Taipei','lunch',None)
                call(runtime,'mvp_mutate_meal',meal,1,revision,'add_item','{"food_id":1}',None)
                data={'weight':70,'calories':2800,'proteinKg':1.6,'fatUnit':'kg','fatValue':1,'carbMinimum':6,'training':'訓練日','manual':False}
                call(runtime,'mvp_save_daily_plan',1,2,'2035-02-01',0,json.dumps(data),0,None)
                for sql in ('DELETE FROM MealRevision','UPDATE AthleteDailyNutritionPlan SET revision=99','CALL mvp_capture_meal(1,@x)','SELECT password_hash FROM Account','CALL mvp_start_analysis(1)'):
                    with runtime.cursor() as c:
                        with self.assertRaises(pymysql.MySQLError) as e: c.execute(sql)
                        self.assertIn(e.exception.args[0],(1142,1143,1370))
            with db.cursor() as c:
                c.execute('REVOKE '+api_role+' FROM %s@%s',(username,'%'))
                c.execute('GRANT '+worker_role+' TO %s@%s',(username,'%'))
                c.execute('SET DEFAULT ROLE '+worker_role+' FOR %s@%s',(username,'%'))
            aid=call(db,'mvp_mutate_meal',meal,1,revision+1,'queue_analysis','{"model_name":"permissions fixture"}',None)[2]
            with pymysql.connect(**config) as worker:
                call(worker,'mvp_start_analysis',aid)
                call(worker,'mvp_finish_analysis',aid,'succeeded','{"items":[]}',None)
                for sql in ('DELETE FROM MealAnalysis','DELETE FROM MealRevision','CALL mvp_capture_meal(1,@x)','CALL mvp_create_meal(1,1,NOW(),\'UTC\',\'lunch\',NULL)'):
                    with worker.cursor() as c:
                        with self.assertRaises(pymysql.MySQLError) as e: c.execute(sql)
                        self.assertIn(e.exception.args[0],(1142,1143,1370))
        finally:
            with db.cursor() as c:
                if user_created: c.execute('DROP USER IF EXISTS %s@%s',(username,'%'))
                if roles_attempted: c.execute('DROP ROLE IF EXISTS '+api_role+','+worker_role)
            db.close()
