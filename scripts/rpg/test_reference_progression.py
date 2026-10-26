import copy,math,unittest
from reference_progression import *


def curve():return {'MinLevel':1,'MaxLevel':5,'BaseValue':{'Value':100},'IncValue':{'Value':10},'IncRate':{'Value':100},'Scaler':{'Value':1000}}


class ProgressionTests(unittest.TestCase):
    def test_core_rounding_not_generic_percent_rounding(self):
        self.assertEqual(combat_art_value({'AbilType':7,'AbilValInc':2.5},1),2)
        self.assertEqual(combat_art_value({'AbilType':26,'AbilValInc':2.5},1),2.5)
    def test_trait_above_cap_returns_zero(self):
        row={'MaxLevel':10,'AbilType':27,'AbilValInc':1.5}
        self.assertEqual(trait_value(row,10),15);self.assertEqual(trait_value(row,11),0)
    def test_invalid_levels_rejected(self):
        for level in [True,-1,1.5]:
            with self.assertRaises(ValueError):combat_art_value({'AbilType':7,'AbilValInc':1},level)
    def test_skill_hold_uses_level_minus_one(self):
        r={'HoldAbilTypes':[7,86],'HoldAbilVals':[2.5,.1],'HoldAbilIncs':[1,.1]}
        self.assertEqual(skill_hold_values(r,1),[(7,2.),(86,.1)])
        self.assertEqual(skill_hold_values(r,2),[(7,4.),(86,.2)])
    def test_mismatched_skill_arrays_do_not_zip_truncate(self):
        with self.assertRaises(Unresolved):skill_hold_values({'HoldAbilTypes':[7],'HoldAbilVals':[2],'HoldAbilIncs':[]},1)
    def test_parameters_float32_intermediate(self):
        r={'ParamCalcMethod':1,'ParamDatas':[{f'V{i}':.1 for i in range(1,10)},{f'V{i}':.2 for i in range(1,10)}]}
        value=skill_parameters(r,4)[0];self.assertEqual(value,f32(f32(.1)+f32(f32(.2)*3)))
        self.assertNotEqual(value,.1+.2*3)
    def test_parameters_table_selection_and_out_of_range(self):
        r={'ParamCalcMethod':0,'ParamDatas':[{f'V{i}':i*10 for i in range(1,10)}]}
        self.assertEqual(skill_parameters(r,1),[i*10 for i in range(1,10)])
        self.assertEqual(skill_parameters(r,0),[0]*9);self.assertEqual(skill_parameters(r,2),[0]*9)
    def test_bad_linear_shape_follows_native_zero_branch(self):
        self.assertEqual(skill_parameters({'ParamCalcMethod':1,'ParamDatas':[]},5),[0]*9)
    def test_nonfinite_skill_parameters_fail(self):
        with self.assertRaises(ValueError):f32(math.nan)
    def test_awaken_uses_snapshot_not_sum(self):
        r={'AwakenAbilityDatas':[{'AbilType':225,'AbilVals':[15,32.3]}]}
        self.assertEqual(skill_awaken_values(r,2),[(225,32.3)]);self.assertEqual(skill_awaken_values(r,0),[])
    def test_costs_sum_each_level_stop_at_affordability(self):
        q=curve_quote([curve()],1,5,4,131,budget=210)
        self.assertEqual(q['quantity'],2);self.assertEqual(q['total'],210);self.assertEqual(q['stop'],'insufficient-material')
    def test_zero_curve_never_free_upgrade(self):
        q=curve_quote([],1,50,100,131);self.assertEqual(q['quantity'],0);self.assertEqual(q['stop'],'missing-or-zero-cost')
    def test_cap_is_separate_from_zero_price(self):
        q=curve_quote([curve()],5,5,10,131);self.assertEqual(q['stop'],'max-level');self.assertEqual(q['quantity'],0)
    def test_cost_quote_does_not_mutate_input(self):
        rows=[curve()];before=copy.deepcopy(rows);curve_quote(rows,1,5,4,131);self.assertEqual(rows,before)
    def test_unknown_missing_pairs_are_not_zero(self):
        with self.assertRaises(Unresolved):pairs({})
        self.assertEqual(pairs({},nullable=True),[])
    def test_will_grade_snapshot_plus_per_level(self):
        table={'WillGradeDatas':[{'Grade':0,'Level':100},{'Grade':1,'Level':200,'AbilTypes':[73],'AbilVals':[5]}],
               'WillAbilTypes':[7],'WillAbilIncPerLevels':[2]}
        self.assertEqual(will_values(table,1,10),[(73,5),(7,20)])
        with self.assertRaises(ValueError):will_values(table,0,101)
    def test_target_level_prerequisite(self):
        t={'CombatArtDatas':[{'Type':102,'ReqAllPrevMax':False,'ReqType':0,'ReqLevel':0}],
           'CombatArtLevelPreqDatas':[{'Type':102,'Level':1,'ReqType':101,'ReqLevel':5}]}
        self.assertEqual(art_requirements(t,102,0,{}),[{'type':101,'level':5}])
        self.assertEqual(art_requirements(t,102,0,{101:5}),[])

if __name__=='__main__':unittest.main()
