using System;
using System.IO;
using System.Linq;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEngine.EventSystems;
using Unity.Profiling;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class MeasureCombat {
 const string Dir="C:/Users/SHK/island-combat-stability-20261107/evidence/",Prefix="CombatStability20261107/";
 static readonly string[] Keys={"island-server","island-lobby-token","island-name","island-rpg-cookie"};
 public static object Prepare(){
  if(EditorApplication.isPlaying)throw new Exception("Stop Play before prepare");
  foreach(var k in Keys){if(!SessionState.GetBool(Prefix+k+"/saved",false)){SessionState.SetBool(Prefix+k+"/had",PlayerPrefs.HasKey(k));SessionState.SetString(Prefix+k,PlayerPrefs.GetString(k,""));SessionState.SetBool(Prefix+k+"/saved",true);}}
  PlayerPrefs.SetString("island-server","http://127.0.0.1:18093");PlayerPrefs.SetString("island-lobby-token","");PlayerPrefs.SetString("island-name","Combat measurement");PlayerPrefs.DeleteKey("island-rpg-cookie");
  var t=typeof(EditorWindow).Assembly.GetType("UnityEditor.GameView");var w=EditorWindow.GetWindow(t);var p=t.GetProperty("selectedSizeIndex",System.Reflection.BindingFlags.Public|System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance);
  if(SessionState.GetInt(Prefix+"size",-1)<0)SessionState.SetInt(Prefix+"size",(int)p.GetValue(w));
  IslandGame.Editor.BattleHudReview.SetSize(1080,2340);return new{prepared=true};
 }
 public static object Baseline(){return Begin("before");}
 public static object After(){return Begin("after");}
 public static object BeforeFocused(){return Begin("before-focused");}
 public static object AfterFocused(){return Begin("after-focused");}
 public static object BeforeRendered(){return Begin("before-rendered");}
 public static object AfterRendered(){return Begin("after-rendered");}
 public static object FinalRendered(){return Begin("final-rendered");}
 static object Begin(string label){var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();app.server="http://127.0.0.1:18093";app.SendMessage("StartRpg",false);app.StartCoroutine(Run(app,label));return new{started=label,frame=Time.frameCount};}
 static IEnumerator Run(IslandApp app,string label){
  var rows=new List<double[]>(6000);var errors=new List<string>();Application.LogCallback log=(m,s,t)=>{if(t==LogType.Error||t==LogType.Exception)errors.Add(m);};Application.logMessageReceived+=log;
  var gc=ProfilerRecorder.StartNew(ProfilerCategory.Memory,"GC Allocated In Frame");var draws=ProfilerRecorder.StartNew(ProfilerCategory.Render,"Draw Calls Count");var batches=ProfilerRecorder.StartNew(ProfilerCategory.Render,"Batches Count");var pass=ProfilerRecorder.StartNew(ProfilerCategory.Render,"SetPass Calls Count");
  double begin=Time.realtimeSinceStartupAsDouble,previous=begin;int start=Time.frameCount,seq=-1;double received=begin;var intervals=new List<double>();float lastX=0;int frozen=0,moving=0;bool inputStarted=false;
  bool forceRender=label.EndsWith("-rendered");RenderTexture renderTarget=null;if(forceRender){renderTarget=new RenderTexture(1080,1170,24);renderTarget.Create();}
  IslandHudStick stick=null;int inputSegment=-1;var gameView=EditorWindow.GetWindow(typeof(EditorWindow).Assembly.GetType("UnityEditor.GameView"));gameView.Focus();
  while(Time.realtimeSinceStartupAsDouble-begin<85){gameView.Repaint();yield return null;double now=Time.realtimeSinceStartupAsDouble,t=now-begin;var state=app.HudSession.State;if(state==null)continue;
   int next=(int?)state["sequence"]??-1;if(next!=seq){if(seq>=0)intervals.Add((now-received)*1000);received=now;seq=next;}
   // Identical wall-clock input: auto reaches the boss, then a held right/up stick.
   // Repeated pointer-downs are ignored by IslandHudStick while the pointer is held.
   // Boundary/knockdown holds are included, so frozenMovementFrames is not an input-lag metric.
   if(t>25&&(int)(t/6)!=inputSegment){inputSegment=(int)(t/6);app.HudSession.Auto=false;stick=stick?stick:UnityEngine.Object.FindFirstObjectByType<IslandHudStick>();var rect=(RectTransform)stick.transform;var center=RectTransformUtility.WorldToScreenPoint(null,rect.TransformPoint(rect.rect.center));float radius=Mathf.Min(rect.rect.width,rect.rect.height)*.35f*rect.lossyScale.x;stick.OnPointerDown(new PointerEventData(EventSystem.current){pointerId=11231,position=center+new Vector2(t%12<6?1:-1,.3f)*radius});inputStarted=true;}
   if(inputStarted&&t>30){float x=app.HudBattle.HeroWorldX;moving++;if(Mathf.Abs(x-lastX)<.001f)frozen++;lastX=x;}
   var budget=IslandFrameBudget.Current;double drawCount=draws.Valid?draws.LastValue:-1,batchCount=batches.Valid?batches.LastValue:-1,passCount=pass.Valid?pass.LastValue:-1;
   if(forceRender){var camera=app.HudBattle.BattleCamera;var oldTarget=camera.targetTexture;var oldRect=camera.rect;float oldAspect=camera.aspect;camera.targetTexture=renderTarget;camera.rect=new Rect(0,0,1,1);camera.aspect=1080f/1170;camera.Render();drawCount=UnityStats.drawCalls;batchCount=UnityStats.batches;passCount=UnityStats.setPassCalls;camera.targetTexture=oldTarget;camera.rect=oldRect;camera.aspect=oldAspect;}
   rows.Add(new[]{t,(now-previous)*1000,budget?budget.CpuActiveMilliseconds:-1,budget&&budget.GpuMilliseconds>0?budget.GpuMilliseconds:-1,gc.Valid?(double)gc.LastValue:-1,drawCount,batchCount,passCount,(double)seq,NativeCombatPresentation.N(state["elapsed"]),app.HudBattle.HeroWorldX,(now-received)*1000});previous=now;
  }
  Application.logMessageReceived-=log;gc.Dispose();draws.Dispose();batches.Dispose();pass.Dispose();stick?.ResetInput();app.HudSession.Move=app.HudSession.MoveY=0;if(renderTarget){renderTarget.Release();UnityEngine.Object.Destroy(renderTarget);}
  var stable=rows.Where(r=>r[0]>=25).ToList();var summary=new JObject{{"label",label},{"editor",true},{"resolution","1080x2340"},{"controlledRttMs",150},{"warmupSeconds",25},{"frames",Time.frameCount-start},{"measuredSeconds",60},{"frameMs",Stats(stable.Select(r=>r[1]))},{"cpuMs",Stats(stable.Select(r=>r[2]))},{"gpuMs",Stats(stable.Where(r=>r[3]>0).Select(r=>r[3]))},{"gcBytes",Stats(stable.Select(r=>r[4]))},{"drawCalls",Stats(stable.Select(r=>r[5]))},{"batches",Stats(stable.Select(r=>r[6]))},{"setPass",Stats(stable.Select(r=>r[7]))},{"responseIntervalMs",Stats(intervals)},{"over33ms",stable.Count(r=>r[1]>33.333)},{"over50ms",stable.Count(r=>r[1]>50)},{"movementSamples",moving},{"frozenMovementFrames",frozen},{"errors",new JArray(errors)}};
  File.WriteAllText(Dir+label+".json",summary.ToString());File.WriteAllLines(Dir+label+".csv",new[]{"seconds,frameMs,cpuMs,gpuMs,gcBytes,drawCalls,batches,setPass,sequence,elapsed,heroX,stateAgeMs"}.Concat(rows.Select(r=>string.Join(",",r.Select(v=>v.ToString("R",System.Globalization.CultureInfo.InvariantCulture))))));
  IslandGame.Editor.BattleHudReview.Capture(Dir+label+".png");
 }
 static JObject Stats(IEnumerable<double> values){var v=values.OrderBy(x=>x).ToArray();return v.Length==0?new JObject{{"available",false}}:new JObject{{"samples",v.Length},{"p50",v[(int)((v.Length-1)*.5)]},{"p95",v[(int)((v.Length-1)*.95)]},{"p99",v[(int)((v.Length-1)*.99)]},{"max",v.Last()},{"mean",v.Average()}};}
 public static object Restore(){foreach(var k in Keys)if(SessionState.GetBool(Prefix+k+"/saved",false)){if(SessionState.GetBool(Prefix+k+"/had",false))PlayerPrefs.SetString(k,SessionState.GetString(Prefix+k,""));else PlayerPrefs.DeleteKey(k);SessionState.EraseString(Prefix+k);SessionState.EraseBool(Prefix+k+"/saved");SessionState.EraseBool(Prefix+k+"/had");}PlayerPrefs.Save();var i=SessionState.GetInt(Prefix+"size",-1);if(i>=0){var t=typeof(EditorWindow).Assembly.GetType("UnityEditor.GameView");t.GetProperty("selectedSizeIndex",System.Reflection.BindingFlags.Public|System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).SetValue(EditorWindow.GetWindow(t),i);SessionState.EraseInt(Prefix+"size");}return new{restored=true};}
}
