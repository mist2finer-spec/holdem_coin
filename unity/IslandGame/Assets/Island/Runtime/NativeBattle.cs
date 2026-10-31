using System;
using System.Collections.Generic;
using UnityEngine;
using Spine;
using Spine.Unity;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 public sealed class NativeBattle : MonoBehaviour {
  public RpgSession session;public RenderTexture Output{get;private set;}
  Camera view;GameObject world;JObject index;string sessionId;readonly Dictionary<string,SkeletonAnimation> actors=new Dictionary<string,SkeletonAnimation>();
  readonly Dictionary<string,string> keys=new Dictionary<string,string>();readonly List<UnityEngine.Object> owned=new List<UnityEngine.Object>();
  void Awake(){var data=Resources.Load<TextAsset>("AssetIndex");if(data)index=JObject.Parse(data.text);Output=new RenderTexture(720,720,24);owned.Add(Output);
   var cameraObject=new GameObject("Native battle camera");cameraObject.transform.SetParent(transform);view=cameraObject.AddComponent<Camera>();view.orthographic=true;view.orthographicSize=2.6f;view.backgroundColor=new Color(.025f,.035f,.03f);view.clearFlags=CameraClearFlags.SolidColor;view.targetTexture=Output;view.cullingMask=1<<30;
  }
  public void Clear(){if(world)Destroy(world);actors.Clear();keys.Clear();foreach(var item in owned)if(item&&item!=Output)Destroy(item);owned.RemoveAll(item=>item!=Output);sessionId=null;}
  void NewWorld(){Clear();world=new GameObject("Authoritative battle view");world.transform.SetParent(transform);sessionId=(string)session.State["id"];
   var map=session.Map;
   if(map!=null){foreach(var room in (JArray)map["rooms"]){float x1=(room.Value<float>("x1"))*48,x2=(room.Value<float>("x2")+1)*48,e=room.Value<float>("elevation");Backdrop(x1,x2,e);}
    foreach(var gate in (JArray)map["gates"]){foreach(var ledge in (JArray)gate["ledges"]){var go=GameObject.CreatePrimitive(PrimitiveType.Quad);go.name="Climb landing ledge";go.transform.SetParent(world.transform);go.layer=30;go.transform.position=new Vector3(ledge.Value<float>("x")/100,ledge.Value<float>("elevation")/100-.05f,1);go.transform.localScale=new Vector3(.32f,.1f,1);var m=new Material(Shader.Find("Unlit/Color"));m.color=new Color(.35f,.30f,.22f);owned.Add(m);go.GetComponent<Renderer>().sharedMaterial=m;Destroy(go.GetComponent<Collider>());}}
   }else Backdrop(0,5000,0);
  }
  void Backdrop(float from,float to,float elevation){
   var data=Resources.Load<TextAsset>("WebAssets/rpg/maps/candle-dungeon/layout");if(!data)return;var layout=JObject.Parse(data.text);float sourceScale=1680f/(layout.Value<float>("endPixel")-layout.Value<float>("startPixel"));
   float nativeWidth=layout["size"][0].Value<float>()*sourceScale,height=layout["size"][1].Value<float>()*sourceScale,ground=layout.Value<float>("groundY")*sourceScale;
   float u1=((from%1680)+layout.Value<float>("startPixel")*sourceScale)/nativeWidth,u2=u1+(to-from)/nativeWidth;
   for(int layer=0;layer<2;layer++){
    var texture=Resources.Load<Texture2D>("WebAssets/rpg/maps/candle-dungeon/"+(layer==0?"background":"foreground"));if(!texture)continue;
    var go=new GameObject(layer==0?"Original corridor mesh bake":"Original foreground");go.layer=30;go.transform.SetParent(world.transform);go.transform.position=new Vector3(from/100,(elevation+ground-height)/100,layer==0?4:-1);
    var mesh=new Mesh();mesh.vertices=new[]{Vector3.zero,new Vector3((to-from)/100,0,0),new Vector3((to-from)/100,height/100,0),new Vector3(0,height/100,0)};mesh.uv=new[]{new Vector2(u1,0),new Vector2(u2,0),new Vector2(u2,1),new Vector2(u1,1)};mesh.triangles=new[]{0,2,1,0,3,2};mesh.RecalculateBounds();owned.Add(mesh);
    go.AddComponent<MeshFilter>().sharedMesh=mesh;var material=new Material(Shader.Find("Unlit/Transparent"));material.mainTexture=texture;owned.Add(material);go.AddComponent<MeshRenderer>().sharedMaterial=material;
   }
  }
  SkeletonAnimation Actor(string id,string path){SkeletonAnimation actor;if(actors.TryGetValue(id,out actor))return actor;
   var json=Resources.Load<TextAsset>("WebAssets/rpg/"+path);string directory=System.IO.Path.GetDirectoryName(path).Replace('\\','/');var atlases=Resources.LoadAll<SpineAtlasAsset>("WebAssets/rpg/"+directory);
   if(!json||atlases.Length==0){Debug.LogError("Missing imported Spine assets: "+path);return null;}
   var data=SkeletonDataAsset.CreateRuntimeInstance(json,atlases,true);owned.Add(data);actor=SkeletonAnimation.NewSkeletonAnimationGameObject(data);actor.gameObject.layer=30;foreach(Transform child in actor.transform)child.gameObject.layer=30;actor.transform.SetParent(world.transform,false);actors[id]=actor;return actor;
  }
  void DrawActor(string id,string path,string action,float x,float elevation,float height,float facing,string serial,float age=-1,float duration=0){
   var a=Actor(id,path);if(!a)return;var animation=a.Skeleton.Data.FindAnimation(action);if(animation==null)animation=a.Skeleton.Data.FindAnimation("stay1")??a.Skeleton.Data.Animations.Items[0];
   string key=path+":"+animation.Name+":"+serial;string previous;if(!keys.TryGetValue(id,out previous)||previous!=key){a.AnimationState.SetAnimation(0,animation,action.StartsWith("run")||action.StartsWith("stay"));keys[id]=key;}
   a.Skeleton.ScaleX=Mathf.Sign(facing==0?1:facing);float baseHeight=a.Skeleton.Data.Height;if(baseHeight<=0)baseHeight=100;float scale=height/baseHeight/100;a.transform.localScale=Vector3.one*scale;
   if(age>=0&&duration>0){var track=a.AnimationState.GetCurrent(0);track.TrackTime=Mathf.Min(animation.Duration,age/duration*animation.Duration);}
   a.AnimationState.Apply(a.Skeleton);a.Skeleton.UpdateWorldTransform(Spine.Physics.Pose);
   var feet=id=="hero"?new HashSet<string>{"Rleg","Lleg2"}:new HashSet<string>();
   if(id!="hero")foreach(var profile in ((JObject)index["monsters"]).Properties())if((string)profile.Value["skeleton"]==path){foreach(var foot in profile.Value["groundSlots"] as JArray??new JArray())feet.Add(foot.Value<string>());break;}
   float low=float.PositiveInfinity;
   foreach(var slot in a.Skeleton.Slots){if(!feet.Contains(slot.Data.Name))continue;float[] vertices;
    var mesh=slot.Attachment as MeshAttachment;var region=slot.Attachment as RegionAttachment;
    if(mesh!=null){vertices=new float[mesh.WorldVerticesLength];mesh.ComputeWorldVertices(slot,0,vertices.Length,vertices,0,2);}else if(region!=null){vertices=new float[8];region.ComputeWorldVertices(slot,vertices,0,2);}else continue;
    for(int n=1;n<vertices.Length;n+=2)low=Mathf.Min(low,vertices[n]);
   }
   a.transform.position=new Vector3(x/100,elevation/100-(float.IsInfinity(low)?0:low*scale),0);
  }
  void LateUpdate(){if(session==null||session.State==null){if(world)world.SetActive(false);return;}if(index==null)return;if(sessionId!=(string)session.State["id"])NewWorld();world.SetActive(true);
   var state=session.State;bool campaign=state["hero"]==null;var hero=campaign?state:(JObject)state["hero"];float x=hero.Value<float>("x"),e=hero.Value<float?>("elevation")??0,air=hero.Value<float?>("airHeight")??0;
   string weapon=campaign?state.Value<string>("weapon")??"axe":"axe",path=index["heroes"]?[weapon]?.Value<string>()??"characters/hong/native-axe/hong";
   var motion=campaign?state["motion"]:hero["motion"];float elapsed=state.Value<float>("elapsed"),start=motion?[campaign?"startedAt":"start"]?.Value<float>()??elapsed,duration=motion?["duration"]?.Value<float>()??0;
   DrawActor("hero",path,hero.Value<string>("action")??"stay1",x,e+air,88,hero.Value<float?>("facing")??1,(hero["serial"]??hero["actionSerial"]??0).ToString(),elapsed-start,duration);
   var shown=new HashSet<string>{"hero"};foreach(var m in (JArray)(state[campaign?"enemies":"mobs"]??new JArray())){
    if((m.Value<float?>("hp")??0)<=0)continue;int species=m.Value<int?>(campaign?"actorType":"species")??0;var profile=index["monsters"]?[species.ToString()];if(profile==null)continue;float mx=m.Value<float>("x"),height=0;
    if(!campaign)height=session.Map["rooms"][m.Value<int>("room")].Value<float>("elevation");
    string id="mob"+(m["id"]??m["slot"]??0),mode=m.Value<string>("state")??"idle",clip=profile["clips"]?[mode=="windup"?"attack":mode=="walk"?"move":"idle"]?.Value<string>()??"stay1";
    DrawActor(id,profile.Value<string>("skeleton"),clip,mx,height,m.Value<bool?>("boss")==true?94:40,mx>x?-1:1,mode);shown.Add(id);
   }
   foreach(var a in actors)a.Value.gameObject.SetActive(shown.Contains(a.Key));
   var target=new Vector3(x/100,e/100+.8f,-10);view.transform.position=Vector3.Lerp(view.transform.position,target,1-Mathf.Exp(-Time.unscaledDeltaTime*12));
  }
  void OnDestroy(){foreach(var o in owned)if(o)Destroy(o);}
 }
}
