using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using Newtonsoft.Json.Linq;
public static class PrepareNatureMap {
 public static object Main(){
  string output=Path.GetFullPath("Temp/UnityEncounterPreparation/");Directory.CreateDirectory(output);
  var scene=EditorSceneManager.OpenPreviewScene("Assets/Polytope Studio/Lowpoly_Demos/Environment_Free/Environment_Free.unity");
  var root=new GameObject("Nature Free authored environment");
  try{
   var roots=scene.GetRootGameObjects();var source=roots.SelectMany(o=>o.GetComponentsInChildren<Terrain>()).Single(t=>t.name=="Terrain");
   var bridge=roots.Single(o=>o.name=="PT_Wooden_Bridge_02");var bridgeBounds=bridge.GetComponentInChildren<Renderer>().bounds;
   Vector3 offset=new Vector3(bridgeBounds.center.x-24,3,bridgeBounds.center.z);
   foreach(var original in roots){if(original.GetComponent<Camera>()||original.GetComponent<Light>()||original.GetComponentsInChildren<Terrain>().Length>0||original.GetComponentsInChildren<Renderer>().Length==0)continue;var copy=UnityEngine.Object.Instantiate(original,root.transform);copy.name=original.name;copy.transform.position-=offset;}
   var terrainObject=UnityEngine.Object.Instantiate(source.gameObject,root.transform);terrainObject.name="Authored central terrain";terrainObject.transform.position-=offset;
   var terrain=terrainObject.GetComponent<Terrain>();terrain.drawInstanced=true;terrain.heightmapPixelError=12;terrain.basemapDistance=70;terrain.treeDistance=48;terrain.treeBillboardDistance=32;terrain.detailObjectDistance=18;terrain.detailObjectDensity=.35f;
   string generated="Assets/Island/Art/Battle3D/AuthoredNature";Directory.CreateDirectory(generated);Directory.CreateDirectory("Assets/Island/Resources/NatureAuthoredChunks");AssetDatabase.Refresh();
   var terrainData=UnityEngine.Object.Instantiate(source.terrainData);terrainData.name="Nature Free mobile terrain";terrainData.treeInstances=new TreeInstance[0];terrainData.treePrototypes=new TreePrototype[0];
   string terrainPath=generated+"/NatureMobileTerrain.asset";var old=AssetDatabase.LoadAssetAtPath<TerrainData>(terrainPath);if(old){EditorUtility.CopySerialized(terrainData,old);UnityEngine.Object.DestroyImmediate(terrainData);terrainData=old;}else AssetDatabase.CreateAsset(terrainData,terrainPath);
   terrainData.SetAlphamaps(0,0,source.terrainData.GetAlphamaps(0,0,source.terrainData.alphamapWidth,source.terrainData.alphamapHeight));
   terrain.terrainData=terrainData;terrain.GetComponent<TerrainCollider>().terrainData=terrainData;
   var chunks=new Dictionary<string,GameObject>();var tdOriginal=source.terrainData;
   foreach(var tree in tdOriginal.treeInstances){Vector3 p=Vector3.Scale(tree.position,tdOriginal.size)+source.transform.position-offset;int cx=Mathf.FloorToInt(p.x/12),cz=Mathf.FloorToInt(p.z/12);string key=cx+"_"+cz;if(!chunks.TryGetValue(key,out var chunk)){chunk=new GameObject("Authored trees "+key);chunks.Add(key,chunk);}var instance=UnityEngine.Object.Instantiate(tdOriginal.treePrototypes[tree.prototypeIndex].prefab,chunk.transform);instance.transform.localPosition=p;instance.transform.localRotation=Quaternion.Euler(0,tree.rotation*Mathf.Rad2Deg,0);instance.transform.localScale=Vector3.Scale(instance.transform.localScale,new Vector3(tree.widthScale,tree.heightScale,tree.widthScale));}
   var layout=new JArray();foreach(var pair in chunks){var coordinates=pair.Key.Split('_');float cx=(int.Parse(coordinates[0])+.5f)*12,cz=(int.Parse(coordinates[1])+.5f)*12;string path="NatureAuthoredChunks/"+pair.Key;foreach(var t in pair.Value.GetComponentsInChildren<Transform>(true))t.gameObject.layer=30;PrefabUtility.SaveAsPrefabAsset(pair.Value,"Assets/Island/Resources/"+path+".prefab");layout.Add(new JObject{{"path",path},{"x",cx},{"z",cz}});UnityEngine.Object.DestroyImmediate(pair.Value);}
   File.WriteAllText("Assets/Island/Resources/NatureAuthoredLayout.json",layout.ToString());
   foreach(var t in root.GetComponentsInChildren<Transform>(true))t.gameObject.layer=30;
   // Save the imported map composition, retaining its original meshes, terrain and bridge.
   string prefab="Assets/Island/Resources/NatureAuthoredMap.prefab";PrefabUtility.SaveAsPrefabAsset(root,prefab);
   float height(float x,float z)=>source.terrainData.GetInterpolatedHeight((x+offset.x-source.transform.position.x)/100,(z+offset.z-source.transform.position.z)/100)-3;
   var heights=new JArray();for(int z=0;z<=100;z++)for(int x=0;x<=100;x++)heights.Add(Math.Round(source.terrainData.GetInterpolatedHeight(x/100f,z/100f)-3,5));
   var tris=new List<Vector3[]>();foreach(var filter in bridge.GetComponentsInChildren<MeshFilter>()){if(filter.name.Contains("LOD1"))continue;var mesh=filter.sharedMesh;var v=mesh.vertices;var indices=mesh.triangles;for(int i=0;i<indices.Length;i+=3){var a=filter.transform.TransformPoint(v[indices[i]]);var b=filter.transform.TransformPoint(v[indices[i+1]]);var c=filter.transform.TransformPoint(v[indices[i+2]]);if(Vector3.Cross(b-a,c-a).normalized.y>.4f)tris.Add(new[]{a,b,c});}}
   var deck=new JArray();float start=bridgeBounds.min.x-offset.x,end=bridgeBounds.max.x-offset.x;
   for(int i=0;i<=64;i++){float x=Mathf.Lerp(bridgeBounds.min.x+.03f,bridgeBounds.max.x-.03f,i/64f),h=float.NegativeInfinity;var ray=new Ray(new Vector3(x,20,offset.z),Vector3.down);foreach(var tri in tris){float d;if(Hit(ray,tri[0],tri[1],tri[2],out d))h=Mathf.Max(h,ray.GetPoint(d).y);}deck.Add(Math.Round((float.IsNegativeInfinity(h)?3:h)-3,5));}
   // Plank gaps are not holes in the walk surface. Interpolate only missed interior rays.
   for(int i=1;i<deck.Count-1;i++)if((float)deck[i]==0){int a=i-1,b=i+1;while(b<deck.Count-1&&(float)deck[b]==0)b++;deck[i]=Mathf.Lerp((float)deck[a],(float)deck[b],(i-a)/(float)(b-a));}
   var obstacles=new JArray();var td=source.terrainData;
   foreach(var tree in td.treeInstances){var p=Vector3.Scale(tree.position,td.size)+source.transform.position-offset;var asset=td.treePrototypes[tree.prototypeIndex].prefab;string n=asset.name;if(n.Contains("Tree")&&p.x>27&&p.x<87){float radius=Mathf.Clamp(.22f*tree.widthScale,.18f,.65f);obstacles.Add(new JObject{{"x",Math.Round(p.x*100,2)},{"y",Math.Round((p.z+50)*100,2)},{"radius",Math.Round(radius*100,2)}});}}
   var profile=new JObject{{"source","Polytope Studio/Lowpoly_Demos/Environment_Free/Environment_Free.unity"},{"originX",-offset.x},{"originZ",source.transform.position.z-offset.z},{"step",1},{"width",101},{"height",101},{"heights",heights},{"bridge",new JObject{{"from",start*100},{"to",end*100},{"heightCore",new JArray(deck.Select(v=>(double)v*100))}}},{"obstacles",obstacles}};
   File.WriteAllText(output+"nature-map.json",profile.ToString(Newtonsoft.Json.Formatting.None));
   return new{prefab,offset=offset.ToString(),bridgeFrom=start,bridgeTo=end,terrainTreeCount=td.treeInstanceCount,objects=root.GetComponentsInChildren<Renderer>().Length,obstacles=obstacles.Count,spawnHeight=height(12,0)};
  }finally{UnityEngine.Object.DestroyImmediate(root);EditorSceneManager.ClosePreviewScene(scene);AssetDatabase.SaveAssets();}
 }
 static bool Hit(Ray ray,Vector3 a,Vector3 b,Vector3 c,out float d){var e=b-a;var f=c-a;var p=Vector3.Cross(ray.direction,f);float det=Vector3.Dot(e,p);d=0;if(Mathf.Abs(det)<1e-7f)return false;var t=ray.origin-a;float u=Vector3.Dot(t,p)/det;if(u<0||u>1)return false;var q=Vector3.Cross(t,e);float v=Vector3.Dot(ray.direction,q)/det;if(v<0||u+v>1)return false;d=Vector3.Dot(f,q)/det;return d>=0;}
}
