using Jint;
using Jint.Native;
using NUnit.Framework;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace IslandGame.Tests {
 // Kit boss fight (2026-11-21, brief 3): the kernel shrinks the boss hitbox by one factor (3.2 m / 6.5 m) and reports it as state
 // "bossScale"; the boss presentation takes its display height from the same value, so the hands the player sees are the hands
 // that hit. Legacy (bossHero "legacy") has no bossScale and keeps the 6.5 m boss.
 public sealed class BossKitScaleTests {
  static JObject Build()=>new JObject{{"skills",new JArray()}};
  static string Call(Engine e,JsValue f,string v)=>e.Invoke(f,JsValue.Undefined,new JsValue[]{v}).ToString();
  // First kernel snapshot of the boss-mode boot (kit unless the legacy override is set).
  static JObject BossSnapshot(string bossHero){
   var source=Resources.Load<TextAsset>("TrainingCombatKernel.js");Assert.IsNotNull(source,"Resources/TrainingCombatKernel.js");
   var was=Battle3DAssets.BossHeroOverride;Battle3DAssets.BossHeroOverride=bossHero;
   try{
    var boot=RpgSession.TrainingBoot(false,Build());var e=new Engine();e.Execute(source.text);
    Call(e,e.GetValue("stageInitialize"),boot.ToString(Formatting.None));
    var s=Call(e,e.GetValue("stageAdvance"),new JObject{{"steps",1},{"input",new JObject{{"x",0},{"y",0},{"auto",false},{"paused",false}}},{"commands",new JArray()},{"snapshot",true}}.ToString(Formatting.None));
    e.Dispose();return JObject.Parse(s);
   }finally{Battle3DAssets.BossHeroOverride=was;}
  }
  [Test] public void Kit_boss_display_height_comes_from_the_kernel_hitbox_scale_and_legacy_stays_6_5_m(){
   if(!Battle3DAssets.LoadKit())Assert.Ignore("local kit asset not present in this checkout");
   var a=Resources.Load<UnityBossAssets>("UnityBossAssets");if(!a||!a.boss)Assert.Ignore("boss assets not present");
   var kit=BossSnapshot("kit");var legacy=BossSnapshot("legacy");
   Assert.AreEqual("pink-iai",(string)kit["heroKit"]);Assert.IsNull(legacy["heroKit"]);
   Assert.AreEqual(320.0/650.0,(double)kit["bossScale"],1e-9,"kernel kit boss scale");Assert.IsNull(legacy["bossScale"],"legacy: no scale key");
   Assert.AreEqual(140*320.0/650.0,(double)kit["bodyRadius"],1e-6,"kernel body radius follows the scale");Assert.AreEqual(140,(double)legacy["bodyRadius"],1e-9);
   Assert.AreEqual(3.2f,UnityBossPresentation.DisplayHeight(a,kit),1e-4f,"shown 3.2 m");Assert.AreEqual(a.bossHeight,UnityBossPresentation.DisplayHeight(a,legacy),1e-6f,"legacy shown at the asset height");
  }
  // One combo pose per phase: boss at the origin facing +z (kernel direction (0,1)), so the kernel hand point (profile x scale) is the
  // presentation-local point. The visible hand (Hand bone + profile hand offset) must sit on it at both scales.
  static float HandError(UnityBossAssets a,float scale,float phase,int point){
   var parent=new GameObject("boss scale test").transform;var map=new JObject{{"laneY",0}};var view=new UnityBossPresentation(parent,a,map);
   try{
    const float duration=2.2f;float target=phase*duration;
    for(float t=0;t<=target+1e-4f;t+=1/60f){
     var state=new JObject{{"bossVisible",true},{"mobs",new JArray(new JObject{{"unityBoss",true},{"x",0},{"y",0},{"elevation",0},{"direction",new JObject{{"x",0},{"y",1}}},{"action","combo"},{"motion",new JObject{{"start",0},{"duration",duration}}}})}};
     if(scale!=1)state["bossScale"]=scale;view.Update(state,Mathf.Min(t,target));
    }
    var expected=view.BossTarget.position+BossContactProfile.Sample(phase,point)*scale;return Vector3.Distance(view.ContactPoint(point),expected);
   }finally{view.Dispose();Object.DestroyImmediate(parent.gameObject);}
  }
  [Test] public void Kit_boss_camera_is_the_tuned_quarter_view(){
   var q=Battle3DView.KitBossQuarter;Assert.AreEqual(45f,q.pitch);Assert.AreEqual(90f,q.yaw);Assert.AreEqual(22f,q.verticalFov);Assert.AreEqual(6f,q.distance);
   Assert.AreEqual(new Vector3(-.6f,.8f,-.15f),q.pivotOffset,"brief 3 Editor sweep values (hero >= 10 %, boss/warning/hero in view)");
  }
  [Test] public void Kit_boss_visible_hands_sit_on_the_kernel_hook_points(){
   var a=Resources.Load<UnityBossAssets>("UnityBossAssets");if(!a||!a.boss||!a.combo)Assert.Ignore("boss assets not present");
   BossContactProfile.Load();float s=320f/650f;var log=new System.Text.StringBuilder();
   foreach(var (phase,point) in new[]{(.30f,1),(.74f,3)}){
    float full=HandError(a,1,phase,point),kit=HandError(a,s,phase,point);log.Append($"phase {phase} point {point}: 6.5 m err {full:F3} m, 3.2 m err {kit:F3} m; ");
    Assert.Less(kit,Mathf.Max(.06f,full*s*1.5f),"kit boss hand drifts off the kernel hook point: "+log);
   }
   TestContext.WriteLine(log.ToString());
  }
 }
}
