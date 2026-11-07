using System;
using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 // Consumes authoritative contact events once. It never emits gameplay damage or changes timeScale.
 public sealed class BossContactFeedback:IDisposable {
  sealed class Target {public Renderer renderer;public MaterialPropertyBlock saved=new MaterialPropertyBlock(),flash=new MaterialPropertyBlock();public int colorId;public Color color;}
  readonly AudioListener ownedListener;readonly Target[] targets;readonly AudioSource audio;readonly AudioClip clip;readonly BattleCameraController camera;int lastEvent=-1;float hitAt=-100;bool flashing;
  public bool FlashEnabled=true,SoundEnabled=true,CameraEnabled=true;public int ConsumedContacts{get;private set;}public int LastAttackId{get;private set;}public float LastContactAt{get;private set;}
  public BossContactFeedback(GameObject host,Transform hero,BattleCameraController rig){camera=rig;if(rig&&rig.view&&UnityEngine.Object.FindObjectsByType<AudioListener>(FindObjectsSortMode.None).Length==0)ownedListener=rig.view.gameObject.AddComponent<AudioListener>();var renderers=hero.GetComponentsInChildren<SkinnedMeshRenderer>();targets=new Target[renderers.Length];for(int i=0;i<targets.Length;i++){var r=renderers[i];int id=Shader.PropertyToID(r.sharedMaterial.HasProperty("_BaseColor")?"_BaseColor":"_Color");var t=new Target{renderer=r,colorId=id,color=r.sharedMaterial.GetColor(id)};r.GetPropertyBlock(t.saved);r.GetPropertyBlock(t.flash);targets[i]=t;}
   audio=host.AddComponent<AudioSource>();audio.playOnAwake=false;audio.spatialBlend=0;audio.volume=.16f;audio.maxDistance=20;const int rate=22050;var samples=new float[1764];var random=new System.Random(9027);for(int i=0;i<samples.Length;i++){float t=(float)i/rate,envelope=Mathf.Pow(1-(float)i/samples.Length,2);samples[i]=(Mathf.Sin(t*2*Mathf.PI*(130-40*t))*.65f+((float)random.NextDouble()*2-1)*.17f)*envelope;}clip=AudioClip.Create("Original short contact thump",samples.Length,1,rate,false);clip.SetData(samples,0);
  }
  public void Update(JObject state,float time){foreach(var token in state["fx"] as JArray??Empty){int id=(int?)token["id"]??0;if(id<=lastEvent||(string)token["kind"]!="boss-hook")continue;float contact=(float?)token["contactAt"]??-100;if(time<contact)continue;lastEvent=id;if(time-contact>.45f)continue;hitAt=contact;LastAttackId=(int?)token["attackId"]??0;LastContactAt=contact;ConsumedContacts++;if(SoundEnabled)audio.PlayOneShot(clip);}
   float age=time-hitAt,amount=FlashEnabled&&age>=0&&age<.24f?1-age/.24f:0;
   if(amount>0){foreach(var t in targets){t.flash.SetColor(t.colorId,Color.Lerp(t.color,new Color(1,.78f,.65f),amount*.7f));t.renderer.SetPropertyBlock(t.flash);}flashing=true;}else if(flashing){foreach(var t in targets)t.renderer.SetPropertyBlock(t.saved);flashing=false;}
   if(camera){float a=CameraEnabled&&age>=0&&age<.22f?Mathf.Pow(1-age/.22f,2)*.055f:0;camera.ImpactOffset=new Vector3(Mathf.Sin(age*93)*a,Mathf.Sin(age*71)*a*.6f,0);}
  }
  static readonly JArray Empty=new JArray();
  public void Dispose(){if(ownedListener)UnityEngine.Object.Destroy(ownedListener);foreach(var t in targets)if(t.renderer)t.renderer.SetPropertyBlock(t.saved);if(camera)camera.ImpactOffset=Vector3.zero;if(audio)UnityEngine.Object.Destroy(audio);if(clip)UnityEngine.Object.Destroy(clip);}
 }
}
