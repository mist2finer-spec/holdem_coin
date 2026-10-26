"""Read-only access to a private restored RPG database; never opens a live save."""
import argparse,json,sqlite3
from pathlib import Path
from reference_progression import combat_art_value,trait_value,skill_parameters,skill_hold_values,curve_quote,evaluate_growth,Unresolved


class ReferenceDB:
    def __init__(self,path):
        path=Path(path).resolve(strict=True)
        self.db=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)
        self.db.execute('PRAGMA query_only=ON')
    def close(self):self.db.close()
    def table(self,name):
        row=self.db.execute('SELECT document FROM sources WHERE name=?',(name,)).fetchone()
        if not row:raise KeyError('Unknown source '+name)
        return json.loads(row[0])
    def records(self,source,vector,type_id=None,limit=100,offset=0):
        if not 1<=limit<=1000:raise ValueError('Limit must be 1..1000')
        if type(offset) is not int or offset<0:raise ValueError('Invalid offset')
        sql='SELECT document FROM records WHERE source=? AND vector=?';args=[source,vector]
        if type_id is not None:sql+=" AND json_extract(document,'$.Type')=?";args.append(type_id)
        sql+=' ORDER BY row_index LIMIT ? OFFSET ?';args.extend([limit,offset])
        return [json.loads(r[0]) for r in self.db.execute(sql,args)]
    def growth(self,system,type_id,level):
        lookup={'art':('CombatArtData','CombatArtDatas'),'trait':('TraitData','TraitDatas'),'skill':('SkillData','SkillDatas')}
        if system not in lookup:raise ValueError('Unknown system')
        rows=self.records(*lookup[system],type_id=type_id)
        if len(rows)!=1:raise ValueError('Unknown/ambiguous type')
        row=rows[0]
        if system=='art':return {'ability':row['AbilType'],'value':combat_art_value(row,level),'maxLevel':row['MaxLevel']}
        if system=='trait':return {'ability':row['AbilType'],'value':trait_value(row,level),'maxLevel':row['MaxLevel']}
        return {'parameters':skill_parameters(row,level),'hold':skill_hold_values(row,level) if row.get('HoldAbilTypes') else [],'grade':row['Grade'],'numericEvaluationOnly':True}
    def profile(self,path,metadata):
        fields=json.loads((metadata/'actor-ability-fields.json').read_text())
        runtime={r['name'].casefold():r['name'] for r in fields if r['name']!='Null'}
        mapping={value:runtime[name.casefold()] for value,name in self.db.execute('SELECT value,name FROM enums WHERE enum=?',('BalanceData.ActorAbilityType',)) if name.casefold() in runtime}
        tables={name:self.table(name) for name, in self.db.execute('SELECT name FROM sources WHERE name!=?',('StageData.pack',))}
        return evaluate_growth(tables,json.loads(path.read_text()),mapping,json.loads((metadata/'stat-plans.json').read_text()))
    def costs(self,system,type_id,level,count=1,offset=0,budget=None):
        if system=='team':
            row=self.table('TeamData');return curve_quote(row['LevelUpQuadFuncDatas'],level,row['MaxLevel'],count,3,level_offset=offset,budget=budget)
        table,key={'art':('CombatArtData','CombatArtDatas'),'weapon':('WeaponData','WeaponDatas'),'armor':('ArmorData','ArmorDatas'),'ring':('RingData','RingDatas')}[system]
        rows=self.records(table,key,type_id=type_id)
        if len(rows)!=1:raise ValueError('Unknown/ambiguous type')
        row=rows[0]
        if system=='art':curves=[row['ReqMatFuncData']];material=row['ReqMatType'];maximum=row['MaxLevel']
        else:
            if system=='weapon':row=next(g for g in self.table(table)['WeaponGradeDatas'] if g['Tier']==row['Tier'] and g['Grade']==row['Grade'])
            curves=row['ReqLevelUpMatFuncDatas'];material=row['ReqLevelUpMatType'];maximum=row['MaxLevel']
        result=curve_quote(curves,level,maximum,count,material,level_offset=offset,budget=budget)
        result['unverifiedExecutionGates']=['unlock conditions','ownership/material debits','breakthrough extension','same-type copy requirements']
        return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--db',type=Path,required=True)
    sub=p.add_subparsers(dest='command',required=True)
    r=sub.add_parser('records');r.add_argument('source');r.add_argument('vector');r.add_argument('--type',dest='type_id',type=int);r.add_argument('--limit',type=int,default=10);r.add_argument('--offset',type=int,default=0)
    g=sub.add_parser('growth');g.add_argument('system',choices=['art','trait','skill']);g.add_argument('type_id',type=int);g.add_argument('level',type=int)
    q=sub.add_parser('cost');q.add_argument('system',choices=['team','art','weapon','armor','ring']);q.add_argument('type_id',type=int);q.add_argument('level',type=int);q.add_argument('--count',type=int,default=1);q.add_argument('--curve-level-offset',type=int,default=0);q.add_argument('--budget',type=float)
    f=sub.add_parser('profile');f.add_argument('path',type=Path);f.add_argument('--metadata-dir',type=Path)
    a=p.parse_args();db=ReferenceDB(a.db)
    try:
        if a.command=='records':result=db.records(a.source,a.vector,a.type_id,a.limit,a.offset)
        elif a.command=='growth':result=db.growth(a.system,a.type_id,a.level)
        elif a.command=='profile':result=db.profile(a.path,a.metadata_dir or a.db.resolve().parent/'data')
        else:result=db.costs(a.system,a.type_id,a.level,a.count,a.curve_level_offset,a.budget)
        print(json.dumps(result,ensure_ascii=False,indent=2))
    finally:db.close()
