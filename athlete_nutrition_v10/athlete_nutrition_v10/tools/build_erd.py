"""Generate DBML, full DOT and overview DOT from this package's SQL DDL.

Supports the deliberately uniform CREATE/ALTER syntax in this package;
fails on missing columns/targets rather than generating a partial diagram.
Does not validate stored-routine execution or MariaDB CHECK semantics.
"""
from pathlib import Path
import html
import re

ROOT=Path(__file__).resolve().parents[1]

def parse(sql):
    tables={}
    for name,body in re.findall(r'CREATE TABLE `?(\w+)`?\s*\((.*?)\)\s*ENGINE=',sql,re.S):
        columns={}
        for line in body.splitlines():
            match=re.match(r'\s*`(\w+)`\s+(\w+(?:\([^)]*\))?)(.*)',line)
            if match:
                key,kind,extra=match.groups()
                columns[key]=dict(type=kind.lower(),required='NOT NULL' in extra or 'PRIMARY KEY' in extra,
                                  primary='PRIMARY KEY' in extra,increment='AUTO_INCREMENT' in extra,
                                  unique='UNIQUE' in extra,generated='GENERATED' in extra,unsigned='unsigned' in extra.lower(),
                                  collation=(re.search(r'COLLATE\s+(\w+)',extra,re.I) or [None,None])[1],
                                  default=(re.search(r'\bDEFAULT\s+(NULL|\d+|\x27[^\x27]*\x27)',extra) or [None,None])[1])
        checks=re.findall(r'CONSTRAINT `?(\w+)`? CHECK\s*\((.*?)\)(?:,?\s*\n|\s*$)',body,re.S)
        indexes=[]
        for unique,cols in re.findall(r'(UNIQUE )?KEY `?\w+`?\s*\(([^)]+)\)',body):
            indexes.append(([c.strip().strip('`') for c in cols.split(',')],bool(unique)))
        tables[name]=dict(columns=columns,checks=checks,indexes=indexes)
    for table,body in re.findall(r'ALTER TABLE `?(\w+)`?\s+(.*?);',sql,re.S):
        for name,kind,extra in re.findall(r'ADD COLUMN\s+(\w+)\s+(\w+(?:\([^)]*\))?)(.*?)(?=,\s*ADD|$)',body,re.S):
            tables[table]['columns'][name]=dict(type=kind.lower(),required='NOT NULL' in extra,primary=False,
                increment=False,unique=False,generated='GENERATED' in extra,unsigned='unsigned' in extra.lower(),collation=None,default=None)
        for unique,cols in re.findall(r'ADD (UNIQUE )?KEY \w+\s*\(([^)]+)\)',body):
            tables[table]['indexes'].append(([c.strip().strip('`') for c in cols.split(',')],bool(unique)))
    refs=[]
    for table,col,target,key,delete in re.findall(r'ALTER TABLE `?(\w+)`? ADD CONSTRAINT `?\w+`? FOREIGN KEY\s*\(`?(\w+)`?\) REFERENCES `?(\w+)`?\s*\(`?(\w+)`?\)(?: ON DELETE (CASCADE|RESTRICT|SET NULL))?',sql):
        if table not in tables or col not in tables[table]['columns'] or target not in tables or key not in tables[target]['columns']:
            raise ValueError('Dangling FK: '+str((table,col,target,key)))
        refs.append((table,col,target,key,delete))
    if not tables: raise ValueError('No tables found')
    return tables,refs

def dbml(tables,refs):
    out=['// Generated from athlete_nutrition_schema.sql by tools/build_erd.py.',
         '// SQL is canonical. Routine/trigger authorization and transaction rules are in SQL/production_guide.md.',
         '// Account is the common identity. Coach and Nutritionist are role-specific profiles.',
         '// Daily plan input_json is the original F2e form; final targets are separate calculated values.','']
    for name,table in tables.items():
        out.append('Table '+name+' {')
        for col,data in table['columns'].items():
            opts=[]
            for key,label in [('primary','pk'),('increment','increment'),('required','not null'),('unique','unique')]:
                if data[key]:opts.append(label)
            if data['default'] is not None:opts.append('default: '+data['default'])
            if data['generated']:opts.append("note: 'Generated PERSISTENT; expression in SQL'")
            if data['unsigned']:opts.append("note: 'SQL UNSIGNED'")
            if data['collation']:opts.append("note: 'SQL collation: "+data['collation']+"'")
            kind=data['type']
            if kind=='json':opts.append("note: 'MariaDB JSON with JSON_VALID; business validation in commands'")
            out.append('  '+col+' '+kind+(' ['+', '.join(opts)+']' if opts else ''))
        if table['indexes']:
            out.append('  indexes {')
            for cols,unique in table['indexes']:
                out.append('    ('+', '.join(cols)+')'+(' [unique]' if unique else ''))
            out.append('  }')
        if table['checks']:
            out.append('  checks {')
            for label,expr in table['checks']:
                out.append('    `'+expr.strip().replace('\n',' ')+'` [name: \''+label+"']")
            out.append('  }')
        out.extend(['}',''])
    for table,col,target,key,delete in refs:
        out.append(f'Ref: {table}.{col} > {target}.{key}'+(' [delete: '+delete.lower()+']' if delete else ''))
    return '\n'.join(out)+'\n'

def dot(tables,refs,overview=False):
    fk={(t,c) for t,c,_,_,_ in refs}
    targets={(t,c) for _,_,t,c,_ in refs}
    out=['digraph ERD {','graph [rankdir=LR, bgcolor="white", nodesep=0.35, ranksep=1.0, label="Athlete nutrition v10 | 18 tables", labelloc=t, fontsize=24];',
         'node [shape=plain, fontname="Arial"];','edge [color="#64748b", arrowsize=0.7, fontname="Arial", fontsize=9];']
    for name,table in tables.items():
        color='#1d4ed8' if name in ('Organization','Account','Athlete','Coach','Nutritionist','AthleteCoach') else '#0f766e'
        rows=[f'<TR><TD COLSPAN="3" BGCOLOR="{color}"><FONT COLOR="white"><B>{name}</B></FONT></TD></TR>']
        for col,data in table['columns'].items():
            if overview and not(data['primary'] or (name,col) in fk or (name,col) in targets):continue
            flags=('PK ' if data['primary'] else '')+('FK ' if (name,col) in fk else '')+('UQ ' if data['unique'] else '')+('G' if data['generated'] else '')
            kind=data['type']+(' unsigned' if data['unsigned'] else '')+(' NN' if data['required'] else '')
            rows.append(f'<TR><TD ALIGN="LEFT">{flags or "&#160;"}</TD><TD PORT="{col}" ALIGN="LEFT">{col}</TD><TD ALIGN="LEFT">{html.escape(kind)}</TD></TR>')
        out.append(f'"{name}" [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" COLOR="{color}">'+''.join(rows)+'</TABLE>>];')
    for table,col,target,key,delete in refs:
        nullable=not tables[table]['columns'][col]['required']
        unique=tables[table]['columns'][col]['unique'] or tables[table]['columns'][col]['primary']
        # Child -> parent, labels show permitted counts, avoiding fake staff FKs.
        out.append(f'"{table}":e -> "{target}":w [taillabel="{("0..1" if unique else "0..*")}", headlabel="{("0..1" if nullable else "1")}", labeldistance=2, tooltip="{table}.{col} -> {target}.{key}; delete={delete or "RESTRICT"}"];')
    out.append('}')
    return '\n'.join(out)+'\n'

def main():
    tables,refs=parse((ROOT/'athlete_nutrition_schema.sql').read_text(encoding='utf-8'))
    (ROOT/'athlete_nutrition_erd.dbml').write_text(dbml(tables,refs),encoding='utf-8')
    for suffix,overview in [('',False),('_overview',True)]:
        (ROOT/'erd'/('athlete_nutrition_v10_erd'+suffix+'.dot')).write_text(dot(tables,refs,overview),encoding='utf-8')
    print(f'Generated {len(tables)} tables, {sum(len(t["columns"]) for t in tables.values())} columns, {len(refs)} foreign keys')

if __name__=='__main__': main()
