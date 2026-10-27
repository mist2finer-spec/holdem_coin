"""Restore queryable native interpolation/preview with explicit server-policy gaps."""
import argparse,collections,hashlib,json,sqlite3,struct
from pathlib import Path
from reference_reward_scaling import stage_base_reward,hunting_table_preview
from reference_rewards import CHAPTER_MATERIALS
HASH='fb3c0eb9ea7c067aa24fa8d7ce6a2f1433dbfe82f3dfc13b9dfc12933c567901'

def audit_metadata(path):
 b=path.read_bytes()
 if hashlib.sha256(b).hexdigest()!=HASH:raise ValueError('Audited metadata build required')
 if struct.unpack_from('<II',b)!=(0xfab11baf,39):raise ValueError('Unsupported metadata')
 sec=[struct.unpack_from('<III',b,8+i*12) for i in range(31)]
 for offset,size,count in sec:
  if offset+size>len(b):raise ValueError('Bad metadata section')
 strings,methods,types=[sec[i] for i in [2,5,19]]
 if methods[1]!=30*methods[2] or types[1]!=76*types[2]:raise ValueError('Metadata layout mismatch')
 pool=b[strings[0]:strings[0]+strings[1]]
 def name(i):return pool[i:pool.index(0,i)].decode('utf-8')
 wanted={'BalanceDataManager','RewardGroupData','RandomUtil','BigIntData','PcgRandom'};result=[]
 for i in range(types[2]):
  p=types[0]+76*i;type_name=name(struct.unpack_from('<I',b,p)[0])
  if type_name not in wanted:continue
  start=struct.unpack_from('<i',b,p+24)[0];count=struct.unpack_from('<H',b,p+52)[0]
  if start<0 or start+count>methods[2]:raise ValueError('Invalid method range')
  rows=[]
  for index in range(start,start+count):
   method=name(struct.unpack_from('<I',b,methods[0]+30*index)[0])
   if type_name=='BalanceDataManager' and not any(x in method for x in ['IdleReward','HuntingEvent','HuntingStageReward','StageDataCount']):continue
   rows.append({'metadataMethodIndex':index,'name':method})
  result.append({'typeIndex':i,'typeName':type_name,'methods':rows})
 return {'sha256':HASH,'scope':'Relevant client metadata types; absence of a named sampler is not proof of server implementation','types':result}

def restore(source,metadata,output):
 if output.exists():raise FileExistsError('Choose a new output directory')
 lab_path=source/'LabyrinthData.json';hunt_path=source/'HuntingData.json';stage_path=source/'stages.jsonl'
 lab=json.loads(lab_path.read_text());hunt=json.loads(hunt_path.read_text());chapters=collections.defaultdict(list)
 with stage_path.open(encoding='utf-8') as stage_file:
  for line in stage_file:
   row=json.loads(line)
   if row['category']=='Labyrinth':
    sid=row['stageId'];chapters[sid//100].append(sid%100)
 for chapter,stages in chapters.items():
  if sorted(stages)!=list(range(1,len(stages)+1)):raise ValueError('Stage IDs not contiguous; do not infer stage count')
 audit=audit_metadata(metadata);output.mkdir(parents=True);db=sqlite3.connect(output/'vardian-reward-policy.sqlite')
 db.executescript('''CREATE TABLE provenance(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL);
 CREATE TABLE interpolated_idle_bases(chapter INTEGER,stage INTEGER,material INTEGER,amount TEXT,PRIMARY KEY(chapter,stage,material));
 CREATE TABLE hunting_preview(chapter INTEGER,stage INTEGER,material INTEGER,amount TEXT,points INTEGER,PRIMARY KEY(chapter,stage,material));
 CREATE TABLE policy_boundaries(policy TEXT PRIMARY KEY,status TEXT,detail TEXT);''')
 for path in [lab_path,hunt_path,stage_path,metadata]:db.execute('INSERT INTO provenance VALUES(?,?)',(path.name,hashlib.sha256(path.read_bytes()).hexdigest()))
 counts=collections.Counter()
 for chapter,stages in sorted(chapters.items()):
  for stage in sorted(stages):
   for material in CHAPTER_MATERIALS.values():
    value=stage_base_reward(lab,chapter,stage,material,len(stages));db.execute('INSERT INTO interpolated_idle_bases VALUES(?,?,?,?)',(chapter,stage,material,str(int(value))));counts['interpolatedIdleBases']+=1
   for material,value in hunting_table_preview(lab,hunt,chapter,stage,len(stages)).items():
    db.execute('INSERT INTO hunting_preview VALUES(?,?,?,?,?)',(chapter,stage,material,str(int(value)),hunt['HuntingPopupRewardBasePoint']));counts['huntingPreviews']+=1
 boundaries=[('weighted-index-utility','NATIVE_DIFFERENTIAL_VERIFIED','Client RandomUtil signed/ushort utility; server RewardGroup call linkage unproven'),('shield-layer-consumption','NATIVE_DIFFERENTIAL_VERIFIED','Newest-to-oldest; stop marks exhausted layer'),('chapter-stage-base','NATIVE_DIFFERENTIAL_VERIFIED','CalcLabyrinthIdleRewardCount; not a stage-clear grant'),('hunting-preview','CLIENT_SOURCE_RESTORED','Expected popup per 500 points; not sampled rewards'),('hunting-bonus','CLIENT_SOURCE_RESTORED','Separate amount floor(floor(base*rate)/100); ability 3 positive-only'),('server-reward-selection','UNRESOLVED','Client receives ResourceResult; PickEach/PickNTimes/Chance and replacement semantics not proven'),('idle-tick-grant','UNRESOLVED','Time interval alone does not prove grant event scaling')]
 db.executemany('INSERT INTO policy_boundaries VALUES(?,?,?)',boundaries);db.commit()
 if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('Derived DB integrity failed')
 examples=[dict(zip(['chapter','stage','material','amount'],r)) for r in db.execute('SELECT * FROM interpolated_idle_bases WHERE chapter IN (1,2,100,1200) AND stage IN (1,5) AND material=1')]
 report={'metadataAudit':audit,'counts':dict(counts),'chapterStageCounts':dict(collections.Counter(len(s) for s in chapters.values())),'examples':examples,'boundaries':[dict(zip(['policy','status','detail'],r)) for r in boundaries],'wholeServerEconomyRestored':False}
 db.close();(output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--metadata',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();print(json.dumps(restore(a.source,a.metadata,a.output),ensure_ascii=False))
