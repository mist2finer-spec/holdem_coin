"""Original shield-layer consumption and explicit post-damage command planning.
Layers are stored in insertion order. Passive callbacks/FX are external.
"""
import math
from dataclasses import dataclass,replace
from reference_progression import f32

@dataclass(frozen=True)
class ShieldLayer:
 remaining:float
 shield_original:float
 is_shield:bool=True
 stop:bool=False
 effect_type:int=900
 exploded:bool=False
 explosion_multiplier:float=0.
 armor_damage:float=0.
 camera_shake:float=0.
 skill_type:int=0

def consume_shields(layers,damage):
 if not math.isfinite(damage) or damage<0:raise ValueError('Invalid shield damage')
 if not all(math.isfinite(l.remaining) and l.remaining>=0 for l in layers):raise ValueError('Invalid shield layer')
 result=list(layers)
 for i in range(len(result)-1,-1,-1):
  layer=result[i]
  if not layer.is_shield or layer.stop:continue
  if layer.remaining<=damage:
   damage-=layer.remaining;result[i]=replace(layer,remaining=0.,stop=True)
  else:result[i]=replace(layer,remaining=layer.remaining-damage);damage=0.
  if damage<=0:break
 return result,damage

def total_shield(layers):
 return sum(l.remaining for l in layers if l.is_shield and not l.stop)

def shield_explosion_commands(layers):
 """Source-grounded selection only. Caller must execute damage BEFORE marking exploded.
 901 damages the shield OWNER, not a reflected attack on the incoming attacker.
 """
 commands=[]
 for i,layer in enumerate(layers):
  if layer.effect_type!=901 or layer.remaining>0 or not layer.stop or layer.exploded:continue
  if not all(math.isfinite(x) for x in [layer.shield_original,layer.explosion_multiplier,layer.armor_damage,layer.camera_shake]):raise ValueError('Invalid explosion data')
  commands.append({'layerIndex':i,'damageTarget':'shield-owner','damage':layer.shield_original*f32(layer.explosion_multiplier) if layer.explosion_multiplier>0 else 0.,'flags':0x200,'skillType':layer.skill_type,'armorDamage':f32(layer.armor_damage),'cameraShake':f32(layer.camera_shake),'markExplodedAfterDamage':True})
 return commands

def apply_armor_damage(armor,max_armor,damage,groggy_duration,*,alive=True):
 if not all(math.isfinite(n) and n>=0 for n in [armor,max_armor,damage,groggy_duration]) or armor>max_armor:raise ValueError('Invalid armor state')
 groggy_duration=f32(groggy_duration)
 if not alive or damage<=0 or armor<=0:return armor,[]
 armor=min(max_armor,max(0.,armor-damage))
 return armor,([{'effectType':114,'duration':f32(groggy_duration)}] if armor<=0 and groggy_duration>0 else [])
