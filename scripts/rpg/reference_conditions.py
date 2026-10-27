"""Audited ActionCondition and FilterTarget semantics, not an effect state machine."""
import math
from reference_progression import f32, Unresolved
from recover_combat_gaps import action_parameter


def condition(row, actual=None, invoker=None, sensored=None, parameters=None, context=True):
    kind=row['Condition']
    if kind in (0,1): return kind==0
    target=row['ConditionTarget']
    actor=actual if target==2 else sensored if target==3 and context else invoker if context and target!=3 else None
    if actor is None: return False
    a=action_parameter(row.get('ConditionParam',0),row.get('ConditionValue',0),parameters)
    b=action_parameter(row.get('ConditionParam2',0),row.get('ConditionValue2',0),parameters)
    if a is None or b is None:raise Unresolved('Skill level parameters required by condition')
    if kind in (20,21,40,41):
        value,maximum=('hp','maxHP') if kind<40 else ('mp','maxMP')
        ratio=actor[value]/actor[maximum] if actor[maximum]>0 else 0
        threshold=f32(a/100)
        return ratio>threshold if kind in (20,40) else ratio<=threshold
    if kind==30:return actor['shield']>0
    if kind in (10,11,12,13):
        # The float-to-marking conversion has not yet been independently recovered.
        if not float(a).is_integer() or not float(b).is_integer():
            raise Unresolved('Fractional marking conversion is not verified')
        marks=actor.get('markings')
        if marks is None:raise Unresolved('Marking context required')
        entry=marks.get(int(a),{'count':0,'maximum':False})
        return entry['maximum'] if kind==10 else not entry['maximum'] if kind==11 else entry['count']==int(b) if kind==12 else entry['count']!=int(b)
    return False


def filter_target(filters, operation, **context):
    # Native returns true for None and for empty lists, including empty OR.
    if operation==0 or not filters:return True
    if operation==1:return all(condition(row,**context) for row in filters)
    if operation==2:return any(condition(row,**context) for row in filters)
    raise Unresolved('Unknown filter operator')


def unconditional_filter(effect):
    """Safe compile-time reduction only; symbolic/actor-dependent filters remain pending."""
    filters=effect.get('FilterDatas',[])
    if effect.get('FilterOp',0)==0 or not filters:return True
    if any(row['Condition'] not in (0,1) for row in filters):return None
    return filter_target(filters,effect['FilterOp'])
