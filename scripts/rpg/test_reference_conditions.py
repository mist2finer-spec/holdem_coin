import unittest
from reference_conditions import condition,filter_target,unconditional_filter
from reference_progression import Unresolved
class ConditionTests(unittest.TestCase):
    def setUp(self):self.actor=dict(hp=50,maxHP=100,mp=25,maxMP=50,shield=0,markings={7:{'count':2,'maximum':True}})
    def row(self,kind,a=0,b=0,target=2):return dict(Condition=kind,ConditionTarget=target,ConditionValue=a,ConditionValue2=b)
    def test_empty_and_disabled_filters_do_not_resolve_targets_or_parameters(self):
        self.assertTrue(filter_target([{'Condition':255}],0))
        for op in (0,1,2):self.assertTrue(filter_target([],op))
    def test_strict_greater_and_inclusive_less(self):
        for gt,lte in [(20,21),(40,41)]:
            self.assertFalse(condition(self.row(gt,50),actual=self.actor))
            self.assertTrue(condition(self.row(lte,50),actual=self.actor))
            self.assertTrue(condition(self.row(gt,49),actual=self.actor))
    def test_zero_maximum_and_missing_target(self):
        self.actor['maxHP']=0
        self.assertTrue(condition(self.row(21,0),actual=self.actor))
        self.assertFalse(condition(self.row(21,100)))
        self.assertTrue(condition(self.row(0)))
    def test_filter_and_or_and_short_circuit(self):
        yes=self.row(0);no=self.row(1)
        self.assertFalse(filter_target([yes,no],1));self.assertTrue(filter_target([no,yes],2))
        self.assertTrue(filter_target([yes,{'Condition':255}],2))
    def test_target_context_is_distinct(self):
        self.assertTrue(condition(self.row(20,40,target=1),invoker=self.actor))
        self.assertFalse(condition(self.row(20,40,target=1),actual=self.actor))
        self.assertTrue(condition(self.row(20,40,target=3),sensored=self.actor))
        self.assertFalse(condition(self.row(20,40,target=3),sensored=self.actor,context=False))
    def test_symbolic_values_require_parameters_and_ignore_literal_multiplier(self):
        r=self.row(20,100);r['ConditionParam']=2
        self.assertTrue(condition(r,actual=self.actor,parameters=[40]*9))
        with self.assertRaises(Unresolved):condition(r,actual=self.actor)
    def test_markings_are_explicit_and_fractional_conversion_not_invented(self):
        self.assertTrue(condition(self.row(10,7),actual=self.actor))
        self.assertTrue(condition(self.row(12,7,2),actual=self.actor))
        self.assertTrue(condition(self.row(11,99),actual=self.actor))
        with self.assertRaises(Unresolved):condition(self.row(12,7.5,2),actual=self.actor)
    def test_only_constant_filters_are_reduced(self):
        self.assertTrue(unconditional_filter(dict(FilterOp=0,FilterDatas=[self.row(20)])))
        self.assertFalse(unconditional_filter(dict(FilterOp=1,FilterDatas=[self.row(1)])))
        self.assertIsNone(unconditional_filter(dict(FilterOp=1,FilterDatas=[self.row(20)])))
if __name__=='__main__':unittest.main()
