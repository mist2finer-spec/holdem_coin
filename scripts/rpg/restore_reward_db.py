"""Restore exact acquisition curves and reward definitions into private SQLite.
Raw source tables stay outside git; all queryable references retain provenance.
"""
import argparse,collections,csv,hashlib,json,sqlite3
from pathlib import Path
from reference_rewards import CHAPTER_MATERIALS,amount

SCHEMA='''
PRAGMA foreign_keys=ON;
CREATE TABLE sources(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,document TEXT NOT NULL CHECK(json_valid(document)));
CREATE TABLE materials(id INTEGER PRIMARY KEY,name TEXT,icon TEXT,max_count TEXT,max_recharge TEXT,definition TEXT NOT NULL);
CREATE TABLE chapter_baselines(chapter INTEGER NOT NULL,material_id INTEGER REFERENCES materials(id),amount TEXT NOT NULL,source_vector TEXT NOT NULL,PRIMARY KEY(chapter,material_id));
CREATE TABLE stages(category TEXT NOT NULL,stage_id INTEGER NOT NULL,map_type INTEGER,definition TEXT NOT NULL,PRIMARY KEY(category,stage_id));
CREATE TABLE reward_groups(category TEXT,stage_id INTEGER,group_no INTEGER,method INTEGER,n_times INTEGER,vector_present INTEGER,definition TEXT NOT NULL,PRIMARY KEY(category,stage_id,group_no),FOREIGN KEY(category,stage_id) REFERENCES stages(category,stage_id));
CREATE TABLE reward_entries(category TEXT,stage_id INTEGER,group_no INTEGER,row_no INTEGER,reward_category INTEGER,reward_type INTEGER,amount TEXT,min_amount TEXT,ref_idle INTEGER,chance INTEGER,definition TEXT NOT NULL,PRIMARY KEY(category,stage_id,group_no,row_no),FOREIGN KEY(category,stage_id,group_no) REFERENCES reward_groups(category,stage_id,group_no));
CREATE INDEX reward_material_lookup ON reward_entries(reward_category,reward_type);
CREATE TABLE progress_rewards(chapter INTEGER PRIMARY KEY,start_stage INTEGER,end_stage INTEGER,crystals TEXT,definition TEXT NOT NULL);
CREATE TABLE hunting_events(id INTEGER PRIMARY KEY,event_type INTEGER,definition TEXT NOT NULL);
CREATE TABLE timing_settings(name TEXT PRIMARY KEY,value INTEGER,unit TEXT NOT NULL);
CREATE TABLE unresolved(owner TEXT,reason TEXT NOT NULL,detail TEXT NOT NULL);
'''
def js(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'))
def build(source,output):
 if output.exists():raise FileExistsError('Choose a new output directory')
 output.mkdir(parents=True);db=sqlite3.connect(output/'vardian-rewards.sqlite');db.executescript(SCHEMA)
 tables={};hashes={}
 for name in ['LabyrinthData','MaterialData','HuntingData']:
  p=source/(name+'.json');raw=p.read_bytes();tables[name]=json.loads(raw);hashes[name]=hashlib.sha256(raw).hexdigest();db.execute('INSERT INTO sources VALUES(?,?,?)',(name,hashes[name],js(tables[name])))
 enum_path=source.parent/'evidence/metadata-enums.json';names={r['value']:r['name'] for r in json.loads(enum_path.read_text())['enums']['BalanceData.MaterialType']['entries']}
 for m in tables['MaterialData']['MaterialDatas']:
  db.execute('INSERT INTO materials VALUES(?,?,?,?,?,?)',(m['Type'],names.get(m['Type']),m['IconKey'],str(amount(m['MaxCount'])),str(amount(m['MaxRechargeCount'])),js(m)))
 labyrinth=tables['LabyrinthData'];checkpoints=[]
 with (output/'chapter-acquisition-curves.csv').open('w',newline='',encoding='utf-8-sig') as f:
  w=csv.writer(f);w.writerow(['chapter','material_id','material_name','base_amount','source_vector'])
  for vector,material in CHAPTER_MATERIALS.items():
   for i,v in enumerate(labyrinth[vector],1):
    n=str(amount(v));db.execute('INSERT INTO chapter_baselines VALUES(?,?,?,?)',(i,material,n,vector));w.writerow([i,material,names.get(material),n,vector])
 for i,r in enumerate(labyrinth['LabyrinthProgressRewardDatas'],1):db.execute('INSERT INTO progress_rewards VALUES(?,?,?,?,?)',(i,r['StartStageId'],r['EndStageId'],str(amount(r['CrystalReward'])),js(r)))
 for key in ['IdleRewardTimeInterval','IdleRewardMaxTime','IdleRewardBadgeTime','IdleRewardBonusMaxTime','IdleRewardPushDelayStacked','IdleRewardPushDelayFull','IdleRewardFxTime1','IdleRewardFxTime2']:
  db.execute('INSERT INTO timing_settings VALUES(?,?,?)',(key,labyrinth[key],'milliseconds'))
 db.execute('INSERT INTO timing_settings VALUES(?,?,?)',('IdleRewardBonusMaxCnt',labyrinth['IdleRewardBonusMaxCnt'],'count'))
 for row in tables['HuntingData']['HuntingEventDatas']:db.execute('INSERT INTO hunting_events VALUES(?,?,?)',(row['Type'],row['EventType'],js(row)))
 stage_path=source/'stages.jsonl';stage_hash=hashlib.sha256(stage_path.read_bytes()).hexdigest();hashes['stages']=stage_hash;categories=collections.Counter()
 with stage_path.open(encoding='utf-8') as stage_file:
  for line in stage_file:
   s=json.loads(line);category=s['category'];sid=s['stageId'];d=s['data'];categories[category]+=1
   db.execute('INSERT INTO stages VALUES(?,?,?,?)',(category,sid,d.get('MapType'),js(d)))
   for group_no in range(1,5):
    key=f'RewardGroup{group_no}Data'
    if key not in d:continue
    g=d[key];db.execute('INSERT INTO reward_groups VALUES(?,?,?,?,?,?,?)',(category,sid,group_no,g['Method'],g.get('NTimes'),int('RewardDatas' in g),js(g)))
    for i,r in enumerate(g.get('RewardDatas',[])):
     db.execute('INSERT INTO reward_entries VALUES(?,?,?,?,?,?,?,?,?,?,?)',(category,sid,group_no,i,r['RewardCategoryType'],r['RewardType'],str(amount(r['RewardCnt'])),str(amount(r['RewardMin'])),int(r['RefIdleCurChapter']),r['Chance'],js(r)))
 for reason in ['RewardGroup1..4 event routing not yet proven for every mode','PickEach/PickNTimes probability and replacement policy need original server evidence','RefIdleCurChapter amount scaling not inferred','Idle interval does not prove baseline reward per tick','Source MaxCount zero is preserved, not interpreted as a zero-cap wallet']:
  db.execute('INSERT INTO unresolved VALUES(?,?,?)',('policy',reason,'source values indexed; live grants not silently inferred'))
 db.commit()
 if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('Reward DB integrity failure')
 for name,doc in tables.items():
  if json.loads(db.execute('SELECT document FROM sources WHERE name=?',(name,)).fetchone()[0])!=doc:raise AssertionError('Lossy source roundtrip')
 counts={t:db.execute('SELECT count(*) FROM '+t).fetchone()[0] for t in ['materials','chapter_baselines','stages','reward_groups','reward_entries','progress_rewards','hunting_events','timing_settings','unresolved']}
 for chapter in [1,10,100,500,1200]:checkpoints.append({'chapter':chapter,'amounts':dict(db.execute('SELECT material_id,amount FROM chapter_baselines WHERE chapter=? ORDER BY material_id',(chapter,)))})
 result={'sourceHashes':hashes,'counts':counts,'stageCategories':dict(categories),'checkpoints':checkpoints,'status':'EXACT_STATIC_REWARD_DB_RESTORED_RUNTIME_POLICY_PARTIAL','wholeEconomyRestored':False,'maxGoldBaseline':db.execute('SELECT amount FROM chapter_baselines WHERE material_id=1 ORDER BY chapter DESC LIMIT 1').fetchone()[0],'webWalletCapConflict':'Existing web cap 1e12 truncates the chapter1200 gold baseline; use exact decimal wallet before enabling this curve live.'}
 db.close();(output/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();print(js(build(a.source,a.output)))
