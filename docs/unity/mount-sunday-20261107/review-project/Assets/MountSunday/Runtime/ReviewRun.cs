using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using Unity.Profiling;

namespace MountSunday.Review {
 [Serializable] public class RoadPoints {public Vector3[] points;}
 public sealed class ReviewRun:MonoBehaviour {
  public string output, mode="tour", label="baseline";
  public bool completed;public int waypoint,frames;public float travel;public string failure;
  public float warmup=10,duration=60;
  public bool crossedBridgeDeck;readonly List<Vector3> walkingTrace=new List<Vector3>();
  Camera cam;MountSundayFreeFlight flight;CharacterController controller;Vector3[] road;float timer,vertical,stuck;Vector3 last;
  ProfilerRecorder cpu,gpu,gc,mem;readonly List<Sample> samples=new List<Sample>(10000);FrameTiming[] timings=new FrameTiming[1];
  [Serializable] public class Sample {public float frameMs,cpuMs,gpuMs;public long gcBytes,memoryBytes;public int draws,setPass,triangles;}
  [Serializable] public class Report {public string mode,label,status,failure,device,gpu,unity;public int width,height,frames,roadPoints,visited;public float seconds,travel;public bool cpuAvailable,gpuAvailable,teleportedDuringWalk,crossedBridgeDeck;public Sample[] samples;public Vector3 end;public Vector3[] walkingTrace;}
  public static ReviewRun Begin(string folder,string mode,string label){var go=new GameObject("Review measurement "+mode);var r=go.AddComponent<ReviewRun>();r.output=folder;r.mode=mode;r.label=label;return r;}
  void Start(){
   Directory.CreateDirectory(output);cam=Camera.main;flight=FindFirstObjectByType<MountSundayFreeFlight>();controller=flight.GetComponent<CharacterController>();flight.enabled=false;
   road=JsonUtility.FromJson<RoadPoints>(Resources.Load<TextAsset>(mode=="walk"&&label!="baseline"?"MountSundayWalkingRoad":"MountSundayReviewRoad").text).points;
   cpu=ProfilerRecorder.StartNew(ProfilerCategory.Internal,"Main Thread",1);gpu=ProfilerRecorder.StartNew(ProfilerCategory.Render,"GPU Frame Time",1);gc=ProfilerRecorder.StartNew(ProfilerCategory.Memory,"GC Allocated In Frame",1);mem=ProfilerRecorder.StartNew(ProfilerCategory.Memory,"Total Used Memory",1);
   if(mode=="walk") {controller.enabled=false;flight.transform.position=road[0]+Vector3.up*.35f;controller.enabled=true;waypoint=1;last=flight.transform.position;}
   else controller.enabled=false;
  }
  void Update(){if(completed)return;float dt=Mathf.Min(Time.unscaledDeltaTime,.05f);timer+=Time.unscaledDeltaTime;frames++;
   if(mode=="walk")Walk(dt);else Tour();
   if(timer>warmup&&mode=="tour"){
    FrameTimingManager.CaptureFrameTimings();uint n=FrameTimingManager.GetLatestTimings(1,timings);
    var s=new Sample{frameMs=Time.unscaledDeltaTime*1000,cpuMs=cpu.Valid?cpu.LastValue/1000000f:0,gpuMs=n>0?(float)timings[0].gpuFrameTime:gpu.Valid?gpu.LastValue/1000000f:0,gcBytes=gc.Valid?gc.LastValue:0,memoryBytes=mem.Valid?mem.LastValue:0};
    #if UNITY_EDITOR
    s.draws=UnityEditor.UnityStats.drawCalls;s.setPass=UnityEditor.UnityStats.setPassCalls;s.triangles=UnityEditor.UnityStats.triangles;
    #endif
    samples.Add(s);
   }
   if(mode=="tour"&&timer>=warmup+duration)Finish();
  }
  void Tour(){float u=Mathf.Clamp01((timer-warmup)/duration);float f=u*(road.Length-1);int i=Mathf.Min((int)f,road.Length-2);Vector3 p=Vector3.Lerp(road[i],road[i+1],f-i)+Vector3.up*2.0f;flight.transform.position=p;Vector3 target=road[Mathf.Min(i+8,road.Length-1)]+Vector3.up*1.5f;var d=target-p;if(d.sqrMagnitude>.01f)flight.transform.rotation=Quaternion.LookRotation(d);cam.transform.localRotation=Quaternion.identity;}
  void Walk(float dt){
   var p=flight.transform.position;Vector3 delta=road[waypoint]-p;delta.y=0;
   if(delta.magnitude<.65f){walkingTrace.Add(p);waypoint++;if(waypoint>=road.Length){if(!crossedBridgeDeck)failure="Route did not cross the bridge deck";Finish();return;}delta=road[waypoint]-p;delta.y=0;}
   if(!crossedBridgeDeck&&Vector2.Distance(new Vector2(p.x,p.z),new Vector2(-365,250))<2&&p.y>36&&p.y<36.6f){crossedBridgeDeck=true;ScreenCapture.CaptureScreenshot(Path.Combine(output,label+"-bridge-walking.png"));}
   var dir=delta.normalized;flight.transform.rotation=Quaternion.LookRotation(dir);cam.transform.localRotation=Quaternion.Euler(5,0,0);
   if(controller.isGrounded&&vertical<0)vertical=-2;vertical=Mathf.Max(-45,vertical-20*dt);controller.Move((dir*5.5f+Vector3.up*vertical)*dt);
   float step=Vector3.Distance(p,flight.transform.position);travel+=step;stuck=step<.002f?stuck+dt:0;
   if(stuck>3||timer>480||flight.transform.position.y<-50){failure="Walking blocked or fell at road point "+waypoint;Finish();}
  }
  void Finish(){completed=true;var report=new Report{mode=mode,label=label,status=string.IsNullOrEmpty(failure)?"PASS":"FAIL",failure=failure,device=SystemInfo.deviceModel,gpu=SystemInfo.graphicsDeviceName,unity=Application.unityVersion,width=cam.pixelWidth,height=cam.pixelHeight,frames=frames,roadPoints=road.Length,visited=waypoint,seconds=timer,travel=travel,cpuAvailable=cpu.Valid,gpuAvailable=samples.Exists(s=>s.gpuMs>0),samples=samples.ToArray(),end=flight.transform.position,teleportedDuringWalk=false,crossedBridgeDeck=crossedBridgeDeck,walkingTrace=walkingTrace.ToArray()};File.WriteAllText(Path.Combine(output,label+"-"+mode+".json"),JsonUtility.ToJson(report,true));cpu.Dispose();gpu.Dispose();gc.Dispose();mem.Dispose();Debug.Log("MountSunday "+mode+" "+report.status+" "+report.failure);}
  void OnDestroy(){if(cpu.Valid)cpu.Dispose();if(gpu.Valid)gpu.Dispose();if(gc.Valid)gc.Dispose();if(mem.Valid)mem.Dispose();}
 }
}
