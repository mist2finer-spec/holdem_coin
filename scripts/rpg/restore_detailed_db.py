"""Build a private queryable database from an existing decoded audited-build export.

No device, credentials, game server, random rolls or live-save mutations. Original
raw tables and generated database must stay outside the public Git repository.
"""
import argparse,csv,hashlib,json,sqlite3
from pathlib import Path
from reference_progression import combat_art_value,trait_value,skill_hold_values,skill_parameters,evaluate_growth


def js(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def pointer(value):return str(value).replace('~','~0').replace('/','~1')

SCHEMA='''
PRAGMA foreign_keys=ON;
CREATE TABLE sources(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,document TEXT NOT NULL CHECK(json_valid(document)));
CREATE TABLE vectors(source TEXT REFERENCES sources(name),name TEXT,count INTEGER,PRIMARY KEY(source,name));
CREATE TABLE records(id TEXT PRIMARY KEY,source TEXT REFERENCES sources(name),vector TEXT,row_index INTEGER,identity TEXT NOT NULL,document TEXT NOT NULL CHECK(json_valid(document)));
CREATE INDEX record_lookup ON records(source,vector,row_index);
CREATE INDEX record_type ON records(source,vector,json_extract(document,'$.Type'));
CREATE TABLE enums(enum TEXT,value INTEGER,name TEXT,PRIMARY KEY(enum,value,name));
CREATE TABLE curves(owner TEXT REFERENCES records(id),path TEXT,minimum INTEGER,maximum INTEGER,document TEXT NOT NULL,PRIMARY KEY(owner,path));
CREATE TABLE abilities(owner TEXT REFERENCES records(id),path TEXT,ability INTEGER,name TEXT,context TEXT NOT NULL);
CREATE INDEX ability_lookup ON abilities(ability);
CREATE TABLE unresolved(owner TEXT REFERENCES records(id),path TEXT,field TEXT,kind TEXT,PRIMARY KEY(owner,path,field,kind));
CREATE TABLE conditions(owner TEXT REFERENCES records(id),path TEXT,type INTEGER,document TEXT NOT NULL);
CREATE TABLE relations(owner TEXT REFERENCES records(id),path TEXT,target_table TEXT,target_vector TEXT,target_field TEXT,target_value TEXT,matches INTEGER);
CREATE TABLE evidence(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,bytes INTEGER NOT NULL);
'''


def build(source,output,equipment=None,profile=None):
    if output.exists():raise ValueError('Choose a NEW output directory; existing recoveries are preserved')
    decoded=source/'decoded'
    if not decoded.is_dir():raise ValueError('Expected source/decoded directory')
    output.mkdir(parents=True);con=sqlite3.connect(output/'vardian-reference.sqlite');con.execute('PRAGMA journal_mode=MEMORY');con.executescript(SCHEMA)
    tables={};ids={};manifest={};counts={};relations=[];row_docs={}
    def record(name,vector,i,row):
        rid=f'{name}#/{pointer(vector)}/{i}'
        ident={k:row[k] for k in ['Type','ActorType','SkillType','StageId','Tier','Grade','Degree','Level','Star','Board','Group','Kind','Slot','MinLevel','MaxLevel','GrowthLevel','AwakenLevel'] if isinstance(row,dict) and k in row}
        con.execute('INSERT INTO records VALUES(?,?,?,?,?,?)',(rid,name,vector,i,js(ident),js(row)))
        return rid
    enum_file=source/'evidence/metadata-enums.json';enum_doc=json.loads(enum_file.read_text())
    ability_names={r['value']:r['name'] for r in enum_doc['enums']['BalanceData.ActorAbilityType']['entries']}
    for enum,doc in enum_doc['enums'].items():
        con.executemany('INSERT INTO enums VALUES(?,?,?)',[(enum,r['value'],r['name']) for r in doc['entries']])
    for path in sorted(decoded.glob('*.json')):
        doc=json.loads(path.read_text());name=path.stem
        if not isinstance(doc,dict):continue
        tables[name]=doc;manifest[name]={'sha256':digest(path),'bytes':path.stat().st_size}
        con.execute('INSERT INTO sources VALUES(?,?,?,?)',(name,manifest[name]['sha256'],manifest[name]['bytes'],js(doc)))
        root_id=record(name,'$root',0,doc);ids[(name,'$root')]=root_id
        for vector,rows in doc.items():
            if vector.startswith('_') or not isinstance(rows,list):continue
            con.execute('INSERT INTO vectors VALUES(?,?,?)',(name,vector,len(rows)))
            for i,row in enumerate(rows):
                rid=record(name,vector,i,row);ids[(name,'/'+pointer(vector)+'/'+str(i))]=rid
                if isinstance(row,dict):row_docs[rid]=row
    # Targets are built from explicitly declared DB keys, not similarly named enums.
    target_specs=[('ActorData','ActorDatas','ActorType'),('ActionData','ActionDatas','SkillType'),('SkillData','SkillDatas','Type'),('CombatArtData','CombatArtDatas','Type')]
    targets={}
    for name,vector,key in target_specs:
        target={}
        for i,row in enumerate(tables[name][vector]):target.setdefault(js(row[key]),[]).append(i)
        targets[(name,vector,key)]=target
    def link(owner,path,target,value):
        n=len(targets[target].get(js(value),[]));relations.append((owner,path,*target,js(value),n))
    def walk(name,value,path,owner):
        owner=ids.get((name,path),owner)
        if isinstance(value,list):
            for i,v in enumerate(value):walk(name,v,path+'/'+str(i),owner)
        elif isinstance(value,dict):
            if value.get('_schema')=='QuadFuncData':
                con.execute('INSERT INTO curves VALUES(?,?,?,?,?)',(owner,path,value['MinLevel'],value['MaxLevel'],js(value)))
            if value.get('_schema')=='ConditionData':
                con.execute('INSERT INTO conditions VALUES(?,?,?,?)',(owner,path,value.get('Type'),js(value)))
            for field in value.get('_absentDefaultsUnresolved',[]):con.execute('INSERT INTO unresolved VALUES(?,?,?,?)',(owner,path,field,'absent-default-unresolved'))
            for key,v in value.items():
                if key.startswith('_'):continue
                if key.endswith('AbilType') and type(v) is int:
                    con.execute('INSERT INTO abilities VALUES(?,?,?,?,?)',(owner,path+'/'+pointer(key),v,ability_names.get(v),js(value)))
                if key.endswith('AbilTypes') and isinstance(v,list):
                    con.executemany('INSERT INTO abilities VALUES(?,?,?,?,?)',[(owner,path+'/'+pointer(key)+'/'+str(i),a,ability_names.get(a),js(value)) for i,a in enumerate(v)])
                if name=='WeaponData' and key in ['ActorTypeM','ActorTypeF']:
                    link(owner,path+'/'+key,('ActorData','ActorDatas','ActorType'),v)
                if name=='ActorData' and key=='SkillTypes' and isinstance(v,list):
                    for i,a in enumerate(v):link(owner,path+'/'+key+'/'+str(i),('ActionData','ActionDatas','SkillType'),a)
                if name=='SkillData' and value.get('_schema')=='SkillData' and key=='Type':
                    link(owner,path+'/'+key,('ActionData','ActionDatas','SkillType'),v)
                if name=='CombatArtData' and key=='ReqType' and v:
                    link(owner,path+'/'+key,('CombatArtData','CombatArtDatas','Type'),v)
                walk(name,v,path+'/'+pointer(key),owner)
    for name,doc in tables.items():walk(name,doc,'',ids[(name,'$root')])
    stages=decoded/'stages.jsonl';stage_count=0
    if stages.exists():
        con.execute('INSERT INTO sources VALUES(?,?,?,?)',('StageData.pack',digest(stages),stages.stat().st_size,js({'format':'jsonl','hasSeparateRecordDocuments':True})))
        with stages.open() as f:
            for i,line in enumerate(f):
                row=json.loads(line);rid=record('StageData.pack','Stages',i,row);stage_count+=1
                walk('StageData.pack',row,'/Stages/'+str(i),rid)
                for j,monster in enumerate(row['data'].get('MonsterDatas',[])):
                    link(rid,f'/data/MonsterDatas/{j}/MonsterType',('ActorData','ActorDatas','ActorType'),monster['MonsterType'])
        con.execute('INSERT INTO vectors VALUES(?,?,?)',('StageData.pack','Stages',stage_count))
        manifest['StageData.pack']={'sha256':digest(stages),'bytes':stages.stat().st_size}
    con.executemany('INSERT INTO relations VALUES(?,?,?,?,?,?,?)',relations)
    for p in sorted((source/'evidence').glob('*')):
        if p.is_file():con.execute('INSERT INTO evidence VALUES(?,?,?)',(p.name,digest(p),p.stat().st_size))
    con.commit()
    if con.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or con.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('SQLite integrity failure')
    for table in ['sources','vectors','records','curves','abilities','conditions','unresolved','relations','enums','evidence']:
        counts[table]=con.execute('SELECT count(*) FROM '+table).fetchone()[0]
    # Re-read stored documents and compare the exact decoded JSON values, not counts.
    roundtrips=0
    for name,doc in tables.items():
        if json.loads(con.execute('SELECT document FROM sources WHERE name=?',(name,)).fetchone()[0])!=doc:raise AssertionError('Source changed during indexing')
        roundtrips+=1
    exports=output/'evaluated';exports.mkdir()
    with (exports/'combat-art-and-trait-all-levels.csv').open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.writer(f);writer.writerow(['system','type','tier_or_board','level','maxLevel','ability','value'])
        growth_rows=0
        for table,key,fn in [('CombatArtData','CombatArtDatas',combat_art_value),('TraitData','TraitDatas',trait_value)]:
            for row in tables[table][key]:
                for lv in range(row['MaxLevel']+1):
                    writer.writerow([table,row['Type'],row.get('Tier',row.get('Board')),lv,row['MaxLevel'],row['AbilType'],format(fn(row,lv),'.17g')]);growth_rows+=1
    skill_rows=0
    with (exports/'skills-all-learnable-levels.jsonl').open('w') as f:
        data=tables['SkillData'];grades={g['Grade']:g for g in data['SkillGradeDatas']}
        for row in data['SkillDatas']:
            if row['Grade'] not in grades:continue  # grade0 belongs to other subsystems
            for lv in range(1,grades[row['Grade']]['MaxLevel']+1):
                f.write(js({'type':row['Type'],'grade':row['Grade'],'level':lv,'hold':skill_hold_values(row,lv),'parameters':skill_parameters(row,lv)})+'\n');skill_rows+=1
    with (output/'vectors.csv').open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.writer(f);w.writerow(['source','vector','rows']);w.writerows(con.execute('SELECT * FROM vectors ORDER BY source,name'))
    # Export issues as structured rows; unsupported values do not become zero/None.
    with (output/'reference-gaps.csv').open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.writer(f);w.writerow(['owner','path','target_table','target_vector','target_field','target_value','matches']);w.writerows(con.execute('SELECT * FROM relations WHERE matches=0'))
    result={'schemaVersion':1,'sourceBuild':'user supplied installed label1.21.1 / audited native hash','sourceHashes':manifest,'counts':counts,'stages':stage_count,'roundtripTables':roundtrips,
            'evaluatedGrowthRows':growth_rows,'evaluatedLearnableSkillRows':skill_rows,'unmatchedReferenceRows':con.execute('SELECT count(*) FROM relations WHERE matches=0').fetchone()[0],
            'status':'STATIC_DATA_INDEX_AND_NUMERIC_SUBSET_RESTORED','wholeGameRestored':False,
            'pending':['StringData_23 display strings','ChatForbiddenWords','full actor effect and HP damage pipeline','server purchase/combination RNG','original trait adjacency purchase rules','grade-zero skill owning-system mapping','web migration of all growth systems']}
    if equipment and profile:
        fields=json.loads((equipment/'actor-ability-fields.json').read_text());runtime={r['name'].casefold():r['name'] for r in fields if r['name']!='Null'}
        mapping={a:runtime[name.casefold()] for a,name in ability_names.items() if name.casefold() in runtime}
        evaluated=evaluate_growth(tables,json.loads(profile.read_text()),mapping,json.loads((equipment/'stat-plans.json').read_text()))
        (output/'evaluated-profile.json').write_text(json.dumps(evaluated,ensure_ascii=False,indent=2))
    (output/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    con.close()
    check=sqlite3.connect((output/'vardian-reference.sqlite').resolve().as_uri()+'?mode=ro',uri=True)
    if check.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('Reopened database integrity failure')
    check.close();return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['source','output']:p.add_argument('--'+n,required=True,type=Path)
    p.add_argument('--equipment',type=Path);p.add_argument('--profile',type=Path)
    a=p.parse_args();r=build(a.source,a.output,a.equipment,a.profile);print(js({k:v for k,v in r.items() if k!='sourceHashes'}))
