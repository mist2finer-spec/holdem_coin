using System;using System.Collections.Generic;using Newtonsoft.Json.Linq;using UnityEngine;
namespace IslandGame {
 // One authoritative damage event -> flash, sound, bounded camera offset and pooled contact spark.
 public sealed class CombatFeedbackRouter:IDisposable {
  sealed class Flash {public Renderer renderer;public MaterialPropertyBlock saved=new MaterialPropertyBlock(),block=new MaterialPropertyBlock();public int colorId;public Color color;public float at=-100;public bool active;}
  sealed class Trail {public LineRenderer line;public Vector3[] points=new Vector3[4];public float[] times=new float[4];public int attack=-1;public bool active;}
  readonly GameObject root;readonly Material material;readonly AudioSource audio;readonly AudioClip clip;readonly AudioListener ownedListener;readonly BattleCameraController camera;readonly ViewPresentationCoordinator profile;readonly Func<string,Transform> resolve;
  readonly Dictionary<string,Flash[]> targets=new Dictionary<string,Flash[]>();readonly Trail[] trails=new Trail[3];readonly LineRenderer[] sparks=new LineRenderer[6];readonly float[] sparkAt=new float[6];readonly Vector3[] sparkPoints=new Vector3[9];
  int lastEvent=-1,lastLightning=-1,nextSpark;float hitAt=-100,soundAt=-100;string session;
  public bool FlashEnabled=true,SoundEnabled=true,CameraEnabled=true,DecorationsEnabled=true;
  public int ConsumedContacts{get;private set;}public int LastAttackId{get;private set;}public int LastStrike{get;private set;}public float LastContactAt{get;private set;}public float MaximumLateSeconds{get;private set;}
  public CombatFeedbackRouter(GameObject host,BattleCameraController rig,ViewPresentationCoordinator profiles,Func<string,Transform> targetResolver){
   camera=rig;profile=profiles;resolve=targetResolver;root=new GameObject("Combat feedback · pooled");root.transform.SetParent(host.transform,false);
   if(rig&&rig.view&&UnityEngine.Object.FindObjectsByType<AudioListener>(FindObjectsSortMode.None).Length==0)ownedListener=rig.view.gameObject.AddComponent<AudioListener>();
   var settings=Resources.Load<BattleDioramaSettings>("BattleDioramaSettings");material=settings&&settings.transparent?new Material(settings.transparent):new Material(Shader.Find("Sprites/Default"));if(material.HasProperty("_BaseMap"))material.SetTexture("_BaseMap",null);if(material.HasProperty("_BaseColor"))material.SetColor("_BaseColor",Color.white);
   for(int i=0;i<3;i++){trails[i]=new Trail{line=Line("Decorative trail "+i,4)};trails[i].line.enabled=false;}
   for(int i=0;i<sparks.Length;i++){sparks[i]=Line("Contact spark "+i,9);sparks[i].enabled=false;sparkAt[i]=-100;}
   audio=root.AddComponent<AudioSource>();audio.playOnAwake=false;audio.spatialBlend=0;audio.volume=.16f;
   const int rate=22050;var samples=new float[1764];var random=new System.Random(9027);for(int i=0;i<samples.Length;i++){float t=(float)i/rate,envelope=Mathf.Pow(1-(float)i/samples.Length,2);samples[i]=(Mathf.Sin(t*2*Mathf.PI*(130-40*t))*.65f+((float)random.NextDouble()*2-1)*.17f)*envelope;}clip=AudioClip.Create("Original contact thump",samples.Length,1,rate,false);clip.SetData(samples,0);audio.clip=clip;
  }
  LineRenderer Line(string name,int count){var g=new GameObject(name);g.layer=30;g.transform.SetParent(root.transform,false);var l=g.AddComponent<LineRenderer>();l.sharedMaterial=material;l.positionCount=count;l.useWorldSpace=true;l.widthMultiplier=.02f;l.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;l.receiveShadows=false;return l;}
  Flash[] Target(string id){if(targets.TryGetValue(id,out var cached))return cached;var target=resolve(id);if(!target)return null;var rs=target.GetComponentsInChildren<Renderer>();var list=new List<Flash>();foreach(var r in rs){if(!r.sharedMaterial||r is LineRenderer)continue;int property=Shader.PropertyToID(r.sharedMaterial.HasProperty("_BaseColor")?"_BaseColor":"_Color");if(!r.sharedMaterial.HasProperty(property))continue;var f=new Flash{renderer=r,colorId=property,color=r.sharedMaterial.GetColor(property)};r.GetPropertyBlock(f.saved);r.GetPropertyBlock(f.block);list.Add(f);}cached=list.ToArray();targets[id]=cached;return cached;}
  public void Update(JObject state,float time){
   string id=(string)state["id"];if(session!=id){Reset();session=id;}
   foreach(var strike in state["fx"] as JArray??Empty){if((string)strike["kind"]!="elemental-strike"||(bool?)strike["blocked"]==true)continue;int key=(int?)strike["id"]??0;float born=NativeCombatPresentation.N(strike["born"]);if(key<=lastLightning||time<born)continue;lastLightning=key;if(time-born<.24f)hitAt=Mathf.Max(hitAt,born);}
   foreach(var token in state["fx"] as JArray??Empty){if((string)token["kind"]!="damage"||token["attackId"]==null||token["contactAt"]==null)continue;int eventId=(int?)token["id"]??0;float contact=(float)token["contactAt"];if(eventId<=lastEvent||time<contact)continue;lastEvent=eventId;float late=time-contact;MaximumLateSeconds=Mathf.Max(MaximumLateSeconds,late);if(late>.45f)continue;
    hitAt=contact;LastAttackId=(int)token["attackId"];LastStrike=(int?)token["strike"]??0;LastContactAt=contact;ConsumedContacts++;
    var target=Target((string)token["target"]??"hero");if(target!=null)foreach(var f in target)f.at=contact;
    if(SoundEnabled&&time-soundAt>=.04f){audio.volume=profile.SoundVolume;audio.Play();soundAt=time;}
    var p=token["point"];if(p!=null){int n=nextSpark++%sparks.Length;var center=new Vector3(NativeCombatPresentation.N(p["x"])/100,NativeCombatPresentation.N(p["y"])/100,(NativeCombatPresentation.N(p["z"])-5000)/100);for(int i=0;i<9;i++){float angle=i*Mathf.PI/4;sparkPoints[i]=center+new Vector3(Mathf.Cos(angle),Mathf.Sin(angle),0)*.11f;}sparks[n].SetPositions(sparkPoints);sparkAt[n]=contact;}
   }
   foreach(var ts in targets.Values)foreach(var f in ts){if(!f.renderer)continue;float age=time-f.at,amount=FlashEnabled&&age>=0?Mathf.Clamp01(1-age/Mathf.Max(.001f,profile.FlashSeconds)):0;if(amount>0){f.block.SetColor(f.colorId,Color.Lerp(f.color,new Color(1,.85f,.7f),amount*profile.FlashStrength));f.renderer.SetPropertyBlock(f.block);f.active=true;}else if(f.active){f.renderer.SetPropertyBlock(f.saved);f.active=false;}}
   bool low=IslandFrameBudget.Current&&IslandFrameBudget.Current.Policy.Level>=1;
   for(int i=0;i<sparks.Length;i++){float age=time-sparkAt[i];sparks[i].enabled=DecorationsEnabled&&!low&&age>=0&&age<.14f;if(sparks[i].enabled){var c=new Color(1,.8f,.4f,1-age/.14f);sparks[i].startColor=sparks[i].endColor=c;}}
   float hitAge=time-hitAt,a=CameraEnabled&&hitAge>=0&&hitAge<.18f?Mathf.Pow(1-hitAge/.18f,2):0;
   if(camera)camera.SetPresentationImpact(new Vector3(Mathf.Sin(hitAge*93),Mathf.Sin(hitAge*71)*.6f,0)*a*profile.Shake,-profile.FovPunch*a);
  }
  public void Smear(int index,int attack,bool active,Vector3 tip,float time){var t=trails[index];bool low=IslandFrameBudget.Current&&IslandFrameBudget.Current.Policy.Level>=1;active&=DecorationsEnabled&&!low;
   if(!active){t.line.enabled=false;t.active=false;return;}if(!t.active||t.attack!=attack){for(int i=0;i<4;i++){t.points[i]=tip;t.times[i]=time;}t.attack=attack;t.active=true;}
   if(time-t.times[0]>.012f){for(int i=3;i>0;i--){t.points[i]=t.points[i-1];t.times[i]=t.times[i-1];}t.points[0]=tip;t.times[0]=time;}
   for(int i=0;i<4;i++)t.line.SetPosition(i,time-t.times[i]<=profile.SmearLife?t.points[i]:tip);
   t.line.startWidth=profile.SmearWidth;t.line.endWidth=.008f;t.line.startColor=new Color(1,.84f,.45f,profile.SmearOpacity);t.line.endColor=new Color(1,.84f,.45f,0);t.line.enabled=profile.SmearOpacity>.01f;
  }
  void Reset(){lastEvent=lastLightning=-1;hitAt=soundAt=-100;foreach(var ts in targets.Values)foreach(var f in ts)if(f.renderer){f.renderer.SetPropertyBlock(f.saved);f.at=-100;f.active=false;}foreach(var t in trails){t.active=false;t.line.enabled=false;}for(int i=0;i<sparks.Length;i++){sparks[i].enabled=false;sparkAt[i]=-100;}if(camera)camera.SetPresentationImpact(Vector3.zero,0);audio.Stop();}
  static readonly JArray Empty=new JArray();
  public void Dispose(){Reset();if(ownedListener)UnityEngine.Object.Destroy(ownedListener);UnityEngine.Object.Destroy(root);UnityEngine.Object.Destroy(material);UnityEngine.Object.Destroy(clip);targets.Clear();}
 }
}
