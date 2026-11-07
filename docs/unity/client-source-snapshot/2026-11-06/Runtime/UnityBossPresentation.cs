using System;
using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 public sealed class UnityBossPresentation:IDisposable {
  readonly UnityBossAssets assets;readonly GameObject root,bossRoot,bossModel,bridge,warning,explosion;readonly Mesh disc,sphere;readonly Transform hips,leftFoot,rightFoot;readonly float scale,sole;
  readonly Material warningMaterial,blastMaterial;int explosionId=-1;
  public Transform BossTarget=>bossRoot.transform;public bool BossVisible=>bossRoot.activeSelf;
  public string BossClipName{get;private set;}public float BossSampleTime{get;private set;}
  public UnityBossPresentation(Transform parent,UnityBossAssets a){
   assets=a;root=new GameObject("Unity boss encounter presentation");root.transform.SetParent(parent,false);
   bossRoot=new GameObject("Giant Boss 1");bossRoot.transform.SetParent(root.transform,false);bossRoot.layer=30;bossModel=UnityEngine.Object.Instantiate(a.boss,bossRoot.transform,false);bossModel.name="Boss model";
   foreach(var r in bossModel.GetComponentsInChildren<Renderer>()){r.sharedMaterial=a.bossMaterial;r.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.On;}
   foreach(var t in bossModel.GetComponentsInChildren<Transform>(true)){t.gameObject.layer=30;if(t.name=="Hips")hips=t;if(t.name=="Foot.L")leftFoot=t;if(t.name=="Foot.R")rightFoot=t;}
   a.combo.SampleAnimation(bossModel,0);scale=a.bossHeight/a.bossReferenceHeight;var skin=bossModel.GetComponentInChildren<SkinnedMeshRenderer>();sole=(leftFoot&&rightFoot?Mathf.Min(leftFoot.position.y,rightFoot.position.y):0)-skin.bounds.min.y;bossRoot.SetActive(false);
   bridge=UnityEngine.Object.Instantiate(a.bridge,root.transform,false);bridge.name="Bridge · slime to boss";bridge.transform.localScale=Vector3.one*a.bridgeScale;bridge.transform.localRotation=Quaternion.Euler(0,a.bridgeYaw,0);bridge.transform.localPosition=new Vector3(24,0,0)+a.bridgeOffset;
   disc=Disc();sphere=IslandDisplayMeshes.Create(PrimitiveType.Sphere);var colors=new Color[sphere.vertexCount];for(int i=0;i<colors.Length;i++)colors[i]=Color.white;sphere.colors=colors;
   warningMaterial=new Material(a.telegraphMaterial){name="Boss warning yellow"};warningMaterial.color=new Color(1,.84f,.03f,.4f);
   blastMaterial=new Material(a.explosionMaterial){name="Boss blast orange"};blastMaterial.color=new Color(1,.27f,.025f,.65f);
   warning=Visual("Warning circle · 2 seconds",disc,warningMaterial);explosion=Visual("Explosion",sphere,blastMaterial);warning.SetActive(false);explosion.SetActive(false);
  }
  GameObject Visual(string name,Mesh mesh,Material material){var go=new GameObject(name,typeof(MeshFilter),typeof(MeshRenderer));go.layer=30;go.transform.SetParent(root.transform,false);go.GetComponent<MeshFilter>().sharedMesh=mesh;var r=go.GetComponent<MeshRenderer>();r.sharedMaterial=material;r.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;r.receiveShadows=false;return go;}
  public void Update(JObject state,float visualTime){
   var boss=(state["mobs"] as JArray)?.First as JObject;
   foreach(var m in state["mobs"] as JArray??new JArray())if((bool?)m["unityBoss"]==true){boss=m as JObject;break;}
   bool show=(bool?)state["bossVisible"]==true&&boss!=null;bossRoot.SetActive(show);
   if(show){bossRoot.transform.localPosition=new Vector3(N(boss["x"])/100,N(boss["elevation"])/100,0);bossRoot.transform.localRotation=Quaternion.Euler(0,assets.bossYaw*(N(boss["facing"],-1)<0?-1:1),0);
    var motion=boss["motion"] as JObject;var clip=(string)boss["action"]=="throw"?assets.throwClip:assets.combo;float time=motion==null?0:Mathf.Clamp01((visualTime-N(motion["start"]))/Mathf.Max(.001f,N(motion["duration"])))*clip.length;
    clip.SampleAnimation(bossModel,time);bossModel.transform.localScale=Vector3.one*scale;bossModel.transform.localPosition=Vector3.zero;
    float feet=0;if(leftFoot&&rightFoot)feet=Mathf.Min(bossRoot.transform.InverseTransformPoint(leftFoot.position).y,bossRoot.transform.InverseTransformPoint(rightFoot.position).y)-sole*scale;
    Vector3 pelvis=hips?bossRoot.transform.InverseTransformPoint(hips.position):Vector3.zero;bossModel.transform.localPosition=new Vector3(-pelvis.x,-feet,-pelvis.z);BossClipName=clip.name;BossSampleTime=time;
   }
   var w=state["warning"] as JObject;warning.SetActive(w!=null);if(w!=null){float radius=N(w["radius"])/100;warning.transform.localPosition=new Vector3(N(w["x"])/100,.025f,N(w["z"])/100);warning.transform.localScale=new Vector3(radius,1,radius);float age=Mathf.Clamp01((visualTime-N(w["born"]))/Mathf.Max(.01f,N(w["explodeAt"])-N(w["born"])));warningMaterial.color=new Color(1,.82f,.015f,.22f+age*.35f);}
   JObject latest=null;foreach(var f in state["fx"] as JArray??new JArray())if((string)f["kind"]=="explosion")latest=f as JObject;
   float blastAge=latest==null?10:visualTime-N(latest["born"]);bool blast=blastAge>=0&&blastAge<.55f;explosion.SetActive(blast);if(blast){explosionId=(int)N(latest["id"]);float radius=N(latest["radius"])/100;explosion.transform.localPosition=new Vector3(N(latest["x"])/100,.6f,0);float s=Mathf.Lerp(.2f,radius*2,Mathf.Clamp01(blastAge/.3f));explosion.transform.localScale=new Vector3(s,s*.65f,s);blastMaterial.color=new Color(1,.28f,.025f,Mathf.Clamp01(1-blastAge/.55f)*.8f);}
  }
  static float N(JToken t,float fallback=0)=>NativeCombatPresentation.N(t,fallback);
  static Mesh Disc(){const int count=64;var v=new Vector3[count+1];var colors=new Color[count+1];var indices=new int[count*3];colors[0]=new Color(1,1,1,.18f);for(int i=0;i<count;i++){float a=i*Mathf.PI*2/count;v[i+1]=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a));colors[i+1]=Color.white;indices[i*3]=0;indices[i*3+1]=i+1;indices[i*3+2]=(i+1)%count+1;}var mesh=new Mesh{name="Warning ground disc"};mesh.vertices=v;mesh.colors=colors;mesh.triangles=indices;mesh.RecalculateBounds();mesh.RecalculateNormals();return mesh;}
  public void Dispose(){Destroy(root);Destroy(disc);Destroy(sphere);Destroy(warningMaterial);Destroy(blastMaterial);}
  static void Destroy(UnityEngine.Object o){if(!o)return;if(Application.isPlaying)UnityEngine.Object.Destroy(o);else UnityEngine.Object.DestroyImmediate(o);}
 }
}
