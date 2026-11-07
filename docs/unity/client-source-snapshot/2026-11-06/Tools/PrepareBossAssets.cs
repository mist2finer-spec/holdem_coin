using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class PrepareBossAssets {
 const string Folder="Assets/Island/Art/Battle3D/UnityBoss/",Out="C:/Users/SHK/island-boss-camera-review/";
 static void Save(UnityEngine.Object obj,string path){var old=AssetDatabase.LoadMainAssetAtPath(path);if(old){EditorUtility.CopySerialized(obj,old);UnityEngine.Object.DestroyImmediate(obj);}else AssetDatabase.CreateAsset(obj,path);}
 static Material Adapt(Material source,string name){string path=Folder+name+".mat";var old=AssetDatabase.LoadAssetAtPath<Material>(path);if(name.StartsWith("Bridge_")){var copy=new Material(source){name=name};Save(copy,path);return AssetDatabase.LoadAssetAtPath<Material>(path);}if(old)return old;var m=new Material(Shader.Find("Standard")){name=name,color=Color.white};
  Texture texture=source.mainTexture;if(!texture)foreach(string p in source.GetTexturePropertyNames())if(!p.ToLowerInvariant().Contains("normal")&&!p.ToLowerInvariant().Contains("bump")&&source.GetTexture(p)){texture=source.GetTexture(p);break;}m.mainTexture=texture;m.SetFloat("_Glossiness",.12f);m.SetFloat("_Metallic",0);m.enableInstancing=true;Save(m,path);return AssetDatabase.LoadAssetAtPath<Material>(path);
 }
 static Bounds BoundsOf(GameObject root){bool first=true;var bounds=new Bounds();foreach(var r in root.GetComponentsInChildren<Renderer>(true)){if(first){bounds=r.bounds;first=false;}else bounds.Encapsulate(r.bounds);}return bounds;}
 public static object Main(){
  if(EditorApplication.isPlaying)throw new Exception("Prepare assets outside Play");
  string configPath="Assets/Island/Resources/UnityBossAssets.asset";var config=Resources.Load<UnityBossAssets>("UnityBossAssets");if(!config){config=ScriptableObject.CreateInstance<UnityBossAssets>();AssetDatabase.CreateAsset(config,configPath);}
  var boss=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(Folder+"boss1_rig.glb"));boss.name="Boss1";
  try{foreach(var t in boss.GetComponentsInChildren<Transform>(true))t.gameObject.layer=30;foreach(var a in boss.GetComponentsInChildren<Animator>(true))a.enabled=false;var skin=boss.GetComponentInChildren<SkinnedMeshRenderer>();config.bossMaterial=Adapt(skin.sharedMaterial,"Boss1_Textured");skin.sharedMaterial=config.bossMaterial;
   var baked=new Mesh();skin.BakeMesh(baked);var b=new Bounds();bool first=true;foreach(var p in baked.vertices){Vector3 v=boss.transform.InverseTransformPoint(skin.transform.TransformPoint(p));if(first){b=new Bounds(v,Vector3.zero);first=false;}else b.Encapsulate(v);}config.bossReferenceHeight=b.size.y;skin.localBounds=b;UnityEngine.Object.DestroyImmediate(baked);config.boss=PrefabUtility.SaveAsPrefabAsset(boss,Folder+"Boss1.prefab");
  }finally{UnityEngine.Object.DestroyImmediate(boss);}
  config.combo=AssetDatabase.LoadAllAssetsAtPath(Folder+"boss_melee_hook_combo.glb").OfType<AnimationClip>().Single();config.throwClip=AssetDatabase.LoadAllAssetsAtPath(Folder+"boss_overhand_throw.glb").OfType<AnimationClip>().Single();config.bossHeight=13;
  const string Bridge="Assets/Polytope Studio/Lowpoly_Village/Prefabs/Modular/Bridge/PT_Wooden_Bridge_02.prefab";var bridge=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(Bridge));bridge.name="BridgeWalkway";
  try{
   foreach(var t in bridge.GetComponentsInChildren<Transform>(true))t.gameObject.layer=30;foreach(var c in bridge.GetComponentsInChildren<Collider>(true))UnityEngine.Object.DestroyImmediate(c);
   var mats=new Dictionary<Material,Material>();foreach(var r in bridge.GetComponentsInChildren<Renderer>(true)){var list=r.sharedMaterials;for(int i=0;i<list.Length;i++){if(!list[i])continue;Material m;if(!mats.TryGetValue(list[i],out m)){m=Adapt(list[i],"Bridge_"+list[i].name.Replace(' ','_'));mats.Add(list[i],m);}list[i]=m;}r.sharedMaterials=list;}
   var raw=BoundsOf(bridge);float yaw=raw.size.z>raw.size.x?90:0;bridge.transform.rotation=Quaternion.Euler(0,yaw,0);var b=BoundsOf(bridge);float scale=9.6f/b.size.x;float[] samples=new float[33];
   var tris=new List<Vector3[]>();foreach(var filter in bridge.GetComponentsInChildren<MeshFilter>(true)){var mesh=filter.sharedMesh;if(!mesh||!mesh.isReadable)continue;var v=mesh.vertices;var idx=mesh.triangles;for(int i=0;i<idx.Length;i+=3){var a=filter.transform.TransformPoint(v[idx[i]]);var c=filter.transform.TransformPoint(v[idx[i+1]]);var d=filter.transform.TransformPoint(v[idx[i+2]]);if(Vector3.Cross(c-a,d-a).normalized.y>.15f)tris.Add(new[]{a,c,d});}}
   for(int i=0;i<samples.Length;i++){float x=Mathf.Lerp(b.min.x+.01f,b.max.x-.01f,i/32f),height=float.NegativeInfinity;var ray=new Ray(new Vector3(x,b.max.y+5,b.center.z),Vector3.down);foreach(var tri in tris){float distance;if(Intersect(ray,tri[0],tri[1],tri[2],out distance))height=Mathf.Max(height,ray.GetPoint(distance).y);}samples[i]=float.IsNegativeInfinity(height)?b.min.y:height;}
   samples[0]=samples[1];samples[samples.Length-1]=samples[samples.Length-2];float baseline=samples[0];config.bridgeGround=new AnimationCurve();for(int i=0;i<samples.Length;i++)config.bridgeGround.AddKey(i/32f,(samples[i]-baseline)*scale);config.bridgeScale=scale;config.bridgeYaw=yaw;config.bridgeOffset=new Vector3(-b.center.x*scale,-baseline*scale,-b.center.z*scale);bridge.transform.rotation=Quaternion.identity;config.bridge=PrefabUtility.SaveAsPrefabAsset(bridge,Folder+"BridgeWalkway.prefab");
   var json=new JObject{{"heightCore",new JArray(samples.Select(v=>(v-baseline)*scale*100))},{"source","PT_Wooden_Bridge_02"}};File.WriteAllText(Out+"bridge-profile.json",json.ToString());
  }finally{UnityEngine.Object.DestroyImmediate(bridge);}
  var shader=Shader.Find("Island/BossTelegraph");if(!shader)throw new Exception("Boss telegraph shader is not imported");
  if(!config.telegraphMaterial){var mat=new Material(shader){name="Boss Warning Yellow",color=new Color(1,.84f,.02f,.4f)};AssetDatabase.CreateAsset(mat,Folder+"BossWarning.mat");config.telegraphMaterial=mat;}
  if(!config.explosionMaterial){var mat=new Material(shader){name="Boss Explosion Orange",color=new Color(1,.27f,.02f,.7f)};AssetDatabase.CreateAsset(mat,Folder+"BossExplosion.mat");config.explosionMaterial=mat;}
  EditorUtility.SetDirty(config);AssetDatabase.SaveAssets();return new{bossHeight=config.bossHeight,bossReferenceHeight=config.bossReferenceHeight,bridgeScale=config.bridgeScale,bridgeYaw=config.bridgeYaw,bridgeOffset=config.bridgeOffset.ToString(),bridgeSamples=config.bridgeGround.length};
 }
 static bool Intersect(Ray ray,Vector3 a,Vector3 b,Vector3 c,out float distance){var e1=b-a;var e2=c-a;var p=Vector3.Cross(ray.direction,e2);float det=Vector3.Dot(e1,p);distance=0;if(Mathf.Abs(det)<1e-7f)return false;float inverse=1/det;var t=ray.origin-a;float u=Vector3.Dot(t,p)*inverse;if(u<0||u>1)return false;var q=Vector3.Cross(t,e1);float v=Vector3.Dot(ray.direction,q)*inverse;if(v<0||u+v>1)return false;distance=Vector3.Dot(e2,q)*inverse;return distance>=0;}
}
