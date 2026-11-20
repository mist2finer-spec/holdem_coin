using System;
using System.Diagnostics;
using UnityEngine;
using UnityEngine.Rendering;
namespace IslandGame {
 // A = the default rule (Q1, user's choice 2026-11-19). Old = the pre-Q1 rule kept for comparison. Pin = level held at 0
 // (counted with A). Old and Pin are picked only by the development button (IslandBattleHud); nothing is saved, a new app runs A.
 public enum IslandBudgetRule{A,Old,Pin}
 // Cooperative presentation budget. Never changes simulation time or input frequency.
 public sealed class IslandBudgetPolicy {
  public const double TargetMilliseconds=1000.0/60*.65;
  // Rule A. Counted in frame-timing samples (one per rendered frame; 60 = 1 s at 60 fps).
  //  up   : unchanged, 8 samples in a row over the target -> +1.
  //  down : the last WindowSamples (2 s) hold at most WindowOverAllowed (6 = 5 %) samples over the target, and at least
  //         `hold` samples have passed since the last level change -> -1. No 78 % band and no "in a row": a lone hitch or a
  //         load between 78 % and 100 % of the target no longer blocks the way down.
  //  flap : a step down that is followed by a step up within FailSamples (10 s) failed; the next try waits twice as long
  //         (2 -> 4 -> 8 -> 16 -> 30 s). A step down that holds FailSamples puts the wait back to 2 s.
  public const int WindowSamples=120,WindowOverAllowed=6,HoldMinSamples=120,HoldMaxSamples=1800,FailSamples=600,UpRun=8;
  public int Level{get;private set;} int over,under;
  readonly bool[] window=new bool[WindowSamples];int windowAt,windowFilled,windowOvers,sinceChange,sinceDescent=-1,hold=HoldMinSamples;
  public IslandBudgetRule Rule{get;private set;}
  public bool Pinned=>Rule==IslandBudgetRule.Pin;
  // Over = the current run over the target (both rules). Under = Old: its run below 78 %; A / Pin: samples since the last level change.
  public int Over=>over; public int Under=>Rule==IslandBudgetRule.Old?under:sinceChange;
  public int WindowOvers=>windowOvers; public int HoldSamples=>hold;
  // Switching the rule starts again from level 0 with fresh counters.
  public void SetRule(IslandBudgetRule rule){Rule=rule;Level=0;over=under=0;Array.Clear(window,0,WindowSamples);windowAt=windowFilled=windowOvers=sinceChange=0;sinceDescent=-1;hold=HoldMinSamples;}
  public void Pin(bool on){SetRule(on?IslandBudgetRule.Pin:IslandBudgetRule.A);}
  public void Observe(double cpu,double gpu){
   double load=Math.Max(cpu,gpu);if(double.IsNaN(load)||double.IsInfinity(load)||load<=0)return;
   if(Rule==IslandBudgetRule.Old){
    if(load>TargetMilliseconds){under=0;if(++over>=8){Level=Math.Min(3,Level+1);over=0;}}
    else if(load<TargetMilliseconds*.78){over=0;if(++under>=120){Level=Math.Max(0,Level-1);under=0;}}
    else {over=under=0;}
    return;
   }
   bool hot=load>TargetMilliseconds;
   if(window[windowAt])windowOvers--;window[windowAt]=hot;if(hot)windowOvers++;windowAt=(windowAt+1)%WindowSamples;if(windowFilled<WindowSamples)windowFilled++;
   if(sinceChange<int.MaxValue)sinceChange++;
   if(sinceDescent>=0&&++sinceDescent>=FailSamples){sinceDescent=-1;hold=HoldMinSamples;}
   if(hot){if(++over>=UpRun){over=0;if(Level<3){Level++;sinceChange=0;if(sinceDescent>=0){sinceDescent=-1;hold=Math.Min(HoldMaxSamples,hold*2);}}}}
   else{over=0;if(Level>0&&sinceChange>=hold&&windowFilled>=WindowSamples&&windowOvers<=WindowOverAllowed){Level--;sinceChange=0;sinceDescent=0;}}
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
  // Q1 development button: A -> Old -> Pin -> A. Each switch starts again from level 0 (ApplyScenery follows next Update).
  public IslandBudgetRule Rule{get=>Policy.Rule;set{if(value!=Policy.Rule)Policy.SetRule(value);}}
  public IslandBudgetRule CycleRule(){Rule=Rule==IslandBudgetRule.A?IslandBudgetRule.Old:Rule==IslandBudgetRule.Old?IslandBudgetRule.Pin:IslandBudgetRule.A;return Rule;}
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
