import json,sqlite3,tempfile,unittest
from pathlib import Path
from restore_detailed_db import build
from rpg_db import ReferenceDB


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.source=self.root/'source';(self.source/'decoded').mkdir(parents=True);(self.source/'evidence').mkdir()
        tables={'TeamData':{'MaxLevel':3,'LevelUpQuadFuncDatas':[]},'WeaponData':{'WeaponDatas':[],'WeaponGradeDatas':[]},
                'ActorData':{'ActorDatas':[{'ActorType':42,'Size':0.,'_absentDefaultsUnresolved':['SkillTypes']}]},
                'ActionData':{'ActionDatas':[]},'CombatArtData':{'CombatArtDatas':[{'Type':101,'Tier':1,'MaxLevel':2,'AbilType':7,'AbilValInc':1,'ReqType':0}]},
                'TraitData':{'TraitDatas':[{'Type':101,'Board':1,'MaxLevel':2,'AbilType':7,'AbilValInc':.5}]},'SkillData':{'SkillDatas':[],'SkillGradeDatas':[]}}
        for name,doc in tables.items():(self.source/'decoded'/f'{name}.json').write_text(json.dumps(doc))
        enum={'enums':{'BalanceData.ActorAbilityType':{'entries':[{'name':'Atk','value':7}]}}}
        (self.source/'evidence/metadata-enums.json').write_text(json.dumps(enum));self.output=self.root/'output';self.result=build(self.source,self.output);self.db=ReferenceDB(self.output/'vardian-reference.sqlite')
    def tearDown(self):self.db.close();self.tmp.cleanup()
    def test_source_roundtrip_and_missing_are_distinct_from_zero(self):
        row=self.db.records('ActorData','ActorDatas')[0];self.assertEqual(row['Size'],0);self.assertNotIn('SkillTypes',row);self.assertEqual(row['_absentDefaultsUnresolved'],['SkillTypes'])
    def test_query_by_type_not_row_index(self):
        self.assertEqual(self.db.records('TraitData','TraitDatas',101)[0]['Type'],101);self.assertEqual(self.db.records('TraitData','TraitDatas',102),[])
    def test_readonly_cannot_mutate(self):
        with self.assertRaises(sqlite3.OperationalError):self.db.db.execute('DELETE FROM records')
    def test_unknown_table_and_parameterized_queries(self):
        with self.assertRaises(KeyError):self.db.table("TeamData' OR 1=1 --")
        self.assertEqual(self.db.records("TeamData' OR 1=1 --",'TraitDatas'),[])
    def test_existing_output_is_never_overwritten(self):
        with self.assertRaises(ValueError):build(self.source,self.output)
    def test_complete_level_exports_include_zero_and_max(self):
        lines=(self.output/'evaluated/combat-art-and-trait-all-levels.csv').read_text(encoding='utf-8-sig').splitlines();self.assertEqual(len(lines),7)
    def test_database_reopens_without_journal_recovery(self):
        self.assertEqual(self.db.db.execute('PRAGMA integrity_check').fetchone()[0],'ok');self.assertFalse((self.output/'vardian-reference.sqlite-journal').exists())
    def test_growth_and_zero_cost_rejection(self):
        self.assertEqual(self.db.growth('trait',101,3)['value'],0);self.assertEqual(self.db.costs('team',0,1)['quantity'],0)

if __name__=='__main__':unittest.main()
