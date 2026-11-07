using System;
using System.IO;
using System.Linq;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class ReviewControls {
 const string Dir="C:/Users/SHK/island-combat-stability-20261107/evidence/";
 static float N(JToken value)=>NativeCombatPresentation.N(value);
 static Vector2 Position(IslandApp app)=>new Vector2(N(app.HudSession.State?["hero"]?["x"]),N(app.HudSession.State?["hero"]?["y"]));
 static void Press(IslandHudStick stick,Vector2 direction){var rect=(RectTransform)stick.transform;var center=RectTransformUtility.WorldToScreenPoint(null,rect.TransformPoint(rect.rect.center));float radius=Mathf.Min(rect.rect.width,rect.rect.height)*.35f*rect.lossyScale.x;var e=new PointerEventData(EventSystem.current){pointerId=11231,position=center+direction*radius};stick.OnPointerDown(e);}
 public static object Main(){var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();app.server="http://127.0.0.1:18093";app.SendMessage("StartRpg",false);app.StartCoroutine(Run(app));return new{started=true,frame=Time.frameCount};}
 static IEnumerator Run(IslandApp app){
  var errors=new JArray();Application.LogCallback onLog=(m,t,k)=>{if(k==LogType.Error||k==LogType.Exception||k==LogType.Assert)errors.Add(m);};Application.logMessageReceived+=onLog;
  double began=Time.realtimeSinceStartupAsDouble;int startFrame=Time.frameCount;var captures=new HashSet<string>();var checks=new JArray();var cpu=new List<double>();var gpu=new List<double>();
  IslandHudStick stick=null;bool sideStarted=false,sideDone=false,upStarted=false,upDone=false,rightStarted=false,rightDone=false;float inputAt=0;Vector2 from=Vector2.zero;Quaternion previous=Quaternion.identity;float maxBossBoneDelta=0;string previousAction=null;float bossEntered=-1;
  while(Time.realtimeSinceStartupAsDouble-began<68){yield return null;var state=app.HudSession.State;if(state==null)continue;stick=stick?stick:UnityEngine.Object.FindFirstObjectByType<IslandHudStick>();float elapsed=N(state["elapsed"]);string action=(string)state["hero"]?["action"];bool quarter=app.HudSession.PlanarMovement;
   if(!sideStarted&&elapsed>1){app.HudSession.Auto=false;from=Position(app);Press(stick,new Vector2(-.8f,-.8f));inputAt=elapsed;sideStarted=true;}
   if(sideStarted&&!sideDone&&elapsed-inputAt>1.2f){var to=Position(app);checks.Add(new JObject{{"name","side diagonal touch moves left only"},{"pass",to.x<from.x&&Mathf.Abs(to.y-from.y)<.01f},{"delta",(to-from).ToString()}});stick.ResetInput();app.HudSession.Auto=true;sideDone=true;}
   if(quarter&&bossEntered<0)bossEntered=elapsed;
   if(quarter&&!upStarted&&elapsed-bossEntered>2){app.HudSession.Auto=false;from=Position(app);Press(stick,Vector2.up);inputAt=elapsed;upStarted=true;}
   if(upStarted&&!upDone&&elapsed-inputAt>1.5f){var to=Position(app);checks.Add(new JObject{{"name","quarter vertical touch changes depth"},{"pass",to.y>from.y+40},{"delta",(to-from).ToString()}});stick.ResetInput();upDone=true;}
   if(upDone&&!rightStarted){from=Position(app);Press(stick,Vector2.right);inputAt=elapsed;rightStarted=true;}
   if(rightStarted&&!rightDone&&elapsed-inputAt>1.5f){var to=Position(app);checks.Add(new JObject{{"name","quarter horizontal touch changes world position"},{"pass",to.x>from.x+40},{"delta",(to-from).ToString()}});stick.ResetInput();app.HudSession.Auto=true;rightDone=true;}
   var boss=UnityEngine.Object.FindObjectsByType<Transform>(FindObjectsSortMode.None).FirstOrDefault(t=>t.name=="UpperArm.L"&&t.gameObject.activeInHierarchy);string bossAction=(string)state["mobs"]?.Last?["action"];
   if(boss){if(previousAction==bossAction&&(bossAction=="combo"||bossAction=="throw"))maxBossBoneDelta=Mathf.Max(maxBossBoneDelta,Quaternion.Angle(previous,boss.localRotation));previous=boss.localRotation;previousAction=bossAction;}
   string capture=null;if(!captures.Contains("side")&&sideDone&&!quarter&&elapsed>3)capture="side";else if(!captures.Contains("bridge")&&Position(app).x>2260&&Position(app).x<2500)capture="bridge";else if(!captures.Contains("quarter")&&quarter&&elapsed-bossEntered>1.4f)capture="quarter";else if(!captures.Contains("warning")&&state["warning"] is JObject)capture="warning";else if(!captures.Contains("knockdown")&&action=="knockdown")capture="knockdown";else if(!captures.Contains("getup")&&action=="getup")capture="getup";
   if(capture!=null){captures.Add(capture);IslandGame.Editor.BattleHudReview.Capture(Dir+"final-"+capture+".png");}
   var budget=IslandFrameBudget.Current;if(budget&&budget.TimingsAvailable){cpu.Add(budget.CpuActiveMilliseconds);gpu.Add(budget.GpuMilliseconds);}
  }
  stick?.ResetInput();Application.logMessageReceived-=onLog;
  checks.Add(new JObject{{"name","live boss arm rotations change during attacks"},{"pass",maxBossBoneDelta>.2f},{"maximumFrameDeltaDegrees",maxBossBoneDelta}});
  checks.Add(new JObject{{"name","all encounter states rendered"},{"pass",new[]{"side","bridge","quarter","warning","knockdown","getup"}.All(captures.Contains)}});
  checks.Add(new JObject{{"name","no runtime errors"},{"pass",errors.Count==0}});
  var report=new JObject{{"passed",checks.All(c=>(bool)c["pass"])},{"frames",Time.frameCount-startFrame},{"elapsed",Time.realtimeSinceStartupAsDouble-began},{"checks",checks},{"errors",errors},{"captures",new JArray(captures)},{"cpu",Stats(cpu)},{"gpu",Stats(gpu)}};File.WriteAllText(Dir+"play-review.json",report.ToString());
 }
 static JObject Stats(List<double> v){v.Sort();return v.Count>0?new JObject{{"samples",v.Count},{"p95",v[(int)((v.Count-1)*.95)]},{"max",v.Last()}}:new JObject{{"samples",0}};}
}
