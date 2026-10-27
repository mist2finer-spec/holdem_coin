import unittest
from reference_damage_application import DamageTarget,inflict_damage
from reference_critical import critical_damage,hypercritical_damage

class ApplicationTests(unittest.TestCase):
 def test_overkill_uses_net_hp_but_original_gross_counter(self):
  target=DamageTarget(20,100,10);r=inflict_damage(target,200)
  self.assertEqual((r.hp,r.hp_damage,r.gross_damage,r.shield_spent),(0,20,200,10));self.assertEqual(r.passive_triggers,[15,12,11]);self.assertEqual(target.hp,20)
 def test_shield_bonus_native_expression(self):
  r=inflict_damage(DamageTarget(100,100,200),100,50)
  self.assertEqual((r.hp,r.shield),(50,50))
 def test_invincible_and_bypass(self):
  t=DamageTarget(100,100,50,invincible=True)
  self.assertEqual(inflict_damage(t,100).flags,0x2000)
  self.assertEqual(inflict_damage(t,100,flags=0x4000).hp,50)
 def test_critical_resistance_roll_and_strict_boundary(self):
  kw=dict(chance=50,damage_percent=100,resistance=25,bonus=0,cap=90)
  self.assertEqual(critical_damage(100,0,rolls=[.5],**kw),(100,0,1))
  self.assertEqual(critical_damage(100,0,rolls=[.1,.1],**kw),(100,0,2))
  self.assertEqual(critical_damage(100,0,rolls=[.1,.5],**kw),(200,1,2))
 def test_hyper_requires_original_critical(self):
  kw=dict(chance=100,damage_percent=100,bonus=0,cap=90,roll=.1)
  self.assertEqual(hypercritical_damage(100,0,**kw),(100,0,0));self.assertEqual(hypercritical_damage(100,1,**kw),(200,3,1))
if __name__=='__main__':unittest.main()
