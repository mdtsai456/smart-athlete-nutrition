"""Read-only server capability check; credentials only from environment."""
import pymysql
from test_schema import connection_config

with pymysql.connect(**connection_config(database=False)) as db:
 with db.cursor() as c:
  c.execute('SELECT VERSION(),@@log_bin,@@binlog_format')
  print('SERVER',c.fetchone())
  c.execute("SELECT CONVERT_TZ('2026-10-05 17:00:00','+00:00','Asia/Taipei')")
  print('IANA',c.fetchone())
  c.execute("SHOW STATUS LIKE 'Ssl_cipher'")
  print('TLS',c.fetchone())
  c.execute("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='zeabur'")
  print('Existing zeabur table count',c.fetchone()[0])
