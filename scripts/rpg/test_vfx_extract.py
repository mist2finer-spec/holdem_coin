import unittest
from PIL import Image
from extract_vfx import value,curve,gradient,particles,runtime_focus

class PreviewMathTests(unittest.TestCase):
    def test_absent_delay_speed_rate_are_zero_not_one(self):
        self.assertEqual(value({}),0)
        e={'ps':{'InitialModule':{'startLifetime':{'scalar':2},'startSize':{'scalar':1}},'EmissionModule':{'enabled':True,'m_Bursts':[{'countCurve':{'scalar':1}}]}}}
        p=particles(e,1);self.assertEqual(len(p),1);self.assertEqual(p[0]['born'],0);self.assertEqual(p[0]['vx'],0);self.assertEqual(p[0]['vy'],0)
    def test_curve_endpoints_and_two_constants(self):
        self.assertEqual(value({'minMaxState':3,'scalar':10,'minScalar':2},r=.25),4)
        self.assertEqual(curve({'m_Curve':[{'time':0,'value':0,'outSlope':1},{'time':1,'value':1,'inSlope':1}]},.5),.5)
    def test_focus_changes_presentation_size_only(self):
        original=Image.new('RGBA',(256,256));frames=runtime_focus([original],'whirlwind')
        self.assertEqual(frames[0].size,(256,256));self.assertEqual(original.size,(256,256))
if __name__=='__main__':unittest.main()
