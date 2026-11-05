using System;
using System.Linq;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using Newtonsoft.Json.Linq;
using UnityEngine;
using IslandGame;
public static class ValidateLayout {
 public static object Expanded(){
  var raw=JObject.Parse(Resources.Load<TextAsset>("RpgCatalog").text)["tree"]["nodes"] as JArray;
  var points=new SkillTreeLayout().Build(raw);var expanded=(JArray)raw.DeepClone();
  for(int i=0;i<18;i++)expanded.Add(new JObject{{"id","cluster_test_"+i},{"clusterId","test"},{"kind","small"},{"x",1750},{"y",1750}});
  var more=new SkillTreeLayout().Build(expanded);foreach(var p in points)if(more[p.Key]!=p.Value)throw new Exception("Base moved");
  float min=float.PositiveInfinity;var all=more.Values.ToArray();for(int i=0;i<all.Length;i++)for(int j=i+1;j<all.Length;j++)min=Mathf.Min(min,Vector2.Distance(all[i],all[j]));
  if(min<.899f)throw new Exception("Cluster overlap");return new {status="PASS",nodes=all.Length,minimumCenterDistance=min,baseStable=true};
 }
 public static object Main(){
  var panel=UnityEngine.Object.FindFirstObjectByType<IslandGrowthPanel>();
  if(panel==null||panel.Tree.Nodes.Count!=780)throw new Exception("Live growth tree not bound");
  var raw=JObject.Parse(Resources.Load<TextAsset>("RpgCatalog").text)["tree"]["nodes"] as JArray;
  string before=raw.ToString();var layout=new SkillTreeLayout();var timer=Stopwatch.StartNew();var points=layout.Build(raw);timer.Stop();
  float min=float.PositiveInfinity;int pairs=0;var ids=points.Keys.ToArray();
  foreach(var a in ids)foreach(var b in ids)if(StringComparer.Ordinal.Compare(a,b)<0){float d=Vector2.Distance(points[a],points[b]);min=Mathf.Min(min,d);if(d<.899f)throw new Exception("Overlap "+a+"/"+b);pairs++;}
  var counts=new JObject();foreach(var socket in raw.OfType<JObject>().Where(n=>(string)n["socketType"]=="timeless")){
   string id=(string)socket["id"];int count=raw.OfType<JObject>().Count(n=>n["startFor"]==null&&(string)n["kind"]!="socket"&&(string)n["kind"]!="keystone"&&Vector2.Distance(points[(string)n["id"]],points[id])<=SkillTreeLayout.NeighborhoodRadius);
   if(count>8)throw new Exception("Neighborhood exceeds 8 "+id+":"+count);counts[id]=count;
  }
  if(raw.ToString()!=before)throw new Exception("Canonical data mutated");
  var reverse=new SkillTreeLayout().Build(new JArray(raw.Reverse().Select(n=>n.DeepClone())));
  foreach(var id in ids)if(points[id]!=reverse[id])throw new Exception("Order changes position "+id);
  var expanded=(JArray)raw.DeepClone();for(int i=0;i<18;i++)expanded.Add(new JObject{{"id","cluster_test_"+i},{"clusterId","test"},{"kind","small"},{"x",1750},{"y",1750}});
  var more=new SkillTreeLayout().Build(expanded);foreach(var id in ids)if(points[id]!=more[id])throw new Exception("Cluster moved base "+id);
  var all=more.Values.ToArray();for(int i=0;i<all.Length;i++)for(int j=i+1;j<all.Length;j++)if(Vector2.Distance(all[i],all[j])<.899f)throw new Exception("Expanded cluster overlaps");
  foreach(var node in panel.Tree.Nodes)if(Vector2.Distance(node.Value.Data.Position,points[node.Key])>.001f)throw new Exception("Rendered position differs "+node.Key);
  var report=new JObject{{"status","PASS"},{"nodes",ids.Length},{"pairsChecked",pairs},{"minimumCenterDistance",min},{"layoutMilliseconds",timer.Elapsed.TotalMilliseconds},{"timelessDisplayNeighborhoods",counts},{"orderIndependent",true},{"clusterBaseStable",true},{"canonicalUnchanged",true},{"positions",new JArray(ids.Select(id=>new JObject{{"id",id},{"x",points[id].x},{"y",points[id].y}}))}};
  File.WriteAllText("C:/Users/SHK/island-layout-review/layout-validation.json",report.ToString());
  return new {status="PASS",nodes=ids.Length,pairs,minimumCenterDistance=min,layoutMilliseconds=timer.Elapsed.TotalMilliseconds,counts};
 }
}
