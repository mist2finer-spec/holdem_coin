using System;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json.Linq;
using Unity.Profiling;
namespace IslandGame {
 // Nearby chunk instances only. Far chunks remain placement metadata, never disabled whole-map copies.
 public sealed class NatureEnvironmentStream:IDisposable {
  sealed class Live {
   public NatureStreamPlan.Chunk plan;public GameObject root;public bool[] spawned;
   public readonly Dictionary<string,NaturePropCache.Entry> leases=new Dictionary<string,NaturePropCache.Entry>();
   public readonly List<NaturePropCache.Instance> props=new List<NaturePropCache.Instance>();public readonly List<bool> shadows=new List<bool>();
  }
  static readonly ProfilerMarker tickMarker=new ProfilerMarker("Presentation.StreamChunks"),spawnMarker=new ProfilerMarker("Presentation.StreamProp");
  readonly NatureEnvironmentAssets assets;readonly List<NatureStreamPlan.Chunk> plan;readonly Dictionary<int,Live> live=new Dictionary<int,Live>();readonly List<int> release=new List<int>();
  readonly NatureTerrainBatch terrain;readonly List<NatureStreamPlan.Chunk> terrainChunks=new List<NatureStreamPlan.Chunk>();bool terrainDirty;readonly int seed;readonly Transform root;int applied=-1;float previousX,trimAt;bool disposed;
  public readonly NaturePropCache Cache;
  public const float LoadDistance=12,ReleaseDistance=20;
  public int TotalChunks=>plan.Count;public int LoadedChunks=>live.Count;public int LoadedProps{get;private set;}public int PeakProps{get;private set;}public int Loads{get;private set;}public int Unloads{get;private set;}
  public int PlannedProps{get;private set;}public double LastTickMilliseconds{get;private set;}public double MaxTickMilliseconds{get;private set;}
  public Transform Root=>root;
  public NatureEnvironmentStream(Transform parent,JObject map,NatureEnvironmentAssets a){
   assets=a;seed=unchecked((int)(map?.Value<long?>("seed")??111L));plan=NatureStreamPlan.Build(a,map);foreach(var c in plan)PlannedProps+=c.props.Count;
   var go=new GameObject("Nature Free · environment");go.transform.SetParent(parent,false);root=go.transform;terrain=new NatureTerrainBatch(root,a,seed);Cache=new NaturePropCache(root);
  }
  public void ConfigureGround(float front,float back,float skirt){if(terrain.Configure(front,back,skirt))terrainDirty=true;}
  public void Tick(float x,IslandFrameBudget budget,float visibleHalfWidth=6){
   if(disposed)return;using(tickMarker.Auto()){
    long started=System.Diagnostics.Stopwatch.GetTimestamp();int level=budget?budget.Policy.Level:0;
    if(applied!=level){applied=level;foreach(var l in live.Values)for(int i=0;i<l.props.Count;i++)NaturePropCache.Quality(l.props[i],l.shadows[i],level);}
    float load=Mathf.Max(LoadDistance,visibleHalfWidth+5);float retain=Mathf.Max(level>=2?16:ReleaseDistance,load+5);release.Clear();foreach(var p in live)if(NatureStreamPlan.Distance(p.Value.plan,x)>retain)release.Add(p.Key);
    foreach(int id in release)Unload(id,level<2);
    // Terrain is priority work. Create at most one small chunk per frame, nearest first.
    NatureStreamPlan.Chunk nearest=null;float best=float.MaxValue;float ahead=Mathf.Sign(x-previousX)*2;previousX=x;
    foreach(var c in plan){if(live.ContainsKey(c.id))continue;float d=NatureStreamPlan.Distance(c,x);if(d>load)continue;float priority=NatureStreamPlan.Distance(c,x+ahead);if(priority<best){best=priority;nearest=c;}}
    if(nearest!=null&&(best<7||budget==null||budget.AllowOptionalWork(.2)))Load(nearest);
    if(terrainDirty){terrainChunks.Clear();foreach(var l in live.Values)terrainChunks.Add(l.plan);terrain.Rebuild(terrainChunks);terrainDirty=false;}
    // Bound per-frame creation count and wall time; async resource completion never spawns from a callback.
    double slice=level>=2?.6:1.25;int spawned=0;
    while(spawned<6&&(System.Diagnostics.Stopwatch.GetTimestamp()-started)*1000.0/System.Diagnostics.Stopwatch.Frequency<slice&&(budget==null||budget.AllowOptionalWork(.15))){
     Live chosen=null;int index=-1;float distance=float.MaxValue;
     foreach(var l in live.Values){float d=NatureStreamPlan.Distance(l.plan,x);if(d>=distance)continue;for(int i=0;i<l.plan.props.Count;i++){if(l.spawned[i])continue;var e=l.leases[NaturePropCache.Key(l.plan.props[i].prop)];if(Cache.Ready(e)){chosen=l;index=i;distance=d;break;}}}
     if(chosen==null)break;Spawn(chosen,index,level);spawned++;
    }
    if(Time.unscaledTime>=trimAt){Cache.Trim(level>=2);trimAt=Time.unscaledTime+1;}
    LastTickMilliseconds=(System.Diagnostics.Stopwatch.GetTimestamp()-started)*1000.0/System.Diagnostics.Stopwatch.Frequency;MaxTickMilliseconds=Math.Max(MaxTickMilliseconds,LastTickMilliseconds);
   }
  }
  void Load(NatureStreamPlan.Chunk c){
   var go=new GameObject("Stream chunk "+c.id+" · room "+c.room);go.transform.SetParent(root,false);var l=new Live{plan=c,root=go,spawned=new bool[c.props.Count]};live.Add(c.id,l);Loads++;
   terrainDirty=true;
   foreach(var p in c.props){string key=NaturePropCache.Key(p.prop);if(!l.leases.ContainsKey(key))l.leases.Add(key,Cache.Acquire(p.prop));}
  }
  void Spawn(Live l,int index,int level){using(spawnMarker.Auto()){
   var p=l.plan.props[index];var entry=l.leases[NaturePropCache.Key(p.prop)];var instance=Cache.Rent(entry,l.root.transform);if(instance==null)return;
   float scale=p.height/Mathf.Max(.001f,p.prop.bounds.size.y);var rotation=Quaternion.Euler(0,p.yaw,0);var center=rotation*(new Vector3(p.prop.bounds.center.x,0,p.prop.bounds.center.z)*scale);
   var t=instance.root.transform;t.localScale=Vector3.one*scale;t.localRotation=rotation;t.localPosition=p.position-center-Vector3.up*(p.prop.bounds.min.y*scale);
   NaturePropCache.Quality(instance,p.shadow,level);l.props.Add(instance);l.shadows.Add(p.shadow);l.spawned[index]=true;LoadedProps++;PeakProps=Math.Max(PeakProps,LoadedProps);
  }}
  void Unload(int id,bool keep){var l=live[id];l.root.SetActive(false);foreach(var i in l.props)Cache.Return(i,keep);LoadedProps-=l.props.Count;foreach(var e in l.leases.Values)Cache.Release(e);Destroy(l.root);live.Remove(id);terrainDirty=true;Unloads++;}
  public bool HasTerrainAt(float x,float y){foreach(var l in live.Values)if(x>=l.plan.a-.001f&&x<=l.plan.b+.001f&&Mathf.Abs(l.plan.y-y)<.05f)return true;return false;}
  public void RequestCacheCleanup(){Cache.Trim(true);}
  public void Dispose(){if(disposed)return;disposed=true;release.Clear();foreach(int id in live.Keys)release.Add(id);foreach(int id in release)Unload(id,false);Cache.Dispose();terrain.Dispose();if(root)Destroy(root.gameObject);}
  static void Destroy(UnityEngine.Object o){if(!o)return;if(Application.isPlaying)UnityEngine.Object.Destroy(o);else UnityEngine.Object.DestroyImmediate(o);}
 }
}
