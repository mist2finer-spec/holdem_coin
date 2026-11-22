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
   var q=Battle3DView.KitBossQuarter;Assert.AreEqual(55f,q.pitch);Assert.AreEqual(70f,q.yaw);Assert.AreEqual(12f,q.verticalFov);Assert.AreEqual(14f,q.distance);
   Assert.AreEqual(new Vector3(-.8f,.8f,0),q.pivotOffset,"brief 4 Editor sweep values (55 deg, hero-centred, hero >= 10 %)");
  }
  // Hero-centred framing vs the old whole-boss framing, same rig, same pose: hero 2 m from a 3.2 m boss (a box ~ its skinned bounds).
  static (float dist,float heroFrac,bool footIn,bool headIn,bool heroIn) Frame(bool heroCentric,bool warning){
   var rigGo=new GameObject("rig test");var camGo=new GameObject("cam");camGo.transform.SetParent(rigGo.transform,false);var cam=camGo.AddComponent<Camera>();
   var bossGo=GameObject.CreatePrimitive(PrimitiveType.Cube);bossGo.transform.position=new Vector3(2f,1.6f,0);bossGo.transform.localScale=new Vector3(2.4f,3.2f,2.4f); // ~ the skinned bounds of the 3.2 m boss
   var bossRoot=new GameObject("boss root").transform;bossRoot.position=new Vector3(2f,0,0);bossGo.transform.SetParent(bossRoot,true);
   try{
    cam.aspect=1080f/2340f;var rig=rigGo.AddComponent<BattleCameraController>();rig.Bind(cam);rig.externallyDriven=true;rig.quarter=Battle3DView.KitBossQuarter;rig.heroCentricBoss=heroCentric;
    rig.SetPose(Vector3.zero,1,0,0);rig.SetViewMode(ViewMode.QuarterView,bossRoot);rig.ResetPose();
    if(warning){rig.WarningActive=true;rig.WarningBounds=new Bounds(new Vector3(0,.05f,0),new Vector3(2.4f,.1f,2.4f));}
    for(int i=0;i<240;i++)rig.Tick(1/60f);
    bool In(Vector3 p){var v=cam.WorldToViewportPoint(p);return v.z>0&&v.x>=0&&v.x<=1&&v.y>=0&&v.y<=1;}
    float hf=Mathf.Abs(cam.WorldToViewportPoint(Vector3.up*1.2f).y-cam.WorldToViewportPoint(Vector3.zero).y);
    bool foot=In(new Vector3(1.5f,0,-.5f))&&In(new Vector3(2.5f,0,.5f))&&In(new Vector3(2f,.4f,0));
    bool warn=!warning||In(new Vector3(-1.2f,0,-1.2f))&&In(new Vector3(1.2f,0,1.2f))&&In(new Vector3(-1.2f,0,1.2f))&&In(new Vector3(1.2f,0,-1.2f));
    return (rig.CurrentDistance,hf,foot&&warn,In(new Vector3(2f,3.2f,0)),In(Vector3.zero)&&In(Vector3.up*1.2f));
   }finally{Object.DestroyImmediate(rigGo);Object.DestroyImmediate(bossRoot.gameObject);}
  }
  [Test] public void Hero_centred_boss_framing_keeps_the_hero_big_and_the_boss_feet_and_warning_in_view(){
   var whole=Frame(false,false);var hero=Frame(true,false);var warned=Frame(true,true);
   TestContext.WriteLine($"whole-boss: dist {whole.dist:F2} hero {whole.heroFrac:F3} head {whole.headIn}; hero-centred: dist {hero.dist:F2} hero {hero.heroFrac:F3} head {hero.headIn}; warning: dist {warned.dist:F2} hero {warned.heroFrac:F3}");
   Assert.IsTrue(whole.headIn,"old framing fits the whole boss");Assert.IsTrue(hero.heroIn&&hero.footIn,"hero and boss feet in view");
   Assert.Greater(hero.heroFrac,whole.heroFrac*1.2f,"hero-centred framing does not push the camera out for the boss head");Assert.Less(hero.dist,whole.dist*.85f,"closer camera");
   Assert.IsTrue(warned.heroIn&&warned.footIn,"warning disc, hero and boss feet in view while a warning is up");
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
