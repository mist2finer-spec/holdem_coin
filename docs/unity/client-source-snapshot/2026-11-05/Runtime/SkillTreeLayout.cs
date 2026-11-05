using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 // Authored display map only. Server positions, edges, costs and jewel targets remain authoritative.
 public sealed class SkillTreeLayout {
  readonly Dictionary<string,Vector2> positions=new Dictionary<string,Vector2>();
  readonly Dictionary<string,Vector2[]> routes=new Dictionary<string,Vector2[]>();
  readonly Dictionary<string,Vector2> basePositions=new Dictionary<string,Vector2>();
  readonly Dictionary<string,Vector2[]> baseRoutes=new Dictionary<string,Vector2[]>();
  readonly Dictionary<string,Rect> focus=new Dictionary<string,Rect>();
  readonly Dictionary<string,Frame> docks=new Dictionary<string,Frame>();
  readonly HashSet<string> baseEdges=new HashSet<string>();
  readonly List<string> warnings=new List<string>();
  sealed class Frame {public Vector2 Origin;public float Angle;public int Part=-1,Depth;}
  string signature;bool loaded;
  public int RebuildCount {get;private set;}
  public IReadOnlyDictionary<string,Vector2[]> Routes=>routes;
  public IReadOnlyList<string> Warnings=>warnings;
  public bool TryFocus(string id,out Rect bounds){Load();return focus.TryGetValue(id,out bounds);}
  public static string EdgeKey(string a,string b)=>StringComparer.Ordinal.Compare(a,b)<0?a+"|"+b:b+"|"+a;
  static Vector2 Point(JToken v)=>new Vector2(v[0].Value<float>(),v[1].Value<float>());
  void Load(){
   if(loaded)return;loaded=true;var asset=Resources.Load<TextAsset>("SkillTreePresentationV2");if(!asset)throw new InvalidOperationException("Missing SkillTreePresentationV2 display map");
   var map=JObject.Parse(asset.text);foreach(var p in ((JObject)map["positions"]).Properties())basePositions[p.Name]=Point(p.Value);
   foreach(var p in ((JObject)map["paths"]).Properties())baseRoutes[p.Name]=p.Value.Select(Point).ToArray();
   foreach(var e in map["edges"])baseEdges.Add(EdgeKey((string)e[0],(string)e[1]));
   foreach(var p in ((JObject)map["focus"]).Properties()){var v=p.Value;focus[p.Name]=Rect.MinMaxRect(v[0].Value<float>(),v[1].Value<float>(),v[2].Value<float>(),v[3].Value<float>());}
   foreach(var r in map["reservations"])docks[(string)r["socketId"]]=new Frame{Origin=Point(r["dock"]),Angle=r.Value<float>("angle")};
  }
  static KeyValuePair<string,string> Pair(JToken e)=>e is JArray?new KeyValuePair<string,string>((string)e[0],(string)e[1]):new KeyValuePair<string,string>((string)e["from"],(string)e["to"]);
  static Vector2 Apply(Frame f,Vector2 local){float c=Mathf.Cos(f.Angle),s=Mathf.Sin(f.Angle);return f.Origin+new Vector2(c*local.x-s*local.y,s*local.x+c*local.y);}
  public IReadOnlyDictionary<string,Vector2> Build(JArray sources,JArray edges=null){
   Load();var ordered=sources.OfType<JObject>().Where(n=>!string.IsNullOrEmpty((string)n["id"])).OrderBy(n=>(string)n["id"],StringComparer.Ordinal).ToArray();
   var pairs=(edges??new JArray()).Select(Pair).Where(e=>e.Key!=null&&e.Value!=null).OrderBy(e=>EdgeKey(e.Key,e.Value),StringComparer.Ordinal).ToArray();
   string next=string.Join(";",ordered.Select(n=>string.Join(":",new[]{"id","x","y","region","branch","tier","kind","category","socketType","startFor","clusterId"}.Select(k=>(string)n[k]))))+"/"+string.Join(";",pairs.Select(e=>EdgeKey(e.Key,e.Value)));
   if(next==signature)return positions;signature=next;RebuildCount++;positions.Clear();routes.Clear();warnings.Clear();
   var data=ordered.ToDictionary(n=>(string)n["id"]);var contexts=new Dictionary<string,Frame>();int unknown=0;
   foreach(var n in ordered){string id=(string)n["id"];Vector2 p;if(basePositions.TryGetValue(id,out p)){positions[id]=p;Frame f;if(docks.TryGetValue(id,out f))contexts[id]=f;}else if(n["clusterId"]==null){positions[id]=new Vector2(200+unknown++*1.2f,0);warnings.Add("Unmapped base node: "+id);}}
   if(edges!=null){var actual=new HashSet<string>(pairs.Where(e=>basePositions.ContainsKey(e.Key)&&basePositions.ContainsKey(e.Value)).Select(e=>EdgeKey(e.Key,e.Value)));if(!actual.SetEquals(baseEdges))warnings.Add("Base edge set differs from presentation map; all actual edges are still rendered");}
   var pending=ordered.Where(n=>n["clusterId"]!=null&&!positions.ContainsKey((string)n["id"])).GroupBy(n=>(string)n["clusterId"]).OrderBy(g=>g.Key,StringComparer.Ordinal).Select(g=>g.OrderBy(n=>n.Value<int?>("tier")??0).ThenBy(n=>(string)n["id"],StringComparer.Ordinal).ToArray()).ToList();
   for(int pass=0;pending.Count>0&&pass<=ordered.Length;pass++){
    bool progress=false;
    for(int gi=0;gi<pending.Count;gi++){
     var group=pending[gi];string first=(string)group[0]["id"];var ids=new HashSet<string>(group.Select(n=>(string)n["id"]));
     string parent=pairs.Where(e=>e.Key==first||e.Value==first).Select(e=>e.Key==first?e.Value:e.Key).Where(i=>!ids.Contains(i)&&positions.ContainsKey(i)).OrderBy(i=>i,StringComparer.Ordinal).FirstOrDefault();
     if(parent==null)continue;Frame frame;string kind=(string)data[parent]["socketType"];bool known=contexts.TryGetValue(parent,out frame)&&((kind=="large"&&group.Length==10&&frame.Depth==0)||(kind=="medium"&&group.Length==5&&frame.Depth==1&&frame.Part>=0)||(kind=="small"&&group.Length==3&&frame.Depth==2));
     for(int k=0;k<group.Length;k++){
      string id=(string)group[k]["id"];Vector2 local=Vector2.zero;
      if(known){
       if(kind=="large"){float a=Mathf.PI+k*Mathf.PI/5;local=new Vector2(4+2*Mathf.Cos(a),2*Mathf.Sin(a));}
       else if(kind=="medium"){float a=Mathf.PI+k*Mathf.PI/4;local=new Vector2(10+1.3f*Mathf.Cos(a),(frame.Part==0?-4:4)+1.3f*Mathf.Sin(a));}
       else {float a=Mathf.PI-k*Mathf.PI/2;local=new Vector2(15+.8f*Mathf.Cos(a),(frame.Part==0?-4:4)+.8f*Mathf.Sin(a));}
       positions[id]=Apply(frame,local);contexts[id]=new Frame{Origin=frame.Origin,Angle=frame.Angle,Depth=frame.Depth+1,Part=kind=="large"?(k==4?0:k==8?1:-1):frame.Part};
      }else positions[id]=new Vector2(200+unknown++*1.2f,4);
     }
     if(!known)warnings.Add("Unrecognized extension displayed in extra lane: "+group[0]["clusterId"]);
     pending.RemoveAt(gi--);progress=true;
    }
    if(!progress)break;
   }
   foreach(var group in pending){foreach(var n in group)positions[(string)n["id"]]=new Vector2(200+unknown++*1.2f,8);warnings.Add("Extension parent unresolved: "+group[0]["clusterId"]);}
   foreach(var e in pairs){if(!positions.ContainsKey(e.Key)||!positions.ContainsKey(e.Value)){warnings.Add("Edge references missing source node: "+EdgeKey(e.Key,e.Value));continue;}string key=EdgeKey(e.Key,e.Value);Vector2[] cached;if(baseRoutes.TryGetValue(key,out cached)){routes[key]=cached;continue;}
    var a=positions[e.Key];var b=positions[e.Value];var direction=(b-a).normalized;float length=Vector2.Distance(a,b);routes[key]=new[]{a+direction*Mathf.Min(Radius(data[e.Key]),length*.4f),b-direction*Mathf.Min(Radius(data[e.Value]),length*.4f)};
   }
   return positions;
  }
  static float Radius(JObject n)=>n["startFor"]!=null?.36f:(string)n["kind"]=="keystone"?.396f:(string)n["kind"]=="socket"?.288f:(string)n["kind"]=="notable"?.24f:.15f;
 }
}
