"""Export private evaluated equipment values from recovered tables; no server mutation.

python scripts/rpg/restore_combat_stats.py --recovered DIR --enums metadata-enums.json
 --fields actor-ability-fields.json --plans stat-plans.json --output NEW_DIR
"""
import argparse,csv,json,pathlib,shutil
from reference_equipment import item_abilities,aggregate_equipment,final_stat,equipment_cost

def restore(recovered,enums_path,fields_path,plans_path,output):
    if output.exists():raise ValueError('Preserve previous exports: choose a new output directory')
    enum_doc=json.loads(enums_path.read_text());names={r['value']:r['name'] for r in enum_doc['enums']['BalanceData.ActorAbilityType']['entries']}
    fields=json.loads(fields_path.read_text());runtime={r['name'].casefold():r['name'] for r in fields if r['name']!='Null'}
    mapping={k:runtime[v.casefold()] for k,v in names.items() if v.casefold() in runtime}
    plans=json.loads(plans_path.read_text());output.mkdir(parents=True);(output/'data').mkdir()
    for f in [enums_path,fields_path,plans_path]:shutil.copy2(f,output/'data'/f.name)
    def load(fn):
        f=recovered/fn;shutil.copy2(f,output/'data'/fn);return json.loads(f.read_text())
    team=load('TeamData.json');weapon=load('WeaponData.json');armor=load('ArmorData.json');ring=load('RingData.json')
    grades={r['Grade']:r for r in weapon['WeaponGradeDatas']};inventory=[];count=0
    with open(output/'equipment-evaluated.csv','w',encoding='utf-8-sig',newline='') as f:
        writer=csv.writer(f);writer.writerow(['category','type','grade','level','channel','abilityId','abilityName','evaluatedValue'])
        for category,rows in [('weapon',weapon['WeaponDatas']),('armor',armor['ArmorDatas']),('ring',ring['RingDatas'])]:
            for row in rows:
                max_level=(grades[row['Grade']] if category=='weapon' else row)['MaxLevel']
                inventory.append({'category':category,'type':row['Type'],'grade':row['Grade'],'maxLevel':max_level,'stepEquip':row.get('UseStepEquipAbilData',False),'stepHold':row.get('UseStepHoldAbilData',False)})
                for level in range(1,max_level+1):
                    for channel in ['Equip','Hold']:
                        for ability,value in item_abilities(row,level,category,channel):
                            writer.writerow([category,row['Type'],row['Grade'],level,channel,ability,names.get(ability,'UNMAPPED'),format(value,'.17g')]);count+=1
    # Explicit worked example. Includes one equipped+held weapon and armor only;
    # NOT a claim about the original session's ownership stacking rules.
    entries=[{'category':cat,'definition':next(r for r in rows if r['Type']==typ),'level':lv,'channels':['Equip','Hold']} for cat,rows,typ,lv in [('weapon',weapon['WeaponDatas'],1101,1),('armor',armor['ArmorDatas'],1104,1)]]
    ledger=aggregate_equipment(entries);stats={}
    for ability,value in zip(team['BaseAbilTypes'],team['BaseAbilVals']):
        if ability not in mapping:raise ValueError('Unresolved base stat '+str(ability))
        stats[mapping[ability]]=value
    for ability,value in ledger['abilities'].items():
        if ability not in mapping:raise ValueError('Unresolved equipment stat '+str(ability))
        k=mapping[ability];stats[k]=stats.get(k,0.)+value
    example={'scope':'Explicit example: base team + one weapon + one armor; Equip and Hold both requested; no options or other systems',
             'rawAbilities':stats,'contributions':ledger['contributions'],'attack':final_stat(stats,plans['attack']),
             'hp':final_stat(stats,plans['hp']),
             'weaponUpgradeCost':equipment_cost(grades[1],1),'armorUpgradeCost':equipment_cost(entries[1]['definition'],1)}
    (output/'example-loadout.json').write_text(json.dumps(example,indent=2))
    summary={'itemDefinitions':len(inventory),'evaluatedRows':count,'runtimeFields':len(runtime),'enumToRuntimeMappings':len(mapping),'unmappedAbilities':{str(k):v for k,v in names.items() if k not in mapping},'items':inventory,
             'notRestored':['session ownership/dedup rules','seeded random option generation','all damage/target defense branches','server purchase and combination policy','breakthrough condition executor']}
    (output/'summary.json').write_text(json.dumps(summary,indent=2));return summary

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for k in ['recovered','enums','fields','plans','output']:p.add_argument('--'+k,required=True,type=pathlib.Path)
    a=p.parse_args();r=restore(a.recovered,a.enums,a.fields,a.plans,a.output);print(json.dumps({k:v for k,v in r.items() if k not in ['items','unmappedAbilities']}))
