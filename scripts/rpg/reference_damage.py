"""Recovered CalcFinalDamage ability-only path.

Explicitly rejects active effect state. This is an offline reference, not the live
web damage formula or a claim that all RunEffect/InflictDamage branches are done.
Stats use ActorAbilitySet field names (layout recorded separately).
"""
import math
from reference_progression import Unresolved,f32

PHY=0x1f0000010
MAG=0xf800020

def final_damage(damage,flags,attacker=None,defender=None,*,valor=(0.,0.),mental=(0.,0.),
                 critical_effect_bonus=0.,attribute_adjustment=0,actor_type_bonus=0.,
                 maximum_defense_percent=90.,active_effects=False,damage_rate=0.,defense_rates=()):
    if active_effects:raise Unresolved('Active effects require the complete effect-state dispatcher')
    if not isinstance(flags,int) or not 0<=flags<2**64:raise ValueError('Invalid damage flags')
    attacker=attacker or {};defender=defender or {}
    numbers=[damage,critical_effect_bonus,attribute_adjustment,actor_type_bonus,maximum_defense_percent,damage_rate,*defense_rates,*valor,*mental,*attacker.values(),*defender.values()]
    if not all(isinstance(n,(int,float)) and math.isfinite(n) for n in numbers):raise ValueError('Non-finite damage input')
    def positive(name):return max(0,attacker.get(name,0))
    def group(pairs):
        nonlocal damage
        value=sum(positive(name) for gate,name in pairs if gate)
        if value:damage+=damage*value/100
    basic=bool(flags&64);skill=bool(flags&128);physical=bool(flags&PHY);magical=bool(flags&MAG)
    if basic:damage+=damage*attacker.get('weaponTypeDmgRate',0)/100
    group([(basic,'defaultAtkDmgRate'),(skill,'skillDmgRate')])
    group([(physical,'phyDmgRate'),(magical,'magDmgRate')])
    for mask,name in [(0xa0,'artifactSkillDmgRate'),(0x90,'overchargeSkillDmgRate'),(0xa0,'guildRaidGearArtifactSkillDmgRate'),(0x90,'guildRaidGearOverchargeSkillDmgRate')]:
        group([(flags&mask==mask,name)])
    relative=0.
    for gate,ignore_negative,(a,b) in [(physical,flags&16,valor),(magical,flags&32,mental)]:
        if gate:
            value=math.tanh((a-b)/300*1.2)*.2
            relative+=max(0,value) if ignore_negative else value
    damage+=damage*relative
    # Attribute resistance is a separately recovered lookup result, not a guessed type relation.
    if attribute_adjustment:
        flags|=0x200000 if attribute_adjustment>0 else 0x400000
        damage+=damage*attribute_adjustment/100
        if damage<=0:damage=0.;flags|=0x800
    damage+=damage*actor_type_bonus/100
    group([(True,'skillAttrDmgRate'),(basic,'skillAttrDefaultAtkDmgRate'),(skill,'skillAttrSkillDmgRate'),(physical,'skillAttrPhyDmgRate'),(magical,'skillAttrMagDmgRate')])
    damage+=damage*(f32(damage_rate)+(f32(critical_effect_bonus) if flags&1 else 0))/100
    group([(basic,'expBuffDefaultAtkDmgRate'),(skill,'expBuffSkillDmgRate')])
    group([(physical,'expBuffPhyDmgRate'),(magical,'expBuffMagDmgRate')])
    group([(flags&(1<<23),'fireMagDmgRate'),(flags&(1<<24),'waterMagDmgRate'),(flags&(1<<25),'earthMagDmgRate'),(flags&(1<<28),'impactPhyDmgRate'),(flags&(1<<27),'darkMagDmgRate'),(flags&(1<<26),'lightMagDmgRate')])
    group([(flags&4,'powerBlowDmgRate'),(flags&8,'finishBlowDmgRate')])
    if flags&(1<<19):group([(True,'vsMobDmgRate'),(True,'expBuffVsMobDmgRate')])
    elif flags&(1<<17):group([(True,'vsBossDmgRate'),(True,'expBuffVsBossDmgRate')])
    floor=damage-damage*maximum_defense_percent/100
    for gate,name in [(basic,'defaultAtkDefRate'),(skill,'skillDefRate'),(flags&0x1f0000000,'phyDefRate'),(flags&0xf800000,'magDefRate'),(flags&(1<<28),'impactPhyDefRate'),(flags&(1<<23),'fireMagDefRate'),(flags&(1<<24),'waterMagDefRate'),(flags&(1<<25),'earthMagDefRate'),(flags&(1<<26),'lightMagDefRate'),(flags&(1<<27),'darkMagDefRate'),(True,'skillAttrDefRate')]:
        if gate:damage=max(0,damage-damage*defender.get(name,0)/100)
    for rate in defense_rates:damage=max(0,damage-damage*f32(rate)/100)
    for gate,name in [(flags&0x1f0000000,'expBuffPhyDefRate'),(flags&0xf800000,'expBuffMagDefRate'),(True,'expBuffAllDefRate')]:
        if gate:damage=max(0,damage-damage*defender.get(name,0)/100)
    for name in (['vsMobDefRate','expBuffVsMobDefRate'] if flags&(1<<20) else ['vsBossDefRate','expBuffVsBossDefRate'] if flags&(1<<18) else []):
        damage=max(0,damage-damage*defender.get(name,0)/100)
    damage=max(0,damage,floor)
    if flags&0x1000:return damage,flags
    if flags&0x800:return 0.,flags
    return max(1.,damage),flags


def heal_amount(percent,max_hp,*,override=0.,heal_rate=None,heal_rate_lower_bound=None):
    """CalcHealAmount: positive actor override bypasses percent and HealRate.
    The original lower-bound lookup must be supplied when effect 229 is present.
    Applying HP caps and choosing the target are separate caller responsibilities.
    """
    values=[percent,max_hp,override]+([] if heal_rate is None else [heal_rate])
    if not all(math.isfinite(v) for v in values):raise ValueError('Non-finite heal input')
    if override>0:return override
    amount=max_hp*percent/100
    if heal_rate is not None:
        if heal_rate_lower_bound is None:raise Unresolved('Original HealRate lower-bound lookup required')
        if not math.isfinite(heal_rate_lower_bound):raise ValueError('Non-finite heal lower bound')
        amount+=amount*max(f32(heal_rate),f32(heal_rate_lower_bound))/100
    return amount
