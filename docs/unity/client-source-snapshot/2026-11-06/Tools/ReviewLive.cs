using System;
using System.IO;
using System.Linq;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class ReviewLive {
 const string Dir="C:/Users/SHK/island-boss-camera-review/";
 public static object Main(){var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();app.StartCoroutine(Run(app));return new{reviewing=true};}
 static IEnumerator Run(IslandApp app){
  var captured=new HashSet<string>();var checks=new JArray();var samples=new JArray();var cpu=new List<double>();var gpu=new List<double>();var timings=new FrameTiming[1];ulong stamp=0;double start=Time.realtimeSinceStartupAsDouble;int frames=0;float lastSample=-1;app.HudSession.Auto=true;
  while(Time.realtimeSinceStartupAsDouble-start<70&&app.HudSession.Active){yield return null;var state=app.HudSession.State;if(state==null)continue;var view=UnityEngine.Object.FindFirstObjectByType<Battle3DView>();var rig=app.HudBattle.CameraRig;float x=NativeCombatPresentation.N(state["hero"]?["x"]);string action=(string)state["hero"]?["action"];float elapsed=NativeCombatPresentation.N(state["elapsed"]);
   string key=null;if(!captured.Contains("side")&&rig.Mode==ViewMode.Side25D&&elapsed>1)key="side";else if(!captured.Contains("bridge")&&x>2070&&x<2300)key="bridge";else if(!captured.Contains("quarter")&&rig.Mode==ViewMode.QuarterView&&(int)NativeCombatPresentation.N(state["room"])==1)key="quarter";else if(!captured.Contains("warning")&&state["warning"] is JObject)key="warning";else if(!captured.Contains("knockdown")&&action=="knockdown")key="knockdown";else if(!captured.Contains("getup")&&action=="getup")key="getup";
   if(key!=null){captured.Add(key);IslandGame.Editor.BattleHudReview.Capture(Dir+key+".png");}
   if(elapsed-lastSample>1){lastSample=elapsed;samples.Add(new JObject{{"elapsed",elapsed},{"room",state["room"]?.DeepClone()},{"phase",state["phase"]?.DeepClone()},{"heroX",x},{"heroAction",action},{"mode",rig.Mode.ToString()},{"distance",rig.CurrentDistance},{"pitch",rig.transform.eulerAngles.x},{"yaw",rig.transform.eulerAngles.y},{"fov",rig.view.fieldOfView},{"groundY",rig.GroundViewportPosition},{"heroClip",view.HeroClipName},{"bossClip",view.BossClipName},{"loadedChunks",view.Stream.LoadedChunks}});}
   if(FrameTimingManager.GetLatestTimings(1,timings)>0&&timings[0].frameStartTimestamp!=stamp){stamp=timings[0].frameStartTimestamp;var t=timings[0];cpu.Add(Math.Max(0,Math.Max(t.cpuMainThreadFrameTime-t.cpuMainThreadPresentWaitTime,t.cpuRenderThreadFrameTime)));gpu.Add(t.gpuFrameTime);}frames++;
  }
  checks.Add(new JObject{{"name","server-authoritative Unity mode, no Jint worker"},{"pass",!app.HudSession.UsesLocalStages&&(bool?)app.HudSession.State?["unityBossMode"]==true}});
  foreach(string key in new[]{"side","bridge","quarter","warning","knockdown","getup"})checks.Add(new JObject{{"name","actual frame captured: "+key},{"pass",captured.Contains(key)}});
  var report=new JObject{{"passed",checks.All(c=>(bool)c["pass"])},{"checks",checks},{"captureSeconds",Time.realtimeSinceStartupAsDouble-start},{"frames",frames},{"cpuActive",Stats(cpu)},{"gpu",Stats(gpu)},{"samples",samples},{"kernelDroppedSeconds",app.HudSession.LocalDroppedSeconds},{"endElapsed",app.HudSession.State?["elapsed"]?.DeepClone()}};File.WriteAllText(Dir+"live-review.json",report.ToString());
 }
 static JObject Stats(List<double> v){v.Sort();return v.Count==0?new JObject{{"samples",0}}:new JObject{{"samples",v.Count},{"p50",v[(int)((v.Count-1)*.5)]},{"p95",v[(int)((v.Count-1)*.95)]},{"p99",v[(int)((v.Count-1)*.99)]},{"max",v.Last()}};}
}
