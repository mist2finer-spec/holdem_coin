"""Bridge actual equipped skill levels to action effects, without applying guessed effects."""
from reference_progression import skill_parameters,Unresolved
from recover_combat_gaps import action_parameter
from reference_conditions import filter_target

def resolve_effect(effect,skill=None,level=None,**context):
    if skill is not None and (type(level) is not int or level<1):raise Unresolved('Positive actual skill level required')
    parameters=skill_parameters(skill,level) if skill is not None else None
    allowed=filter_target(effect.get('FilterDatas',[]),effect.get('FilterOp',0),parameters=parameters,**context)
    if not allowed:return {'eligible':False,'reason':'filter-rejected','type':effect['Type']}
    symbolic=any(effect.get('P'+str(i),0)>1 for i in range(1,6)) or effect.get('ChanceParam',0)>1
    symbolic|=effect.get('FilterOp',0)!=0 and any(r.get(k,0)>1 for r in effect.get('FilterDatas',[]) for k in ['ConditionParam','ConditionParam2'])
    extra=effect.get('DamageExtraData') or {}
    symbolic|=any(extra.get(k,0)>1 for k in ['VsShieldDmgRateParam','CriBonusParam','CriDmgBonusParam'])
    if symbolic and (skill is None or type(level) is not int or level<1):
        raise Unresolved('Actual equipped skill and positive skill level required')
    def resolve(k,v):
        result=action_parameter(k,v,parameters)
        if result is None:raise Unresolved('Missing skill parameters')
        return result
    # Evaluation ordering mirrors RunActionEffect: filter first, chance next.
    chance=resolve(effect.get('ChanceParam',0),effect.get('ChanceValue',0))
    return {'eligible':True,'type':effect['Type'],'target':effect['ApplyTarget'],
            'values':[resolve(effect.get('P'+str(i),0),effect.get('V'+str(i),0)) for i in range(1,6)],
            'chancePercent':100 if chance<=0 else chance,
            'damageExtra':{name:resolve(extra.get(name+'Param',0),extra.get(name+'Value',0)) for name in ['VsShieldDmgRate','CriBonus','CriDmgBonus']},
            'markingType':effect.get('MultMarkingType',0),'level':level,
            'scope':'resolved parameters only; no damage or active-effect application'}
