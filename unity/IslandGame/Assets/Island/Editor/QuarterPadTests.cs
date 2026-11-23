using System;
using System.Collections.Generic;
using Jint;
using Jint.Native;
using NUnit.Framework;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace IslandGame.Tests {
 // Quarter pad fix (2026-11-23, maintenance/quarterview-move-body-20261123/BRIEF2_gameplay-dev_padfix_KO.md).
 // A-1: in the quarter view the pad is screen-relative (IslandApp.ResolveMove / ScreenPadToWorld). A-2: a planar roll follows the pad,
 // or the facing with the pad released (IslandApp.PlanarEvadeDirection). A-3: the boss-mode hero projection no longer adds a lead on
 // top of the already-interpolated snapshot (NativeCombatPresentation.ProjectHero), so the drawn hero never steps backward.
 public sealed class QuarterPadTests {
  static readonly float[] Eight={0,45,90,135,180,225,270,315};
  static Vector2 Pad(float deg)=>new Vector2(Mathf.Cos(deg*Mathf.Deg2Rad),Mathf.Sin(deg*Mathf.Deg2Rad));
  static float Wrap(float a){a=(a+180)%360;if(a<0)a+=360;return a-180;}

  // A real rig and camera at a quarter preset, hero pose at the origin, settled for 4 s (portrait aspect as on the phone).
  sealed class Rig:IDisposable{
   public GameObject go;public Camera cam;public BattleCameraController rig;
   public Rig(BattleCameraController.Preset preset,ViewMode mode=ViewMode.QuarterView){
    go=new GameObject("quarter pad rig");var camGo=new GameObject("cam");camGo.transform.SetParent(go.transform,false);cam=camGo.AddComponent<Camera>();cam.aspect=1080f/2340f;
    rig=go.AddComponent<BattleCameraController>();rig.Bind(cam);rig.externallyDriven=true;rig.quarter=preset;rig.SetPose(Vector3.zero,1,0,0);rig.SetViewMode(mode);rig.ResetPose();
    for(int i=0;i<240;i++)rig.Tick(1/60f);
   }
   // Screen angle of a short ground step from p along world (x, z) = kernel (x, y). Viewport x is scaled by the camera aspect: in the
   // Editor the pixel rect is the Game view's (not 1080x2340), so WorldToScreenPoint would stretch x.
   public float ScreenDeg(Vector3 p,Vector2 world){var a=cam.WorldToViewportPoint(p);var b=cam.WorldToViewportPoint(p+new Vector3(world.x,0,world.y).normalized*.1f);return Mathf.Atan2(b.y-a.y,(b.x-a.x)*cam.aspect)*Mathf.Rad2Deg;}
   public void Dispose(){UnityEngine.Object.DestroyImmediate(go);}
  }
  // Worst screen error over 8 pad directions at the hero and `ring` metres around it (the camera leans/looks ahead by up to ~1 m;
  // perspective changes the angle away from the hero).
  static float WorstError(Rig r,Func<Vector2,Vector2> map,float ring,out string log){
   float worst=0;var sb=new System.Text.StringBuilder();
   foreach(var at in new[]{Vector3.zero,new Vector3(ring,0,0),new Vector3(-ring,0,0),new Vector3(0,0,ring),new Vector3(0,0,-ring)})
    foreach(var d in Eight){float e=Mathf.Abs(Wrap(r.ScreenDeg(at,map(Pad(d)))-d));worst=Mathf.Max(worst,e);if(at==Vector3.zero)sb.Append(d+":"+e.ToString("F2")+" ");}
   log=sb.ToString();return worst;
  }
  // The game's quarter presets: kit boss, legacy zone-10 arena, mountain path (Battle3DView), and the rig default.
  static readonly BattleCameraController.Preset[] Quarters={Battle3DView.KitBossQuarter,new BattleCameraController.Preset(38,25,38,19,new Vector3(0,2.2f,.6f)),
   new BattleCameraController.Preset(40,35,35,17,new Vector3(0,1.2f,1.8f)),new BattleCameraController.Preset(42,35,35,20,new Vector3(0,1.2f,2.5f))};

  [Test] public void Quarter_pad_moves_the_hero_the_way_the_pad_points_on_screen(){
   foreach(var preset in Quarters){
    using(var r=new Rig(preset)){
     float now=WorstError(r,p=>IslandApp.ResolveMove(p,true,r.rig),1,out var log),far=WorstError(r,p=>IslandApp.ResolveMove(p,true,r.rig),2,out _);
     float old=WorstError(r,p=>p,1,out var oldLog); // the old world X/Z pad, as a check that the measure can tell them apart
     Debug.Log($"[QuarterPad] preset pitch {preset.pitch} yaw {preset.yaw} fov {preset.verticalFov}: converted worst {now:F2} deg within 1 m, {far:F2} within 2 m (hero: {log}); world-axis worst {old:F2} deg (hero: {oldLog})");
     Assert.Less(now,5f,"pad direction vs screen move direction, yaw "+preset.yaw+" | "+log);
     Assert.Greater(old,20f,"the world-axis pad really was off on screen (test setup)");
    }
   }
  }

  [Test] public void Pad_strength_is_kept_and_releasing_gives_zero(){
   using(var r=new Rig(Battle3DView.KitBossQuarter)){
    foreach(var d in Eight)foreach(var s in new[]{.3f,.7f,1f})Assert.AreEqual(s,IslandApp.ResolveMove(Pad(d)*s,true,r.rig).magnitude,1e-4f,"strength at "+d);
    Assert.AreEqual(Vector2.zero,IslandApp.ResolveMove(Vector2.zero,true,r.rig));
   }
  }

  [Test] public void Side_view_and_side_camera_input_is_unchanged(){
   // Old HudMove: y dropped when not planar, then ClampMagnitude; planar kept world X/Z.
   using(var side=new Rig(Battle3DView.KitBossQuarter,ViewMode.Side25D)){
    for(float x=-1.5f;x<=1.5f;x+=.25f)for(float y=-1.5f;y<=1.5f;y+=.25f){var v=new Vector2(x,y);
     Assert.AreEqual(Vector2.ClampMagnitude(new Vector2(x,0),1),IslandApp.ResolveMove(v,false,side.rig),"side view "+v);
     Assert.AreEqual(Vector2.ClampMagnitude(new Vector2(x,0),1),IslandApp.ResolveMove(v,false,null),"side view, no rig "+v);
     Assert.AreEqual(Vector2.ClampMagnitude(v,1),IslandApp.ResolveMove(v,true,side.rig),"planar under the side camera "+v);
     Assert.AreEqual(Vector2.ClampMagnitude(v,1),IslandApp.ResolveMove(v,true,null),"planar, no rig "+v);
    }
   }
  }

  [Test] public void Quarter_roll_goes_the_way_the_pad_points_or_the_hero_faces(){
   using(var r=new Rig(Battle3DView.KitBossQuarter)){
    var sb=new System.Text.StringBuilder();float worst=0;
    foreach(var d in Eight){var roll=IslandApp.PlanarEvadeDirection(IslandApp.ResolveMove(Pad(d),true,r.rig),null,null);Assert.AreEqual(1,roll.magnitude,1e-4f);
     float e=Mathf.Abs(Wrap(r.ScreenDeg(Vector3.zero,roll)-d));worst=Mathf.Max(worst,e);sb.Append(d+":"+e.ToString("F2")+" ");}
    Debug.Log("[QuarterPad] roll screen error by pad direction: "+sb);
    Assert.Less(worst,5f,sb.ToString());
   }
   var facing=new JObject{{"x",-.6f},{"y",.8f}};
   Assert.AreEqual(new Vector2(-.6f,.8f),IslandApp.PlanarEvadeDirection(Vector2.zero,facing,new JValue(-1)),"released pad: the hero's direction");
   Assert.AreEqual(new Vector2(-.6f,.8f),IslandApp.PlanarEvadeDirection(new Vector2(.05f,0),facing,new JValue(1)),"pad inside the kernel's 0.1 dead zone counts as released");
   Assert.AreEqual(new Vector2(-1,0),IslandApp.PlanarEvadeDirection(Vector2.zero,null,new JValue(-1)),"no direction: facing");
   Assert.AreEqual(new Vector2(1,0),IslandApp.PlanarEvadeDirection(Vector2.zero,JValue.CreateNull(),null),"nothing: right");
  }

  // The roll command as HudEvade sends it reaches the kernel's planar roll unchanged (zone-10 arena, kit hero, Jint bundle).
  static string Call(Engine e,JsValue f,string v)=>e.Invoke(f,JsValue.Undefined,new JsValue[]{v}).ToString();
  [Test] public void Kernel_rolls_along_the_sent_planar_direction(){
   var source=Resources.Load<TextAsset>("TrainingCombatKernel.js");Assert.IsNotNull(source);
   var boot=new JObject{{"mode","mount"},{"seed",111},{"referencePreview",true},{"previewZone",9},{"traversalProfile","source-run-v2"},{"heroKit","pink-iai"},{"build",new JObject{{"skills",new JArray()}}}};
   var sb=new System.Text.StringBuilder();int rolls=0;
   foreach(var d in new[]{0f,135f,250f}){
    var e=new Engine();e.Execute(source.text);Call(e,e.GetValue("stageInitialize"),boot.ToString(Formatting.None));
    try{
     var idle=new JObject{{"x",0},{"y",0},{"auto",false},{"paused",false},{"readyZone",9},{"readyBoss",true}};JObject s=null;
     for(int i=0;i<600;i++){s=JObject.Parse(Call(e,e.GetValue("stageAdvance"),new JObject{{"steps",5},{"input",idle},{"commands",new JArray()},{"snapshot",true}}.ToString(Formatting.None)));
      if((int?)s["room"]==1&&(string)s["phase"]=="boss"&&(bool?)s["bossIntroActive"]!=true&&s["hero"]?["motion"]?.Type!=JTokenType.Object&&(float)s["elapsed"]>12)break;}
     Assert.AreEqual(1,(int?)s["room"],"reached the arena: "+s?["phase"]);
     var want=Pad(d);var cmd=new JObject{{"dodge",true},{"x",want.x},{"y",want.y}};
     s=JObject.Parse(Call(e,e.GetValue("stageAdvance"),new JObject{{"steps",1},{"input",idle},{"commands",new JArray(cmd)},{"snapshot",true}}.ToString(Formatting.None)));
     var m=s["hero"]?["motion"] as JObject;Assert.IsNotNull(m,"roll started");Assert.AreEqual("dodge",(string)m["kind"]);
     var step=new Vector2((float)m["to"]["x"]-(float)m["from"]["x"],(float)m["to"]["y"]-(float)m["from"]["y"]);
     float err=Mathf.Abs(Wrap(Mathf.Atan2(step.y,step.x)*Mathf.Rad2Deg-d));sb.Append(d+": len "+step.magnitude.ToString("F0")+" err "+err.ToString("F2")+"; ");
     Assert.Less(err,1f,sb.ToString());Assert.Greater(step.magnitude,50f,sb.ToString());rolls++;
    }finally{e.Dispose();}
   }
   Debug.Log("[QuarterPad] kernel rolls: "+sb);Assert.AreEqual(3,rolls);
  }

  // A-3: snapshots every 50 ms of a hero running at 210 cm/s, drawn at ~60 fps (a 45 ms hitch every 97 frames) through the boss-mode
  // buffer (local training delay .04) and ProjectHero with the stick held. The drawn hero must never step backward.
  static (int back,float meanStep,float sdStep,int frames) Run(bool planar,float interval){
   var dir=planar?new Vector2(.6f,.8f):new Vector2(1,0);var buffer=new CombatSnapshotBuffer();var proj=new NativeHeroProjection();
   var snaps=new List<JObject>();for(int k=0;k<=80;k++){float t=10+k*interval;var p=dir*210*(t-10);
    snaps.Add(new JObject{{"id","pad"},{"routeStage","boss"},{"room",planar?1:0},{"elapsed",t},{"status","playing"},{"unityBossMode",true},{"movementSpeed",210},
     {"walkBounds",new JObject{{"minX",-1e5},{"maxX",1e5},{"minY",-1e5},{"maxY",1e5}}},{"mobs",new JArray()},{"fx",new JArray()},
     {"hero",new JObject{{"x",100+p.x},{"y",192+p.y},{"elevation",0},{"airHeight",0},{"action","run1"},{"facing",1},{"direction",new JObject{{"x",dir.x},{"y",dir.y}}},{"motion",null},{"serial",1}}}});}
   double now=10;int idx=0,back=0,n=0;float last=float.NaN;var steps=new List<float>();
   for(int f=0;now<10+80*interval-.1f;f++){now+=f%97==0?.045:1/60.0;while(idx+1<snaps.Count&&(float)snaps[idx+1]["elapsed"]<=now)idx++;
    var state=buffer.Sample(snaps[idx],now,true,.04f);var hero=proj.Project(state,null,buffer.Time,dir.x,false,planar?dir.y:0);
    float along=Vector2.Dot(new Vector2((float)hero["x"],(float)hero["y"]),dir);
    if(!float.IsNaN(last)&&f>20){float s=along-last;steps.Add(s);if(s<-1e-3f)back++;n++;}last=along;}
   float mean=0;foreach(var s in steps)mean+=s;mean/=steps.Count;float sd=0;foreach(var s in steps)sd+=(s-mean)*(s-mean);sd=Mathf.Sqrt(sd/steps.Count);
   return (back,mean,sd,n);
  }
  [Test] public void Boss_mode_hero_never_steps_backward_while_running(){
   foreach(var planar in new[]{false,true})foreach(var interval in new[]{.05f,.033f}){
    var r=Run(planar,interval);
    Debug.Log($"[QuarterPad] {(planar?"quarter":"side")} snapshots {interval*1000:F0} ms: frames {r.frames} backward {r.back} step mean {r.meanStep:F2} cm sd {r.sdStep:F2} cm");
    Assert.AreEqual(0,r.back,(planar?"quarter":"side")+" backward frames");Assert.Greater(r.meanStep,2.5f,"the hero does move (~3.5 cm a frame)");
   }
  }
 }
}
