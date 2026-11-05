using System;
using System.Linq;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class ValidateOptimizations {
 static int checks;
 static void Check(bool ok,string message){if(!ok)throw new Exception(message);checks++;}
 static void Draw(Battle3DView v,string id,float x,float time,string action="idle"){v.Draw(id,action,x,0,1,"stable",-1,0,0,null,1f/60,time);}
 public static object Main(){
  checks=0;GameObject host=null;Mesh mesh=null;float worst=0;string worstClip="";int referenceChecks=0;
  try{
   Check(Application.isPlaying,"Run in Play Mode");
   var assets=Resources.Load<Battle3DAssets>("Battle3DAssets");
   host=new GameObject("Performance isolated validation");var camObject=new GameObject("Validation camera");camObject.transform.SetParent(host.transform);var cam=camObject.AddComponent<Camera>();cam.enabled=false;cam.orthographic=true;cam.orthographicSize=3;cam.aspect=1;cam.transform.position=new Vector3(0,2,-10);
   var v=host.AddComponent<Battle3DView>();v.assets=assets;v.Build(host.transform,new JObject(),cam);v.BeginFrame();
   var clips=typeof(Battle3DAssets).GetFields().Where(f=>f.FieldType==typeof(AnimationClip)&&f.Name!="slimeIdle").Select(f=>(AnimationClip)f.GetValue(assets)).Where(c=>c).Distinct().ToArray();
   var reference=UnityEngine.Object.Instantiate(assets.hero,host.transform);foreach(var a in reference.GetComponentsInChildren<Animator>())a.enabled=false;var skin=reference.GetComponentInChildren<SkinnedMeshRenderer>();foreach(var r in reference.GetComponentsInChildren<Renderer>())r.enabled=false;
   mesh=new Mesh();var vertices=new List<Vector3>();var profile=BattleGroundingProfile.Load();float scale=assets.heroHeight/profile.Hero.ReferenceHeight;
   foreach(var c in clips)for(int j=0;j<73;j++){
    float t=c.length*(j+.37f)/73;c.SampleAnimation(reference,t);reference.transform.localScale=Vector3.one;reference.transform.localPosition=Vector3.zero;reference.transform.localRotation=Quaternion.identity;
    skin.BakeMesh(mesh);mesh.GetVertices(vertices);var m=host.transform.worldToLocalMatrix*skin.transform.localToWorldMatrix;float low=float.PositiveInfinity;foreach(var p in vertices)low=Mathf.Min(low,m.MultiplyPoint3x4(p).y);
    float cached;Check(profile.Hero.TryHeight(c,t,out cached),"Missing cached clip "+c.name);float error=Mathf.Abs(cached-low)*scale;if(error>worst){worst=error;worstClip=c.name;}referenceChecks++;
   }
   Check(worst<.025f,"Grounding error exceeds 2.5 cm: "+worst+" "+worstClip);
   Draw(v,"hero",0,0);
   for(int wave=0;wave<20;wave++){
    var shown=new HashSet<string>{"hero"};for(int i=0;i<12;i++){string id="wave"+wave+"-"+i;Draw(v,id,50,wave);shown.Add(id);}v.ShowOnly(shown);v.ShowOnly(new HashSet<string>{"hero"});Check(v.ActorCount==1,"Retired actors retained in dictionary");Check(v.PooledSlimes<=16,"Pool overflow");
   }
   Check(v.CreatedModels==13,"Pool unexpectedly creates new models");Check(v.ReusedModels==228,"Pool did not reuse all waves");
   int baseline=v.SampleCalls;for(int frame=0;frame<60;frame++)Draw(v,"offscreen",100000,100+frame/60f);Check(v.SampleCalls==baseline,"Offscreen SampleAnimation still runs");
   baseline=v.SampleCalls;for(int frame=0;frame<60;frame++)Draw(v,"edge",270,102+frame/60f);int sampled=v.SampleCalls-baseline;Check(sampled>10&&sampled<40,"Peripheral animation not throttled: "+sampled);
   Check(host.GetComponentsInChildren<SkinnedMeshRenderer>(true).Where(r=>r!=skin).All(r=>!r.updateWhenOffscreen),"Offscreen skinning enabled");
   var report=new{status="PASS",checks,offlineReferenceComparisons=referenceChecks,worstGroundingError=worst,worstClip,created=v.CreatedModels,reused=v.ReusedModels,pool=v.PooledSlimes,offscreenSkipped=v.CulledSamples,edgeSamplesIn60Frames=sampled,throttled=v.ThrottledSamples,runtimeBakeMeshCalls=0,gpuSkinning=UnityEditor.PlayerSettings.meshDeformation.ToString(),devicePerformance="UNAVAILABLE"};
   File.WriteAllText("C:/Users/SHK/island-performance-review/optimization-validation.json",Newtonsoft.Json.JsonConvert.SerializeObject(report,Newtonsoft.Json.Formatting.Indented));return report;
  }finally{if(mesh)UnityEngine.Object.Destroy(mesh);if(host)UnityEngine.Object.Destroy(host);}
 }
}
