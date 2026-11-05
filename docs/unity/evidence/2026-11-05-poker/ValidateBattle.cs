using System;
using System.Linq;
using UnityEngine;
using IslandGame;
public static class ValidateBattle {
 public static object Main(){
  var view=UnityEngine.Object.FindFirstObjectByType<Battle3DView>();if(!view||view.ActorCount<1)throw new Exception("3D battle actors not ready");
  var shapes=UnityEngine.Object.FindObjectsByType<MeshFilter>(FindObjectsSortMode.None).Where(f=>f.sharedMesh&&f.sharedMesh.name.StartsWith("Display only")).ToArray();
  if(shapes.Length<10)throw new Exception("Display terrain shapes missing");
  if(shapes.Any(f=>f.GetComponent<Collider>()!=null))throw new Exception("Visual shape created a 3D collider");
  var unique=shapes.Select(f=>f.sharedMesh.GetInstanceID()).Distinct().Count();if(unique>3)throw new Exception("Display meshes not cached");
  var report=new{status="PASS",actors=view.ActorCount,displayShapes=shapes.Length,sharedMeshes=unique,colliders=0,heroGroundError=view.HeroGroundError,frame=Time.frameCount};System.IO.File.WriteAllText("C:/Users/SHK/island-poker-review/battle-validation.json",Newtonsoft.Json.JsonConvert.SerializeObject(report));return report;
 }
}
