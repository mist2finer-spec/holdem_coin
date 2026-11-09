using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
namespace IslandGame {
 // One async request per canonical key. Chunk leases prevent referenced entries from eviction.
 public sealed class NaturePropCache:IDisposable {
  public sealed class Instance {public GameObject root;public Renderer[] renderers;public LODGroup[] lods;internal Entry entry;}
  public sealed class Entry {public string key;public ResourceRequest request;public GameObject prefab;public int references;public float lastUse;public bool failed;public readonly Stack<Instance> pool=new Stack<Instance>();}
  readonly Dictionary<string,Entry> entries=new Dictionary<string,Entry>();readonly List<string> expired=new List<string>();readonly Transform poolRoot;
  public const int PoolLimit=16,PerTypeLimit=2;public int PoolCount{get;private set;}
  public int LoadRequests{get;private set;}public int CacheHits{get;private set;}public int Created{get;private set;}public int Reused{get;private set;}public int Released{get;private set;}public int Evicted{get;private set;}
  public int EntryCount=>entries.Count;public int Outstanding{get{int n=0;foreach(var e in entries.Values)if(e.request!=null&&!e.request.isDone)n++;return n;}}
  public NaturePropCache(Transform parent){var go=new GameObject("Bounded nature reuse pool");go.transform.SetParent(parent,false);go.SetActive(false);poolRoot=go.transform;}
  public static string Key(NatureEnvironmentAssets.Prop p)=>!string.IsNullOrEmpty(p.resourcePath)?p.resourcePath:"direct:"+p.prefab.GetInstanceID();
  public Entry Acquire(NatureEnvironmentAssets.Prop p){string key=Key(p);Entry e;if(entries.TryGetValue(key,out e))CacheHits++;else{e=new Entry{key=key,prefab=p.prefab};if(!e.prefab){e.request=Resources.LoadAsync<GameObject>(p.resourcePath);LoadRequests++;}entries.Add(key,e);}e.references++;e.lastUse=Time.unscaledTime;return e;}
  public void Release(Entry e){if(e.references<=0)throw new InvalidOperationException("Unbalanced nature resource lease");e.references--;e.lastUse=Time.unscaledTime;Released++;}
  public bool Ready(Entry e){if(e.prefab)return true;if(e.failed)return false;if(e.request==null||!e.request.isDone)return false;e.prefab=e.request.asset as GameObject;e.request=null;if(!e.prefab){e.failed=true;Debug.LogError("Nature resource unavailable: "+e.key);}return e.prefab;}
  public Instance Rent(Entry e,Transform parent){if(!Ready(e))return null;Instance instance;if(e.pool.Count>0){instance=e.pool.Pop();PoolCount--;Reused++;instance.root.transform.SetParent(parent,false);instance.root.SetActive(true);}else{var go=UnityEngine.Object.Instantiate(e.prefab,parent,false);instance=new Instance{root=go,entry=e,renderers=go.GetComponentsInChildren<Renderer>(true),lods=go.GetComponentsInChildren<LODGroup>(true)};Created++;if(go.GetComponentInChildren<Renderer>()&&!go.GetComponent<BattleOccluder>())go.AddComponent<BattleOccluder>();}return instance;}
  public void Return(Instance instance,bool keep){var e=instance.entry;instance.root.SetActive(false);if(keep&&PoolCount<PoolLimit&&e.pool.Count<PerTypeLimit){instance.root.transform.SetParent(poolRoot,false);e.pool.Push(instance);PoolCount++;}else Destroy(instance.root);e.lastUse=Time.unscaledTime;}
  public static void Quality(Instance i,bool castShadow,int level){foreach(var r in i.renderers)if(r)r.shadowCastingMode=castShadow&&level<2?ShadowCastingMode.On:ShadowCastingMode.Off;foreach(var lod in i.lods)if(lod&&lod.enabled&&lod.gameObject.activeInHierarchy&&lod.lodCount>0)lod.ForceLOD(level==0?-1:Math.Min(level,lod.lodCount-1));}
  public void Trim(bool pressure){expired.Clear();float ttl=pressure?0:12;foreach(var pair in entries){var e=pair.Value;if(e.references!=0||Time.unscaledTime-e.lastUse<ttl)continue;if(e.request!=null&&!e.request.isDone)continue;expired.Add(pair.Key);}foreach(string key in expired){var e=entries[key];while(e.pool.Count>0){Destroy(e.pool.Pop().root);PoolCount--;}e.prefab=null;e.request=null;entries.Remove(key);Evicted++;}}
  public void Dispose(){foreach(var e in entries.Values){while(e.pool.Count>0)Destroy(e.pool.Pop().root);e.prefab=null;e.request=null;}entries.Clear();PoolCount=0;if(poolRoot)Destroy(poolRoot.gameObject);}
  static void Destroy(UnityEngine.Object o){if(!o)return;if(Application.isPlaying)UnityEngine.Object.Destroy(o);else UnityEngine.Object.DestroyImmediate(o);}
 }
}
