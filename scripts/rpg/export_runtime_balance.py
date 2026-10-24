#!/usr/bin/env python3
"""One command: export recovered private curves into the web battle adapter.

Original decoded DB stays private. Rewards and combat stats remain web settings.
"""
import argparse
import hashlib
import json
from pathlib import Path
from vardian_cost import calc_segments


def export(recovered, output):
    def read(name):return json.loads((recovered/name).read_text(encoding='utf-8'))
    team,weapon,armor=read('TeamData.json'),read('WeaponData.json'),read('ArmorData.json')
    def normalize(rows):return [{'min':r['MinLevel'],'max':r['MaxLevel'],**{k:r[source]['Value'] for k,source in [('base','BaseValue'),('inc','IncValue'),('rate','IncRate'),('scaler','Scaler')]}} for r in rows]
    curves=team['LevelUpQuadFuncDatas']
    # Web ledger uses bounded safe integers. Stop BEFORE unavailable/unsafe curves.
    maximum=1
    for level in range(1,min(team['MaxLevel'],10000)):
        cost=calc_segments(curves,level)
        if cost<=0 or cost>1e12:break
        maximum=level+1
    if maximum<2:raise ValueError('No playable safe level range')
    bundle={'version':1,'source':'recovered-curves-with-prototype-combat-and-rewards',
            'maxLevel':maximum,'team':normalize(curves),
            'weapon':normalize(weapon['WeaponGradeDatas'][0]['ReqLevelUpMatFuncDatas']),
            'armor':normalize(armor['ArmorDatas'][0]['ReqLevelUpMatFuncDatas']),
            'reward':{'gold':25,'xp':12,'soulGem':2}}
    output.parent.mkdir(parents=True,exist_ok=True)
    if output.exists():raise ValueError('Output exists; preserve prior configuration')
    output.write_text(json.dumps(bundle,ensure_ascii=False,indent=2),encoding='utf-8')
    evidence={'note':'Serialized coefficient mapping adopted by web adapter; no original UI/server charge claim.',
        'prototypeFields':['reward','combat stats','training equipment choice','character archetypes'],
        'runtimeSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
        'sourceHashes':{n:hashlib.sha256((recovered/n).read_bytes()).hexdigest() for n in ['TeamData.json','WeaponData.json','ArmorData.json']}}
    output.with_suffix('.evidence.json').write_text(json.dumps(evidence,indent=2),encoding='utf-8')
    return maximum


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--recovered',type=Path,required=True)
    p.add_argument('--output',type=Path,default=Path('data/rpg-reference/runtime-balance.json'))
    a=p.parse_args();print('RUNTIME_BALANCE_EXPORTED maxPlayableLevel='+str(export(a.recovered,a.output)))
