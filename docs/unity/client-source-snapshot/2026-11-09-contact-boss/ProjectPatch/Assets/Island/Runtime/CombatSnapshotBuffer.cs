using System;using System.Collections.Generic;using Newtonsoft.Json.Linq;using UnityEngine;
namespace IslandGame {
 // Render confirmed combat 160 ms behind authority. Never invent damage while extrapolating.
 public sealed class CombatSnapshotBuffer {
  readonly List<JObject> frames=new List<JObject>();JObject latest;double received;string key;float rendered;public float Time{get;private set;}
  public void Reset(){frames.Clear();latest=null;key=null;rendered=0;}
  public JObject Sample(JObject raw,double now,bool playing){
   string next=(string)raw["id"]+":"+(string)raw["routeStage"]+":"+(string)raw["room"];float at=N(raw["elapsed"]);
   if(key!=next){Reset();key=next;rendered=at;}
   if(!ReferenceEquals(raw,latest)){latest=raw;received=now;frames.Add(raw);if(frames.Count>12)frames.RemoveAt(0);}
   float desired=playing?Mathf.Min(at,at+(float)(now-received)-.16f):at;rendered=Mathf.Clamp(Mathf.Max(rendered,desired),N(frames[0]["elapsed"]),at);Time=rendered;
   JObject lo=frames[0],hi=latest;for(int i=1;i<frames.Count;i++){if(N(frames[i]["elapsed"])>rendered){hi=frames[i];break;}lo=frames[i];}
   float span=N(hi["elapsed"])-N(lo["elapsed"]),t=span>.00001f?Mathf.Clamp01((rendered-N(lo["elapsed"]))/span):0;var result=new JObject();foreach(var property in lo.Properties())if(property.Name!="map"&&property.Name!="progress"&&property.Name!="build"&&property.Name!="compiled"&&property.Name!="hero"&&property.Name!="mobs"&&property.Name!="fx")result[property.Name]=property.Value.DeepClone();result["fx"]=latest["fx"]?.DeepClone();
   var h=Blend(lo["hero"] as JObject,hi["hero"] as JObject,t);var upcoming=hi["hero"]?["motion"] as JObject;
   if(upcoming!=null&&N(upcoming["start"])<=rendered){h["motion"]=upcoming.DeepClone();h["action"]=hi["hero"]["action"]?.DeepClone();h["serial"]=hi["hero"]["serial"]?.DeepClone();h["direction"]=hi["hero"]["direction"]?.DeepClone();h["facing"]=hi["hero"]["facing"]?.DeepClone();}
   result["hero"]=h;
   var mobs=new JArray();foreach(JObject a in lo["mobs"] as JArray??new JArray()){JObject b=null;foreach(JObject candidate in hi["mobs"] as JArray??new JArray())if((string)candidate["id"]==(string)a["id"]){b=candidate;break;}var m=Blend(a,b,t);
    if(b!=null&&N(b["hp"])!=N(a["hp"])){float last=-1;string id=(bool?)a["unityBoss"]==true?"boss":"mob"+(string)a["id"];foreach(var fx in hi["fx"] as JArray??new JArray())if((string)fx["target"]==id&&N(fx["contactAt"],-1)>=N(lo["elapsed"]))last=Mathf.Max(last,N(fx["contactAt"]));if(last>=0&&last<=rendered){m["hp"]=b["hp"]?.DeepClone();m["state"]=b["state"]?.DeepClone();m["until"]=b["until"]?.DeepClone();}}
    mobs.Add(m);
   }result["mobs"]=mobs;return result;
  }
  static JObject Blend(JObject a,JObject b,float t){if(a==null)return b==null?null:(JObject)b.DeepClone();var r=(JObject)a.DeepClone();if(b!=null)foreach(var k in new[]{"x","y","elevation","airHeight"})r[k]=Mathf.Lerp(N(a[k]),N(b[k]),t);return r;}
  static float N(JToken t,float fallback=0)=>NativeCombatPresentation.N(t,fallback);
 }
}
