import unittest
from reference_session_equipment import decode_option,selected_option_codes,stored_option_values,session_equipment,breakthrough_status,tanh_difference,armor_gauge_loss

class SessionTests(unittest.TestCase):
 def setUp(self):
  self.row={'Type':1,'Kind':1,'EquipAbilTypes':[7],'EquipAbilBaseVals':[10],'EquipAbilIncVals':[1],'HoldAbilTypes':[73],'HoldAbilBaseVals':[5],'HoldAbilIncVals':[1],'OpSetData':{'OpNum':1,'OpDatasByIdx':[{'AbilType':26,'AbilValsByGradeIdx':[1,2,3]}]}}
 def test_decode_signed_lock(self):self.assertEqual(decode_option(-2147483135),{'locked':True,'grade':2,'index':1})
 def test_presets_pairs(self):
  s={'ops1':[1],'ops3':[3],'opPresets':[8,2]};self.assertEqual(selected_option_codes(s,8),[3]);self.assertEqual(selected_option_codes(s,9),[1])
 def test_malformed_pairs(self):
  with self.assertRaises(ValueError):selected_option_codes({'opPresets':[1]})
 def test_stored_grade_and_lock_dont_change_effect(self):
  a=stored_option_values(self.row,[0x200]);b=stored_option_values(self.row,[0x80000200]);self.assertEqual(a[0]['value'],2);self.assertEqual(a[0]['value'],b[0]['value'])
 def test_missing_code_is_zero_not_free_option(self):self.assertEqual(stored_option_values(self.row,[])[0]['value'],0)
 def test_hold_once_not_count_scaled(self):
  defs={1:('armor',self.row)}
  a=session_equipment(defs,[{'type':1,'level':1,'count':100}],[]);self.assertEqual(a['abilities'],{73:5})
 def test_equipped_keeps_hold_and_adds_equip_options(self):
  r=session_equipment({1:('armor',self.row)},[{'type':1,'level':1,'ops1':[0x200]}],[1]);self.assertEqual(r['abilities'],{73:5,7:10,26:2})
 def test_duplicate_schemas_rejected(self):
  with self.assertRaises(ValueError):session_equipment({1:('armor',self.row)},[{'type':1,'level':1}]*2,[])
 def test_unresolved_hold_conditions_explicit(self):
  self.row['HoldOpDatas']=[{'AbilType':85,'AbilVal':10,'Conditions':[{'Type':30}]}]
  r=session_equipment({1:('armor',self.row)},[{'type':1,'level':1}],[]);self.assertFalse(r['complete']);self.assertNotIn(85,r['abilities'])
 def test_breakthrough_requires_proven_conditions(self):
  args=({'Grade':8},{'level':600},{'MaxLevel':600},[{'Grade':8,'Degree':1,'MaxLevel':900,'Conditions':[{'Type':32}]}])
  self.assertIsNone(breakthrough_status(*args)['allowed']);self.assertTrue(breakthrough_status(*args,condition_check=lambda c:True)['allowed'])
 def test_breakthrough_level_gate(self):
  self.assertFalse(breakthrough_status({'Grade':8},{'level':599},{'MaxLevel':600},[{'Grade':8,'Degree':1,'MaxLevel':900,'Conditions':[]}])['allowed'])
 def test_tanh_equal_and_symmetric(self):self.assertEqual(tanh_difference(100,100,300,1.2,.2),0);self.assertAlmostEqual(tanh_difference(100,200,300,1.2,.2),-tanh_difference(200,100,300,1.2,.2))
 def test_armor_is_separate_gauge(self):self.assertEqual(armor_gauge_loss({'DecArmorOnCriHit':2,'DecArmorOnDefaultAtkDmg':3,'DecArmorOnSkillDmg':99},1|64),5)


class FurtherConditionTests(unittest.TestCase):
 def test_grade_unlock_uses_any_preset_not_active_one(self):
  from reference_session_equipment import own_option_grade_condition
  d={'Type':1501,'OpSetData':{'OpNum':2}};c={'Type':30,'V1':1501,'V2':5}
  self.assertTrue(own_option_grade_condition(d,{'ops1':[0x100,0x100],'ops5':[0x500,0x80000501]},'weapon',c))
  self.assertFalse(own_option_grade_condition(d,{'ops5':[0x500]},'weapon',c))
 def test_breakthrough_requires_all_four_weapons_and_two_max_subweapons(self):
  from reference_session_equipment import breakthrough_condition
  w=[{'Type':i,'Tier':1,'Grade':8} for i in range(4)];s=[{'Type':i,'Tier':1,'Grade':8,'MaxLevel':600} for i in range(2)]
  owned={i:{'level':600} for i in range(4)};sub={i:{'level':600} for i in range(2)}
  self.assertTrue(breakthrough_condition({'Type':32,'V1':8,'V2':600},w,owned,s,sub))
  owned[3]['level']=599;self.assertFalse(breakthrough_condition({'Type':32,'V1':8,'V2':600},w,owned,s,sub))
  self.assertTrue(breakthrough_condition({'Type':33,'V1':8,'V2':2},w,owned,s,sub))
  sub[1]['level']=599;self.assertFalse(breakthrough_condition({'Type':33,'V1':8,'V2':2},w,owned,s,sub))

class OptionQuoteTests(unittest.TestCase):
 def test_roundtrip_signed(self):
  from reference_session_equipment import encode_option
  self.assertEqual(decode_option(encode_option(True,5,2)),{'locked':True,'grade':5,'index':2})
 def test_invalid_cost_never_free(self):
  from reference_session_equipment import reroll_cost
  d={'OpSetData':{'ReqMatCntsByLockedNum':[{'Value':100},{'Value':200}]}}
  self.assertEqual(reroll_cost(d,1),200);self.assertIsNone(reroll_cost(d,2));self.assertIsNone(reroll_cost(d,-1))

if __name__=='__main__':unittest.main()
