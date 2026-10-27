import unittest
from reference_reward_scaling import scaled_baseline,stage_base_reward,hunting_reward_preview,hunting_reward_bonus,hunting_table_preview,native_floor
from reference_weighted_selection import weighted_index
from reference_progression import Unresolved
from reference_shields import ShieldLayer,consume_shields,total_shield,shield_explosion_commands,apply_armor_damage

class RewardScalingTests(unittest.TestCase):
 def setUp(self):self.table={'BaseGoldsByChapter':[{'Value':300},{'Value':333}]}
 def test_idle_chapter_stage_interpolation_is_not_clear_reward(self):
  self.assertEqual([stage_base_reward(self.table,1,s,1,5) for s in range(1,6)],[60,120,180,240,300])
  self.assertEqual([stage_base_reward(self.table,2,s,1,5) for s in range(1,6)],[306,313,319,326,333])
 def test_floor_is_original_not_round_or_truncate(self):
  self.assertEqual(native_floor(-.5),-1);self.assertEqual(scaled_baseline(self.table,2,1,.37),123)
  with self.assertRaises(ValueError):native_floor(float('nan'))
 def test_no_invented_stage_count_or_unknown_material(self):
  with self.assertRaises(Unresolved):stage_base_reward(self.table,1,1,1,0)
  with self.assertRaises(ValueError):stage_base_reward(self.table,1,6,1,5)
  with self.assertRaises(Unresolved):scaled_baseline(self.table,1,999)
 def test_preview_floor_at_each_step_not_once_at_end(self):
  args=dict(base=61,rate_min=250,rate_max=250,count_min=0,count_max=0,weight=40,total_weight=65,total_points=500,event_point=20)
  self.assertEqual(hunting_reward_preview(**args),2338)
  args.update(rate_min=0,rate_max=0,count_min=1,count_max=4)
  self.assertEqual(hunting_reward_preview(**args),30)
 def test_bonus_is_separate_and_positive_only_caller(self):
  self.assertEqual(hunting_reward_bonus(2338,15),350)
  self.assertEqual(hunting_reward_bonus(3,12.5),0)
  with self.assertRaises(ValueError):hunting_reward_bonus(3,-1)
 def test_popup_denominator_filters_locked_and_zero_point_events(self):
  h={'HuntingPopupRewardBasePoint':500,'HuntingEventDatas':[]}
  def row(chapter,points,weight,rewards):return dict(ReqLabyrinthChapter=chapter,EventPoint=points,EventChance=weight,HuntingRewardDatas=rewards,RewardRateMin=100,RewardRateMax=100,RewardCountMin=0,RewardCountMax=0)
  reward={'RewardType':1,'MatType':1}
  h['HuntingEventDatas']=[row(0,20,50,[reward]),row(0,20,50,[]),row(2,20,100,[reward]),row(0,0,100,[reward])]
  self.assertEqual(hunting_table_preview(self.table,h,1,1,5),{1:750})

class SelectionTests(unittest.TestCase):
 def test_all_boundaries_and_zero_weights(self):
  self.assertEqual([weighted_index([0,2,0,3],r) for r in range(5)],[1,1,3,3,3])
  self.assertEqual(weighted_index([]),-1);self.assertEqual(weighted_index([0,0]),-1)
 def test_negative_is_clamped_only_in_signed_overload(self):
  self.assertEqual(weighted_index([-2,0,3],0),2)
  with self.assertRaises(ValueError):weighted_index([-2,3],0,signed=False)
  with self.assertRaises(ValueError):weighted_index([65536],0,signed=False)
 def test_requires_integer_rng_and_safe_sum(self):
  with self.assertRaises(ValueError):weighted_index([1,2],3)
  with self.assertRaises(ValueError):weighted_index([1,2],.2)
  with self.assertRaises(ValueError):weighted_index([2**31-1,1],0)

class ShieldTests(unittest.TestCase):
 def test_newest_layer_first_ignores_stopped_and_nonshield(self):
  layers=[ShieldLayer(50,50),ShieldLayer(20,20,is_shield=False),ShieldLayer(80,80,stop=True),ShieldLayer(30,30)]
  result,remaining=consume_shields(layers,60)
  self.assertEqual([r.remaining for r in result],[20,20,80,0]);self.assertEqual(remaining,0);self.assertEqual(total_shield(result),20);self.assertEqual(layers[-1].remaining,30)
 def test_overkill_and_zero_shields_stop(self):
  result,remaining=consume_shields([ShieldLayer(0,30),ShieldLayer(10,10)],15)
  self.assertTrue(all(r.stop for r in result));self.assertEqual(remaining,5)
 def test_explosion_selects_stopped_not_first_run_and_hits_owner(self):
  layers=[ShieldLayer(0,100,stop=True,effect_type=901,explosion_multiplier=.5),ShieldLayer(0,100,effect_type=901),ShieldLayer(0,100,stop=True,effect_type=901,exploded=True)]
  commands=shield_explosion_commands(layers);self.assertEqual(len(commands),1);self.assertEqual(commands[0]['damage'],50);self.assertEqual(commands[0]['damageTarget'],'shield-owner');self.assertFalse(layers[0].exploded)
 def test_groggy_once_on_positive_to_zero_crossing(self):
  self.assertEqual(apply_armor_damage(10,10,20,2),(0,[{'effectType':114,'duration':2}]))
  self.assertEqual(apply_armor_damage(0,10,20,2),(0,[]));self.assertEqual(apply_armor_damage(10,10,20,2,alive=False),(10,[]))

if __name__=='__main__':unittest.main()
