"""Evaluate a private reconstructed loadout; no live saves or service changes."""
import argparse,json,pathlib
from reference_session_equipment import session_equipment
from reference_equipment import final_stat


def evaluate(data,profile):
    read=lambda n:json.loads((data/n).read_text())
    team=read('TeamData.json');weapon=read('WeaponData.json');armor=read('ArmorData.json');ring=read('RingData.json')
    enum=read('metadata-enums.json')['enums']['BalanceData.ActorAbilityType']['entries'];fields=read('actor-ability-fields.json');plans=read('stat-plans.json')
    runtime={r['name'].casefold():r['name'] for r in fields if r['name']!='Null'}
    mapping={r['value']:runtime[r['name'].casefold()] for r in enum if r['name'].casefold() in runtime}
    numeric=dict(zip(team['BaseAbilTypes'],team['BaseAbilVals']));groups={};pending=[]
    for category,rows in [('weapon',weapon['WeaponDatas']),('armor',armor['ArmorDatas']),('ring',ring['RingDatas'])]:
        group=profile.get(category,{'owned':[],'equipped':[]})
        evaluated=session_equipment({r['Type']:(category,r) for r in rows},group['owned'],group['equipped'],group.get('presetType',0),{r['Kind']:r for r in weapon['WeaponKindDatas']})
        groups[category]=evaluated;pending.extend(evaluated['pending'])
        for k,v in evaluated['abilities'].items():numeric[k]=numeric.get(k,0.)+v
    limits=[]
    for k,maximum in zip(team['MaxAbilTypes'],team['MaxAbilVals']):
        v=numeric.get(k,0.)
        if v>maximum:numeric[k]=maximum;limits.append({'ability':k,'before':v,'after':maximum})
    stats={};unmapped=[]
    for k,v in numeric.items():
        if k not in mapping:unmapped.append({'ability':k,'value':v});continue
        stats[mapping[k]]=v
    if unmapped:pending.extend({'reason':'unmapped-runtime-field',**r} for r in unmapped)
    return {'scope':'Team base + explicit weapon/armor/ring schemas only; all other growth/effects excluded',
            'completeForRequestedSubset':not pending,'abilities':stats,'limits':limits,'groups':groups,'pending':pending,
            'attack':final_stat(stats,plans['attack'],profile.get('damageFlags',0)),
            'hp':final_stat(stats,plans['hp'])}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['data','profile','output']:p.add_argument('--'+n,type=pathlib.Path,required=True)
    a=p.parse_args()
    if a.output.exists():raise ValueError('Choose a new output filename')
    result=evaluate(a.data,json.loads(a.profile.read_text()));a.output.write_text(json.dumps(result,indent=2));print('PROFILE_RESTORED complete='+str(result['completeForRequestedSubset']))
