"""Recover v39 compressed enum constants and lossless action/skill join evidence.
Private inputs remain outside git; only compact provenance/results are committed.
"""
import argparse, collections, hashlib, json, struct
from pathlib import Path
from reference_monsters import action_timeline
from reference_progression import skill_parameters


def compressed_uint(data, offset=0):
    first=data[offset]
    needed=1 if first<0x80 or first in (0xfe,0xff) else 2 if first<0xc0 else 4 if first<0xe0 else 5 if first==0xf0 else 1
    if offset<0 or offset+needed>len(data): raise ValueError('Truncated compressed integer')
    if first < 0x80: return first,1
    if first < 0xc0: return ((first & 0x3f)<<8)|data[offset+1],2
    if first < 0xe0:
        return ((first & 0x1f)<<24)|int.from_bytes(data[offset+1:offset+4],'big'),4
    if first == 0xf0: return int.from_bytes(data[offset+1:offset+5],'little'),5
    if first == 0xfe: return 0xfffffffe,1
    if first == 0xff: return 0xffffffff,1
    raise ValueError(f'Invalid compressed integer prefix {first:#x}')


def compressed_int(data, offset=0):
    value,width=compressed_uint(data,offset)
    return (-2147483648 if value==0xffffffff else -(value>>1)-1 if value&1 else value>>1),width


def action_parameter(kind, literal, parameters):
    """Original ARM64 0x6b64a98: Specified returns S0; V1..9 loads the struct.
    The source literal is NOT a multiplier for symbolic parameters.
    """
    if kind==0: return struct.unpack('<f',struct.pack('<f',literal))[0]
    if 2<=kind<=10:
        if parameters is None: return None
        return struct.unpack('<f',struct.pack('<f',parameters[kind-2]))[0]
    return 0.0


def recover(metadata, review, decoded, output):
    b=metadata.read_bytes()
    if struct.unpack_from('<II',b)!=(0xfab11baf,39): raise ValueError('Expected audited metadata v39')
    start,size,_=struct.unpack_from('<III',b,8+8*12)
    blob=b[start:start+size]; mappings={}; count=0
    for name,enum in review['originalMappings'].items():
        entries=[]
        for row in enum['entries']:
            offset=row['defaultDataOffset']
            value,width=(compressed_int if enum['schemaFormat']=='i' else compressed_uint)(blob,offset)
            entries.append({**row,'previousValue':row['value'],'value':value,'encodedHex':blob[offset:offset+width].hex(),'encodedWidth':width})
            count+=1
        # Every corrected constant must fit its independently supplied schema type.
        for row in entries: struct.pack('<'+enum['schemaFormat'],row['value'])
        mappings[name]={'schemaFormat':enum['schemaFormat'],'entries':entries}
    def values(name): return {r['name']:r['value'] for r in mappings['BalanceData.'+name]['entries']}
    assert values('ActionCooltimeMethod')=={'Time':0,'PerDefaultAttack':1}
    assert values('MonsterAIType')==dict(zip(['None','Attacker','Neutral','Slow','Defender','NpcAttacker'],range(6)))
    tables=lambda name:json.loads((decoded/(name+'.json')).read_text())
    actions=tables('ActionData')['ActionDatas']; skills={s['Type']:s for s in tables('SkillData')['SkillDatas']}
    joined=[]; missing=[]; symbolic=collections.Counter(); filtered=0
    for a in actions:
        timeline=action_timeline(a); effects=[]
        for event in timeline['events']:
            children=[event['child']] if event['type']==8 else [v['effect'] for v in event.get('effects',[])]
            for effect in children:
                effects.append(effect)
                if effect.get('FilterDatas'): filtered+=1
                for i in range(1,6):
                    if effect.get('P'+str(i),0)>1:symbolic[str(effect['P'+str(i)])]+=1
        skill=skills.get(a['SkillType'])
        parameters=skill_parameters(skill,1) if skill else None
        resolved=[{'dataId':f['DataId'],'type':f['Type'],'target':f['ApplyTarget'],
            'values':[action_parameter(f['P'+str(i)],f['V'+str(i)],parameters) for i in range(1,6)],
            'chance':action_parameter(f['ChanceParam'],f['ChanceValue'],parameters),
            'filters':f.get('FilterDatas',[]),'damageExtra':f.get('DamageExtraData'),
            'backlashExtra':f.get('BacklashShieldExtraData'),'marking':f['MultMarkingType']} for f in effects]
        joined.append({'resolvedLevel1Effects':resolved,'skillType':a['SkillType'],'action':a,'timeline':timeline,'effects':effects,'skill':skill,'level1Params':parameters,
            'status':'parameter-data-joined-not-full-effect-interpreter' if skill else 'no-SkillData-row'})
    present={a['SkillType'] for a in actions}
    actors=tables('ActorData')['ActorDatas']
    for a in actors:
        for skill in a.get('SkillTypes',[]):
            if skill not in present:missing.append({'actorType':a['ActorType'],'skillType':skill})
    summary={'metadataSha256':hashlib.sha256(b).hexdigest(),'correctedEnumCount':len(mappings),'correctedConstantCount':count,
        'actions':len(actions),'actionsWithSkillData':sum(j['skill'] is not None for j in joined),'effectRecordsWithFilters':filtered,
        'symbolicParameterReferences':dict(symbolic),'resolvedLevel1EffectRecords':sum(all(v is not None for v in f['values']) and f['chance'] is not None for j in joined for f in j['resolvedLevel1Effects']),'missingActorActions':missing,
        'limitations':['Compressed metadata constants are decoded; no full native combat execution claimed.',
        'Level1 effect parameters use the verified native selector. Chance, filters, marking and full damage-extra execution remain separate. Source skill levels must be supplied for live use.',
        'Duplicate SkillType actions are retained; no silent overwrite. Native maps/NPC and reward event routing remain unresolved.']}
    output.mkdir(parents=True,exist_ok=True)
    (output/'corrected-enums.json').write_text(json.dumps({'metadataSha256':summary['metadataSha256'],'enums':mappings},indent=2)+'\n')
    (output/'action-skill-evidence.json').write_text(json.dumps(joined,separators=(',',':')))
    (output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    return summary

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--metadata',type=Path,required=True);p.add_argument('--review',type=Path,required=True);p.add_argument('--decoded',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    print(json.dumps(recover(a.metadata,json.loads(a.review.read_text()),a.decoded,a.output)))
