"""Read-only DDL comparison on the configured database; never rebuilds it."""
import json
from pathlib import Path
import re
import sys

from test_schema import connect
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from build_erd import parse

def main():
    tables,refs=parse((ROOT/'athlete_nutrition_schema.sql').read_text(encoding='utf-8'))
    with connect() as db:
        with db.cursor() as c:
            c.execute('SELECT DATABASE(),VERSION()'); name,version=c.fetchone()
            c.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=%s AND TABLE_TYPE='BASE TABLE'",(name,))
            assert {r[0] for r in c.fetchall()}==set(tables),'Live tables differ from SQL'
            c.execute('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLLATION_NAME,IS_GENERATED,EXTRA,COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=%s',(name,))
            actual={(t,k):(kind,nullable,collation,generated,extra,default) for t,k,kind,nullable,collation,generated,extra,default in c.fetchall() if t in tables}
            assert len(actual)==sum(len(t['columns']) for t in tables.values())
            for table,data in tables.items():
                for col,d in data['columns'].items():
                    kind,nullable,collation,generated,extra,default=actual[table,col]
                    normalized=re.sub(r'^(bigint|int|tinyint)\(\d+\)',r'\1',kind)
                    expected=('longtext' if d['type']=='json' else d['type'])+(' unsigned' if d['unsigned'] else '')
                    assert normalized==expected,(table,col,normalized,expected)
                    assert (nullable=='NO')==d['required'],(table,col,nullable)
                    assert (generated=='ALWAYS')==d['generated'],(table,col,generated)
                    assert ('auto_increment' in extra.lower())==d['increment'],(table,col,extra)
                    if d['default'] is not None:assert str(default)==d['default'],(table,col,default)
                    else:assert default in (None,'NULL'),(table,col,default)
                    expected_collation=d['collation'] or ('utf8mb4_bin' if d['type']=='json' else 'utf8mb4_unicode_ci' if d['type'].startswith(('varchar','char','text')) else None)
                    assert collation==expected_collation,(table,col,collation,expected_collation)
            c.execute('SELECT k.TABLE_NAME,k.COLUMN_NAME,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=%s AND k.REFERENCED_TABLE_NAME IS NOT NULL',(name,))
            assert set(c.fetchall())=={(t,k,p,pk,delete or 'RESTRICT') for t,k,p,pk,delete in refs},'FK endpoints/delete rules differ'
            c.execute('SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=%s AND NON_UNIQUE=0 ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX',(name,))
            unique_indexes={}
            for t,index,col in c.fetchall():unique_indexes.setdefault((t,index),[]).append(col)
            actual_unique={(t,tuple(cols)) for (t,_),cols in unique_indexes.items()}
            expected_unique={(t,tuple(cols)) for t,data in tables.items() for cols,unique in data['indexes'] if unique}
            expected_unique|={(t,(col,)) for t,data in tables.items() for col,d in data['columns'].items() if d['primary'] or d['unique']}
            assert actual_unique==expected_unique,'PK/unique indexes differ'
            c.execute('SELECT CONSTRAINT_NAME FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=%s',(name,))
            actual_checks={r[0] for r in c.fetchall()}
            expected_checks={label for data in tables.values() for label,_ in data['checks']}
            assert expected_checks<=actual_checks,'Named CHECK constraints missing'
            print(json.dumps(dict(database=name,server_version=version,tables=len(tables),columns=len(actual),foreign_keys=len(refs),unique_indexes=len(actual_unique),named_checks=len(expected_checks),result='PASS: tables, column types/nullability/all collations/defaults/generated flags/auto_increment, FK endpoints/delete rules, PK/unique indexes and named CHECK presence match SQL'),ensure_ascii=False))

if __name__=='__main__':main()
