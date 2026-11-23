using System;
using System.Collections.Generic;
using Jint;
using Jint.Native;
using NUnit.Framework;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace IslandGame.Tests {
 // AUTO ON keeps manual control (user 2026-11-23, maintenance/auto-manual-20261123/BRIEF_ui-ux-dev_KO.md): the HUD no longer hides the
 // pad and the manual buttons while AUTO is on, so the kernel must let those inputs win over AUTO. Each case runs two copies of the
 // training kernel bundle (Jint, the same Resources bundle the game uses) in lockstep with AUTO on: A gets the manual input, B does not
 // (AUTO alone), so a difference can only come from the manual input. Zone 1 (index 0, side lane) and the zone-10 boss arena (quarter).
 public sealed class AutoManualInputTests {
  static readonly JArray Skills=new JArray{Skill("icespear"),Skill("icenova"),Skill("frostshot"),Skill("stormcall"),Skill("arc"),Skill("spark")};
  static JObject Skill(string id)=>new JObject{{"activeId",id},{"enabled",true}};

  sealed class Kernel:IDisposable{
   readonly Engine e=new Engine();readonly int zone;public JObject S;
   public Kernel(string source,int zone){
    this.zone=zone;e.Execute(source);
    // The practice boot as Battle3DAssets.WithRunOptions sends it (autoSkills on, kit hero, the 1-3 water / 4-6 lightning practice slots).
    var boot=new JObject{{"mode","mount"},{"seed",111},{"referencePreview",true},{"previewZone",zone},{"traversalProfile","source-run-v2"},{"heroKit","pink-iai"},{"autoSkills",true},{"build",new JObject{{"skills",Skills.DeepClone()}}}};
    S=JObject.Parse(Call("stageInitialize",boot.ToString(Formatting.None)));
   }
   string Call(string f,string v)=>e.Invoke(e.GetValue(f),JsValue.Undefined,new JsValue[]{v}).ToString();
   // AUTO stays on in every input (as RpgSession sends it while the AUTO switch is ON).
   public JObject Step(Vector2 pad,JObject command=null,int steps=5){
    var input=new JObject{{"x",pad.x},{"y",pad.y},{"auto",true},{"paused",false},{"readyZone",zone},{"readyBoss",true}};
    var batch=new JObject{{"steps",steps},{"input",input},{"commands",command==null?new JArray():new JArray(command)},{"snapshot",true}};
    return S=JObject.Parse(Call("stageAdvance",batch.ToString(Formatting.None)));
   }
   public JObject Hero=>S["hero"] as JObject;
   public Vector2 HeroXY=>new Vector2((float)Hero["x"],(float)Hero["y"]);
   public void Dispose(){e.Dispose();}
  }
  static bool Quarter(int zone)=>zone==9;
  static string Source(){var s=Resources.Load<TextAsset>("TrainingCombatKernel.js");Assert.IsNotNull(s,"Resources/TrainingCombatKernel.js");return s.text;}
  // AUTO runs until a fight: living mobs in zone 1, the boss phase after the intro in the arena.
  static void ToFight(Kernel k,int zone){
   for(int i=0;i<1200;i++){var s=k.Step(Vector2.zero);
    if(Quarter(zone)?((int?)s["room"]==1&&(string)s["phase"]=="boss"&&(bool?)s["bossIntroActive"]!=true&&(float)s["elapsed"]>14):(Living(s).Count>0&&(float)s["elapsed"]>7.5f))return;}
   Assert.Fail("no fight reached in zone "+zone);
  }
  static List<JObject> Living(JObject s){var l=new List<JObject>();foreach(JObject m in s["mobs"] as JArray??new JArray())if((float)m["hp"]>0)l.Add(m);return l;}
  static JObject Target(JObject s,int zone){
   JObject best=null;float d=float.MaxValue;var h=s["hero"];
   foreach(var m in Living(s)){if(Quarter(zone)&&(bool?)m["unityBoss"]!=true)continue;float dm=Mathf.Abs((float)m["x"]-(float)h["x"]);if(dm<d){d=dm;best=m;}}return best;
  }
  static float Distance(JObject s,JObject target,int zone){var h=s["hero"];return new Vector2((float)h["x"]-(float)target["x"],Quarter(zone)?(float)h["y"]-(float)target["y"]:0).magnitude;}
  // The motion a command started (an attack cancel holds the new motion in `next` for 0.04 s).
  static JObject Started(JObject hero){var m=hero?["motion"] as JObject;if(m!=null&&(string)m["kind"]=="cancel")m=m["next"] as JObject;return m;}
  static void Twins(int zone,Action<Kernel,Kernel> body){
   var source=Source();
   using(var a=new Kernel(source,zone))using(var b=new Kernel(source,zone)){ToFight(a,zone);ToFight(b,zone);
    Assert.AreEqual(b.Hero.ToString(Formatting.None),a.Hero.ToString(Formatting.None),"the two kernel copies must be in lockstep (zone "+zone+")");body(a,b);}
  }

  [TestCase(0)][TestCase(9)]
  public void Auto_on_pad_moves_the_hero_by_hand_and_auto_resumes_on_release(int zone){
   Twins(zone,(a,b)=>{
    // Zone 1: away from the nearest mob (AUTO would walk the other way). Arena: across the hero-boss line (AUTO walks along it).
    var target=Target(a.S,zone);Assert.IsNotNull(target,"a target");var h=a.HeroXY;
    Vector2 pad=Quarter(zone)?new Vector2(-(h.y-(float)target["y"]),h.x-(float)target["x"]).normalized:new Vector2(Mathf.Sign(h.x-(float)target["x"]),0);if(pad==Vector2.zero)pad=Vector2.left;
    // Hold 2 s (a knockback may own the first second), measure the last second.
    Vector2 a0=default,b0=default;for(int i=0;i<20;i++){a.Step(pad);b.Step(Vector2.zero);if(i==9){a0=a.HeroXY;b0=b.HeroXY;}}
    float manual=Vector2.Dot(a.HeroXY-a0,pad),autoOnly=Vector2.Dot(b.HeroXY-b0,pad);
    Debug.Log($"[AutoManual] zone {zone} pad {pad}: held pad {manual:F0} cm along the pad in 1 s, AUTO alone {autoOnly:F0} cm; action {a.Hero["action"]}, auto {a.S["auto"]}");
    Assert.AreEqual(true,(bool?)a.S["auto"],"AUTO stays on while the pad is held");
    Assert.Greater(manual,150f,"the held pad moves the hero the pad's way with AUTO on");
    Assert.Greater(manual-autoOnly,150f,"the move comes from the pad, not from AUTO");
    Assert.AreEqual("run1",(string)a.Hero["action"],"running under the pad");
    var dir=new Vector2((float)a.Hero["direction"]["x"],(float)a.Hero["direction"]["y"]);Assert.Greater(Vector2.Dot(dir.normalized,pad),.95f,"facing the pad's way");
    // Release: AUTO takes over again within 1.5 s (attacks or dashes, or walks back toward the target).
    var t=Target(a.S,zone);Assert.IsNotNull(t);float d0=Distance(a.S,t,zone);string resumed=null;var trace=new System.Text.StringBuilder();
    for(int i=0;i<30&&resumed==null;i++){a.Step(Vector2.zero);var m=a.Hero["motion"] as JObject;string kind=m==null?null:(string)m["kind"];trace.Append(a.Hero["action"]+" ");
     var tt=Target(a.S,zone)??t;float gained=d0-Distance(a.S,tt,zone);
     if(kind=="attack"||kind=="rush"||kind=="skill"||gained>50)resumed=$"step {i}: {kind??"walk"} (closer by {gained:F0} cm)";}
    Debug.Log($"[AutoManual] zone {zone} release: AUTO resumed at {resumed} | {trace}");
    Assert.IsNotNull(resumed,"AUTO resumes after the pad is released: "+trace);
    Assert.AreEqual(true,(bool?)a.S["auto"],"the AUTO switch is still on");
   });
  }

  // The HUD buttons with AUTO on: attack (Attack button / screen tap), roll, jump, slide (manual buttons) and a skill slot (4 = lightning).
  static readonly (string name,JObject cmd,string kind)[] Buttons={("attack",new JObject{{"attack",true}},"attack"),("roll",new JObject{{"dodge",true}},"dodge"),
   ("jump",new JObject{{"jump",true}},"jump"),("slide",new JObject{{"slide",true}},"slide"),("skill4",new JObject{{"skill",3}},"skill")};
  [TestCase(0)][TestCase(9)]
  public void Auto_on_buttons_run_their_action(int zone){
   var log=new System.Text.StringBuilder();
   foreach(var button in Buttons){
    Twins(zone,(a,b)=>{
     // Press every 20 ms tick (a held repeat, as a player retries) until the press is taken; up to 15 s. A knockback, a running AUTO
     // skill or a cooldown refuses it exactly as with AUTO off; in the arena AUTO has just cast slot 4, so its 6 s cooldown comes first.
     for(int i=0;i<750;i++){
      a.Step(Vector2.zero,(JObject)button.cmd.DeepClone(),1);b.Step(Vector2.zero,null,1);
      if(a.Hero.ToString(Formatting.None)==b.Hero.ToString(Formatting.None))continue;
      var ma=Started(a.Hero);var mb=Started(b.Hero);
      log.Append($"{button.name}: taken after {i*20} ms -> {ma?["kind"]}/{a.Hero["action"]} (AUTO alone: {mb?["kind"]??"none"}/{b.Hero["action"]}); ");
      Assert.AreEqual(button.kind,(string)ma?["kind"],button.name+" starts its own action with AUTO on (zone "+zone+")");
      if(button.kind=="skill")Assert.AreEqual(3,(int?)ma["slot"],"the pressed slot, not an AUTO pick");
      bool autoSame=mb!=null&&(string)mb["kind"]==button.kind&&(button.kind!="skill"||(int?)mb["slot"]==3);
      Assert.IsFalse(autoSame,button.name+": AUTO alone did the same thing in the same tick, so the test cannot tell them apart");
      Assert.AreEqual(true,(bool?)a.S["auto"],"AUTO stays on after "+button.name);
      return;
     }
     Assert.Fail(button.name+" was never taken with AUTO on in 15 s (zone "+zone+")");
    });
   }
   Debug.Log($"[AutoManual] zone {zone} buttons: {log}");
  }
 }
}
