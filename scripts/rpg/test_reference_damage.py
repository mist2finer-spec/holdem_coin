import unittest
from reference_damage import final_damage,heal_amount
from reference_progression import Unresolved
class DamageTests(unittest.TestCase):
 def test_defense_is_sequential_and_global_max_is_applied_afterwards(self):
  self.assertEqual(final_damage(100,64|0x100000000,{},dict(defaultAtkDefRate=50,phyDefRate=50))[0],25)
  self.assertEqual(final_damage(100,64,{},dict(defaultAtkDefRate=150))[0],10)
 def test_character_type_is_not_inferred_from_the_damage_school(self):
  self.assertEqual(final_damage(100,64,dict(vsMobDmgRate=100))[0],100)
  self.assertEqual(final_damage(100,64|1<<19,dict(vsMobDmgRate=100))[0],200)
 def test_negative_offense_is_ignored_except_weapon_bonus(self):
  self.assertEqual(final_damage(100,64,dict(defaultAtkDmgRate=-20))[0],100)
  self.assertEqual(final_damage(100,64,dict(weaponTypeDmgRate=-20))[0],80)
 def test_zero_damage_minimum_and_no_damage_flags(self):
  self.assertEqual(final_damage(0,0)[0],1)
  self.assertEqual(final_damage(100,0x800)[0],0)
  self.assertEqual(final_damage(0,0x1000)[0],0)
 def test_unknown_effect_state_is_never_treated_as_no_effects(self):
  with self.assertRaises(Unresolved):final_damage(100,64,active_effects=True)
  with self.assertRaises(ValueError):final_damage(float('nan'),0)
 def test_attribute_negation_sets_flags_and_prevents_one_damage_floor(self):
  damage,flags=final_damage(100,64,attribute_adjustment=-100)
  self.assertEqual(damage,0);self.assertTrue(flags&0x800);self.assertTrue(flags&0x400000)
 def test_dmg_effect_and_critical_bonus_share_a_single_additive_group(self):
  self.assertEqual(final_damage(100,65,critical_effect_bonus=20,damage_rate=10)[0],130)
 def test_defense_effects_reduce_sequentially(self):
  self.assertEqual(final_damage(100,64,defense_rates=[20,30])[0],56)
 def test_heal_override_and_rate_lower_bound(self):
  self.assertEqual(heal_amount(10,1000,override=15),15)
  self.assertEqual(heal_amount(10,1000,heal_rate=-90,heal_rate_lower_bound=-50),50)
  with self.assertRaises(Unresolved):heal_amount(10,1000,heal_rate=-90)
if __name__=='__main__':unittest.main()
