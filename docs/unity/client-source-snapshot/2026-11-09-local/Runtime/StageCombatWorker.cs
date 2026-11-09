using System;
using System.Collections.Generic;
using System.Threading;
using System.Diagnostics;
using Jint;
using Jint.Native;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 // This object never calls Unity APIs. One worker owns the JS engine and all mutable combat state.
 public sealed class StageCombatWorker : IDisposable {
  readonly object gate=new object();readonly AutoResetEvent wake=new AutoResetEvent(false);
  readonly Queue<string> commands=new Queue<string>(),profiles=new Queue<string>();
  readonly int publicationMilliseconds;readonly string source,boot;readonly Thread thread;bool stopping,ready,boundary;
  double pendingTime;string input="{\"x\":0,\"y\":0,\"auto\":true}",latest,error;
  public int SnapshotIntervalMilliseconds{get;private set;}=50;public long SnapshotsProduced{get;private set;}
  public long Steps {get;private set;}public double DroppedSeconds {get;private set;}public double MaxBatchMilliseconds {get;private set;}
  public StageCombatWorker(string source,string boot,int publicationMilliseconds=50){this.publicationMilliseconds=Math.Max(20,publicationMilliseconds);this.source=source;this.boot=boot;thread=new Thread(Run){IsBackground=true,Name="Island local stage combat"};thread.Start();}
  public bool Ready {get{lock(gate)return ready;}}
  public string TakeSnapshot(){lock(gate){var result=latest;latest=null;return result;}}
  public string TakeError(){lock(gate){var result=error;error=null;return result;}}
  void Signal(){try{wake.Set();}catch(ObjectDisposedException){} }
  public void Submit(float seconds,string currentInput){lock(gate){if(stopping||boundary)return;input=currentInput;double next=pendingTime+Math.Max(0,Math.Min(.1,seconds));if(next>.5)DroppedSeconds+=next-.5;pendingTime=Math.Min(.5,next);}Signal();}
  public void Command(string json){lock(gate){if(!stopping&&!boundary&&commands.Count<32)commands.Enqueue(json);}Signal();}
  public void Profile(string json,bool acknowledge){lock(gate){if(stopping)return;profiles.Enqueue((acknowledge?"A":"P")+json);if(acknowledge){boundary=false;pendingTime=0;}commands.Clear();}Signal();}
  static string Call(Engine engine,JsValue function,string value){return engine.Invoke(function,JsValue.Undefined,new JsValue[]{value}).ToString();}
  void Publish(string json){lock(gate){SnapshotsProduced++;latest=json;if(json.Contains("\"stageBoundary\":{")){boundary=true;pendingTime=0;commands.Clear();}}}
  void Run(){
   Engine engine=null;
   try{
    engine=new Engine();engine.Execute(source);var initialize=engine.GetValue("stageInitialize");var advance=engine.GetValue("stageAdvance");var profile=engine.GetValue("stageProfile");var acknowledge=engine.GetValue("stageAcknowledge");
    Publish(Call(engine,initialize,boot));lock(gate)ready=true;
    var publishClock=Stopwatch.StartNew();var runtimeClock=Stopwatch.StartNew();var cadence=new StageSnapshotCadence();
    for(;;){
     string current;string[] events,updates;int count;
     lock(gate){if(stopping)break;SnapshotIntervalMilliseconds=publicationMilliseconds*(cadence.Observe(runtimeClock.Elapsed.TotalSeconds,pendingTime)/50);current=input;updates=profiles.ToArray();profiles.Clear();count=boundary?0:Math.Min(5,(int)(pendingTime/.02));pendingTime-=count*.02;events=boundary?new string[0]:commands.ToArray();commands.Clear();}
     foreach(var update in updates)Call(engine,update[0]=='A'?acknowledge:profile,update.Substring(1));
     if(count==0&&events.Length==0){wake.WaitOne(10);continue;}
     var message=new JObject{{"steps",count},{"input",JObject.Parse(current)},{"commands",new JArray(Array.ConvertAll(events,JObject.Parse))},{"snapshot",publishClock.ElapsedMilliseconds>=SnapshotIntervalMilliseconds||events.Length>0||updates.Length>0}};
     var timer=Stopwatch.StartNew();string snapshot=Call(engine,advance,message.ToString(Newtonsoft.Json.Formatting.None));MaxBatchMilliseconds=Math.Max(MaxBatchMilliseconds,timer.Elapsed.TotalMilliseconds);Steps+=count;
     if(!string.IsNullOrEmpty(snapshot)){Publish(snapshot);publishClock.Restart();}
    }
   }catch(Exception ex){lock(gate)error=ex.GetType().Name+": "+ex.Message;}
   finally{lock(gate)stopping=true;if(engine!=null)engine.Dispose();wake.Dispose();}
  }
  public void Dispose(){lock(gate){stopping=true;commands.Clear();profiles.Clear();}Signal();}
 }
}
