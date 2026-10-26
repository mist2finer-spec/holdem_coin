"""Compile recovered action commands and stage rules for the 1-D web adapter."""
import argparse,json,sys
from pathlib import Path
from reference_monsters import action_timeline
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--stages',type=Path,required=True);p.add_argument('--repo',type=Path,default=Path('.'));args=p.parse_args()
load=lambda name:json.loads((args.source/(name+'.json')).read_text())
runtime=args.repo/'src/components/rpg/data/labyrinth-runtime.json';r=json.loads(runtime.read_text());actors={x['ActorType']:x for x in load('ActorData')['ActorDatas']};ai={x['Type']:x for x in load('MonsterData')['MonsterAIDatas']};actions={}
for a in load('ActionData')['ActionDatas']:
 t=action_timeline(a);commands=[];pending=[];animations=[];clip='attack1'
 for e in t['events']:
  d=e['child']
  if e['type']==1:
   n=(d.get('AnimStates') or [d['AnimState']])[0];clip=d.get('RawAnimName') if d.get('UseRawAnim') else ('attack'+str(n-10) if 11<=n<=15 else 'skill'+str(n-30) if 31<=n<=39 else 'attack1')
   animations.append({'at':e['at'],'clip':clip})
  if e['conditional']:pending.append({'kind':'action-condition-interpreter','dataId':d['DataId']})
  if e['type']==8:
   if d['P1']==0 and d['P2']==0 and not d.get('FilterDatas'):
    commands.append({'at':e['at'],'condition':e['condition'],'count':1,'interval':0,'speed':0,'duration':0,'width':50,'moving':True,'arrive':False,'release':False,'repeat':0,'unique':True,'targetOrigin':11,'startOrigin':1 if d['ApplyTarget']==1 else 2,'tracking':False,'effects':[{'phase':'Moving','type':d['Type'],'value':d['V1'],'duration':d['V2'],'target':d['ApplyTarget']}]})
   else:pending.append({'kind':'direct-effect-parameter-or-filter','dataId':d['DataId']})
  if e['type']!=33:continue
  effects=[]
  for v in e['effects']:
   x=v['effect']
   # Only literal parameters; symbolic values must not silently become zero.
   if x['P1']!=0 or x['P2']!=0 or x.get('FilterDatas'):pending.append({'kind':'effect-parameter-or-filter','dataId':x['DataId']});continue
   effects.append({'phase':v['phase'],'type':x['Type'],'value':x['V1'],'duration':x['V2'],'target':x['ApplyTarget']})
  if any(d[k]!=0 for k in ['CountParam','SpeedParam','DurationParam']):pending.append({'kind':'impactor-parameter','dataId':d['DataId']});continue
  commands.append({'at':e['at'],'condition':e['condition'],'count':max(1,min(64,round(d['CountValue']))),'interval':d['Interval'],'speed':d['SpeedValue']*50,'duration':d['DurationValue'],'width':max(12,d['ColliderWidth']*50),'moving':d['UseMovingHit'],'arrive':d['UseArriveHit'],'release':d['UseReleaseHit'],'repeat':d['MovingHitInterval'],'unique':d['UseUniqueHit'],'targetOrigin':d['TargetOriginType'],'startOrigin':d['StartOriginType'],'tracking':d['TargetUseTrack'],'effects':effects})
 end=max([a['HoldTime'],*(c['at']+(c['count']-1)*c['interval']+.1 for c in commands)])
 actions[str(a['SkillType'])]={'id':a['SkillType'],'clip':animations[0]['clip'] if animations else clip,'animations':animations,'duration':max(.2,end),'cooldown':a['CooltimeValue'] if a['CooltimeParam']==0 else 0,'cooldownMethod':a['CooltimeMethod'],'mp':a['MpCostValue'] if a['MpCostParam']==0 else 0 if a['MpCostParam']==1 else None,'range':max(55,a['ApproachDistance']*50),'tag':a['SkillTag'],'conditions':a.get('AiConditionDatas',[]),'commands':commands,'pending':pending}
for typ,m in r['monsters'].items():
 a=actors[int(typ)];cfg=ai.get(a['StartAIType'],{})
 m.update(skills=a.get('SkillTypes',[]),aiType=a['StartAIType'],keepDistance=cfg.get('MoveMinDistance',0)*50,radius=max(12,min(48,a['Size']*10)))
for i,line in enumerate(args.stages.open()):
 s=json.loads(line);d=s['stageDefinition'];out=r['stages'][i]
 out.update(victory=d['VictoryCondition'],goal=d['VictoryConditionValue'],objectIds=d.get('VictoryConditionValues',[]),timeLimit=d['TimeLimit'],entityObjects=[{'id':o['ObjectId'],'category':o['Category'],'effect':o['EffectType'],'value':o['EffectV1'],'value2':o['EffectV2'],'globalType':o['GlobalEffectType1'],'globalValue':o['GlobalEffectValue1'],'globalType2':o['GlobalEffectType2'],'globalValue2':o['GlobalEffectValue2']} for o in d.get('EntityObjectDatas',[])])
 original=[v for v in s['slots'] if v['actorType'] and v['stats'] and str(v['actorType']) in r['monsters']]
 normal=[v for v in original if not v['boss']];boss=[v for v in original if v['boss']]
 for row,slot in zip(out['normal']+[out['boss']],normal+[boss[-1] if s['section']==5 else boss[0]]):
  v=slot['definition'];row.extend([v['MonsterAIType'],v.get('SkillTypes',[]),[slot['stats'].get(str(k),0) for k in [9,10,11,12]]])
r['actions']=actions;r['ai']={str(k):{'min':v['MoveMinDistance']*50,'max':v['MoveMaxDistance']*50,'waitMin':v['WaitMinSeconds'],'waitMax':v['WaitMaxSeconds']} for k,v in ai.items()}
r['source']='recovered-action-stage-rules-20261026';runtime.write_text(json.dumps(r,separators=(',',':')))
growth=args.repo/'src/components/rpg/data/recovered-growth.json';g=json.loads(growth.read_text());team=load('TeamData');g['teamMaxLevel']=team['MaxLevel'];g['teamCurves']=[{'min':v['MinLevel'],'max':v['MaxLevel'],**{key:v[name]['Value'] for key,name in [('base','BaseValue'),('inc','IncValue'),('rate','IncRate'),('scaler','Scaler')]}} for v in team['LevelUpQuadFuncDatas']];growth.write_text(json.dumps(g,indent=2)+'\n')
print(json.dumps({'actions':len(actions),'commands':sum(len(a['commands']) for a in actions.values()),'pending':sum(len(a['pending']) for a in actions.values()),'stages':len(r['stages']),'maxLevel':g['teamMaxLevel']}))
