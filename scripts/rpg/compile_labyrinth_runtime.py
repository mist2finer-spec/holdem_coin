"""Compile curated web encounters; wave order and uncertain visual choices are web adapters."""
import json,shutil
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--repo',type=Path,default=Path('.'));args=p.parse_args();root=args.source;repo=args.repo
profiles=json.loads((root/'monster-profiles.json').read_text());monsters={}
for p in profiles:
 if p['actorType']>=9000:continue
 visuals=p['visualCandidates'];fallback={1105:'Enemy_GoblinWarrior_Boss_01',1342:'Enemy_DesertSpikedBeetle_01',1345:'Enemy_DesertScorpionKing_01',3006:'Enemy_AutomatonGuardian01'}
 for base,family in [(1300,'Ember'),(1310,'Blaze'),(1320,'Infernal')]:
  for n,element in [(1,'Fire'),(2,'Water'),(3,'Earth')]:fallback[base+n]='Enemy_'+family+'Elemental_'+element
 asset=visuals[0]['asset'] if visuals else fallback.get(p['actorType'],'Enemy_Slime_01_R')
 attacks=[a for a in p['attacks'] if any(e['type']==33 for e in a['events'])]
 a=attacks[0] if attacks else None;impact=next((e for e in a['events'] if e['type']==33),None) if a else None
 source=p['definition'];monsters[str(p['actorType'])]={'name':p['enumName'].replace('Enemy_',''),'asset':asset,'visualFallback':not bool(visuals),'move':max(1,source['MovDistPerSec'] or 3)*15,'windup':max(.15,impact['at']) if impact else .55,'recovery':max(.5,(a['holdTime']-impact['at'])) if impact else 1.3,'attackSkill':a['skillType'] if a else None,'attackFallback':a is None}
rewards=json.loads((root/'chapter-rewards.json').read_text());stages=[];used=set()
for line in (root/'labyrinth.jsonl').open():
 r=json.loads(line);slots=[s for s in r['slots'] if s['actorType'] and s['stats'] and str(s['actorType']) in monsters]
 normal=[s for s in slots if not s['boss']];boss=[s for s in slots if s['boss']]
 if not normal or not boss:break # Stop at unavailable data rather than silently skip a stage.
 def row(s):
  used.add(monsters[str(s['actorType'])]['asset']);return [s['actorType'],s['stats'].get('7',1),s['stats'].get('8',1)]
 b=rewards[r['chapter']-1]['baseRewards'];value=lambda key: min(9007199254740991 if key=='BaseExpsByChapter' else 1e12,round(b[key]['Value']))
 stages.append({'id':r['stageId'],'normal':[row(s) for s in normal],'boss':row(boss[-1] if r['section']==5 else boss[0]),'reward':[value('BaseGoldsByChapter'),value('BaseExpsByChapter'),value('BaseSoulgemsByChapter')]})
assets={}
for name in sorted(used):
 d=root/'monsters'/name;dest=repo/'public/rpg/monsters'/name;dest.mkdir(parents=True,exist_ok=True)
 for f in d.iterdir():shutil.copy(f,dest/f.name)
 skeleton=json.loads((d/(name+'.json')).read_text());clips=list(skeleton['animations']);slots=skeleton['slots'];ground=[s['name'] for s in slots if any(k in s['name'].lower() for k in ['foot','leg','body'])] or [s['name'] for s in slots]
 def clip(*names):return next((n for n in names if n in clips),clips[0])
 assets[name]={'skeleton':'monsters/'+name+'/'+name,'groundSlots':ground,'clips':{'idle':clip('stay1','idle'),'move':clip('run1','walk1','stay1'),'attack':clip('attack1','skill1'),'hurt':clip('hurt1','damage1','stay1'),'death':clip('die1','death1')}}
out={'source':'restored-labyrinth-20261026','encounterLayout':'WEB_ADAPTER_6_NORMAL_THEN_FINAL_BOSS','stages':stages,'monsters':monsters,'assets':assets}
(repo/'src/components/rpg/data/labyrinth-runtime.json').write_text(json.dumps(out,separators=(',',':')))
print({'stages':len(stages),'assets':len(assets),'size':(repo/'src/components/rpg/data/labyrinth-runtime.json').stat().st_size})
