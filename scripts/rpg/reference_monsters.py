"""Original stage/monster arithmetic and explicit action links; no live-save writes."""
import math
from reference_equipment import normalize_ability
from reference_progression import Unresolved

STAGE_BOSS=1024
STAGE_BOSS_APPEAR=512
TARGET_BOSS=1<<17
SOURCE_BOSS=1<<18
TARGET_MOB=1<<19
SOURCE_MOB=1<<20


def stage_number(stage_id):
    if type(stage_id) is not int or stage_id//100<1 or not 1<=stage_id%100<=5:
        raise ValueError('Expected chapter*100 + section1..5')
    return stage_id//100,stage_id%100


def boss_flags(flags,invoker_actor_flags,target_actor_flags):
    # Actor flags and StageMonster flags are DIFFERENT enum domains.
    for n in [flags,invoker_actor_flags,target_actor_flags]:
        if type(n) is not int or not 0<=n<2**64:raise ValueError('Flags must be uint64')
    if invoker_actor_flags&1:flags|=SOURCE_BOSS
    elif invoker_actor_flags&8:flags|=SOURCE_MOB
    if target_actor_flags&1:flags|=TARGET_BOSS
    elif target_actor_flags&8:flags|=TARGET_MOB
    return flags


def class_attack_damage(damage,attacker,flags):
    """The class-bonus substep only, not all CalcFinalDamage branches."""
    if not math.isfinite(damage) or damage<0:raise ValueError('Invalid damage')
    if flags&TARGET_MOB:ids=(21,161)
    elif flags&TARGET_BOSS:ids=(22,162)
    else:ids=()
    rate=sum(max(0.,attacker.get(a,0.)) for a in ids)
    if not math.isfinite(rate):raise ValueError('Invalid rate')
    return damage+damage*rate/100.


def class_defense_damage(damage,defender,flags,other_rates=(),max_def_rate=90.):
    """Recovered defensive reduction chain + global floor; no armor-gauge fiction.

    Caller supplies damage at the start of the defense phase, after upstream
    element/critical/effects. other_rates are already selected upstream defense
    factors; their selection and actor effects remain separate.
    """
    if not math.isfinite(damage) or damage<0 or not 0<=max_def_rate<=100:raise ValueError('Invalid damage/cap')
    ids=(51,166) if flags&SOURCE_MOB else (52,167) if flags&SOURCE_BOSS else ()
    reduced=damage
    for rate in [*other_rates,*(defender.get(a,0.) for a in ids)]:
        if not math.isfinite(rate):raise ValueError('Invalid rate')
        reduced=max(0.,reduced-reduced*rate/100.)
    return max(damage-damage*max_def_rate/100.,reduced)


def monster_abilities(stage,monster,actor,combat,hero=None):
    if monster['HeroAbilityBased']:
        raise Unresolved('Hero-based monster needs original physical/magic/HP context')
    values={2:combat['MonsterMovDistPerSec']}
    if actor['MovDistPerSec']>0:values[2]=actor['MovDistPerSec']
    for r in stage.get('BaseAbilityDatas',[]):values[r['AbilType']]=r['AbilVal']
    # StageMonster AbilityDatas are percentage overrides of the stage base.
    # Do not multiply the six slot definitions into one another.
    for r in monster.get('AbilityDatas',[]):values[r['AbilType']]=values.get(r['AbilType'],0.)*r['AbilVal']/100.
    return values


def adjusted_monster_hp(hp,hero_abilities,actor_flags):
    """AdjustActorAbilityHp: positive class HP reduction, ties-to-even rounding.

    This helper deliberately does not invent a 1-HP floor or a rate cap absent
    from the recovered method. Validate the upstream capped hero profile first.
    StageMonster flags must be converted to CombatActorFlag by the caller.
    """
    rate=hero_abilities.get(45 if actor_flags&1 else 44,0.)
    if not math.isfinite(hp) or hp<0 or not math.isfinite(rate):raise ValueError('Invalid HP/rate')
    return hp if rate<=0 else round(hp-hp*rate/100.)


def action_timeline(action):
    child_keys={1:'MotionDatas',3:'DashDatas',4:'MoveDatas',5:'FxDatas',6:'CameraShakeDatas',8:'EffectDatas',9:'AudioDatas',33:'ImpactorDatas',36:'SummonDatas'}
    events=[];pending=[]
    for order,basic in enumerate(action.get('BasicDatas',[])):
        if basic['Mute']:continue
        key=child_keys.get(basic['Type']);rows=action.get(key,[]) if key else []
        idx=basic.get('DataIdx')
        if idx is None:
            pending.append({'order':order,'reason':'DataIdx-default-unproven','basic':basic});continue
        if key is None or not 0<=idx<len(rows):
            pending.append({'order':order,'reason':'child-type-or-index-not-resolved','type':basic['Type'],'basic':basic});continue
        row=rows[idx]
        if row['DataId']!=basic['DataId']:raise ValueError('Action child ID/index mismatch')
        event={'order':order,'at':basic['Time'],'type':basic['Type'],'child':row,'condition':{k:basic[k] for k in ['ConditionTarget','Condition','ConditionValue','ConditionValue2']},'conditional':basic['Condition']!=0}
        if basic['Type']==33:
            effects=[]
            for phase in ['Moving','Arrive','Release','Return']:
                ids=row.get(phase+'EffectDataIds',[]);idxs=row.get(phase+'EffectDataIdxs',[])
                if len(ids)!=len(idxs):raise ValueError('Impactor effect arrays mismatch')
                for ident,i in zip(ids,idxs):
                    erows=action.get('EffectDatas',[])
                    if not 0<=i<len(erows) or erows[i]['DataId']!=ident:raise ValueError('Impactor effect ID/index mismatch')
                    effects.append({'phase':phase,'effect':erows[i]})
            event['effects']=effects
            event['meaning']='impactor creation; contact/travel and each target hit are separate'
        events.append(event)
    return {'skillType':action['SkillType'],'holdTime':action['HoldTime'],'approachDistance':action['ApproachDistance'],
            'cooltime':{k:action[k] for k in ['CooltimeMethod','CooltimeParam','CooltimeValue']},
            'mpCost':{k:action[k] for k in ['MpCostParam','MpCostValue']},'skillTag':action['SkillTag'],
            'events':sorted(events,key=lambda e:(e['at'],e['order'])),'pending':pending,
            'durationLowerBound':max([action['HoldTime'],*(e['at'] for e in events)]),
            'notExecuted':['action condition interpreter','moving/arrive/release collider simulation','effect target filters','HP damage pipeline']}


def action_events_between(timeline,previous,elapsed,alive=True,condition=None):
    """Advance a timeline once; emits creation commands, never instant damage."""
    if not math.isfinite(previous) or not math.isfinite(elapsed) or elapsed<0 or elapsed<previous:
        raise ValueError('Invalid timeline interval')
    if not alive:return []
    events=[]
    for event in timeline['events']:
        if not previous<event['at']<=elapsed:continue
        if event['conditional'] and (condition is None or not condition(event['condition'])):continue
        events.append(event)
    return events
