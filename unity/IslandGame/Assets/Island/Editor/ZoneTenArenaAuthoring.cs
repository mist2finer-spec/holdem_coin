using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
namespace IslandGame.Editor {
 public static class ZoneTenArenaAuthoring {
  const string Folder="Assets/Island/MountRuntime/ZoneTenArena";
  static readonly Vector2 Center=new Vector2(24,3);const float Radius=11.5f,Floor=-1.28f;
  static readonly List<MeshCollider> Terrain=new List<MeshCollider>();
  static float Ground(float x,float z){float y=float.NegativeInfinity;var ray=new Ray(new Vector3(x,100,z),Vector3.down);foreach(var c in Terrain)if(c.Raycast(ray,out var hit,200))y=Mathf.Max(y,hit.point.y);if(float.IsNegativeInfinity(y))throw new Exception("Missing terrain at "+x+","+z);return y;}
  static float Distance(Vector3 p)=>Vector2.Distance(new Vector2(p.x,p.z),Center);
  public static string Build(){
   if(EditorApplication.isPlaying)throw new Exception("Stop play first");
   var scene=UnityEngine.SceneManagement.SceneManager.GetActiveScene();if(scene.name!="MountZone10")throw new Exception("Open MountZone10 first");
   var root=scene.GetRootGameObjects().First(g=>g.name=="MountZone10");root.SetActive(true);
   if(root.GetComponent<ZoneTenArenaScene>())throw new Exception("Arena already authored; inspect instead of duplicating it");
   Directory.CreateDirectory(Folder);AssetDatabase.Refresh();Terrain.Clear();int changed=0;
   foreach(var mf in root.GetComponentsInChildren<MeshFilter>(true)){
    if(!mf.sharedMesh||!mf.sharedMesh.name.StartsWith("Zone10_Terrain"))continue;
    var mesh=UnityEngine.Object.Instantiate(mf.sharedMesh);mesh.name=mf.sharedMesh.name+"_GrassArena";
    var v=mesh.vertices;var colors=mesh.colors;if(colors.Length!=v.Length)colors=Enumerable.Repeat(new Color(.35f,.48f,.20f,0),v.Length).ToArray();
    for(int i=0;i<v.Length;i++){var p=mf.transform.TransformPoint(v[i]);float d=Distance(p);float blend=1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(9.8f,15,d));if(d<15){p.y=Mathf.Lerp(p.y,Floor,blend);v[i]=mf.transform.InverseTransformPoint(p);changed++;}
     // The old road ends at the western grass entrance; it never crosses the fighting circle.
     if(p.x>12&&p.x<39&&Mathf.Abs(p.z-3)<17){var c=colors[i];c.a*=1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(12,14.5f,p.x));colors[i]=c;}
    }
    mesh.vertices=v;mesh.colors=colors;mesh.RecalculateNormals();mesh.RecalculateBounds();AssetDatabase.CreateAsset(mesh,Folder+"/"+mesh.name+".asset");mf.sharedMesh=mesh;
    var mc=mf.GetComponent<MeshCollider>();if(mc){mc.sharedMesh=null;mc.sharedMesh=mesh;if(!mesh.name.Contains("Skirt"))Terrain.Add(mc);}
   }
   Physics.SyncTransforms();int cleared=0;
   foreach(var t in root.GetComponentsInChildren<Transform>(true))if((t.name.StartsWith("tree /")||t.name.StartsWith("rock /"))&&Distance(t.position)<14){t.gameObject.SetActive(false);cleared++;}
   var arena=root.AddComponent<ZoneTenArenaScene>();var boundary=new GameObject("Grass arena · circular boulders");boundary.layer=30;boundary.transform.SetParent(root.transform,false);
   var assets=Resources.Load<SourceEnvironmentAssets>("SourceEnvironmentAssets");if(!assets||assets.rocks.Length==0)throw new Exception("Missing source rocks");var obstacles=new JArray();int rockIndex=0;
   GameObject Rock(float degrees,Transform parent,bool obstacle){float a=degrees*Mathf.Deg2Rad;var p=new Vector3(Center.x+Radius*Mathf.Cos(a),0,Center.y+Radius*Mathf.Sin(a));p.y=Ground(p.x,p.z)-.14f;
    var g=(GameObject)PrefabUtility.InstantiatePrefab(assets.rocks[rockIndex%assets.rocks.Length],scene);g.name="Arena boulder "+rockIndex++;g.transform.SetParent(parent,false);g.transform.position=p;g.transform.rotation=Quaternion.Euler(0,degrees*2.7f,0);
    var rr=g.GetComponentsInChildren<Renderer>(true);var b=rr[0].bounds;foreach(var r in rr)b.Encapsulate(r.bounds);float diameter=2.6f+(rockIndex%3)*.18f;float height=p.z<Center.y?.95f:1.7f;
    g.transform.localScale=new Vector3(diameter/Mathf.Max(.01f,b.size.x),height/Mathf.Max(.01f,b.size.y),diameter/Mathf.Max(.01f,b.size.z));b=rr[0].bounds;foreach(var r in rr)b.Encapsulate(r.bounds);g.transform.position+=new Vector3(p.x-b.center.x,p.y-b.min.y,p.z-b.center.z);
    foreach(var t in g.GetComponentsInChildren<Transform>(true))t.gameObject.layer=30;foreach(var c in g.GetComponentsInChildren<Collider>(true))c.enabled=false;
    if(!g.GetComponent<BattleOccluder>())g.AddComponent<BattleOccluder>();
    if(obstacle)obstacles.Add(new JObject{{"x",p.x*100},{"y",5000+p.z*100},{"radius",diameter*42},{"baseElevation",p.y*100},{"height",height*100},{"source",g.name}});return g;
   }
   for(int i=0;i<30;i++){float a=i*12;if(Mathf.Abs(Mathf.DeltaAngle(a,180))<8||Mathf.Abs(Mathf.DeltaAngle(a,32))<15)continue;Rock(a,boundary.transform,true);}
   arena.entranceSeal=new GameObject("Entrance closes when boss appears");arena.entranceSeal.transform.SetParent(boundary.transform,false);Rock(174,arena.entranceSeal.transform,false);Rock(186,arena.entranceSeal.transform,false);
   arena.exitSeal=new GameObject("Village exit opens after boss defeat");arena.exitSeal.transform.SetParent(boundary.transform,false);Rock(26,arena.exitSeal.transform,false);Rock(38,arena.exitSeal.transform,false);
   var heights=new JArray();const int width=89,heightGrid=69;for(int z=0;z<heightGrid;z++)for(int x=0;x<width;x++)heights.Add(Math.Round(Ground(4+x*.5f,-12+z*.5f),4));
   var data=new JObject{{"revision","zone10-grass-arena-v1"},{"center",new JObject{{"x",2400},{"y",5300}}},{"radius",1050},{"entry",new JObject{{"x",1200},{"y",5300}}},{"boss",new JObject{{"x",2500},{"y",5300}}},{"exitWaypoints",new JArray(new JObject{{"x",3330},{"y",5890}},new JObject{{"x",4072},{"y",6350}},new JObject{{"x",4330},{"y",6490}})},{"terrain",new JObject{{"originX",4},{"originZ",-12},{"step",.5},{"width",width},{"height",heightGrid},{"heights",heights}}},{"obstacles",obstacles}};
   string repo=Path.GetFullPath(Path.Combine(Application.dataPath,"../../.."));File.WriteAllText(Path.Combine(repo,"src/lib/generated/zone-ten-arena.json"),data.ToString(Newtonsoft.Json.Formatting.None));File.WriteAllText("Assets/Island/Resources/ZoneTenArena.json",data.ToString(Newtonsoft.Json.Formatting.None));
   var points=new List<Vector3>();using(var reader=new BinaryReader(new MemoryStream(assets.zones[9].bytes))){int count=reader.ReadInt32();for(int i=0;i<count;i++){var p=new Vector3(reader.ReadSingle(),reader.ReadSingle(),reader.ReadSingle());if(Distance(p)>15)points.Add(p);}}
   for(float z=-11;z<=17;z+=.30f)for(float x=10;x<=38;x+=.30f){float j=Mathf.Sin(x*18.2f+z*71.7f)*.10f;var p=new Vector3(x+j,0,z-j);if(Distance(p)>14||p.x<14&&Mathf.Abs(p.z-3)<1.5f)continue;p.y=Ground(p.x,p.z);points.Add(p);}
   using(var writer=new BinaryWriter(File.Create("Assets/Island/Resources/ZoneTenArenaGrass.bytes"))){writer.Write(points.Count);foreach(var p in points){writer.Write(p.x);writer.Write(p.y);writer.Write(p.z);}}
   if(root.GetComponent<MountZoneEnvironment>().grass){var grass=root.GetComponent<MountZoneEnvironment>().grass;grass.positions=points.ToArray();grass.Rebuild();}
   // Inspection-only lights from the previous turn are intentionally excluded from the scene asset.
   root.SetActive(false);EditorSceneManager.MarkSceneDirty(scene);AssetDatabase.SaveAssets();EditorSceneManager.SaveScene(scene);AssetDatabase.Refresh();
   return "Zone10 grass arena saved: terrain vertices "+changed+", cleared props "+cleared+", boulders "+rockIndex+", grass "+points.Count;
  }
 }
}
