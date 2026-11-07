using System;
using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 public sealed class UnityBossPresentation:IDisposable {
  readonly UnityBossAssets assets;readonly GameObject root,bossRoot,bossModel,bridge,warning,explosion;readonly Mesh disc,sphere;readonly Transform hips,leftFoot,rightFoot;readonly float scale,sole;
  ViewPresentationCoordinator presentation;readonly Transform visualRoot;public void SetPresentation(ViewPresentationCoordinator value){presentation=value;}
  readonly RuntimeAnimationPlayer animation;float previousVisualTime;JObject map;readonly Material warningMaterial,blastMaterial;int explosionId=-1;
  readonly Transform[] contactBones=new Transform[4];
  public Vector3 ContactPoint(int n)=>contactBones[n]?contactBones[n].TransformPoint(n%2==1?BossContactProfile.HandOffsets[n/2]:Vector3.zero):Vector3.zero;
  public Transform BossTarget=>bossRoot.transform;public bool BossVisible=>bossRoot.activeSelf;
  public Transform WarningTarget=>warning.transform;public bool HookActive{get;private set;}
  public string BossClipName{get;private set;}public float BossSampleTime{get;private set;}
  public UnityBossPresentation(Transform parent,UnityBossAssets a,JObject mapData){
   BossContactProfile.Load();map=mapData;assets=a;root=new GameObject("Unity boss encounter presentation");root.transform.SetParent(parent,false);
   bossRoot=new GameObject("Giant Boss 1");bossRoot.transform.SetParent(root.transform,false);bossRoot.layer=30;visualRoot=new GameObject("Presentation deformation (grounded)").transform;visualRoot.SetParent(bossRoot.transform,false);bossModel=UnityEngine.Object.Instantiate(a.boss,visualRoot,false);bossModel.name="Boss model";
   foreach(var r in bossModel.GetComponentsInChildren<Renderer>()){r.sharedMaterial=a.bossMaterial;r.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.On;}
   foreach(var t in bossModel.GetComponentsInChildren<Transform>(true)){t.gameObject.layer=30;if(t.name=="Hips")hips=t;if(t.name=="Foot.L")leftFoot=t;if(t.name=="Foot.R")rightFoot=t;}
   var contactNames=new[]{"Forearm.R","Hand.R","Forearm.L","Hand.L"};foreach(var t in bossModel.GetComponentsInChildren<Transform>(true))for(int i=0;i<4;i++)if(t.name==contactNames[i])contactBones[i]=t;
   animation=new RuntimeAnimationPlayer(bossModel,.18f);animation.Sample(a.idle?a.idle:a.combo,0);scale=a.bossHeight/a.bossReferenceHeight;var skin=bossModel.GetComponentInChildren<SkinnedMeshRenderer>();sole=(leftFoot&&rightFoot?Mathf.Min(leftFoot.position.y,rightFoot.position.y):0)-skin.bounds.min.y;bossRoot.SetActive(false);
   // Bridge is part of the authored Nature map; never duplicate or resize it.

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
   if(show){bossRoot.transform.localPosition=new Vector3(N(boss["x"])/100,N(boss["elevation"])/100,(N(boss["y"])-N(map?["laneY"],192))/100);bossRoot.transform.localRotation=Quaternion.Euler(0,Mathf.Atan2(N(boss["direction"]?["x"],-1),N(boss["direction"]?["y"]))*Mathf.Rad2Deg,0);
    var motion=boss["motion"] as JObject;string action=(string)boss["action"];var clip=action=="throw"?assets.throwClip:action=="combo"?assets.combo:action=="walk"?assets.walk:assets.idle;float time=motion==null?Mathf.Repeat(visualTime,clip.length):Mathf.Clamp01((visualTime-N(motion["start"]))/Mathf.Max(.001f,N(motion["duration"])))*clip.length;
    float phase=time/clip.length;HookActive=action=="combo"&&(BossContactProfile.Active(phase,0)||BossContactProfile.Active(phase,1));
    if(action=="combo"&&presentation!=null)time=CombatPoseTiming.Limited(phase,.18f,.84f,presentation.SidePoseWeight)*clip.length;
    visualRoot.localScale=Vector3.one;animation.Sample(clip,time,Mathf.Clamp(visualTime-previousVisualTime,0,.1f),action=="combo"?(phase>=.18f&&phase<=.84f?CombatPoseBlend.AttackContact:CombatPoseBlend.AttackEntry):CombatPoseBlend.Locomotion);bossModel.transform.localScale=Vector3.one*scale;bossModel.transform.localPosition=Vector3.zero;
    float feet=0;if(leftFoot&&rightFoot)feet=Mathf.Min(bossRoot.transform.InverseTransformPoint(leftFoot.position).y,bossRoot.transform.InverseTransformPoint(rightFoot.position).y)-sole*scale;
    Vector3 pelvis=hips?bossRoot.transform.InverseTransformPoint(hips.position):Vector3.zero;bossModel.transform.localPosition=new Vector3(-pelvis.x,-feet,-pelvis.z);if(action=="combo"&&presentation!=null)visualRoot.localScale=presentation.Scale(phase,.18f,.84f);BossClipName=clip.name;BossSampleTime=time;
   }
   previousVisualTime=visualTime;var w=state["warning"] as JObject;warning.SetActive(w!=null);if(w!=null){float radius=N(w["radius"])/100;warning.transform.localPosition=new Vector3(N(w["x"])/100,NativeCombatPresentation.UnityGroundHeight(map,N(w["x"]),N(w["z"])/100)/100+.035f,N(w["z"])/100);warning.transform.localScale=new Vector3(radius,1,radius);float age=Mathf.Clamp01((visualTime-N(w["born"]))/Mathf.Max(.01f,N(w["explodeAt"])-N(w["born"])));warningMaterial.color=new Color(1,.82f,.015f,.22f+age*.35f);}
   JObject latest=null;foreach(var f in state["fx"] as JArray??new JArray())if((string)f["kind"]=="explosion")latest=f as JObject;
   float blastAge=latest==null?10:visualTime-N(latest["born"]);bool blast=blastAge>=0&&blastAge<.55f;explosion.SetActive(blast);if(blast){explosionId=(int)N(latest["id"]);float radius=N(latest["radius"])/100;explosion.transform.localPosition=new Vector3(N(latest["x"])/100,NativeCombatPresentation.UnityGroundHeight(map,N(latest["x"]),N(latest["z"])/100)/100+.6f,N(latest["z"])/100);float s=Mathf.Lerp(.2f,radius*2,Mathf.Clamp01(blastAge/.3f));explosion.transform.localScale=new Vector3(s,s*.65f,s);blastMaterial.color=new Color(1,.28f,.025f,Mathf.Clamp01(1-blastAge/.55f)*.8f);}
  }
  static float N(JToken t,float fallback=0)=>NativeCombatPresentation.N(t,fallback);
  static Mesh Disc(){const int count=64;var v=new Vector3[count+1];var colors=new Color[count+1];var indices=new int[count*3];colors[0]=new Color(1,1,1,.18f);for(int i=0;i<count;i++){float a=i*Mathf.PI*2/count;v[i+1]=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a));colors[i+1]=Color.white;indices[i*3]=0;indices[i*3+1]=i+1;indices[i*3+2]=(i+1)%count+1;}var mesh=new Mesh{name="Warning ground disc"};mesh.vertices=v;mesh.colors=colors;mesh.triangles=indices;mesh.RecalculateBounds();mesh.RecalculateNormals();return mesh;}
  public void Dispose(){animation.Dispose();Destroy(root);Destroy(disc);Destroy(sphere);Destroy(warningMaterial);Destroy(blastMaterial);}
  static void Destroy(UnityEngine.Object o){if(!o)return;if(Application.isPlaying)UnityEngine.Object.Destroy(o);else UnityEngine.Object.DestroyImmediate(o);}
 }
}
