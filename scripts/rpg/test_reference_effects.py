import unittest
from reference_effects import resolve_effect
from reference_progression import Unresolved
class EffectTests(unittest.TestCase):
 def effect(self):return dict(Type=1,ApplyTarget=2,P1=2,V1=100,FilterOp=0)
 def skill(self):return dict(ParamCalcMethod=1,ParamDatas=[{f'V{i}':400 if i==1 else 0 for i in range(1,10)},{f'V{i}':10 if i==1 else 0 for i in range(1,10)}])
 def test_actual_level_replaces_the_level_one_placeholder(self):
  self.assertEqual(resolve_effect(self.effect(),self.skill(),3)['values'][0],420)
 def test_symbolic_effect_has_no_implicit_level_one_fallback(self):
  with self.assertRaises(Unresolved):resolve_effect(self.effect())
 def test_literal_effect_and_zero_chance(self):
  e=self.effect();e['P1']=0
  self.assertEqual(resolve_effect(e)['values'][0],100);self.assertEqual(resolve_effect(e)['chancePercent'],100)
 def test_damage_extra_uses_parameter_selector(self):
  e=self.effect();e['DamageExtraData']=dict(CriBonusParam=2,CriBonusValue=0)
  self.assertEqual(resolve_effect(e,self.skill(),2)['damageExtra']['CriBonus'],410)
 def test_rejected_filter_does_not_resolve_chance(self):
  e=self.effect();e['P1']=0;e['FilterOp']=1;e['FilterDatas']=[dict(Condition=1,ConditionTarget=2)];e['ChanceParam']=0
  self.assertFalse(resolve_effect(e)['eligible'])
 def test_filter_rejection_precedes_symbolic_damage_resolution(self):
  e=self.effect();e['FilterOp']=1;e['FilterDatas']=[dict(Condition=1,ConditionTarget=2)]
  self.assertFalse(resolve_effect(e)['eligible'])
 def test_given_skill_cannot_silently_use_level_zero(self):
  with self.assertRaises(Unresolved):resolve_effect(self.effect(),self.skill(),0)
 def test_disabled_filter_does_not_require_unused_symbolic_parameters(self):
  e=self.effect();e['P1']=0;e['FilterDatas']=[dict(Condition=20,ConditionTarget=2,ConditionParam=2)]
  self.assertTrue(resolve_effect(e)['eligible'])
if __name__=='__main__':unittest.main()
