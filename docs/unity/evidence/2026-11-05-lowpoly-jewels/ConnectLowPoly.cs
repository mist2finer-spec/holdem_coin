using System;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEditor;
using IslandGame;
public static class ConnectLowPoly {
 public static object Main(){
  const string folder="Assets/Island/Art/Battle3D/LowPoly/";
  foreach(var name in new[]{"PinkGlass_5000","Slime_300"}){
   var importer=AssetImporter.GetAtPath(folder+name+".glb");var serialized=new SerializedObject(importer);var method=serialized.FindProperty("importSettings.animationMethod");
   if(method==null)throw new Exception("glTFast import settings missing");method.intValue=2;serialized.ApplyModifiedPropertiesWithoutUndo();importer.SaveAndReimport();
  }
  var target=Resources.Load<Battle3DAssets>("Battle3DAssets");
  const string comparison="Assets/Island/Art/Battle3D/LowPoly/Battle3DAssets-Original.asset";
  if(!AssetDatabase.LoadAssetAtPath<Battle3DAssets>(comparison))AssetDatabase.CopyAsset(AssetDatabase.GetAssetPath(target),comparison);
  target.hero=AssetDatabase.LoadAssetAtPath<GameObject>(folder+"PinkGlass_5000.glb");target.slime=AssetDatabase.LoadAssetAtPath<GameObject>(folder+"Slime_300.glb");
  var clips=AssetDatabase.LoadAllAssetsAtPath(folder+"PinkGlass_5000.glb").OfType<AnimationClip>().ToDictionary(c=>c.name);
  string[] fields={"idle","run","jumpStart","jumpLoop","jumpLand","roll","slide","death","hit","attack1","attack2","attack3","combo","heavy","dash","spell"};
  string[] names={"idle_loop","jog_fwd_loop","jump_start","jump_loop","jump_land","roll","slide_loop","death01","hit_chest","sword_regular_a","sword_regular_b","sword_regular_c","sword_regular_combo","sword_heavy_combo","sword_dash","spell_simple_shoot"};
  for(int i=0;i<fields.Length;i++)typeof(Battle3DAssets).GetField(fields[i]).SetValue(target,clips[names[i]]);
  target.slimeIdle=AssetDatabase.LoadAllAssetsAtPath(folder+"Slime_300.glb").OfType<AnimationClip>().Single();EditorUtility.SetDirty(target);AssetDatabase.SaveAssets();
  var report=new{status="PASS",heroClips=clips.Count,connectedHeroClips=fields.Length,allLegacy=clips.Values.All(c=>c.legacy),models=new[]{target.hero,target.slime}.Select(p=>new{model=p.name,skins=p.GetComponentsInChildren<SkinnedMeshRenderer>(true).Select(s=>new{vertices=s.sharedMesh.vertexCount,triangles=s.sharedMesh.triangles.Length/3,bones=s.bones.Length,submeshes=s.sharedMesh.subMeshCount}).ToArray()}).ToArray(),heroMaterial=target.heroMaterial.name,slimeMaterial=target.slimeMaterial.name};
  File.WriteAllText("C:/Users/SHK/island-lowpoly-jewel-review/model-import.json",Newtonsoft.Json.JsonConvert.SerializeObject(report,Newtonsoft.Json.Formatting.Indented));return report;
 }
}
