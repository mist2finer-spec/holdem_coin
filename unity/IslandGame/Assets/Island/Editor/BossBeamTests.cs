using Jint;
using Jint.Native;
using NUnit.Framework;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace IslandGame.Tests {
 // Kit boss rune beams (2026-11-22, boss-beam-camera-20261122). The kernel (rpg-boss-beam.ts) owns the timeline and the hit; the
 // presentation (BossBeamPresentation) draws the RuneBeam package on the same clock, at the same pivot and angle.
 public sealed class BossBeamTests {
  static string Call(Engine e,JsValue f,string v)=>e.Invoke(f,JsValue.Undefined,new JsValue[]{v}).ToString();
  static JObject Input(bool auto)=>new JObject{{"x",0},{"y",0},{"auto",auto},{"paused",false},{"readyZone",9},{"readyBoss",true}};
  // Zone-10 kit boss through the Unity kernel bundle (Jint), dev start HP just above 25 %, AUTO until the ring is up.
  static JObject RingSnapshot(out float elapsed){
   var source=Resources.Load<TextAsset>("TrainingCombatKernel.js");Assert.IsNotNull(source);
   var boot=new JObject{{"mode","mount"},{"seed",111},{"referencePreview",true},{"previewZone",9},{"traversalProfile","source-run-v2"},{"heroKit","pink-iai"},{"bossStartHP",500},{"build",new JObject{{"skills",new JArray()}}}};
   var e=new Engine();e.Execute(source.text);Call(e,e.GetValue("stageInitialize"),boot.ToString(Formatting.None));
   try{
    for(int i=0;i<400;i++){
     var s=JObject.Parse(Call(e,e.GetValue("stageAdvance"),new JObject{{"steps",5},{"input",Input(true)},{"commands",new JArray()},{"snapshot",true}}.ToString(Formatting.None)));
     if(s["beams"] is JArray b&&b.Count==8){elapsed=(float)s["elapsed"];return s;}
    }
   }finally{e.Dispose();}
   elapsed=0;return null;
  }
  [Test] public void Phase_and_angle_match_the_kernel_timeline(){
   // Line: package speed (phase = age / 3.6), fire at .36 (1.296 s), hit stops at .84.
   for(float t=0;t<=3.6f;t+=.1f)Assert.AreEqual(t/3.6f,BossBeamPresentation.Phase(10+t,10,10+1.296f,10+3.024f,3.6f,.36f),1e-5f);
   // Ring: same fire, 6 s of fire, phase .84 at the stop, 1 at the end; continuous.
   float fire=1.296f,stop=fire+6,end=stop+.576f,last=0;
   Assert.AreEqual(.36f,BossBeamPresentation.Phase(fire,0,fire,stop,3.6f,.36f),1e-5f);Assert.AreEqual(.84f,BossBeamPresentation.Phase(stop,0,fire,stop,3.6f,.36f),1e-5f);Assert.AreEqual(1f,BossBeamPresentation.Phase(end,0,fire,stop,3.6f,.36f),1e-5f);
   for(float t=0;t<=end;t+=.01f){float p=BossBeamPresentation.Phase(t,0,fire,stop,3.6f,.36f);Assert.GreaterOrEqual(p,last-1e-6f);Assert.Less(p-last,.02f);last=p;}
   Assert.AreEqual(1f,BossBeamPresentation.Angle(0,1,-.5f,1,7),1e-6f,"no turn while charging");Assert.AreEqual(-2f,BossBeamPresentation.Angle(9,1,-.5f,1,7),1e-6f,"6 s x -0.5 rad/s, then held");
  }
  // Clockwise on the screen of the kit boss camera (55 deg pitch, 55 deg yaw since camera diagonal brief 2, portrait): a falling kernel angle turns clockwise.
  [Test] public void Falling_kernel_angle_turns_clockwise_on_the_boss_camera_screen(){
   var go=new GameObject("beam cam");var cam=go.AddComponent<Camera>();
   try{
    cam.aspect=1080f/2340f;cam.fieldOfView=28;var q=Battle3DView.KitBossQuarter;go.transform.rotation=Quaternion.Euler(q.pitch,q.yaw,0);go.transform.position=go.transform.rotation*new Vector3(0,0,-q.distance);
    int checkedCount=0;
    for(float a=0;a<Mathf.PI*2;a+=Mathf.PI/8){
     Vector3 P(float x)=>new Vector3(Mathf.Cos(x),0,Mathf.Sin(x))*4;var c=cam.WorldToScreenPoint(Vector3.zero);var p0=cam.WorldToScreenPoint(P(a))-c;var p1=cam.WorldToScreenPoint(P(a-.05f))-c;
     float cross=p0.x*p1.y-p0.y*p1.x;Assert.Less(cross,0,$"angle {a}: screen cross {cross} (negative = clockwise, screen y up)");checkedCount++;
    }
    Assert.AreEqual(16,checkedCount);
   }finally{Object.DestroyImmediate(go);}
  }
  [Test] public void Kernel_ring_beams_reach_the_presentation_at_the_kernel_pivot_and_angle(){
   var snap=RingSnapshot(out float now);Assert.IsNotNull(snap,"the ring started (dev bossStartHP 500 = 25 % of 2000)");
   var beams=(JArray)snap["beams"];Assert.AreEqual(8,beams.Count);Assert.AreEqual("pink-iai",(string)snap["heroKit"]);
   for(int i=0;i<8;i++){Assert.AreEqual("ring",(string)beams[i]["kind"]);Assert.AreEqual(-20*Mathf.Deg2Rad,(float)beams[i]["turn"],1e-5f);Assert.AreEqual(i*Mathf.PI/4,(float)beams[i]["angle"]-(float)beams[0]["angle"],1e-4f);}
   var parent=new GameObject("beam view test").transform;var view=new BossBeamPresentation(parent);
   try{
    float t=(float)beams[0]["fireAt"]+1.5f;view.Update(snap,t);Assert.IsTrue(view.Ready,"RuneBeam prefab built");Assert.AreEqual(8,view.Shown);
    for(int i=0;i<8;i++){var b=(JObject)beams[i];float a=(float)b["angle"]+(float)b["turn"]*1.5f;var dir=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a));
     var expected=new Vector3((float)b["originX"]/100,(float)b["elevation"]/100+(float)b["height"]/100,(float)b["originZ"]/100)+dir*(float)b["forward"]/100;
     var tr=view.SlotTransform(i);Assert.Less(Vector3.Distance(tr.localPosition,expected),1e-3f,"pivot "+i);Assert.Greater(Vector3.Dot(tr.forward,dir),.9999f,"local +Z = kernel beam direction "+i);
     Assert.IsTrue(view.SlotRenderer(i).enabled);}
    view.Update(snap,(float)beams[0]["endAt"]+.01f);Assert.AreEqual(0,view.Shown,"gone after the fade");
   }finally{view.Dispose();Object.DestroyImmediate(parent.gameObject);}
  }
  [Test] public void Frame_budget_lite_mesh_keeps_seals_core_and_orb_only(){
   var parent=new GameObject("beam lite test").transform;var view=new BossBeamPresentation(parent);var was=BossBeamPresentation.LevelOverride;
   try{
    view.Build();Assert.IsTrue(view.Ready);int full=view.FullTriangles,lite=view.LiteTriangles;TestContext.WriteLine($"full {full} tris, lite {lite} tris");
    Assert.Greater(lite,0);Assert.Less(lite,full/2,"lite is a real cut");
    var b=new JObject{{"originX",0},{"originZ",0},{"elevation",0},{"forward",90},{"height",100},{"angle",0},{"turn",0},{"chargeAt",0},{"fireAt",1.296},{"stopAt",3.024},{"endAt",3.6},{"length",1800},{"width",1.4},{"size",.8},{"clip",3.6},{"charge",.36}};
    var state=new JObject{{"beams",new JArray(b)}};
    BossBeamPresentation.LevelOverride=0;view.Update(state,2);Assert.IsFalse(view.LiteShown);BossBeamPresentation.LevelOverride=1;view.Update(state,2);Assert.IsTrue(view.LiteShown);
   }finally{BossBeamPresentation.LevelOverride=was;view.Dispose();Object.DestroyImmediate(parent.gameObject);}
  }
  [Test] public void Judgement_half_width_matches_the_kernel_formula(){
   // rpg-boss-beam.ts beamHalfWidth at width 1.4, size .8, length 18 m, full front (cm in the kernel, m here).
   Assert.AreEqual(.8f*(.044f+.27f*0)*1.4f*.8f,BossBeamPresentation.HalfWidth(-.24f*.8f,18,1.4f,.8f,1),1e-5f,"at the seals");
   Assert.AreEqual(.8f*(.044f+.225f+.27f)*1.4f*.8f,BossBeamPresentation.HalfWidth(18,18,1.4f,.8f,1),1e-5f,"at the end");
  }
 }
}
