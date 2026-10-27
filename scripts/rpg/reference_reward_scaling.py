"""Native reward interpolation and hunting preview. Not a server lottery policy.
Original BigInt helpers floor binary64 at EACH arithmetic operation.
"""
import math
from reference_rewards import CHAPTER_MATERIALS,base_reward
from reference_progression import Unresolved,f32

def native_floor(value):
 if not math.isfinite(value):raise ValueError('Non-finite reward arithmetic')
 return float(math.floor(value))

def scaled_baseline(table,chapter,material,scale=1.):
 if not math.isfinite(scale) or scale<0:raise ValueError('Invalid reward scale')
 return native_floor(float(base_reward(table,chapter,material))*scale)

def stage_base_reward(table,chapter,stage,material,stage_count,scale=1.):
 """0x6c54368: previous + floor(floor((current-previous)*stage)/count).
 Stage count must come from the original stage-count lookup, not a guessed 5.
 """
 if type(stage_count) is not int or stage_count<=0:raise Unresolved('Positive original chapter stage count required')
 if type(stage) is not int or not 1<=stage<=stage_count:raise ValueError('Stage outside original chapter')
 previous=scaled_baseline(table,chapter-1,material,scale) if chapter>1 else 0.
 current=scaled_baseline(table,chapter,material,scale)
 delta=native_floor(current-previous)
 delta=native_floor(delta*f32(stage))
 delta=native_floor(delta/f32(stage_count))
 return native_floor(previous+delta)

def hunting_reward_preview(*,base,rate_min,rate_max,count_min,count_max,weight,total_weight,total_points,event_point):
 """Arithmetic block in UIHuntingUtil.RebuildHuntingRewardList. No actual roll."""
 nums=[base,rate_min,rate_max,count_min,count_max,weight,total_weight,total_points,event_point]
 if not all(math.isfinite(n) and n>=0 for n in nums) or event_point<=0 or total_weight<=0:raise ValueError('Invalid hunting preview inputs')
 if any(type(n) is not int for n in [rate_min,rate_max,count_min,count_max]):raise ValueError('Native rates/counts must be integers')
 share=weight/total_weight;events=total_points/event_point
 if rate_min<1 or rate_max<1:
  return native_floor(share*events*((count_min+count_max)//2))
 value=native_floor(base*f32((rate_min+rate_max)//2))
 value=native_floor(value/100.)
 value=native_floor(value*events)
 return native_floor(value*share)

def hunting_reward_bonus(base,rate):
 """0x3c69d34 returns bonus separately, NOT a replacement for base amount."""
 if not all(math.isfinite(n) and n>=0 for n in [base,rate]):raise ValueError('Invalid bonus')
 return native_floor(native_floor(base*rate)/100.)


def hunting_table_preview(labyrinth,hunting,chapter,stage,stage_count):
 """Expected display for HuntingPopupRewardBasePoint, never sampled/granted loot.
 EventChance is normalized as a preview weight among eligible point-cost events.
 This does not establish the server's event selection algorithm.
 """
 eligible=[r for r in hunting['HuntingEventDatas'] if r['EventPoint']!=0 and r['ReqLabyrinthChapter']<=chapter and r['HuntingRewardDatas']]
 # Original denominator includes eligible events even with an empty reward list.
 denominator=sum(r['EventChance'] for r in hunting['HuntingEventDatas'] if r['EventPoint']!=0 and r['ReqLabyrinthChapter']<=chapter)
 result={}
 if denominator<=0:return result
 for r in eligible:
  for reward in r['HuntingRewardDatas']:
   if reward['RewardType']!=1:continue
   mat=reward['MatType'];base=stage_base_reward(labyrinth,chapter,stage,mat,stage_count) if r['RewardRateMin']>0 and r['RewardRateMax']>0 else 0.
   value=hunting_reward_preview(base=base,rate_min=r['RewardRateMin'],rate_max=r['RewardRateMax'],count_min=r['RewardCountMin'],count_max=r['RewardCountMax'],weight=r['EventChance'],total_weight=denominator,total_points=hunting['HuntingPopupRewardBasePoint'],event_point=r['EventPoint'])
   result[mat]=native_floor(result.get(mat,0.)+value)
 return result
