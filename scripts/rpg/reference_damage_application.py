"""Recovered InflictDamage HP/shield settlement, independent of final-damage math.
Passive trigger IDs are emitted in original order; their effects are not invented.
"""
from dataclasses import dataclass,field
import math
from reference_progression import f32

@dataclass
class DamageTarget:
    hp:float
    max_hp:float
    shield:float=0.
    actor_flags:int=0
    invincible:bool=False
    invincible_shield:bool=False

@dataclass
class DamageApplication:
    hp:float
    shield:float
    gross_damage:float
    hp_damage:float
    shield_spent:float
    flags:int
    passive_triggers:list=field(default_factory=list)
    dispatched:bool=True


def inflict_damage(target,damage,shield_bonus=0.,flags=0):
    if target is None:return DamageApplication(0.,0.,0.,0.,0.,flags,dispatched=False)
    if not all(math.isfinite(n) for n in [target.hp,target.max_hp,target.shield,damage,shield_bonus]) or min(target.hp,target.max_hp,target.shield,damage)<0:
        raise ValueError('Invalid damage settlement input')
    hp,shield=target.hp,target.shield
    if hp<=0 or target.actor_flags&0x400:return DamageApplication(hp,shield,0.,0.,0.,flags,dispatched=False)
    ignore_invincibility=bool(flags&0x4000);events=[];spent=0.;hp_loss=0.
    if target.invincible and not ignore_invincibility:
        damage=0.;flags|=0x2000
    else:
        if target.actor_flags&0x200:damage=min(damage,1.)
        if damage>0:
            if shield>0:
                if target.invincible_shield and not ignore_invincibility:
                    damage=0.;flags|=0x2000
                else:
                    bonus=f32(shield_bonus)
                    shield_hit=damage+damage*bonus/100 if bonus>0 else damage
                    spent=min(shield_hit,shield);shield-=spent
                    # Exact native expression; do not replace with guessed (1 + bonus/100).
                    hp_equivalent=spent/(f32(100/bonus+1)) if bonus>0 else spent
                    remainder=max(0.,damage-hp_equivalent)
                    hp_loss=min(hp,remainder);hp=max(0.,hp-remainder)
                if shield<=0:events.append(15)
            else:
                hp_loss=min(hp,damage);hp=max(0.,hp-damage)
    events.append(12)
    if hp<=0:events.append(11)
    return DamageApplication(hp,shield,damage,hp_loss,spent,flags,events)
