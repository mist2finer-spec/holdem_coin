using System;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 // Authored placements only: no generated stages, floors, cliffs or substitute vegetation.
 public sealed class NatureAuthoredEnvironment:MonoBehaviour {
  public event Action<Transform> VisualChunkCreated,VisualChunkRemoving;
  sealed class Chunk {public string path;public Vector3 center;public GameObject instance;public ResourceRequest pending;public GameObject asset;}
  readonly List<Chunk> chunks=new List<Chunk>();GameObject mapAsset;float nextTick;Terrain terrain;
  public void Initialize(){
   mapAsset=Resources.Load<GameObject>("NatureAuthoredMap");if(!mapAsset)throw new InvalidOperationException("Nature Free map has not been prepared.");
   var map=Instantiate(mapAsset,transform,false);terrain=map.GetComponentInChildren<Terrain>();
   foreach(Transform child in map.transform)if(child.name.Contains("Tree")&&child.GetComponentInChildren<Renderer>())child.gameObject.AddComponent<BattleOccluder>();
   var data=Resources.Load<TextAsset>("NatureAuthoredLayout");if(data)foreach(var row in JArray.Parse(data.text))chunks.Add(new Chunk{path=(string)row["path"],center=new Vector3((float)row["x"],0,(float)row["z"])});
  }
  public void Tick(Vector3 hero,Camera camera){
   var budget=IslandFrameBudget.Current;bool changed=false;
   foreach(var c in chunks)if(c.pending!=null&&c.pending.isDone&&(!budget||budget.AllowOptionalWork(.7))){c.asset=c.pending.asset as GameObject;c.pending=null;if(c.asset){c.instance=Instantiate(c.asset,transform,false);foreach(var t in c.instance.GetComponentsInChildren<Transform>())t.gameObject.layer=30;foreach(Transform tree in c.instance.transform)if(tree.GetComponentInChildren<Renderer>())tree.gameObject.AddComponent<BattleOccluder>();VisualChunkCreated?.Invoke(c.instance.transform);changed=true;}break;}
   if(changed&&budget)budget.BindScenery(transform);
   if(Time.unscaledTime<nextTick)return;nextTick=Time.unscaledTime+.12f;
   if(terrain&&budget){terrain.heightmapPixelError=12+budget.Policy.Level*5;terrain.detailObjectDistance=18-budget.Policy.Level*4;}
   int requests=0;foreach(var c in chunks){float distance=Vector2.Distance(new Vector2(hero.x,hero.z),new Vector2(c.center.x,c.center.z));
    if(distance<38&&!c.instance&&c.pending==null&&requests++<2)c.pending=Resources.LoadAsync<GameObject>(c.path);
    else if(distance>52&&c.instance){VisualChunkRemoving?.Invoke(c.instance.transform);Destroy(c.instance);c.instance=null;c.asset=null;}
   }
  }
 }
}
