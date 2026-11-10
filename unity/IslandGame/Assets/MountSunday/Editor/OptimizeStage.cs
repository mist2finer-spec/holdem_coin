using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
namespace MountSunday.Review {
 public static class OptimizeStage {
  const string Root="Assets/MountSunday/Review";
  public static void Apply(){
   EditorSceneManager.OpenScene(Root+"/MountSunday_Baseline.unity");
   Directory.CreateDirectory(Root+"/Meshes");Directory.CreateDirectory(Root+"/Materials");AssetDatabase.Refresh();
   var all=UnityEngine.Object.FindObjectsByType<LODGroup>(FindObjectsInactive.Include,FindObjectsSortMode.None);
   int grass=0,trees=0;
   foreach(var g in all){var cat=g.transform.parent.name;var ls=g.GetLODs();for(int i=0;i<ls.Length;i++)ls[i].screenRelativeTransitionHeight=cat=="grass"||cat=="flower"?(i==0?.7f:i==1?.3f:.15f):cat=="tree"?(i==0?.25f:i==1?.09f:.012f):(i==0?.18f:i==1?.06f:.004f);g.SetLODs(ls);if(cat=="grass"||cat=="flower"){grass++;foreach(var l in ls)foreach(var r in l.renderers)r.shadowCastingMode=ShadowCastingMode.Off;}if(cat=="tree")trees++;}
   var terrains=UnityEngine.Object.FindObjectsByType<MeshFilter>(FindObjectsSortMode.None).Where(f=>f.name.StartsWith("Terrain_")).ToArray();
   foreach(var f in terrains)f.GetComponent<MeshRenderer>().shadowCastingMode=ShadowCastingMode.Off;
   CloneMaterial("MS_Terrain",new Color(.92f,.91f,.87f),.06f);
   CloneMaterial("MS_Vegetation",new Color(.92f,.97f,.84f),.04f);
   DrapeCourtyards();
   var hall=UnityEngine.Object.FindObjectsByType<LODGroup>(FindObjectsSortMode.None).First(g=>g.name.StartsWith("GoldenHall_"));hall.transform.rotation=Quaternion.Euler(0,-145,0);
   var route=UnityEngine.Object.FindFirstObjectByType<MountSundayRoute>();route.waypoints[route.waypoints.Length-1].position=hall.transform.TransformPoint(new Vector3(0,1.8f,17.5f));
   var sun=RenderSettings.sun;sun.intensity=1.15f;sun.color=new Color(1,.96f,.87f);sun.transform.rotation=Quaternion.Euler(42,-32,0);RenderSettings.ambientSkyColor=new Color(.53f,.59f,.65f);RenderSettings.ambientEquatorColor=new Color(.46f,.45f,.38f);RenderSettings.ambientGroundColor=new Color(.24f,.22f,.18f);RenderSettings.fogDensity=.00011f;RenderSettings.fogColor=new Color(.63f,.69f,.72f);
   foreach(var v in UnityEngine.Object.FindObjectsByType<Volume>(FindObjectsSortMode.None)){var profile=ScriptableObject.CreateInstance<VolumeProfile>();AssetDatabase.CreateAsset(profile,Root+"/ReviewVolume.asset");foreach(var component in v.sharedProfile.components){var copy=UnityEngine.Object.Instantiate(component);profile.components.Add(copy);AssetDatabase.AddObjectToAsset(copy,profile);}v.sharedProfile=profile;if(profile.TryGet<Bloom>(out var b))b.intensity.Override(0);EditorUtility.SetDirty(profile);}
   var camera=Camera.main;camera.farClipPlane=11000;camera.nearClipPlane=.15f;
   var flight=UnityEngine.Object.FindFirstObjectByType<MountSundayFreeFlight>();flight.gameObject.AddComponent<ReviewControls>();
   AssetDatabase.SaveAssets();EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),Root+"/MountSunday_Exploration_Review.unity");
   Debug.Log("Review optimization: "+grass+" foliage LODs, "+trees+" tree LODs, "+terrains.Length+" terrain grids.");
  }
  static void DrapeCourtyards(){
   var ground=UnityEngine.Object.FindObjectsByType<MeshCollider>(FindObjectsSortMode.None).Where(c=>c.name.StartsWith("Terrain_")).ToArray();
   foreach(var f in UnityEngine.Object.FindObjectsByType<MeshFilter>(FindObjectsSortMode.None).Where(f=>f.name.StartsWith("Courtyard")).ToArray()){
    var root=PrefabUtility.GetOutermostPrefabInstanceRoot(f.gameObject);if(root)PrefabUtility.UnpackPrefabInstance(root,PrefabUnpackMode.Completely,InteractionMode.AutomatedAction);
    var m=UnityEngine.Object.Instantiate(f.sharedMesh);var vv=m.vertices;float top=vv.Max(v=>f.transform.TransformPoint(v).y);
    for(int i=0;i<vv.Length;i++){var w=f.transform.TransformPoint(vv[i]);float offset=w.y-top;var ray=new Ray(new Vector3(w.x,600,w.z),Vector3.down);foreach(var c in ground)if(c.Raycast(ray,out var hit,1200)){w.y=hit.point.y+.045f+offset;vv[i]=f.transform.InverseTransformPoint(w);break;}}
    m.vertices=vv;m.RecalculateNormals();m.RecalculateBounds();AssetDatabase.CreateAsset(m,Root+"/Meshes/"+f.transform.parent.name+"_"+f.name+"_Grounded.asset");f.sharedMesh=m;var collider=f.GetComponent<MeshCollider>();if(collider)collider.sharedMesh=m;
   }
  }
  static void CloneMaterial(string name,Color tint,float detail){var source=AssetDatabase.LoadAssetAtPath<Material>("Assets/MountSunday/Generated/Materials/"+name+".mat");var copy=new Material(source);copy.SetColor("_BaseColor",tint);copy.SetFloat("_DetailStrength",detail);AssetDatabase.CreateAsset(copy,Root+"/Materials/"+name+".mat");foreach(var r in UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include,FindObjectsSortMode.None)){var mats=r.sharedMaterials;bool changed=false;for(int i=0;i<mats.Length;i++)if(mats[i]==source){mats[i]=copy;changed=true;}if(changed)r.sharedMaterials=mats;}}
 }
}
