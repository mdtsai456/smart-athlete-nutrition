"""Disposable server only. No automatic database download/install/start."""
import argparse
import os
from pathlib import Path
import sys
import unittest
import pymysql
from test_schema import connection_config

ROOT=Path(__file__).resolve().parents[1]

def execute_file(db,path):
    delimiter,buf=';',''
    with db.cursor() as cur:
        for line in Path(path).read_text(encoding='utf-8').splitlines():
            if line.startswith('DELIMITER '): delimiter=line.split()[1]; continue
            if not line.strip() or line.lstrip().startswith('--'): continue
            buf+=line+'\n'
            if buf.rstrip().endswith(delimiter):
                cur.execute(buf.rstrip()[:-len(delimiter)])
                while cur.nextset(): pass
                buf=''
        if buf.strip(): raise ValueError('Unterminated SQL in '+str(path))

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--pattern',default='test_integration.py')
    parser.add_argument('--reset',action='store_true',help='Explicitly rebuild only your disposable test database')
    args=parser.parse_args()
    name=os.environ.setdefault('MVP_DB_NAME','mvp_test_v10')
    if not name.startswith('mvp_test') or not name.replace('_','').isalnum():
        raise ValueError('Only disposable mvp_test* database names are accepted')
    config=connection_config(database=False)
    with pymysql.connect(**config) as db:
        with db.cursor() as c:
            c.execute("SELECT VERSION(),@@log_bin,@@binlog_format,CONVERT_TZ('2026-10-05 17:00:00','+00:00','Asia/Taipei')")
            result=c.fetchone()
            print('SERVER',result,flush=True)
            if result[3] is None: raise RuntimeError('Load IANA timezone tables first')
            c.execute('SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=%s',(name,))
            if c.fetchone()[0]:
                if not args.reset: raise RuntimeError('Test database already exists; choose a fresh name or explicitly --reset your own test database')
                c.execute('DROP DATABASE `'+name+'`')
            c.execute('CREATE DATABASE `'+name+'`')
        db.select_db(name)
        execute_file(db,ROOT/'athlete_nutrition_schema.sql')
        execute_file(db,ROOT/'tests/fixtures.sql')
    sys.path.insert(0,str(ROOT/'tests'))
    suite=unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern=args.pattern)
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1

if __name__=='__main__': raise SystemExit(main())
