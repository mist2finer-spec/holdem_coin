using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json.Linq;
using IslandGame;
public static class ValidateTreeV2 {
 static int checks;static void Check(bool ok,string message){if(!ok)throw new Exception(message);checks++;}
 public static object Geometry(){
  checks=0;var catalog=(JObject)JObject.Parse(Resources.Load<TextAsset>("RpgCatalog").text)["tree"];var baseNodes=(JArray)catalog["nodes"];var baseEdges=(JArray)catalog["edges"];string original=catalog.ToString();
  var expanded=JObject.Parse(File.ReadAllText("C:/Users/SHK/island-tree-design-review/expansion-graph.json"));var expected=JObject.Parse(File.ReadAllText("C:/Users/SHK/island-tree-design-review/expansion-preview.json"));
  var layout=new SkillTreeLayout();var basic=layout.Build(baseNodes,baseEdges).ToDictionary(p=>p.Key,p=>p.Value);Check(basic.Count==780,"Base node missing");Check(layout.Routes.Count==907,"Base edge missing");
  var all=layout.Build((JArray)expanded["nodes"],(JArray)expanded["edges"]);Check(all.Count==832&&layout.Routes.Count==965,"Dynamic node/edge missing");Check(layout.Warnings.Count==0,"Known extension hit fallback");
  float maxError=0;foreach(var p in all){var e=expected["positions"][p.Key];float error=Vector2.Distance(p.Value,new Vector2(e[0].Value<float>(),e[1].Value<float>()));maxError=Mathf.Max(maxError,error);Check(error<.0001f,"Display position differs: "+p.Key);}
  foreach(var p in basic)Check(p.Value==all[p.Key],"Base moved after equip: "+p.Key);
  int before=layout.RebuildCount;var shuffled=new JArray(((JArray)expanded["nodes"]).Reverse().Select(n=>n.DeepClone()));foreach(var node in shuffled){node["name"]="display-only";node["description"]="display-only";}
  layout.Build(shuffled,new JArray(((JArray)expanded["edges"]).Reverse()));Check(layout.RebuildCount==before,"Order/name-only change recomputed geometry");
  var restored=layout.Build(baseNodes,baseEdges);foreach(var p in basic)Check(p.Value==restored[p.Key],"Base moved on unequip");
  var source=baseNodes.ToDictionary(n=>(string)n["id"]);float outer=baseNodes.Where(n=>(string)n["socketType"]!="large").Max(n=>basic[(string)n["id"]].magnitude);int sockets=0;
  foreach(var n in baseNodes.Where(n=>(string)n["socketType"]=="large")){string id=(string)n["id"];Check(baseEdges.Count(e=>e is JArray?e.Values<string>().Contains(id):(string)e["from"]==id||(string)e["to"]==id)==1,"Large socket not a leaf");Check(basic[id].magnitude>outer,"Large socket is not outer terminal");sockets++;}
  Check(sockets==12,"Large socket count changed");Check(catalog.ToString()==original,"Source graph mutated");
  var report=new{status="PASS",checks,baseNodes=780,baseEdges=907,expandedNodes=832,expandedEdges=965,terminalSockets=sockets,maxPrototypeError=maxError,baseStableOnEquipUnequip=true,orderStateStable=true,sourceUnchanged=true};File.WriteAllText("C:/Users/SHK/island-lowpoly-jewel-review/tree-geometry.json",Newtonsoft.Json.JsonConvert.SerializeObject(report,Newtonsoft.Json.Formatting.Indented));return report;
 }
 public static object Models(){
  checks=0;var a=Resources.Load<Battle3DAssets>("Battle3DAssets");var report=new JArray();
  foreach(var model in new[]{a.hero,a.slime}){
   var path=UnityEditor.AssetDatabase.GetAssetPath(model);var clips=UnityEditor.AssetDatabase.LoadAllAssetsAtPath(path).OfType<AnimationClip>().ToArray();GameObject root=null;Mesh mesh=null;
   try{root=UnityEngine.Object.Instantiate(model);root.hideFlags=HideFlags.HideAndDontSave;foreach(var animator in root.GetComponentsInChildren<Animator>())animator.enabled=false;var skin=root.GetComponentInChildren<SkinnedMeshRenderer>();mesh=new Mesh();var first=new List<Vector3>();var other=new List<Vector3>();
    foreach(var clip in clips){Check(UnityEditor.AnimationUtility.GetCurveBindings(clip).Length>0,"Empty animation");clip.SampleAnimation(root,0);skin.BakeMesh(mesh);mesh.GetVertices(first);clip.SampleAnimation(root,clip.length*.371f);skin.BakeMesh(mesh);mesh.GetVertices(other);float delta=0;for(int i=0;i<first.Count;i++)delta+=(first[i]-other[i]).sqrMagnitude;Check(delta>.000001f,"Animation did not deform imported model: "+clip.name);report.Add(new JObject{{"clip",clip.name},{"vertices",skin.sharedMesh.vertexCount},{"poseDeltaSquaredSum",delta}});}
   }finally{if(mesh)UnityEngine.Object.DestroyImmediate(mesh);if(root)UnityEngine.Object.DestroyImmediate(root);}
  }
  var result=new JObject{{"status","PASS"},{"checks",checks},{"clips",report}};File.WriteAllText("C:/Users/SHK/island-lowpoly-jewel-review/model-animation-validation.json",result.ToString());return new{status="PASS",checks,clips=report.Count};
 }
}
