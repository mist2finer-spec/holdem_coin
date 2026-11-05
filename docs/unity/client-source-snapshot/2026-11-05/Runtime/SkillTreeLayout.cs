using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace IslandGame {
 // Display coordinates only: allocation and jewel effects still use server node IDs.
 // Authored sector/orbit anchors are retained; a spatial grid resolves dense or coincident anchors.
 public sealed class SkillTreeLayout {
  public const float SourceScale=.016f,MinimumSeparation=.90f,NeighborhoodRadius=3.1f;
  public const int MaximumNeighbors=8;
  readonly Dictionary<string,Vector2> positions=new Dictionary<string,Vector2>();
  string signature;
  sealed class Socket {public Vector2 Position;public int Count;}
  public IReadOnlyDictionary<string,Vector2> Build(JArray sources){
   var ordered=sources.OfType<JObject>().Where(n=>!string.IsNullOrEmpty((string)n["id"])).OrderBy(Priority).ThenBy(n=>(string)n["id"],StringComparer.Ordinal).ToArray();
   string next=string.Join(";",ordered.Select(n=>(string)n["id"]+":"+n["x"]+":"+n["y"]+":"+n["socketType"]+":"+n["kind"]));
   if(signature==next)return positions;
   positions.Clear();var bins=new Dictionary<Vector2Int,List<Vector2>>();var sockets=new List<Socket>();
   foreach(var n in ordered){
    var origin=new Vector2(n.Value<float?>("x")??0,-(n.Value<float?>("y")??0))*SourceScale;
    bool eligible=n["startFor"]==null&&(string)n["kind"]!="socket"&&(string)n["kind"]!="keystone"&&n["clusterId"]==null;
    Func<Vector2,bool> fits=p=>{
     var cell=Cell(p);for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){List<Vector2> bucket;if(bins.TryGetValue(cell+new Vector2Int(x,y),out bucket))foreach(var q in bucket)if((q-p).sqrMagnitude<MinimumSeparation*MinimumSeparation)return false;}
     if(eligible)foreach(var s in sockets)if(s.Count>=MaximumNeighbors&&(s.Position-p).sqrMagnitude<=NeighborhoodRadius*NeighborhoodRadius)return false;
     return true;
    };
    Vector2 point=origin;bool placed=fits(point);
    // A deterministic local orbit search, never a per-frame force simulation.
    for(int orbit=1;!placed&&orbit<=512;orbit++){
     float radius=orbit*.16f;int count=Mathf.CeilToInt(2*Mathf.PI*radius/.18f);
     for(int i=0;i<count;i++){float a=2*Mathf.PI*i/count;var candidate=origin+new Vector2(Mathf.Cos(a),Mathf.Sin(a))*radius;if(fits(candidate)){point=candidate;placed=true;break;}}
    }
    if(!placed)throw new InvalidOperationException("Cannot place passive node "+n["id"]);
    positions.Add((string)n["id"],point);var key=Cell(point);List<Vector2> points;if(!bins.TryGetValue(key,out points))bins[key]=points=new List<Vector2>();points.Add(point);
    if((string)n["socketType"]=="timeless")sockets.Add(new Socket{Position=point});
    if(eligible)foreach(var s in sockets)if((s.Position-point).sqrMagnitude<=NeighborhoodRadius*NeighborhoodRadius)s.Count++;
   }
   signature=next;return positions;
  }
  static Vector2Int Cell(Vector2 p)=>new Vector2Int(Mathf.FloorToInt(p.x/MinimumSeparation),Mathf.FloorToInt(p.y/MinimumSeparation));
  static int Priority(JObject n)=>n["clusterId"]!=null?6:(string)n["socketType"]=="timeless"?0:n["startFor"]!=null?1:(string)n["kind"]=="socket"?2:(string)n["kind"]=="keystone"?3:(string)n["kind"]=="notable"?4:5;
 }
}
