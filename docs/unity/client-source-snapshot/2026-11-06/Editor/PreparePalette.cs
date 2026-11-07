using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
public static class PreparePalette {
 public static object Main(){
  string folder="Assets/Island/Art/Battle3D/AuthoredNature/";var copies=new Dictionary<Material,Material>();
  var paths=AssetDatabase.FindAssets("t:Prefab",new[]{"Assets/Island/Resources/NatureAuthoredChunks"}).Select(AssetDatabase.GUIDToAssetPath).Concat(new[]{"Assets/Island/Resources/NatureAuthoredMap.prefab"});
  int count=0;foreach(var path in paths){var root=PrefabUtility.LoadPrefabContents(path);try{foreach(var r in root.GetComponentsInChildren<Renderer>(true)){var materials=r.sharedMaterials;bool changed=false;for(int i=0;i<materials.Length;i++){var m=materials[i];if(!m||!m.HasProperty("_Translucency"))continue;if(!copies.TryGetValue(m,out var copy)){string p=folder+"Muted_"+m.name+".mat";copy=AssetDatabase.LoadAssetAtPath<Material>(p);if(!copy){copy=new Material(m){name="Muted_"+m.name};AssetDatabase.CreateAsset(copy,p);}copy.SetFloat("_Translucency",.35f);copy.SetFloat("_TransAmbient",.18f);copy.SetFloat("_WindStrength",.045f);EditorUtility.SetDirty(copy);copies.Add(m,copy);}materials[i]=copy;changed=true;}if(changed)r.sharedMaterials=materials;}PrefabUtility.SaveAsPrefabAsset(root,path);count++;}finally{PrefabUtility.UnloadPrefabContents(root);}}
  AssetDatabase.SaveAssets();var a=AssetDatabase.LoadAssetAtPath<TerrainData>(folder+"NatureMobileTerrain.asset");var b=AssetDatabase.LoadAssetAtPath<TerrainData>("Assets/Polytope Studio/Lowpoly_Demos/Environment_Free/Helpers/Terrain/New Terrain.asset");var aa=a.GetAlphamaps(450,450,1,1);var bb=b.GetAlphamaps(450,450,1,1);return new{prefabs=count,mutedMaterials=copies.Count,terrainLayers=a.alphamapLayers,originalLayers=b.alphamapLayers,sample=Enumerable.Range(0,a.alphamapLayers).Select(i=>new{copy=aa[0,0,i],original=bb[0,0,i]}).ToArray()};
 }
}
