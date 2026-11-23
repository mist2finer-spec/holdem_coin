using Jint;
using Jint.Native;
using NUnit.Framework;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace IslandGame.Tests {
 // Boss beam damage while touching (2026-11-23, maintenance/boss-beam-dot-20261123): the kernel bundle deals 2,000 every .1 s while
 // the hero touches a beam (no knockback); the HUD draws one running total per touch; the hit flash of a tick is light.
 public sealed class BeamDotTests {
  static string Call(Engine e,JsValue f,string v)=>e.Invoke(f,JsValue.Undefined,new JsValue[]{v}).ToString();
  static JObject Input()=>new JObject{{"x",0},{"y",0},{"auto",true},{"paused",false},{"readyZone",9},{"readyBoss",true}};
  [Test] public void Kernel_bundle_beam_ticks_are_2000_with_a_running_total_per_touch(){
   var source=Resources.Load<TextAsset>("TrainingCombatKernel.js");Assert.IsNotNull(source);
   var boot=new JObject{{"mode","mount"},{"seed",111},{"referencePreview",true},{"previewZone",9},{"traversalProfile","source-run-v2"},{"heroKit","pink-iai"},{"bossStartHP",560},{"build",new JObject{{"skills",new JArray()}}}};
   var e=new Engine();e.Execute(source.text);Call(e,e.GetValue("stageInitialize"),boot.ToString(Formatting.None));
   var seen=new System.Collections.Generic.Dictionary<int,JObject>();
   try{
    for(int i=0;i<1600&&seen.Count<12;i++){
     var s=JObject.Parse(Call(e,e.GetValue("stageAdvance"),new JObject{{"steps",5},{"input",Input()},{"commands",new JArray()},{"snapshot",true}}.ToString(Formatting.None)));
     foreach(var fx in s["fx"] as JArray??new JArray()){var def=(string)fx["definitionId"];if((string)fx["kind"]=="damage"&&(string)fx["target"]=="hero"&&def!=null&&def.StartsWith("boss-beam"))seen[(int)fx["id"]]=(JObject)fx;}
     if((string)s["status"]!="playing")break;
    }
   }finally{e.Dispose();}
   Assert.Greater(seen.Count,0,"the hero touched a beam");
   var totals=new System.Collections.Generic.Dictionary<int,float>();
   foreach(var kv in seen){var fx=kv.Value;Assert.AreEqual(2000f,(float)fx["value"],"one tick");Assert.IsNotNull(fx["dotId"]);int dot=(int)fx["dotId"];
    totals.TryGetValue(dot,out float before);Assert.AreEqual(before+2000f,(float)fx["dotTotal"],1e-3f,"running total of touch "+dot);totals[dot]=(float)fx["dotTotal"];
    if(dot==kv.Key)Assert.AreEqual(2000f,(float)fx["dotTotal"],"first tick of a touch");}
  }
  static JObject Tick(int id,int dot,float at,float total)=>new JObject{{"id",id},{"kind","damage"},{"target","hero"},{"value",2000},{"dotId",dot},{"dotTotal",total},{"contactAt",at},{"definitionId","boss-beam"}};
  [Test] public void Hud_shows_one_running_total_per_touch(){
   var other=new JObject{{"id",1},{"kind","damage"},{"target","boss"},{"value",60},{"contactAt",1f}};
   var a=Tick(10,10,1f,2000);var b=Tick(11,10,1.1f,4000);var c=Tick(12,10,1.2f,6000);var all=new JArray{other,a,b,c};
   // Display clock 1.15: tick 11 is the newest reached one -> 10 hidden, 11 shown (4,000), 12 not reached yet (the HUD skips age < 0).
   Assert.IsFalse(BeamDotDisplay.Hidden(all,all[0],1.15f),"other damage drawn as before");
   Assert.IsTrue(BeamDotDisplay.Hidden(all,all[1],1.15f));Assert.IsFalse(BeamDotDisplay.Hidden(all,all[2],1.15f));
   Assert.AreEqual("4000",BeamDotDisplay.Amount(all[2]).ToString());Assert.AreEqual("60",BeamDotDisplay.Amount(all[0]).ToString());
   Assert.IsTrue(BeamDotDisplay.Hidden(all,all[2],1.25f));Assert.IsFalse(BeamDotDisplay.Hidden(all,all[3],1.25f));
   // A new touch (dotId 20) is its own number.
   all.Add(Tick(20,20,2f,2000));Assert.IsFalse(BeamDotDisplay.Hidden(all,all[3],2.05f));Assert.IsFalse(BeamDotDisplay.Hidden(all,all[4],2.05f));
  }
  [Test] public void Feedback_router_tells_first_and_later_beam_ticks(){
   Assert.AreEqual(0,CombatFeedbackRouter.DotTick(new JObject{{"id",5},{"kind","damage"}}),"not a tick");
   Assert.AreEqual(1,CombatFeedbackRouter.DotTick(Tick(10,10,1,2000)),"first tick: sound, spark, light flash");
   Assert.AreEqual(2,CombatFeedbackRouter.DotTick(Tick(11,10,1.1f,4000)),"later tick: light flash only");
  }
 }
}
