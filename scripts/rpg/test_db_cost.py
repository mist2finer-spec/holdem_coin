import unittest
from vardian_cost import calc_segment, calc_segments


def segment(**kwargs):
    result={'MinLevel':1,'MaxLevel':50,**{k:{'Value':v} for k,v in zip(
        ('BaseValue','IncValue','IncRate','Scaler'),(40,2,420,1000))}}
    result.update(kwargs)
    return result


class CostTests(unittest.TestCase):
    def test_known_argument_values(self):
        self.assertEqual(calc_segment(segment(),1),40)
        self.assertEqual(calc_segment(segment(),2),42)
        self.assertEqual(calc_segment(segment(),10),92)

    def test_half_open_boundaries(self):
        self.assertEqual(calc_segment(segment(),0),0)
        self.assertEqual(calc_segment(segment(),50),0)
        self.assertEqual(calc_segments([segment(),segment(MinLevel=50,MaxLevel=100)],50),40)

    def test_intermediate_floors_matter(self):
        s=segment(BaseValue={'Value':1.9},IncValue={'Value':0.9},IncRate={'Value':0.9},Scaler={'Value':3})
        self.assertEqual(calc_segment(s,3),3)

    def test_zero_scaler_and_invalid_inputs(self):
        self.assertEqual(calc_segment(segment(Scaler={'Value':0}),2),0)
        with self.assertRaises(ValueError):calc_segment(segment(),1.5)
        with self.assertRaises(ValueError):calc_segment(segment(BaseValue={'Value':float('nan')}),2)


if __name__=='__main__':unittest.main()
