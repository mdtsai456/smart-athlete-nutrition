"""Create/drop isolated test databases; requires a test-only admin connection.

Normal: python tests/run_integration.py --schema athlete_nutrition_mariadb.sql
Optionally starts a local server with --server /path/to/mariadbd --datadir /test/data.
Never use the configured test database name for production data.
"""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import time
import unittest
import pymysql

ROOT = Path(__file__).resolve().parent.parent


def execute_file(db, path):
    delimiter, buf = ';', ''
    with db.cursor() as cur:
        for line in Path(path).read_text().splitlines():
            if line.startswith('DELIMITER '):
                delimiter = line.split()[1]
                continue
            if line.lstrip().startswith('--') or not line.strip():
                continue
            buf += line + '\n'
            if buf.rstrip().endswith(delimiter):
                cur.execute(buf.rstrip()[:-len(delimiter)])
                while cur.nextset():
                    pass
                buf = ''
        if buf.strip():
            raise ValueError('Unterminated SQL in ' + str(path))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--schema', default=str(ROOT / 'athlete_nutrition_mariadb.sql'))
    ap.add_argument('--server')
    ap.add_argument('--basedir')
    ap.add_argument('--datadir')
    ap.add_argument('--baseline', action='store_true')
    ap.add_argument('--pattern', default='test_*.py')
    args = ap.parse_args()
    name = os.environ.get('MVP_DB_NAME', 'mvp_test')
    if not name.startswith('mvp_test') or not name.replace('_', '').isalnum():
        raise ValueError('Destructive runner accepts mvp_test* database names only')
    config = dict(host=os.environ.get('MVP_DB_HOST', '127.0.0.1'),
                  port=int(os.environ.get('MVP_DB_PORT', '3307')),
                  user=os.environ.get('MVP_DB_USER', 'root'),
                  password=os.environ.get('MVP_DB_PASSWORD', ''), autocommit=True)
    server = None
    try:
        if args.server:
            log = open('/tmp/mvp-test-server.log', 'a')
            server = subprocess.Popen([args.server, '--no-defaults',
                '--basedir=' + args.basedir, '--datadir=' + args.datadir,
                '--user=' + str(os.getuid()), '--bind-address=127.0.0.1',
                '--port=' + str(config['port']), '--socket=',
                '--pid-file=' + args.datadir + '/test.pid',
                '--log-bin=' + args.datadir + '/binlog', '--binlog-format=ROW',
                '--log-bin-trust-function-creators=0'], stdout=log, stderr=log)
        deadline = time.monotonic() + 15
        while True:
            try:
                db = pymysql.connect(**config)
                break
            except pymysql.MySQLError:
                if time.monotonic() > deadline:
                    raise
                time.sleep(.1)
        with db.cursor() as cur:
            cur.execute('SELECT VERSION(),@@log_bin,@@binlog_format')
            print('SERVER', cur.fetchone(), flush=True)
            cur.execute('SELECT COUNT(*) FROM mysql.time_zone_name')
            if cur.fetchone()[0] == 0 and args.server:
                tzsql = subprocess.check_output([args.basedir + '/bin/mariadb-tzinfo-to-sql', '/usr/share/zoneinfo'], stderr=subprocess.DEVNULL)
                # The official client reads tz import SQL, including multi-line statements.
                subprocess.run([args.basedir + '/bin/mariadb','--no-defaults',
                    '--protocol=tcp','-h127.0.0.1','-P' + str(config['port']),
                    '-uroot','mysql'], input=tzsql, check=True, stderr=subprocess.DEVNULL)
            cur.execute('DROP DATABASE IF EXISTS `' + name + '`')
            cur.execute('CREATE DATABASE `' + name + '`')
        db.select_db(name)
        execute_file(db, args.schema)
        execute_file(db, ROOT / 'tests/fixtures.sql')
        db.close()
        sys.path.insert(0, str(ROOT))
        pattern = 'test_schema.py' if args.baseline else args.pattern
        suite = unittest.defaultTestLoader.discover(str(ROOT / 'tests'), pattern=pattern)
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        return 0 if result.wasSuccessful() else 1
    finally:
        if server:
            server.terminate()
            server.wait(timeout=15)


if __name__ == '__main__':
    raise SystemExit(main())
