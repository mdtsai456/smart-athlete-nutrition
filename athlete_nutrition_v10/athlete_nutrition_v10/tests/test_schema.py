"""Connections only; behavioral tests are in test_integration.py."""
import os
import pymysql

def connection_config(database=True):
    config=dict(host=os.environ.get('MVP_DB_HOST','127.0.0.1'),
        port=int(os.environ.get('MVP_DB_PORT','3307')),user=os.environ.get('MVP_DB_USER','root'),
        password=os.environ.get('MVP_DB_PASSWORD',''),autocommit=True,charset='utf8mb4',
        connect_timeout=10,read_timeout=30,write_timeout=30)
    if database: config['database']=os.environ.get('MVP_DB_NAME','mvp_test_v10')
    if os.environ.get('MVP_DB_TLS')=='1': config['ssl']={'check_hostname':False}
    return config

def connect(): return pymysql.connect(**connection_config())

def call(db,name,*args):
    with db.cursor() as c:
        c.execute('CALL '+name+'('+','.join(['%s']*len(args))+')',args)
        result=c.fetchone() if c.description else None
        while c.nextset(): pass
        return result
