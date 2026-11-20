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
   Debug.LogFormat(LogType.Log,LogOption.NoStacktrace,null,"{0}",line.ToString());
   lastGc=gc;windowStart=now;frames=0;maxFrame=0;arrivals=0;maxGap=0;maxAge=0;capFrames=0;
  }
 }
}
