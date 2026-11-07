using System;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEditor;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class ExportContact {
 const string Out="C:/Users/SHK/island-contact-diorama-20261107/";
 public static object Main(){
  var a=Resources.Load<UnityBossAssets>("UnityBossAssets");var root=new GameObject("Contact export");root.hideFlags=HideFlags.HideAndDontSave;var model=UnityEngine.Object.Instantiate(a.boss,root.transform,false);var ts=model.GetComponentsInChildren<Transform>(true);
  Func<string,Transform> bone=name=>ts.Single(t=>t.name==name);
  try{using(var player=new RuntimeAnimationPlayer(model,0)){
   player.Sample(a.idle?a.idle:a.combo,0);var left=bone("Foot.L");var right=bone("Foot.R");var hips=bone("Hips");float scale=a.bossHeight/a.bossReferenceHeight,sole=Mathf.Min(left.position.y,right.position.y)-model.GetComponentInChildren<SkinnedMeshRenderer>().bounds.min.y;
   var names=ts.Where(t=>t.name.ToLowerInvariant().Contains("arm")||t.name.Contains("Hand")).Select(t=>t.name).ToArray();
   var endpoints=new[]{bone("Forearm.R"),bone("Hand.R"),bone("Forearm.L"),bone("Hand.L")};var offsets=new Vector3[4];var radii=new float[2];var skin=model.GetComponentInChildren<SkinnedMeshRenderer>();var mesh=new Mesh();skin.BakeMesh(mesh);var vertices=mesh.vertices;var weights=skin.sharedMesh.boneWeights;
   for(int h=0;h<2;h++){var hand=endpoints[h*2+1];int bi=Array.IndexOf(skin.bones,hand);var points=new System.Collections.Generic.List<Vector3>();for(int v=0;v<vertices.Length;v++){var bw=weights[v];float weight=(bw.boneIndex0==bi?bw.weight0:0)+(bw.boneIndex1==bi?bw.weight1:0)+(bw.boneIndex2==bi?bw.weight2:0)+(bw.boneIndex3==bi?bw.weight3:0);if(weight>=.5f)points.Add(hand.InverseTransformPoint(skin.transform.TransformPoint(vertices[v])));}if(points.Count==0)throw new Exception("No fist vertices: "+hand.name);var bounds=new Bounds(points[0],Vector3.zero);foreach(var p in points)bounds.Encapsulate(p);offsets[h*2+1]=bounds.center;radii[h]=Mathf.Max(bounds.extents.x,bounds.extents.y,bounds.extents.z)*scale*100;}
   UnityEngine.Object.DestroyImmediate(mesh);var frames=new JArray();const int count=196;
   for(int i=0;i<=count;i++){float t=(float)i/count;player.Sample(a.combo,t*a.combo.length);model.transform.localScale=Vector3.one*scale;model.transform.localPosition=Vector3.zero;
    float feet=Mathf.Min(root.transform.InverseTransformPoint(left.position).y,root.transform.InverseTransformPoint(right.position).y)-sole*scale;Vector3 pelvis=root.transform.InverseTransformPoint(hips.position);model.transform.localPosition=new Vector3(-pelvis.x,-feet,-pelvis.z);
    frames.Add(new JArray(endpoints.SelectMany((b,n)=>{var p=root.transform.InverseTransformPoint(b.TransformPoint(offsets[n]));return new[]{Math.Round(p.x*100,5),Math.Round(p.y*100,5),Math.Round(p.z*100,5)};})));
   }
   var profile=new JObject{{"revision","boss-contact-v1"},{"clip",a.combo.name},{"clipAsset",AssetDatabase.GetAssetPath(a.combo)},{"clipLength",a.combo.length},{"bossHeight",a.bossHeight},{"unitsPerMeter",100},{"bodyRadius",140},{"heroRadius",22},{"heroHeight",130},{"armRadius",30},{"handRadii",new JArray(radii)},{"handOffsets",new JArray(new JArray(offsets[1].x,offsets[1].y,offsets[1].z),new JArray(offsets[3].x,offsets[3].y,offsets[3].z))},{"segments",count},{"windows",new JArray(new JObject{{"strike",0},{"hand",0},{"from",.18},{"to",.40}},new JObject{{"strike",1},{"hand",1},{"from",.64},{"to",.84}})},{"frames",frames}};
   File.WriteAllText(Out+"repo/src/lib/generated/unity-boss-contact.json",profile.ToString(Newtonsoft.Json.Formatting.None));File.WriteAllText(Out+"evidence/contact-export.json",new JObject{{"bones",new JArray(names)},{"samples",count+1},{"runtimeBakeMesh",false},{"scale",scale},{"sole",sole}}.ToString());return new{names,samples=count+1,scale,sole};
  }}finally{UnityEngine.Object.DestroyImmediate(root);}
 }
}
