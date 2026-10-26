import unittest
from reference_monsters import *


def action():return {'SkillType':2010,'HoldTime':1.5,'ApproachDistance':1.,'CooltimeMethod':0,'CooltimeParam':1,'CooltimeValue':0.,'MpCostParam':1,'MpCostValue':0.,'SkillTag':160,
 'BasicDatas':[{'Time':.15,'Type':33,'Mute':False,'DataIdx':0,'DataId':8,'Condition':0,'ConditionTarget':0,'ConditionValue':0.,'ConditionValue2':0.}],
 'ImpactorDatas':[{'DataId':8,'MovingEffectDataIds':[9],'MovingEffectDataIdxs':[0]}],'EffectDatas':[{'DataId':9,'Type':1,'V1':100.}]}


class MonsterTests(unittest.TestCase):
 def test_stage_decode_and_boss_section(self):
  self.assertEqual(stage_number(101),(1,1));self.assertEqual(stage_number(120005),(1200,5))
  for n in [100,106,0,1.5]:
   with self.assertRaises(ValueError):stage_number(n)
 def test_flag_domains_and_or_semantics(self):
  self.assertEqual(boss_flags(0,8,1),SOURCE_MOB|TARGET_BOSS)
  self.assertEqual(boss_flags(TARGET_MOB,1,1),SOURCE_BOSS|TARGET_BOSS|TARGET_MOB)
  self.assertEqual(boss_flags(0,9,9),SOURCE_BOSS|TARGET_BOSS)
 def test_positive_damage_bonuses_add_within_class(self):
  self.assertEqual(class_attack_damage(100,{21:20,161:30,22:200},TARGET_MOB),150)
  self.assertEqual(class_attack_damage(100,{21:-50,161:30},TARGET_MOB),130)
 def test_boss_damage_ignores_mob_bonuses(self):self.assertEqual(class_attack_damage(100,{21:999,22:25,162:5},TARGET_BOSS),130)
 def test_defense_is_sequential_not_additive(self):self.assertEqual(class_defense_damage(100,{51:20,166:30},SOURCE_MOB),56)
 def test_defense_global_cap_preserves_ten_percent_floor(self):self.assertEqual(class_defense_damage(100,{52:200},SOURCE_BOSS),10)
 def test_target_boss_does_not_trigger_defense_against_boss(self):self.assertEqual(class_defense_damage(100,{52:50},TARGET_BOSS),100)
 def test_stage_scale_slots_independent(self):
  stage={'BaseAbilityDatas':[{'AbilType':7,'AbilVal':3},{'AbilType':8,'AbilVal':80}]};actor={'MovDistPerSec':0};combat={'MonsterMovDistPerSec':3}
  mob={'HeroAbilityBased':0,'AbilityDatas':[{'AbilType':7,'AbilVal':100},{'AbilType':8,'AbilVal':10000}]}
  self.assertEqual(monster_abilities(stage,mob,actor,combat),{2:3,7:3,8:8000})
 def test_hero_scaling_not_guessed(self):
  with self.assertRaises(Unresolved):monster_abilities({}, {'HeroAbilityBased':1},{},{})
 def test_hp_reduction_selects_target_class_and_rounds_ties_even(self):
  self.assertEqual(adjusted_monster_hp(15,{44:10,45:20},8),14)
  self.assertEqual(adjusted_monster_hp(15,{44:10,45:20},1),12)
  self.assertEqual(adjusted_monster_hp(25,{44:10},8),22)
  self.assertEqual(adjusted_monster_hp(15.5,{44:0},8),15.5)
 def test_attack_emits_impactor_at_creation_time(self):
  t=action_timeline(action());self.assertEqual(action_events_between(t,-1e-9,.1),[])
  events=action_events_between(t,.1,.2);self.assertEqual(len(events),1);self.assertEqual(events[0]['effects'][0]['effect']['V1'],100)
  self.assertEqual(action_events_between(t,.2,.3),[]);self.assertEqual(t['durationLowerBound'],1.5)
 def test_dead_or_unproven_condition_emits_no_attack(self):
  a=action();a['BasicDatas'][0]['Condition']=3;t=action_timeline(a)
  self.assertEqual(action_events_between(t,0,1),[]);self.assertEqual(action_events_between(t,0,1,condition=lambda _:True)[0]['type'],33)
  self.assertEqual(action_events_between(t,0,1,alive=False,condition=lambda _:True),[])
 def test_child_identity_checked(self):
  a=action();a['ImpactorDatas'][0]['DataId']=1
  with self.assertRaises(ValueError):action_timeline(a)
 def test_effect_identity_checked(self):
  a=action();a['EffectDatas'][0]['DataId']=1
  with self.assertRaises(ValueError):action_timeline(a)
 def test_collider_counts_are_not_instant_damage_counts(self):
  a=action();a['ImpactorDatas'][0]['MovingHitCount']=2;t=action_timeline(a)
  self.assertEqual(len(action_events_between(t,0,1)),1)

if __name__=='__main__':unittest.main()
