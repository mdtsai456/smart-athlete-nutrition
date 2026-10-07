"""Offline artifact consistency checks. Not a MariaDB syntax/runtime validator."""
import ast
import re
from pathlib import Path
from build_erd import parse,dbml,dot

ROOT=Path(__file__).resolve().parents[1]
tables,refs=parse((ROOT/'athlete_nutrition_schema.sql').read_text(encoding='utf-8'))
assert len(tables)==18 and len(refs)==30
assert (ROOT/'athlete_nutrition_erd.dbml').read_text(encoding='utf-8')==dbml(tables,refs)
for suffix,overview in [('',False),('_overview',True)]:
 assert (ROOT/'erd'/('athlete_nutrition_v10_erd'+suffix+'.dot')).read_text(encoding='utf-8')==dot(tables,refs,overview)
 for ext in ('svg','png','pdf'):
  path=ROOT/'erd'/('athlete_nutrition_v10_erd'+suffix+'.'+ext)
  assert path.exists() and path.stat().st_size>0,path
mermaid=(ROOT/'erd/full_erd.md').read_text(encoding='utf-8')
assert sum('--' in line for line in mermaid.splitlines())==len(refs)
dictionary=(ROOT/'column_dictionary.md').read_text(encoding='utf-8')
reviewed=0
for name,t in tables.items():
 assert '## '+name+'\n' in dictionary
 section=dictionary.split('## '+name+'\n',1)[1].split('\n## ',1)[0]
 for col in t['columns']:
  assert re.match(r'^[a-z][a-z0-9_]*$',col),col
  rows=[line for line in section.splitlines() if line.startswith('| `'+col+'` |')]
  assert len(rows)==1,(name,col)
  cells=rows[0].strip('|').split('|')
  assert len(cells)==7 and all(cell.strip() for cell in cells),(name,col,'Incomplete field review')
  reviewed+=1
assert reviewed==169
paths=list((ROOT/'tools').glob('*.py'))+list((ROOT/'tests').glob('*.py'))
for path in paths:ast.parse(path.read_text(encoding='utf-8'),filename=str(path))
sql=(ROOT/'athlete_nutrition_schema.sql').read_text(encoding='utf-8')
public=set(re.findall(r'GRANT EXECUTE ON PROCEDURE `__DATABASE__`\.`(\w+)`',(ROOT/'permissions.sql').read_text(encoding='utf-8')))
assert public=={'mvp_create_meal','mvp_mutate_meal','mvp_save_meal','mvp_save_daily_plan','mvp_start_analysis','mvp_finish_analysis'}
assert public<=set(re.findall(r'CREATE PROCEDURE (\w+)',sql))
print(f'Offline consistency OK: {len(tables)} tables, {sum(len(t["columns"]) for t in tables.values())} fields, {len(refs)} FKs, {len(paths)} Python files, 6 granted commands. MariaDB runtime not checked.')
