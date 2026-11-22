using System.Reflection;
using NUnit.Framework;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace IslandGame.Tests {
 // 2026-11-22 (user: no screen shake for now; later only certain monster skills or the boss): the shipped profiles allow no shake
 // source, so a hit moves neither the camera offset nor the FOV, in Side and in the boss Quarter view. The gate itself still works
 // when a profile lists a source (that is how a monster skill or the boss gets shake back).
 public sealed class CombatShakeGateTests {
  static readonly string[] Sources = { "hero:pink-iai-1", "hero:pink-iai-3", "hero:skill", "hero:lightning", "boss:hook", "boss:blast", "mob:attack" };

  [Test] public void ShippedProfilesAllowNoShakeSource(){
   foreach(var name in new[]{"CombatPresentation/SideAction","CombatPresentation/QuarterAction"}){
    var p=Resources.Load<CombatViewPresentationProfile>(name);Assert.IsNotNull(p,name);
    Assert.IsFalse(p.shakeEnabled,name+" shakeEnabled");Assert.IsEmpty(p.shakeAllowSources,name+" shakeAllowSources");
    Assert.Greater(p.shakeMeters,0f,name+" keeps the old amount for allowed sources");
    foreach(var s in Sources)Assert.IsFalse(CombatShakeGate.Allows(p,s),name+" "+s);
   }
  }

  [Test] public void GateMatchesExactPrefixAndNeedsEnabled(){
   Assert.IsFalse(CombatShakeGate.Allows(false,new[]{"*"},"boss:hook"));
   Assert.IsFalse(CombatShakeGate.Allows(true,new string[0],"boss:hook"));
   Assert.IsTrue(CombatShakeGate.Allows(true,new[]{"boss:hook"},"boss:hook"));
   Assert.IsFalse(CombatShakeGate.Allows(true,new[]{"boss:hook"},"boss:blast"));
   Assert.IsTrue(CombatShakeGate.Allows(true,new[]{"boss:*"},"boss:blast"));
   Assert.IsFalse(CombatShakeGate.Allows(true,new[]{"boss:*"},"mob:attack"));
   Assert.IsTrue(CombatShakeGate.Allows(true,new[]{"*"},"hero:pink-iai-2"));
  }

  [Test] public void ShakeSourceKeys(){
   var boss=JObject.Parse("{\"phase\":\"boss\"}");var field=JObject.Parse("{\"phase\":\"combat\"}");
   Assert.AreEqual("hero:pink-iai-1",CombatFeedbackRouter.ShakeSource(JObject.Parse("{\"target\":\"mob3\",\"damageKind\":\"attack\",\"definitionId\":\"pink-iai-1\"}"),field));
   Assert.AreEqual("hero:skill",CombatFeedbackRouter.ShakeSource(JObject.Parse("{\"target\":\"boss\",\"damageKind\":\"skill\"}"),boss));
   Assert.AreEqual("boss:hook",CombatFeedbackRouter.ShakeSource(JObject.Parse("{\"target\":\"hero\",\"damageKind\":\"hook\"}"),boss));
   Assert.AreEqual("boss:blast",CombatFeedbackRouter.ShakeSource(JObject.Parse("{\"target\":\"hero\",\"damageKind\":\"skill\",\"warningId\":18}"),boss));
   Assert.AreEqual("mob:attack",CombatFeedbackRouter.ShakeSource(JObject.Parse("{\"target\":\"hero\",\"damageKind\":\"attack\"}"),field));
  }

  // The router on a real hit: shipped profiles = no camera offset and no FOV punch; a profile that allows the source = the old shake.
  [Test] public void RouterHitMovesCameraOnlyWhenAllowed(){
   var host=new GameObject("shake test host");var rigGo=new GameObject("shake test rig");
   try{
    var rig=rigGo.AddComponent<BattleCameraController>();var coordinator=new ViewPresentationCoordinator();
    var state=JObject.Parse("{\"id\":\"t\",\"phase\":\"boss\",\"fx\":[{\"kind\":\"damage\",\"id\":1,\"attackId\":3,\"contactAt\":1.0,\"target\":\"hero\",\"damageKind\":\"hook\"},{\"kind\":\"damage\",\"id\":2,\"attackId\":4,\"contactAt\":1.0,\"target\":\"boss\",\"damageKind\":\"attack\",\"definitionId\":\"pink-iai-1\"}]}");
    var router=new CombatFeedbackRouter(host,rig,coordinator,id=>null){SoundEnabled=false};
    router.Update(state,1.05f);
    Assert.AreEqual(2,router.ConsumedContacts);
    Assert.AreEqual(Vector3.zero,rig.ImpactOffset,"shipped profile: no camera offset");Assert.AreEqual(0f,rig.ImpactFov,"shipped profile: no FOV punch");

    var allow=Object.Instantiate(coordinator.Side);allow.shakeEnabled=true;allow.shakeAllowSources=new[]{"boss:hook"};
    typeof(ViewPresentationCoordinator).GetField("Side",BindingFlags.Public|BindingFlags.Instance).SetValue(coordinator,allow);
    var router2=new CombatFeedbackRouter(host,rig,coordinator,id=>null){SoundEnabled=false};
    router2.Update(state,1.05f);
    Assert.Greater(rig.ImpactOffset.magnitude,0f,"allowed source shakes");Assert.Less(rig.ImpactFov,0f,"allowed source punches the FOV");
    Object.DestroyImmediate(allow);
   }finally{Object.DestroyImmediate(host);Object.DestroyImmediate(rigGo);}
  }
 }
}
