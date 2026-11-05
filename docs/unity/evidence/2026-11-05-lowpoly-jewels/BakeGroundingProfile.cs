using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using Newtonsoft.Json.Linq;
using IslandGame;
public static class BakeGroundingProfile {
 public static object Main(){
  var assets=Resources.Load<Battle3DAssets>("Battle3DAssets");
  var result=new JObject{{"version",1},{"samplesPerSecond",240}};
  foreach(bool hero in new[]{true,false}){
   GameObject root=null;Mesh mesh=null;
   try{
    root=new GameObject("Grounding offline bake"){hideFlags=HideFlags.HideAndDontSave};
    var model=UnityEngine.Object.Instantiate(hero?assets.hero:assets.slime,root.transform);
    foreach(var anim in model.GetComponentsInChildren<Animator>())anim.enabled=false;
    foreach(var r in model.GetComponentsInChildren<Renderer>())r.enabled=false;
    var skin=model.GetComponentInChildren<SkinnedMeshRenderer>();mesh=new Mesh();
    var initial=hero?assets.idle:assets.slimeIdle;initial.SampleAnimation(model,0);skin.BakeMesh(mesh);
    float referenceHeight=mesh.bounds.size.y*Mathf.Abs(skin.transform.lossyScale.y);
    var vertices=new List<Vector3>();var tracks=new JObject();Bounds skinBounds=mesh.bounds;
    var clips=hero?typeof(Battle3DAssets).GetFields().Where(f=>f.FieldType==typeof(AnimationClip)&&f.Name!="slimeIdle").Select(f=>(AnimationClip)f.GetValue(assets)).Where(c=>c).Distinct().ToArray():new[]{assets.slimeIdle};
    foreach(var clip in clips){
     int steps=Mathf.Max(2,Mathf.CeilToInt(clip.length*240));var heights=new JArray();
     for(int i=0;i<=steps;i++){
      clip.SampleAnimation(model,clip.length*i/steps);model.transform.localPosition=Vector3.zero;model.transform.localRotation=Quaternion.identity;model.transform.localScale=Vector3.one;
      skin.BakeMesh(mesh);mesh.GetVertices(vertices);skinBounds.Encapsulate(mesh.bounds);
      var matrix=root.transform.worldToLocalMatrix*skin.transform.localToWorldMatrix;
      float min=float.PositiveInfinity;foreach(var v in vertices)min=Mathf.Min(min,matrix.MultiplyPoint3x4(v).y);
      heights.Add(min);
     }
     tracks[clip.name]=new JObject{{"length",clip.length},{"heights",heights}};
    }
    initial.SampleAnimation(model,0);model.transform.localPosition=Vector3.zero;model.transform.localScale=Vector3.one;skin.BakeMesh(mesh);mesh.GetVertices(vertices);
    float baseFoot=float.PositiveInfinity;foreach(var v in vertices)baseFoot=Mathf.Min(baseFoot,(root.transform.worldToLocalMatrix*skin.transform.localToWorldMatrix).MultiplyPoint3x4(v).y);
    result[hero?"hero":"slime"]=new JObject{{"vertices",skin.sharedMesh.vertexCount},{"referenceHeight",referenceHeight},{"baseFoot",baseFoot},{"boundsCenter",new JArray(skinBounds.center.x,skinBounds.center.y,skinBounds.center.z)},{"boundsSize",new JArray(skinBounds.size.x*1.15f,skinBounds.size.y*1.15f,skinBounds.size.z*1.15f)},{"clips",tracks}};
   }finally{if(mesh)UnityEngine.Object.DestroyImmediate(mesh);if(root)UnityEngine.Object.DestroyImmediate(root);}
  }
  File.WriteAllText("C:/Users/SHK/island-performance-review/BattleGroundingProfile.json",result.ToString());
  return new{status="PASS",heroClips=((JObject)result["hero"]["clips"]).Count,slimeClips=((JObject)result["slime"]["clips"]).Count};
 }
}
