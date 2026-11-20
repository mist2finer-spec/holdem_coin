using System;
using System.Diagnostics;
using UnityEngine;
using UnityEngine.Rendering;
namespace IslandGame {
 // Cooperative presentation budget. Never changes simulation time or input frequency.
 public sealed class IslandBudgetPolicy {
  public const double TargetMilliseconds=1000.0/60*.65;
  public int Level{get;private set;} int over,under;
  // T1b development pin (Editor / Development builds, IslandBattleHud): holds Level at 0 while the counters keep running for the
  // perf line. Never saved. Unpinning starts the rule again from 0 with fresh counters. The rule below is unchanged.
  public bool Pinned{get;private set;} public int Over=>over; public int Under=>under;
  public void Pin(bool on){Pinned=on;Level=0;over=under=0;}
  public void Observe(double cpu,double gpu){
   double load=Math.Max(cpu,gpu);if(double.IsNaN(load)||double.IsInfinity(load)||load<=0)return;
   if(load>TargetMilliseconds){under=0;if(++over>=8){Level=Math.Min(3,Level+1);over=0;}}
   else if(load<TargetMilliseconds*.78){over=0;if(++under>=120){Level=Math.Max(0,Level-1);under=0;}}
   else {over=under=0;}
   if(Pinned)Level=0;
  }
  public int HudHz=>Level==0?20:Level==1?15:Level==2?10:8;
  public int PoseHz(float distance)=>Level==0?(distance<.25f?60:distance<.45f?30:15):Level==1?(distance<.25f?30:distance<.45f?20:10):Level==2?(distance<.25f?20:distance<.45f?15:10):(distance<.25f?15:distance<.45f?10:5);
 }
 [DefaultExecutionOrder(-10000)]
 public sealed class IslandFrameBudget:MonoBehaviour {
  public static IslandFrameBudget Current{get;private set;}
  public readonly IslandBudgetPolicy Policy=new IslandBudgetPolicy();
  public double CpuActiveMilliseconds{get;private set;} public double GpuMilliseconds{get;private set;}
  public int DeferredPoses{get;private set;} public int TimingSamples{get;private set;}
  public bool TimingsAvailable=>TimingSamples>0;
  readonly FrameTiming[] timings=new FrameTiming[1];ulong last;long frameStart;double poseEstimate=.12;
  LODGroup[] lods=Array.Empty<LODGroup>();Renderer[] scenery=Array.Empty<Renderer>();ShadowCastingMode[] shadows=Array.Empty<ShadowCastingMode>();int applied=-1;
  public static IslandFrameBudget Ensure(GameObject host){if(!Current)Current=host.AddComponent<IslandFrameBudget>();return Current;}
  void Awake(){Current=this;Application.targetFrameRate=60;frameStart=Stopwatch.GetTimestamp();}
  void Update(){
   frameStart=Stopwatch.GetTimestamp();FrameTimingManager.CaptureFrameTimings();
   if(FrameTimingManager.GetLatestTimings(1,timings)>0&&timings[0].frameStartTimestamp!=last){
    var f=timings[0];last=f.frameStartTimestamp;
    CpuActiveMilliseconds=Math.Max(0,Math.Max(f.cpuMainThreadFrameTime-f.cpuMainThreadPresentWaitTime,f.cpuRenderThreadFrameTime));GpuMilliseconds=f.gpuFrameTime;
    winMain+=f.cpuMainThreadFrameTime;winWait+=f.cpuMainThreadPresentWaitTime;winRender+=f.cpuRenderThreadFrameTime;winGpu+=f.gpuFrameTime;winLoad+=Math.Max(CpuActiveMilliseconds,GpuMilliseconds);winCount++;
    if(++TimingSamples>60)Policy.Observe(CpuActiveMilliseconds,GpuMilliseconds);
   }
   if(applied!=Policy.Level)ApplyScenery();
  }
  // T1b perf line (IslandPerfLog, once per second): mean FrameTiming parts since the last call, and load = max(cpu, gpu) as Observe gets it.
  double winMain,winWait,winRender,winGpu,winLoad;int winCount;
  public bool Pinned{get=>Policy.Pinned;set{if(value!=Policy.Pinned)Policy.Pin(value);}}
  public bool TakeWindow(out double main,out double wait,out double render,out double gpu,out double load){
   int n=winCount;main=n>0?winMain/n:0;wait=n>0?winWait/n:0;render=n>0?winRender/n:0;gpu=n>0?winGpu/n:0;load=n>0?winLoad/n:0;
   winMain=winWait=winRender=winGpu=winLoad=0;winCount=0;return n>0;
  }
  public bool AllowOptionalWork(double estimate){return (Stopwatch.GetTimestamp()-frameStart)*1000.0/Stopwatch.Frequency+estimate<=IslandBudgetPolicy.TargetMilliseconds;}
  public bool AllowOptionalPose(){
   double elapsed=(Stopwatch.GetTimestamp()-frameStart)*1000.0/Stopwatch.Frequency;
   if(elapsed+poseEstimate<=IslandBudgetPolicy.TargetMilliseconds)return true;DeferredPoses++;return false;
  }
  public void RecordPose(long start){poseEstimate=Math.Max(.01,poseEstimate*.9+(Stopwatch.GetTimestamp()-start)*1000.0/Stopwatch.Frequency*.1);}
  public void BindScenery(Transform root){RestoreScenery();if(root){lods=root.GetComponentsInChildren<LODGroup>(true);scenery=root.GetComponentsInChildren<Renderer>(true);shadows=new ShadowCastingMode[scenery.Length];for(int i=0;i<scenery.Length;i++)shadows[i]=scenery[i].shadowCastingMode;}applied=-1;ApplyScenery();}
  void ApplyScenery(){applied=Policy.Level;foreach(var lod in lods)if(lod&&lod.enabled&&lod.gameObject.activeInHierarchy&&lod.lodCount>0)lod.ForceLOD(applied==0?-1:Math.Min(applied,lod.lodCount-1));for(int i=0;i<scenery.Length;i++)if(scenery[i])scenery[i].shadowCastingMode=applied>=2?ShadowCastingMode.Off:shadows[i];}
  void RestoreScenery(){foreach(var lod in lods)if(lod&&lod.enabled&&lod.gameObject.activeInHierarchy&&lod.lodCount>0)lod.ForceLOD(-1);for(int i=0;i<scenery.Length;i++)if(scenery[i])scenery[i].shadowCastingMode=shadows[i];lods=Array.Empty<LODGroup>();scenery=Array.Empty<Renderer>();shadows=Array.Empty<ShadowCastingMode>();}
  void OnDestroy(){RestoreScenery();if(Current==this)Current=null;}
 }
}
