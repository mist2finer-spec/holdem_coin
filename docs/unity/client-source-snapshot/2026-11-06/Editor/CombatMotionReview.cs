#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;
namespace IslandGame.Editor {
 public static class CombatMotionReview {
  const string Dir="G:/new_project/IslandGame/.island-backups/combat-motion-20261102/";
  static JArray frames,actions;static double started,next;static int phase;static string originalOrigin;
  public static JObject ValidateOracle(){
   var data=JObject.Parse(File.ReadAllText(Dir+"web-motion-oracle.json"));int checkedCount=0;
   foreach(var row in (JArray)data["contacts"]){float actual=NativeCombatPresentation.MotionTime((float)row["age"],(float)row["duration"],(float)row["hitAt"],(float)row["clipDuration"],(float)row["contact"]);Close(actual,(float)row["expected"],"contact");checkedCount++;}
   foreach(var row in (JArray)data["clocks"]){var clock=new NativeCombatClock();int i=0;foreach(var op in (JArray)row["ops"]){if(op is JObject packet)clock.Receive((double)packet["elapsed"],(double)packet["now"],(bool)packet["playing"]);else Close((float)clock.Sample((double)op),(float)row["expected"][i++],"clock");}checkedCount++;}
   foreach(var row in (JArray)data["traversals"]){var p=NativeCombatPresentation.SampleTraversal((JArray)row["legs"],(float)row["age"]);foreach(string field in new[]{"x","y","elevation","airHeight","progress"})Close((float)p[field],(float)row["expected"][field],"traversal "+field);if((bool)p["holding"]!=(bool)row["expected"]["holding"]||(int)p["index"]!=(int)row["expected"]["index"])throw new Exception("Traversal leg or hold mismatch");checkedCount++;}
   foreach(var row in (JArray)data["projects"]){string before=row["state"].ToString();var p=NativeCombatPresentation.ProjectHero((JObject)row["state"],(JObject)row["world"],(float)row["time"],(float)row["input"]["x"],(bool)row["input"]["auto"]);foreach(string field in new[]{"x","y","elevation","airHeight","facing"})Close((float)p[field],(float)row["expected"][field],"projection "+field);if((string)p["action"]!=(string)row["expected"]["action"])throw new Exception("Projection pose mismatch");if(row["state"].ToString()!=before)throw new Exception("Authority mutated");checkedCount++;}
   var result=new JObject{{"result","PASS"},{"cases",checkedCount},{"source",data["sourceCommit"]},{"authorityUnchanged",true}};File.WriteAllText(Dir+"unity-oracle-result.json",result.ToString());return result;
  }
  static void Close(float actual,float expected,string title){if(float.IsNaN(actual)||Mathf.Abs(actual-expected)>.001f)throw new Exception(title+" "+actual+" != "+expected);}
  public static void StartLive(){
   if(!EditorApplication.isPlaying)throw new Exception("Start Play first");
   var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();originalOrigin=app.server;app.server="http://127.0.0.1:18082";
   typeof(IslandApp).GetMethod("StartRpg",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).Invoke(app,new object[]{false});app.HudSession.Auto=false;
   frames=new JArray();actions=new JArray();started=EditorApplication.timeSinceStartup;next=started;phase=0;EditorApplication.update-=Tick;EditorApplication.update+=Tick;
  }
  static void Tick(){
   var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();if(!EditorApplication.isPlaying||!app){End("interrupted");return;}
   double now=EditorApplication.timeSinceStartup,t=now-started;if(now<next)return;next=now+.025;
   var state=app.HudSession.State;var b=app.HudBattle;
   if(state!=null){var hero=state["hero"] as JObject;var motion=hero?["motion"] as JObject;
    frames.Add(new JObject{{"wall",t},{"frame",Time.frameCount},{"authority",b.AuthorityTime},{"visual",b.VisualTime},{"lead",b.VisualTime-b.AuthorityTime},{"x",b.HeroWorldX},{"serverX",hero?["x"]?.DeepClone()},{"air",b.HeroAirHeight},{"pose",b.HeroAction},{"track",b.HeroTrackTime},{"bodyHeight",b.HeroBodyHeight},{"groundError",b.HeroGroundError},{"kind",motion?["kind"]?.DeepClone()},{"duration",motion?["duration"]?.DeepClone()},{"hitAt",motion?["hitAt"]?.DeepClone()}});
   }
   try{
    if(phase==0&&state!=null&&t>.3){BattleHudReview.Stick(1);Action("move-right",t);phase++;}
    else if(phase==1&&t>1.4){BattleHudReview.Stick(0,true);BattleHudReview.Click("Jump");Action("jump",t);phase++;}
    else if(phase==2&&t>1.85){BattleHudReview.Capture(Dir+"jump.png");phase++;}
    else if(phase==3&&t>3){BattleHudReview.Click("EvadeRight");Action("dodge",t);phase++;}
    else if(phase==4&&t>5.3){BattleHudReview.Click("Slide");Action("slide",t);phase++;}
    else if(phase==5&&t>7.7){BattleHudReview.Click("Auto");Action("auto-on",t);phase++;}
    else if(phase==6&&t>12){BattleHudReview.Capture(Dir+"combat.png");phase++;}
    if(t>20)End("completed");
   }catch(Exception ex){actions.Add(new JObject{{"error",ex.Message},{"wall",t}});phase++;}
  }
  static void Action(string action,double t){actions.Add(new JObject{{"action",action},{"wall",t}});}
  public static void End(string reason){
   EditorApplication.update-=Tick;var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();if(app){BattleHudReview.Stick(0,true);app.HudSession.Auto=false;if(originalOrigin!=null)app.server=originalOrigin;}
   if(frames!=null)File.WriteAllText(Dir+"live-motion-trace.json",new JObject{{"reason",reason},{"frames",frames},{"actions",actions}}.ToString());frames=null;
  }
 }
}
#endif
