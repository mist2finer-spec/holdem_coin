using NUnit.Framework;

namespace IslandGame.Tests {
 // T1b development 0-pin of the presentation budget: the level rule itself is unchanged; the pin only holds Level at 0
 // while the run counters keep counting, and unpinning starts the rule again from 0 with fresh counters.
 public sealed class IslandBudgetPinTests {
  const double Heavy=IslandBudgetPolicy.TargetMilliseconds+1,Light=IslandBudgetPolicy.TargetMilliseconds*.5,Middle=IslandBudgetPolicy.TargetMilliseconds*.9;
  static void Feed(IslandBudgetPolicy p,double load,int n){for(int i=0;i<n;i++)p.Observe(load,0);}

  [Test] public void Rule_is_unchanged_without_the_pin(){
   var p=new IslandBudgetPolicy();Feed(p,Heavy,7);Assert.AreEqual(0,p.Level);Assert.AreEqual(7,p.Over);
   Feed(p,Heavy,1);Assert.AreEqual(1,p.Level);Assert.AreEqual(0,p.Over);Feed(p,Heavy,16);Assert.AreEqual(3,p.Level);Feed(p,Heavy,8);Assert.AreEqual(3,p.Level);
   Feed(p,Light,119);Assert.AreEqual(3,p.Level);Assert.AreEqual(119,p.Under);Feed(p,Light,1);Assert.AreEqual(2,p.Level);
   Feed(p,Light,60);Feed(p,Middle,1);Assert.AreEqual(0,p.Under);Assert.AreEqual(0,p.Over);Assert.AreEqual(2,p.Level);
   Assert.IsFalse(p.Pinned);
  }

  [Test] public void Pin_holds_level_zero_and_keeps_counting(){
   var p=new IslandBudgetPolicy();Feed(p,Heavy,24);Assert.AreEqual(3,p.Level);
   p.Pin(true);Assert.IsTrue(p.Pinned);Assert.AreEqual(0,p.Level);Assert.AreEqual(0,p.Over);
   Feed(p,Heavy,5);Assert.AreEqual(0,p.Level);Assert.AreEqual(5,p.Over);
   Feed(p,Heavy,40);Assert.AreEqual(0,p.Level,"pinned: the level stays 0 however long the load is high");
  }

  [Test] public void Unpin_starts_again_from_zero(){
   var p=new IslandBudgetPolicy();p.Pin(true);Feed(p,Heavy,5);Assert.AreEqual(5,p.Over);
   p.Pin(false);Assert.IsFalse(p.Pinned);Assert.AreEqual(0,p.Level);Assert.AreEqual(0,p.Over);Assert.AreEqual(0,p.Under);
   Feed(p,Heavy,7);Assert.AreEqual(0,p.Level,"fresh counters: 8 runs again before the first step up");Feed(p,Heavy,1);Assert.AreEqual(1,p.Level);
  }
 }
}
