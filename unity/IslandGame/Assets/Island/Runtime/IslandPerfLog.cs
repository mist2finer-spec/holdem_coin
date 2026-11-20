using System;
using System.Text;
using UnityEngine;
namespace IslandGame {
 // O1-0 perf log: Development builds and the Editor only. Once per second, one log line tagged [IslandPerf]
 // (Android: logcat tag "Unity"). Reads counters only and changes no game behaviour. The per-frame path allocates nothing;
 // the once-per-second line builds one string.
 // Fields: t=realtime s, fps, fmax=longest frame ms, snapCfg=worker snapshot interval ms (20/40), snaps=snapshots received,
 // gapMax=longest gap between received snapshots ms, ageMax=oldest snapshot age seen ms, cap=frames with snapshot age > 150 ms
 // (the NativeCombatClock lead limit, so on-screen combat time stood still), steps=worker 20 ms steps, dropMs=worker time
 // dropped (backlog > 0.5 s), batchMax=longest worker advance batch ms, gc=GC.CollectionCount(0) increase, budget=IslandFrameBudget level, room.
 public sealed class IslandPerfLog:MonoBehaviour {
  public const string Tag="[IslandPerf]";
  const double LeadLimitSeconds=.15;
  [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)] static void Boot(){
   if(!Debug.isDebugBuild)return;
   var go=new GameObject("Island perf log"){hideFlags=HideFlags.HideInHierarchy};DontDestroyOnLoad(go);go.AddComponent<IslandPerfLog>();
  }
  readonly StringBuilder line=new StringBuilder(256);
  RpgSession session;double windowStart,lastArrival,maxGap,maxAge,lastDropped,nextLookup;object lastState;
  int frames,arrivals,capFrames,lastGc=-1;float maxFrame;long lastSteps=-1;
  void Update(){
   double now=Time.unscaledTimeAsDouble;
   if(windowStart<=0){windowStart=now;lastGc=GC.CollectionCount(0);}
   frames++;float frameMs=Time.unscaledDeltaTime*1000;if(frameMs>maxFrame)maxFrame=frameMs;
   if(!session&&now>=nextLookup){nextLookup=now+1;session=FindFirstObjectByType<RpgSession>();}
   if(session&&session.Active&&session.UsesLocalTraining){
    var state=session.State;
    if(!ReferenceEquals(state,lastState)){if(lastState!=null){double gap=now-lastArrival;if(gap>maxGap)maxGap=gap;}lastState=state;lastArrival=now;arrivals++;}
    else if(lastState!=null&&!session.Paused){double age=now-lastArrival;if(age>maxAge)maxAge=age;if(age>LeadLimitSeconds)capFrames++;}
   }
   if(now-windowStart<1)return;
   Emit(now);
  }
  void Emit(double now){
   double span=now-windowStart;int gc=GC.CollectionCount(0);bool local=session&&session.Active&&session.UsesLocalTraining;
   line.Length=0;
   line.Append(Tag).Append(" t=").Append(Time.realtimeSinceStartup.ToString("F1")).Append(" fps=").Append((frames/span).ToString("F1")).Append(" fmax=").Append(maxFrame.ToString("F1"));
   if(local){
    long steps=session.LocalSteps;double dropped=session.LocalDroppedSeconds;
    line.Append(" snapCfg=").Append(session.LocalSnapshotIntervalMilliseconds).Append(" snaps=").Append(arrivals).Append(" gapMax=").Append((maxGap*1000).ToString("F0"))
     .Append(" ageMax=").Append((maxAge*1000).ToString("F0")).Append(" cap=").Append(capFrames)
     .Append(" steps=").Append(lastSteps<0?0:steps-lastSteps).Append(" dropMs=").Append(((dropped-lastDropped)*1000).ToString("F0"))
     .Append(" batchMax=").Append(StageCombatWorker.TakeWindowMaxBatchMilliseconds().ToString("F1"));
    var room=session.State?["room"];line.Append(" room=").Append(room==null?"-":room.ToString());
    lastSteps=steps;lastDropped=dropped;
   }else{line.Append(" session=none");lastSteps=-1;lastDropped=session?session.LocalDroppedSeconds:0;}
   line.Append(" gc=").Append(lastGc<0?0:gc-lastGc).Append(" budget=").Append(IslandFrameBudget.Current?IslandFrameBudget.Current.Policy.Level:-1);
   // T1b (appended at the end, earlier keys unchanged): pin = development 0-pin on, over/under = the budget rule's run counts now,
   // main/wait/render/gpu = mean FrameTiming parts of the last second (ms), load = mean max(cpu, gpu) the rule was given ("-" = no timings).
   var budget=IslandFrameBudget.Current;
   if(budget){line.Append(" pin=").Append(budget.Pinned?1:0).Append(" over=").Append(budget.Policy.Over).Append(" under=").Append(budget.Policy.Under);
    if(budget.TakeWindow(out double main,out double wait,out double render,out double gpu,out double load))
     line.Append(" main=").Append(main.ToString("F2")).Append(" wait=").Append(wait.ToString("F2")).Append(" render=").Append(render.ToString("F2")).Append(" gpu=").Append(gpu.ToString("F2")).Append(" load=").Append(load.ToString("F2"));
    else line.Append(" main=- wait=- render=- gpu=- load=-");
    // Q1 (appended at the end): rule = A | old (a pin counts with A: rule=A pin=1), win = samples over the target in A's last
    // 2 s window, hold = samples A waits after a level change before its next step down (120 = 2 s .. 1800 = 30 s).
    line.Append(" rule=").Append(budget.Rule==IslandBudgetRule.Old?"old":"A").Append(" win=").Append(budget.Policy.WindowOvers).Append(" hold=").Append(budget.Policy.HoldSamples);}
   else line.Append(" pin=- over=- under=- main=- wait=- render=- gpu=- load=- rule=- win=- hold=-");
   Debug.LogFormat(LogType.Log,LogOption.NoStacktrace,null,"{0}",line.ToString());
   lastGc=gc;windowStart=now;frames=0;maxFrame=0;arrivals=0;maxGap=0;maxAge=0;capFrames=0;
  }
 }
}
