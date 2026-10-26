"""Collect supplied combat evidence without treating dumps as implemented code.

Private output only: do not commit original decompilations or balance tables.
"""
import argparse,collections,csv,hashlib,io,json,re,zipfile
from pathlib import Path

PATTERN=re.compile(r'Combat|Map(?:Entity|Scene|Pathfind|Monster|Spawn|Trigger|Data|Loader|Config)|SceneMap|Labyrinth|StageSpawn|ActorAbilitySet|Impactor|HitSensor|Damage|RewardGroup|Skill.*Executor',re.I)

def collect(handoff,decoded,profiles,repo,output):
 if output.exists():raise ValueError('Use a new output directory')
 output.mkdir(parents=True);(output/'evidence').mkdir();seen={};archives=[];scanned=0
 with zipfile.ZipFile(handoff) as outer:
  selected=[i for i in outer.infolist() if i.filename.endswith('.zip') and ('/VERIFIED_SOURCE/' in i.filename or '/MANAGED_COVERAGE/' in i.filename and 'Ghidra' in i.filename)]
  for item in selected:
   raw=outer.read(item);archives.append({'name':item.filename,'sha256':hashlib.sha256(raw).hexdigest()})
   with zipfile.ZipFile(io.BytesIO(raw)) as z:
    for member in z.infolist():
     if member.is_dir() or member.file_size>20_000_000 or Path(member.filename).suffix not in ['.cs','.txt']:continue
     scanned+=1;body=z.read(member);text=body.decode('utf-8-sig',errors='replace')
     if not PATTERN.search(Path(member.filename).name+'\n'+text[:16000]):continue
     digest=hashlib.sha256(body).hexdigest();origin={'archive':item.filename,'member':member.filename}
     if digest in seen:seen[digest]['origins'].append(origin);continue
     name=Path(member.filename).name;path=Path('evidence')/(digest[:12]+'_'+name)
     (output/path).write_bytes(body)
     grab=lambda key:next(iter((v.strip() for v in re.findall(r'^'+key+r':\s*(.+)$',text,re.M|re.I))),None)
     seen[digest]={'path':str(path),'sha256':digest,'bytes':len(body),'class':grab('CLASS'),'method':grab('METHOD'),'token':grab('TOKEN'),'address':grab('ADDRESS'),'kind':'managed_declaration_only' if name.endswith('.cs') else 'decompiler_or_trace_text','origins':[origin]}
 source=decoded.parent
 tables=[p for p in decoded.glob('*.json') if any(t in p.stem for t in ['Combat','Actor','Action','Monster','Skill','Team','Weapon','Armor','Ring','Mastery','Will','Labyrinth'])]
 (output/'tables').mkdir()
 for p in tables:(output/'tables'/p.name).write_bytes(p.read_bytes())
 for n in ['schema-evidence.json','metadata-enums.json']:(output/n).write_bytes((source/'evidence'/n).read_bytes())
 # Re-resolve every exported monster action using the complete action-type map.
 import sys
 sys.path.insert(0,str(Path(__file__).resolve().parent))
 from reference_monsters import action_timeline
 rows=json.loads(profiles.read_text());resolved=[]
 for monster in rows:
  resolved.append({'actorType':monster['actorType'],'enumName':monster['enumName'],'definition':monster['definition'],'aiConfig':monster['aiConfig'],'phaseChanges':monster['phaseChanges'],'visualCandidates':monster['visualCandidates'],'attacks':[{**action_timeline(a['sourceAction']),'sourceAction':a['sourceAction']} for a in monster['attacks']]})
 (output/'monster-combat-detailed.json').write_text(json.dumps(resolved,separators=(',',':')))
 stage_rules=[];conditions=collections.Counter();stage_counts=collections.Counter()
 for line in (profiles.parent/'labyrinth.jsonl').open():
  r=json.loads(line);d=r['stageDefinition'];conditions[d['VictoryCondition']]+=1;stage_counts['timeLimits']+=d['TimeLimit']>0
  overrides=[]
  for slot in r['slots']:
   m=slot['definition'];ai=m['MonsterAIType']!=0;skill=bool(m.get('SkillTypes'))
   stage_counts['aiOverrides']+=ai;stage_counts['skillOverrides']+=skill
   if ai or skill:overrides.append({'slot':slot['index'],'actorType':slot['actorType'],'aiType':m['MonsterAIType'],'skills':m.get('SkillTypes')})
  stage_rules.append({'id':r['stageId'],'mapType':d['MapType'],'entityGroup':d['MapEntityGroupId'],'timeLimit':d['TimeLimit'],'victoryCondition':d['VictoryCondition'],'victoryValue':d['VictoryConditionValue'],'victoryValues':d.get('VictoryConditionValues'),'objectDefinitions':d.get('EntityObjectDatas'),'slotOverrides':overrides})
 (output/'stage-rules-index.json').write_text(json.dumps(stage_rules,separators=(',',':')))
 runtime=json.loads((repo/'src/components/rpg/data/labyrinth-runtime.json').read_text());used={int(x[0]) for s in runtime['stages'] for x in [*s['normal'],s['boss']]}
 count=lambda m:len(m['attacks'])
 result={'evidenceArchives':archives,'scannedTextMembers':scanned,'uniqueSelectedFiles':len(seen),'fileKinds':dict(collections.Counter(r['kind'] for r in seen.values())),
 'stageRuleCounts':dict(stage_counts),'victoryConditionCounts':dict(conditions),'selectedTables':[p.name for p in tables],'monsterDefinitions':len(resolved),'monsterActionTimelines':sum(count(m) for m in resolved),'unresolvedTimelineCommands':sum(len(a['pending']) for m in resolved for a in m['attacks']),
 'activeStageActorTypes':len(used),'multiSkillStageActors':[{'actorType':m['actorType'],'name':m['enumName'],'availableActions':count(m),'webSelectedSkill':runtime['monsters'][str(m['actorType'])]['attackSkill'],'phaseChanges':m['phaseChanges']} for m in resolved if m['actorType'] in used and count(m)>1],
 'phaseStageActors':[m['actorType'] for m in resolved if m['actorType'] in used and (m['phaseChanges']['Phase2ChangeConditionHPPercent']>0 or m['phaseChanges']['Phase3ChangeConditionHPPercent']>0)],
 'activeVisualFallbacks':[t for t in sorted(used) if runtime['monsters'][str(t)]['visualFallback']],
 'notes':['Evidence presence is not implementation or proof of native-build compatibility.','Source addresses/tokens remain tied to their own archive; do not mix builds.','Web combat runtime is not changed by this collection.']}
 (output/'inventory.json').write_text(json.dumps(list(seen.values()),indent=2));(output/'summary.json').write_text(json.dumps(result,indent=2))
 with (output/'evidence-index.csv').open('w',newline='',encoding='utf-8-sig') as f:
  w=csv.writer(f);w.writerow(['class','method','token','address','kind','path','sourceArchive']);w.writerows([r['class'],r['method'],r['token'],r['address'],r['kind'],r['path'],r['origins'][0]['archive']] for r in seen.values())
 return result

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__)
 for n in ['handoff','decoded','profiles','repo','output']:p.add_argument('--'+n,type=Path,required=True)
 a=p.parse_args();r=collect(a.handoff,a.decoded,a.profiles,a.repo,a.output);print(json.dumps({k:v for k,v in r.items() if k not in ['evidenceArchives','multiSkillStageActors','notes']}))
