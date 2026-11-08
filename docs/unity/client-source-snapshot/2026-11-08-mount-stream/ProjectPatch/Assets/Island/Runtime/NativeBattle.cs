using System;
using System.Collections.Generic;
using UnityEngine;
using Spine;
using Spine.Unity;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 [DefaultExecutionOrder(-100)]
 public sealed class NativeBattle : MonoBehaviour {
  readonly NativeHeroWalkFilter walkFilter=new NativeHeroWalkFilter();
  readonly NativeHeroRollPresentation rollPresentation=new NativeHeroRollPresentation();
  readonly HashSet<string> shownActors=new HashSet<string>();
  public RpgSession session;public RenderTexture Output{get;private set;}
  Battle3DView threeD; public bool Uses3D=>threeD && threeD.assets;
  Camera view;GameObject world;JObject index;string sessionId;readonly Dictionary<string,SkeletonAnimation> actors=new Dictionary<string,SkeletonAnimation>();
  readonly Dictionary<string,string> actorPaths=new Dictionary<string,string>();readonly Dictionary<string,SkeletonDataAsset> actorData=new Dictionary<string,SkeletonDataAsset>();
  readonly Dictionary<string,string> keys=new Dictionary<string,string>();readonly List<UnityEngine.Object> owned=new List<UnityEngine.Object>();
  NativeCombatClock clock=new NativeCombatClock();JObject lastSnapshot,combatProfile;double lastVisual;bool lastPlaying;float frameAdvance;float viewportAspect=1;
  readonly Dictionary<string,float> bodyHeights=new Dictionary<string,float>();
  public float VisualTime{get;private set;} public float AuthorityTime{get;private set;} public float HeroTrackTime{get;private set;} public float HeroGroundError{get;private set;} public float HeroBodyHeight{get;private set;} public float HeroWorldX{get;private set;} public float HeroAirHeight{get;private set;}public string HeroAction{get;private set;}
  public BattleCameraController CameraRig{get;private set;}
  int mountRoom=-1;bool cameraPoseReady;float previousCameraHeroX;
  CameraHorizontalWidthLock widthLock;Mesh landingMesh;
  public bool DirectPresentationActive {get;private set;}
  public Camera BattleCamera=>view;
  public bool OverridePresentationView;public ViewMode PresentationView=ViewMode.Side25D;
  public void SetPresentationView(ViewMode? mode){OverridePresentationView=mode.HasValue;if(mode.HasValue)PresentationView=mode.Value;}
  public ViewPresentationCoordinator ViewPresentation=>threeD?threeD.Presentation:null;
  public void ConfigureViewport(float aspect){
   if(!view||!Output||aspect<=0)return;RestoreTexturePresentation();
   if(Mathf.Abs(aspect-viewportAspect)>.001f){
    viewportAspect=aspect;int height=Mathf.RoundToInt(720/aspect),width=720;
    if(height>2048){width=Mathf.Max(1,Mathf.RoundToInt(width*2048f/height));height=2048;}
    if(Output.width!=width||Output.height!=height){Output.Release();Output.width=width;Output.height=Mathf.Max(1,height);Output.Create();}
   }
   view.aspect=aspect;if(CameraRig&&Uses3D)CameraRig.ApplyProjection();else if(widthLock)widthLock.Apply();else view.orthographicSize=3.2f/aspect;
  }
  public void ConfigureScreenViewport(Rect rect){
   if(!view||rect.width<=0||rect.height<=0)return;if(DirectPresentationActive&&view.rect==rect)return;
   DirectPresentationActive=true;view.targetTexture=null;view.rect=rect;view.ResetAspect();if(CameraRig&&Uses3D)CameraRig.ApplyProjection();else if(widthLock)widthLock.Apply();
  }
  public void RestoreTexturePresentation(){
   if(!view||!DirectPresentationActive)return;DirectPresentationActive=false;view.targetTexture=Output;view.rect=new Rect(0,0,1,1);view.aspect=viewportAspect;if(CameraRig&&Uses3D)CameraRig.ApplyProjection();else if(widthLock)widthLock.Apply();
  }
  void Awake(){var data=Resources.Load<TextAsset>("AssetIndex");if(data)index=JObject.Parse(data.text);var profile=Resources.Load<TextAsset>("VardianCombatProfile");if(profile)combatProfile=JObject.Parse(profile.text);Output=new RenderTexture(720,720,24);owned.Add(Output);
   var pivotObject=new GameObject("CameraPivot");pivotObject.transform.SetParent(transform,false);var cameraObject=new GameObject("Main Camera");cameraObject.transform.SetParent(pivotObject.transform,false);view=cameraObject.AddComponent<Camera>();view.orthographic=true;view.orthographicSize=3.2f;view.backgroundColor=new Color(.025f,.035f,.03f);view.clearFlags=CameraClearFlags.SolidColor;view.targetTexture=Output;view.cullingMask=1<<30;
   var models=Resources.Load<Battle3DAssets>("Battle3DAssets");if(models&&models.hero&&models.slime){threeD=gameObject.AddComponent<Battle3DView>();threeD.assets=models;widthLock=cameraObject.AddComponent<CameraHorizontalWidthLock>();widthLock.enabled=false;CameraRig=pivotObject.AddComponent<BattleCameraController>();CameraRig.externallyDriven=true;CameraRig.maxBossDistance=40;CameraRig.Bind(view);}
  }
  public void Clear(){mountRoom=-1;OverridePresentationView=false;heroProjection.Reset();bossMovement.Reset();cameraPoseReady=false;if(CameraRig){CameraRig.SetViewMode(ViewMode.Side25D);CameraRig.ResetPose();}rollPresentation.Reset();walkFilter.Reset();landingMesh=null;if(threeD)threeD.Clear();if(world)Destroy(world);actors.Clear();actorPaths.Clear();actorData.Clear();keys.Clear();bodyHeights.Clear();clock=new NativeCombatClock();lastSnapshot=null;lastVisual=0;foreach(var item in owned)if(item&&item!=Output)Destroy(item);owned.RemoveAll(item=>item!=Output);sessionId=null;}
  void NewWorld(){Clear();world=new GameObject("Authoritative battle view");world.transform.SetParent(transform);sessionId=(string)session.State["id"];
   var map=session.Map;
   if(Uses3D){threeD.Build(world.transform,map,view);return;}
   if(map!=null){foreach(var room in (JArray)map["rooms"]){float x1=(room.Value<float>("x1"))*48,x2=(room.Value<float>("x2")+1)*48,e=room.Value<float>("elevation");Backdrop(x1,x2,e);}
    foreach(var gate in (JArray)map["gates"]){foreach(var ledge in (JArray)gate["ledges"]){if(!landingMesh){landingMesh=IslandDisplayMeshes.Create(PrimitiveType.Quad);owned.Add(landingMesh);}var go=new GameObject("Climb landing ledge",typeof(MeshFilter),typeof(MeshRenderer));go.GetComponent<MeshFilter>().sharedMesh=landingMesh;go.transform.SetParent(world.transform);go.layer=30;go.transform.position=new Vector3(ledge.Value<float>("x")/100,ledge.Value<float>("elevation")/100-.05f,1);go.transform.localScale=new Vector3(.32f,.1f,1);var m=new Material(Shader.Find("Unlit/Color"));m.color=new Color(.35f,.30f,.22f);owned.Add(m);go.GetComponent<Renderer>().sharedMaterial=m;}}
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
  SkeletonAnimation Actor(string id,string path){SkeletonAnimation actor;if(actors.TryGetValue(id,out actor)){
    if(actorPaths[id]==path)return actor;
    Destroy(actor.gameObject);actors.Remove(id);actorPaths.Remove(id);keys.Remove(id);bodyHeights.Remove(id);
    SkeletonDataAsset old;if(actorData.TryGetValue(id,out old)){owned.Remove(old);Destroy(old);actorData.Remove(id);}
   }
   var json=Resources.Load<TextAsset>("WebAssets/rpg/"+path);string directory=System.IO.Path.GetDirectoryName(path).Replace('\\','/');var atlases=Resources.LoadAll<SpineAtlasAsset>("WebAssets/rpg/"+directory);
   if(!json||atlases.Length==0){Debug.LogError("Missing imported Spine assets: "+path);return null;}
   var data=SkeletonDataAsset.CreateRuntimeInstance(json,atlases,true);owned.Add(data);actor=SkeletonAnimation.NewSkeletonAnimationGameObject(data);actor.gameObject.layer=30;foreach(Transform child in actor.transform)child.gameObject.layer=30;actor.transform.SetParent(world.transform,false);actor.UpdateTiming=UpdateTiming.ManualUpdate;actor.updateWhenInvisible=UpdateMode.FullUpdate;actor.AnimationState.Data.DefaultMix=.06f;
   var idle=actor.Skeleton.Data.FindAnimation("stay1")??actor.Skeleton.Data.Animations.Items[0];actor.AnimationState.SetAnimation(0,idle,true);actor.AnimationState.Apply(actor.Skeleton);actor.Skeleton.UpdateWorldTransform(Spine.Skeleton.Physics.Pose);bodyHeights[id]=MeasureBody(actor.Skeleton,id=="hero");actors[id]=actor;actorPaths[id]=path;actorData[id]=data;return actor;
  }
  static float[] Vertices(Slot slot){if(slot.Attachment is MeshAttachment mesh){var v=new float[mesh.WorldVerticesLength];mesh.ComputeWorldVertices(slot,0,v.Length,v,0,2);return v;}if(slot.Attachment is RegionAttachment region){var v=new float[8];region.ComputeWorldVertices(slot,v,0,2);return v;}return null;}
  static float MeasureBody(Skeleton skeleton,bool hero){
   float low=float.PositiveInfinity,high=float.NegativeInfinity;
   foreach(var slot in skeleton.Slots){if(hero&&slot.Data.Name!="head"&&slot.Data.Name!="body"&&slot.Data.Name!="Rleg"&&slot.Data.Name!="Lleg2")continue;var v=Vertices(slot);if(v==null)continue;for(int i=1;i<v.Length;i+=2){low=Mathf.Min(low,v[i]);high=Mathf.Max(high,v[i]);}}
   if(high>low)return high-low;
   if(hero)return MeasureBody(skeleton,false);return 1;
  }
  float NativeContact(string action,float duration){foreach(var stage in combatProfile?["combo"] as JArray??new JArray())if((string)stage["animation"]==action)return Mathf.Clamp(NativeCombatPresentation.N(stage["hitAt"]),0,duration);return duration*.45f;}
  void DrawActor(string id,string path,string action,float x,float elevation,float height,float facing,string serial,float age=-1,float duration=0,float hitAt=0,string kind=null){
   if(Uses3D&&(id=="hero"||path.Contains("Slime"))){float t=threeD.Draw(id,action,x,elevation,facing,serial,age,duration,hitAt,kind,frameAdvance,VisualTime);if(id=="hero"){HeroTrackTime=t;HeroGroundError=threeD.HeroGroundError;HeroBodyHeight=threeD.assets.heroHeight;HeroWorldX=x;HeroAction=action;}return;}
   var a=Actor(id,path);if(!a)return;action=NativeCombatPresentation.ClipName(action);var animation=a.Skeleton.Data.FindAnimation(action);if(animation==null)animation=a.Skeleton.Data.FindAnimation("stay1")??a.Skeleton.Data.Animations.Items[0];
   string key=path+":"+animation.Name+":"+serial;string previous;if(!keys.TryGetValue(id,out previous)||previous!=key){a.Skeleton.SetSlotsToSetupPose();a.AnimationState.SetAnimation(0,animation,animation.Name.Contains("run")||animation.Name.Contains("stay"));keys[id]=key;}
   a.Skeleton.ScaleX=Mathf.Sign(facing==0?1:facing);float scale=height/bodyHeights[id]/100;a.transform.localScale=Vector3.one*scale;
   a.AnimationState.TimeScale=id=="hero"&&animation.Name.Contains("run")?210f/180:1;a.AnimationState.Update(frameAdvance);
   var track=a.AnimationState.GetCurrent(0);
   if(age>=0&&duration>0&&(kind=="attack"||kind=="skill"))track.TrackTime=NativeCombatPresentation.MotionTime(age,duration,hitAt,animation.Duration,NativeContact(animation.Name,animation.Duration));
   else if(age>=0&&duration>0&&kind=="rush")track.TrackTime=Mathf.Clamp01(age/duration)*animation.Duration;
   a.AnimationState.Apply(a.Skeleton);a.Skeleton.UpdateWorldTransform(Spine.Skeleton.Physics.Pose);
   var feet=id=="hero"?new HashSet<string>{"Rleg","Lleg2"}:new HashSet<string>();
   if(id!="hero")foreach(var profile in ((JObject)index["monsters"]).Properties())if((string)profile.Value["skeleton"]==path){foreach(var foot in profile.Value["groundSlots"] as JArray??new JArray())feet.Add(foot.Value<string>());break;}
   float low=float.PositiveInfinity;foreach(var slot in a.Skeleton.Slots){if(!feet.Contains(slot.Data.Name))continue;var v=Vertices(slot);if(v==null)continue;for(int n=1;n<v.Length;n+=2)low=Mathf.Min(low,v[n]);}
   a.transform.position=new Vector3(x/100,elevation/100-(float.IsInfinity(low)?0:low*scale),0);
   if(id=="hero"){HeroTrackTime=track.TrackTime;HeroGroundError=float.IsInfinity(low)?0:a.transform.position.y+low*scale-elevation/100;HeroBodyHeight=bodyHeights[id]*scale;HeroWorldX=x;HeroAirHeight=NativeCombatPresentation.N((lastSnapshot?["hero"] as JObject)?["airHeight"]);HeroAction=animation.Name;}
  }
  readonly NativeHeroProjection heroProjection=new NativeHeroProjection();
  readonly BossMovementPresentation bossMovement=new BossMovementPresentation();
  void LateUpdate(){
   if(session==null||session.State==null){if(world)world.SetActive(false);return;}if(index==null)return;if(sessionId!=(string)session.State["id"])NewWorld();world.SetActive(true);
   var state=session.State;bool campaign=!(state["hero"] is JObject),playing=session.Active&&!session.Paused&&(bool?)state["paused"]!=true&&(string)state["status"]!="dead"&&(string)state["status"]!="won";
   double now=Time.unscaledTimeAsDouble;float elapsed=NativeCombatPresentation.N(state["elapsed"]);if(!ReferenceEquals(lastSnapshot,state)||lastPlaying!=playing){clock.Receive(elapsed,now,playing);lastSnapshot=state;lastPlaying=playing;}
   // Keep boss poses advancing across the measured serial response interval. The bound
   // prevents unlimited animation extrapolation during a disconnect; pause resets the clock.
   double leadLimit=(bool?)state["unityBossMode"]==true?Math.Max(.15,Math.Min(.45,session.LastResponseIntervalMilliseconds*.001+.03)):.15;
   double visual=clock.Sample(now,leadLimit);frameAdvance=Mathf.Clamp((float)(visual-lastVisual),0,.05f);lastVisual=visual;AuthorityTime=elapsed;VisualTime=(float)visual;
   float previewMove=session.Paused?0:session.Move,previewDepth=session.Paused?0:session.MoveY;
   if((bool?)state["unityBossMode"]==true&&session.Auto&&new Vector2(previewMove,previewDepth).magnitude<.1f&&(bool?)state["auto"]==true&&(string)state["hero"]?["action"]=="run1"){previewMove=NativeCombatPresentation.N(state["hero"]?["direction"]?["x"],1);previewDepth=NativeCombatPresentation.N(state["hero"]?["direction"]?["y"]);}
   var hero=campaign?state:heroProjection.Project(state,session.Map,VisualTime,previewMove,session.Auto,previewDepth);
   if(!campaign&&(bool?)state["unityBossMode"]==true)bossMovement.Apply(hero,state,session.Map,previewMove,previewDepth,Time.unscaledDeltaTime,now,session.LastResponseAt,session.LastRttMilliseconds,session.Paused);
   if(!campaign&&(bool?)state["unityBossMode"]!=true)walkFilter.Apply(hero,state,session.Map,previewMove,session.Auto,frameAdvance,session.Paused);
   if(!campaign&&Uses3D)rollPresentation.Apply(hero,state,VisualTime);
   if(!campaign&&(bool?)state["mountSunday"]==true){var p=MountRoute.Clamp(session.Map,state,new Vector2(NativeCombatPresentation.N(hero["x"]),NativeCombatPresentation.N(hero["y"])),session.PlanarMovement);NativeCombatPresentation.SetNumber(hero,"x",p.x);NativeCombatPresentation.SetNumber(hero,"y",p.y);}
   if(!campaign&&(bool?)state["mountSunday"]!=true&&(bool?)state["unityBossMode"]==true){BossContactProfile.ConstrainProjectedMotion(hero,state,session.Map);BossContactProfile.ClampBody(hero,state,session.Map);}
   float x=NativeCombatPresentation.N(hero["x"]),e=NativeCombatPresentation.N(hero["elevation"]),air=NativeCombatPresentation.N(hero["airHeight"]);
   string weapon=campaign?state.Value<string>("weapon")??"axe":state["progress"]?.Value<string>("weaponType")??"axe",path=index["heroes"]?[weapon]?.Value<string>()??"characters/hong/native-axe/hong";
   var motion=(campaign?state["motion"]:hero["motion"]) as JObject;float start=motion?.Value<float?>(campaign?"startedAt":"start")??elapsed,duration=motion?.Value<float?>("duration")??0;
   if(Uses3D){
    if((bool?)state["mountSunday"]==true){int room=(int)state["room"];MountZoneStream.Ensure().Bind(view,threeD.HeroTarget,room);if(mountRoom!=room){mountRoom=room;cameraPoseReady=false;CameraRig.ResetPose();}view.farClipPlane=650;}
    float depth=NativeCombatPresentation.N(hero["y"])-NativeCombatPresentation.N(session.Map?["laneY"],192);
    bool unity=(bool?)state["unityBossMode"]==true;
    if(unity)e=NativeCombatPresentation.UnityGroundHeight(session.Map,x,depth/100);
    threeD.HeroDepth=unity?depth/100:0;threeD.Planar=session.PlanarMovement;
    threeD.HeroHeading=Mathf.Atan2(NativeCombatPresentation.N(hero["direction"]?["x"],1),NativeCombatPresentation.N(hero["direction"]?["y"]))*Mathf.Rad2Deg;
    
    if(CameraRig){
     bool quarter=(string)state["cameraMode"]=="QuarterView";CameraRig.SetViewMode(OverridePresentationView?PresentationView:quarter?ViewMode.QuarterView:ViewMode.Side25D,(bool?)state["bossVisible"]==true?threeD.BossTarget:null);
     CameraRig.FacingWorld=new Vector2(NativeCombatPresentation.N(hero["direction"]?["x"],1),NativeCombatPresentation.N(hero["direction"]?["y"]));
     CameraRig.PrepareTransition(frameAdvance);threeD.PreparePresentation(state,hero,VisualTime,CameraRig);
     var warning=state["warning"] as JObject;CameraRig.WarningActive=warning!=null;
     if(warning!=null){float wx=NativeCombatPresentation.N(warning["x"]),wz=NativeCombatPresentation.N(warning["z"])/100,wr=NativeCombatPresentation.N(warning["radius"])/100;CameraRig.WarningBounds=new Bounds(new Vector3(wx/100,NativeCombatPresentation.UnityGroundHeight(session.Map,wx,wz)/100+.1f,wz),new Vector3(wr*2,.5f,wr*2));}
     int chamber=(int)NativeCombatPresentation.N(state["room"]);var chamberData=session.Map?["rooms"]?[chamber];bool combat=(string)state["phase"]=="combat"||(string)state["phase"]=="boss";
     CameraRig.SetChamberBounds(NativeCombatPresentation.N(chamberData?["x1"])*.48f,(NativeCombatPresentation.N(chamberData?["x2"])+1)*.48f,combat);
     float speed=cameraPoseReady?(x-previousCameraHeroX)/100/Mathf.Max(.001f,Time.unscaledDeltaTime):0;previousCameraHeroX=x;cameraPoseReady=true;
     CameraRig.SetPose(new Vector3(x/100,(e+air)/100,threeD.HeroDepth),NativeCombatPresentation.N(hero["facing"],1),e/100,Mathf.Clamp(speed,-20,20));
    }
    threeD.UpdateEncounter(state,VisualTime);threeD.BeginFrame(x);
   }
   DrawActor("hero",path,hero.Value<string>("action")??"stay1",x,e+air,88,hero.Value<float?>("facing")??1,(hero["serial"]??hero["actionSerial"]??0).ToString(),VisualTime-start,duration,motion?.Value<float?>("hitAt")??0,(string)motion?["kind"]);HeroAirHeight=air;
   var shown=shownActors;shown.Clear();shown.Add("hero");foreach(var m in state[campaign?"enemies":"mobs"] as JArray??new JArray()){
    if((bool?)m["unityBoss"]==true)continue;
    if(!campaign&&(int)NativeCombatPresentation.N(m["room"])!=(int)NativeCombatPresentation.N(state["room"]))continue;
    bool dead=NativeCombatPresentation.N(m["hp"])<=0;if(dead&&elapsed-NativeCombatPresentation.N(m["until"])>.5f)continue;
    int species=m.Value<int?>(campaign?"actorType":"species")??0;var profile=index["monsters"]?[species.ToString()];if(profile==null)continue;
    float mx=NativeCombatPresentation.N(m["x"]),height=NativeCombatPresentation.N(m["elevation"]);if(!campaign&&(bool?)state["unityBossMode"]!=true)height=NativeCombatPresentation.N(session.Map?["rooms"]?[(int)NativeCombatPresentation.N(m["room"])]?["elevation"]);
    string id="mob"+(m["id"]??m["slot"]??0),mode=m.Value<string>("state")??"idle",clip=dead?(string)profile["clips"]?["death"]:m.Value<string>("castClip")??profile["clips"]?[mode=="windup"?"attack":mode=="walk"?"move":"idle"]?.Value<string>()??"stay1";
    if(Uses3D&&!threeD.ShouldPresent(mx))continue;
    if(Uses3D)threeD.MobDepth=(bool?)state["mountSunday"]==true?(NativeCombatPresentation.N(m["y"])-NativeCombatPresentation.N(session.Map?["laneY"],5000))/100:0;DrawActor(id,profile.Value<string>("skeleton"),clip??"stay1",mx,height,m.Value<bool?>("boss")==true?94:species==1102?68:40,mx>x?-1:1,mode+(mode=="windup"?m["until"]?.ToString():""));shown.Add(id);
   }
   foreach(var actor in actors)actor.Value.gameObject.SetActive(shown.Contains(actor.Key));
   if(Uses3D){threeD.ShowOnly(shown);threeD.UpdateContact(state,VisualTime);threeD.Follow(view,x,e,frameAdvance);return;}
   var target=new Vector3(x/100,e/100+view.orthographicSize*.44f,-10);view.transform.position=Vector3.Lerp(view.transform.position,target,1-Mathf.Exp(-Time.unscaledDeltaTime*24));
  }
  public Vector2 ViewPoint(float x,float elevation,float depth=0){var p=view.WorldToViewportPoint(new Vector3(x/100,elevation/100,depth/100));return new Vector2(p.x,1-p.y);}
  void OnDestroy(){foreach(var o in owned)if(o)Destroy(o);}
 }
}

