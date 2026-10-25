import unittest
from reference_equipment import item_abilities,step_ability,normalize_ability,aggregate_equipment,final_stat,equipment_cost

class ReferenceTests(unittest.TestCase):
 def test_weapon_armor_ring_level_conventions(self):
  r={'EquipAbilTypes':[7,73],'EquipAbilBaseVals':[5.1,10.2],'EquipAbilIncVals':[.1,.2]}
  self.assertEqual(item_abilities(r,1,'weapon','Equip'),[(7,5.),(73,10.2)])
  self.assertEqual(item_abilities(r,1,'armor','Equip'),[(7,5.),(73,10.2)])
  self.assertEqual(item_abilities(r,1,'ring','Equip'),[(7,5.),(73,10.4)])
 def test_midpoint_even_and_decimal_round(self):
  self.assertEqual([normalize_ability(7,x) for x in [2.5,3.5,-2.5,-3.5]],[2,4,-2,-4])
  self.assertEqual(normalize_ability(73,2.675),2.68)
 def test_step_boundaries_replace_not_add(self):
  r={'AbilType':73,'MinLevels':[1,100],'AbilBaseVals':[100,500],'AbilIncVals':[2,3]}
  self.assertEqual([step_ability(r,i) for i in [0,1,99,100,101]],[0,100,296,500,503])
 def test_malformed_does_not_become_zero(self):
  with self.assertRaises(ValueError):item_abilities({},1,'weapon','Equip')
  with self.assertRaises(ValueError):step_ability({'AbilType':7,'MinLevels':[1],'AbilBaseVals':[],'AbilIncVals':[1]},1)
 def test_channels_remain_explicit(self):
  r={'Type':1,'EquipAbilTypes':[7],'EquipAbilBaseVals':[10],'EquipAbilIncVals':[1],'HoldAbilTypes':[73],'HoldAbilBaseVals':[5],'HoldAbilIncVals':[1]}
  v=aggregate_equipment([{'category':'weapon','definition':r,'level':2,'channels':['Hold']}]);self.assertEqual(v['abilities'],{73:6})
 def test_conditional_multiplication(self):
  f={'base':'atk','factors':[{'field':'weaponAtkRate'},{'field':'skillAtkRate','mask':'0x80000'}]}
  self.assertEqual(final_stat({'atk':100,'weaponAtkRate':50,'skillAtkRate':20},f)['value'],150)
  self.assertEqual(final_stat({'atk':100,'weaponAtkRate':50,'skillAtkRate':20},f,0x80000)['value'],180)
 def test_missing_curve_never_free_upgrade(self):
  self.assertIsNone(equipment_cost({'MaxLevel':50,'ReqLevelUpMatFuncDatas':[]},1))
 def test_invalid_values(self):
  with self.assertRaises(ValueError):normalize_ability(7,float('nan'))
  with self.assertRaises(ValueError):final_stat({'atk':float('inf')},{'base':'atk','factors':[]})

if __name__=='__main__':unittest.main()
