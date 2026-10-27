"""Original critical sequence with caller-supplied rolls and DB caps (percent units).
No hidden RNG, guessed cap, or default active-effect magnitude.
"""
import math
from reference_progression import f32

def critical_damage(damage,flags,*,chance,damage_percent,resistance,bonus,cap,rolls):
    values=[damage,chance,damage_percent,resistance,bonus,cap,*rolls]
    if not all(math.isfinite(x) for x in values) or any(not 0<=r<1 for r in rolls):raise ValueError('Invalid critical inputs')
    it=iter(rolls);used=0
    def roll():
        nonlocal used
        used+=1
        try:return f32(next(it))*100
        except StopIteration:raise ValueError('Missing original RNG roll') from None
    if roll()<min(chance+f32(bonus),cap):
        if resistance>0 and roll()<resistance:return damage,flags,used
        return damage*(1+damage_percent/100),flags|1,used
    return damage,flags,used

def hypercritical_damage(damage,flags,*,chance,damage_percent,bonus,cap,roll,effect_values=()):
    if not flags&1:return damage,flags,0
    if not all(math.isfinite(x) for x in [damage,chance,damage_percent,bonus,cap,roll,*effect_values]) or not 0<=roll<1:raise ValueError('Invalid hypercritical inputs')
    chance+=f32(bonus)
    for value in effect_values:chance+=f32(value)
    if f32(roll)*100<min(chance,cap):return damage*(1+damage_percent/100),flags|2,1
    return damage,flags,1
