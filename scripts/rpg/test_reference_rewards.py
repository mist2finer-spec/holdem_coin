import unittest
from decimal import Decimal
from reference_rewards import amount,base_reward,static_material_quote,idle_ticks
from reference_progression import Unresolved

class RewardTests(unittest.TestCase):
 def test_exact_large_amount_and_missing_not_zero(self):
  self.assertEqual(amount({'Value':'11162225642645'}),Decimal('11162225642645'))
  for n in ['NaN','Infinity','-1']:
   with self.assertRaises(ValueError):amount(n)
  with self.assertRaises(Unresolved):amount({})
 def test_no_baseline_extrapolation(self):
  table={'BaseGoldsByChapter':[{'Value':300},{'Value':500}]}
  self.assertEqual(base_reward(table,2,1),500)
  with self.assertRaises(Unresolved):base_reward(table,3,1)
  with self.assertRaises(ValueError):base_reward(table,0,1)
 def test_literal_reward_is_exact_and_aggregates(self):
  row={'RewardCategoryType':1,'RewardType':1,'RewardCnt':{'Value':300},'RewardMin':{'Value':0},'Chance':0}
  self.assertEqual(static_material_quote({'Method':1,'RewardDatas':[row,row]}),{1:600})
  for altered in [dict(row,Chance=20),dict(row,RefIdleCurChapter=True),dict(row,RewardCategoryType=3),dict(row,RewardMin={'Value':1})]:
   with self.assertRaises(Unresolved):static_material_quote({'Method':1,'RewardDatas':[altered]})
  with self.assertRaises(Unresolved):static_material_quote({'Method':2,'RewardDatas':[row]})
  with self.assertRaises(Unresolved):static_material_quote({'Method':1})
 def test_idle_time_cap_is_not_a_grant_formula(self):
  self.assertEqual(idle_ticks(86400000*2,120000,86400000),720)
  self.assertEqual(idle_ticks(119999,120000,86400000),0)
  with self.assertRaises(ValueError):idle_ticks(-1,120000,86400000)

class RewardDatabaseTests(unittest.TestCase):
 def test_builder_preserves_exact_values_links_and_readonly_queries(self):
  import json,tempfile,sqlite3
  from pathlib import Path
  from restore_reward_db import build
  from reference_rewards import CHAPTER_MATERIALS
  from reward_db import query
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);source=root/'decoded';source.mkdir();(root/'evidence').mkdir()
   material_ids=list(CHAPTER_MATERIALS.values())
   table={k:[{'Value':'11162225642645'}] for k in CHAPTER_MATERIALS};table['LabyrinthProgressRewardDatas']=[]
   for k in ['IdleRewardTimeInterval','IdleRewardMaxTime','IdleRewardBadgeTime','IdleRewardBonusMaxTime','IdleRewardPushDelayStacked','IdleRewardPushDelayFull','IdleRewardFxTime1','IdleRewardFxTime2','IdleRewardBonusMaxCnt']:table[k]=1
   docs={'LabyrinthData':table,'MaterialData':{'MaterialDatas':[{'Type':m,'IconKey':'x','MaxCount':{'Value':0},'MaxRechargeCount':{'Value':0}} for m in material_ids]},'HuntingData':{'HuntingEventDatas':[]}}
   for name,doc in docs.items():(source/(name+'.json')).write_text(json.dumps(doc))
   enums={'enums':{'BalanceData.MaterialType':{'entries':[{'value':m,'name':str(m)} for m in material_ids]}}};(root/'evidence/metadata-enums.json').write_text(json.dumps(enums))
   row={'RewardCategoryType':1,'RewardType':1,'RewardCnt':{'Value':'11162225642645'},'RewardMin':{'Value':0},'RefIdleCurChapter':False,'Chance':0}
   stage={'category':'Labyrinth','stageId':1,'data':{'MapType':1,'RewardGroup1Data':{'Method':1,'RewardDatas':[row]}}};(source/'stages.jsonl').write_text(json.dumps(stage)+'\n')
   out=root/'output';result=build(source,out);db=out/'vardian-rewards.sqlite'
   self.assertEqual(result['counts']['chapter_baselines'],10)
   self.assertEqual(query(db,chapter=1,material=1)[0]['amount'],'11162225642645')
   self.assertEqual(query(db,category='Labyrinth',stage=1)[0]['amount'],'11162225642645')
   self.assertEqual(query(db,material=1)[0]['max_count'],'0')
   with self.assertRaises(ValueError):query(db,stage=1)
   with self.assertRaises(FileExistsError):build(source,out)

if __name__=='__main__':unittest.main()
