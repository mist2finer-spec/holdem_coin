"""Exact static reward references and explicit, non-random reward quotes.
No inferred drop probabilities, event routing, server RNG or global zero defaults.
"""
from decimal import Decimal
from reference_progression import Unresolved

CHAPTER_MATERIALS={'BaseGoldsByChapter':1,'BaseExpsByChapter':3,'BaseOrbsOfMasteryByChapter':101,'BaseOrbsOfWillByChapter':121,'BaseCrystalsByChapter':2,'BaseSoulgemsByChapter':131,'BaseManastonesByChapter':112,'BaseEngravegemsByChapter':132,'BaseArcanegemsByChapter':146,'BaseUmbraSigilsByChapter':149}

def amount(value):
 if isinstance(value,dict):
  if 'Value' not in value:raise Unresolved('Missing original amount')
  value=value['Value']
 n=Decimal(str(value))
 if not n.is_finite() or n<0:raise ValueError('Invalid reward amount')
 return n

def base_reward(table,chapter,material):
 if type(chapter) is not int or chapter<1:raise ValueError('Chapter is one-based')
 key=next((k for k,v in CHAPTER_MATERIALS.items() if v==material),None)
 if key is None:raise Unresolved('Material has no recovered chapter baseline')
 rows=table.get(key)
 if rows is None or chapter>len(rows):raise Unresolved('Chapter is outside recovered data; no extrapolation')
 return amount(rows[chapter-1])

def static_material_quote(group):
 """GiveAll literal material rewards only. Unknown event routing is a caller concern."""
 if group['Method']!=1:raise Unresolved('Original random selection policy not restored')
 if 'RewardDatas' not in group:raise Unresolved('Original RewardDatas vector not provided')
 result={}
 for reward in group['RewardDatas']:
  if reward['RewardCategoryType']!=1:raise Unresolved('Non-material grant needs its owning subsystem')
  if reward.get('RefIdleCurChapter',False):raise Unresolved('Idle chapter-relative amount semantics not verified')
  if any(reward.get(k,0) for k in ['GotchaType','GotchaTier','GotchaDispCnt']):raise Unresolved('Gotcha semantics not verified')
  if amount(reward['RewardMin'])!=0:raise Unresolved('Original ranged amount sampling not restored')
  if reward.get('Chance',0)!=0:raise Unresolved('Chance meaning is not inferred from its name')
  mat=reward['RewardType'];result[mat]=result.get(mat,Decimal(0))+amount(reward['RewardCnt'])
 return result

def idle_ticks(elapsed_ms,interval_ms,max_time_ms):
 """Scheduling arithmetic only; not proof that each tick grants a whole baseline."""
 if any(type(n) is not int for n in [elapsed_ms,interval_ms,max_time_ms]) or elapsed_ms<0 or interval_ms<=0 or max_time_ms<0:raise ValueError('Invalid millisecond timing')
 return min(elapsed_ms,max_time_ms)//interval_ms
