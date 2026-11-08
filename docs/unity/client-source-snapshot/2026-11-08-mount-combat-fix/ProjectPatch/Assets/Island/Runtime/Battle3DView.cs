using System;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json.Linq;

namespace IslandGame {
 // Visual adapter only. The existing server, presentation clock and HUD own gameplay/time.
 public sealed class Battle3DView : MonoBehaviour {
  sealed class Actor {
   public GameObject root, model;public Transform presentationRoot,weapon;public RuntimeAnimationPlayer animation;
   public SkinnedMeshRenderer skin,occlusionSkin;
   public BattleGroundingProfile.Model grounding;
   public int lastSampleSlot=int.MinValue,phase;public bool placed;
   public Transform leftFoot,rightFoot,pelvis;
   public AnimationClip clip;
   public string serial;
   public float time, scale, baseFoot, soleOffset;
  }
  public Battle3DAssets assets;
  readonly Dictionary<string,Actor> actors=new Dictionary<string,Actor>();
  readonly Stack<Actor> slimePool=new Stack<Actor>();
  readonly List<string> retired=new List<string>();
  readonly Plane[] frustum=new Plane[6];
  Camera battleCamera;BattleGroundingProfile groundingProfile;bool hasFrustum;
  public const int MaximumPooledSlimes=16;
  public int PooledSlimes=>slimePool.Count;
  public int CreatedModels {get;private set;}
  public int ReusedModels {get;private set;}
  public int SampleCalls {get;private set;}
  public int CulledSamples {get;private set;}
  public int ThrottledSamples {get;private set;}
  readonly List<UnityEngine.Object> owned=new List<UnityEngine.Object>();
  readonly Dictionary<PrimitiveType,Mesh> displayMeshes=new Dictionary<PrimitiveType,Mesh>();
  Transform world;NatureAuthoredEnvironment authored;public float HeroDepth,HeroHeading,MobDepth;bool mountMode;public bool Planar;
  public NatureEnvironmentStream Stream{get;private set;}
  BossContactDebug contactDebug;CombatFeedbackRouter contactFeedback;BattleDioramaLook diorama;
  public BattleDioramaLook Diorama=>diorama;
  public CombatFeedbackRouter ContactFeedback=>contactFeedback;
  public ViewPresentationCoordinator Presentation{get;private set;}
  public int HeroAttackId{get;private set;}public float HeroAttackProgress{get;private set;}public bool HeroAttackActive{get;private set;}
  public Vector3 HeroWeaponBase=>actors.TryGetValue("hero",out var a)&&a.weapon?a.weapon.TransformPoint(new Vector3(0,.13f,0)):Vector3.zero;
  public Vector3 HeroWeaponTip=>actors.TryGetValue("hero",out var a)&&a.weapon?a.weapon.TransformPoint(new Vector3(0,.73f,0)):Vector3.zero;
  public void PreparePresentation(JObject state,JObject hero,float time,BattleCameraController rig){
   if(Presentation==null)Presentation=new ViewPresentationCoordinator();Presentation.Sync(rig);bossView?.SetPresentation(Presentation);
   var m=hero?["motion"] as JObject;HeroAttackId=(int?)m?["attackId"]??0;HeroAttackProgress=m==null?0:Mathf.Clamp01((time-NativeCombatPresentation.N(m["start"]))/Mathf.Max(.001f,NativeCombatPresentation.N(m["duration"])));
   HeroAttackActive=(string)m?["kind"]=="attack"&&HeroAttackProgress>=.32f&&HeroAttackProgress<=.58f;
  }
  Transform FeedbackTarget(string id){if(id=="boss")return BossTarget;if(actors.TryGetValue(id,out var a))return a.root.transform;return null;}
  public BossContactDebug ContactDebug=>contactDebug;
  public Transform HeroTarget=>actors.TryGetValue("hero",out var actor)?actor.root.transform:null;
  public void UpdateContact(JObject state,float visualTime){if(!HeroTarget)return;if(mountMode){if(contactFeedback==null)contactFeedback=new CombatFeedbackRouter(gameObject,battleCamera.GetComponentInParent<BattleCameraController>(),Presentation??(Presentation=new ViewPresentationCoordinator()),FeedbackTarget);contactFeedback.Update(state,visualTime);contactFeedback.Smear(0,HeroAttackId,HeroAttackActive,HeroWeaponTip,visualTime);return;}if(bossView==null)return;if(diorama)diorama.ProtectAttack(bossView.ContactPoint(1),bossView.ContactPoint(3),bossView.WarningTarget,bossView.BossVisible&&bossView.HookActive);if(contactFeedback==null)contactFeedback=new CombatFeedbackRouter(gameObject,battleCamera.GetComponentInParent<BattleCameraController>(),Presentation??(Presentation=new ViewPresentationCoordinator()),FeedbackTarget);contactFeedback.Update(state,visualTime);
   if(actors.TryGetValue("hero",out var readable)&&readable.occlusionSkin){
    // Imported skinned bounds include the full animation envelope and falsely cover nearby heroes.
    // Use the calibrated torso volume as a conservative gate; the shader checks actual rendered depth.
    bool blocked=false;if(bossView.BossVisible&&BossTarget&&battleCamera){var cameraPosition=battleCamera.transform.position;float height=bossAssets?bossAssets.bossHeight:6.5f;float radius=NativeCombatPresentation.N(state["bodyRadius"],140)/100;var bounds=new Bounds(BossTarget.position+Vector3.up*(height*.5f),new Vector3(radius*2,height,radius*2));
     for(int i=0;i<3&&!blocked;i++){var delta=HeroTarget.position+Vector3.up*(.2f+i*.4f)-cameraPosition;float distance=delta.magnitude;blocked=distance>.01f&&bounds.IntersectRay(new Ray(cameraPosition,delta/distance),out float near)&&near<distance-.15f;}
    }readable.occlusionSkin.enabled=blocked;
   }
   contactFeedback.Smear(0,HeroAttackId,HeroAttackActive,HeroWeaponTip,visualTime);
   var bm=BossContactProfile.Boss(state)?["motion"] as JObject;int bid=(int?)bm?["attackId"]??0;float bp=bm==null?0:(visualTime-NativeCombatPresentation.N(bm["start"]))/Mathf.Max(.001f,NativeCombatPresentation.N(bm["duration"]));
   for(int h=0;h<2;h++)contactFeedback.Smear(h+1,bid,bossView.BossVisible&&bossView.HookActive&&BossContactProfile.Active(bp,h),bossView.ContactPoint(h*2+1),visualTime);if(contactDebug==null)contactDebug=new BossContactDebug(world);contactDebug.Update(state,visualTime,bossView.BossTarget,HeroTarget,bossView.ContactPoint(0),bossView.ContactPoint(1),bossView.ContactPoint(2),bossView.ContactPoint(3),HeroWeaponBase,HeroWeaponTip,HeroAttackId,HeroAttackProgress,HeroAttackActive,Presentation.State.ToString());}
  UnityBossPresentation bossView;UnityBossAssets bossAssets;
  public Transform BossTarget=>bossView!=null?bossView.BossTarget:null;
  public string BossClipName=>bossView?.BossClipName;
  public void UpdateEncounter(JObject state,float visualTime){if(bossView!=null)bossView.Update(state,visualTime);}
  public string HeroClipName {get;private set;}
  public float HeroSampleTime {get;private set;}
  public float HeroGroundError {get;private set;}
  public int ActorCount=>actors.Count;
  Material ground,edge,bark,leaves,rock,steel,grip,shadow;
  public void Clear(){if(mountMode&&MountZoneStream.Current)MountZoneStream.Current.Release();mountMode=false;Presentation=null;HeroAttackId=0;HeroAttackActive=false;contactFeedback?.Dispose();contactFeedback=null;contactDebug?.Dispose();contactDebug=null;if(authored){authored.VisualChunkCreated-=OnVisualBranch;authored.VisualChunkRemoving-=OnVisualRemoving;}if(diorama){diorama.Dispose();diorama=null;}foreach(var a in actors.Values)a.animation?.Dispose();foreach(var a in slimePool)a.animation?.Dispose();if(authored){Destroy(authored.gameObject);authored=null;}if(bossView!=null){bossView.Dispose();bossView=null;}if(Stream!=null){Stream.Dispose();Stream=null;}actors.Clear();slimePool.Clear();displayMeshes.Clear();world=null;hasFrustum=false;foreach(var o in owned)if(o)Destroy(o);owned.Clear();}
  Material Mat(string name,Color color,float metallic=0){var m=new Material(Shader.Find("Standard")){name=name,color=color};m.SetFloat("_Glossiness",.2f);m.SetFloat("_Metallic",metallic);owned.Add(m);return m;}
  GameObject Shape(string name,PrimitiveType type,Transform parent,Vector3 p,Vector3 scale,Material material){
   Mesh mesh;if(!displayMeshes.TryGetValue(type,out mesh)){mesh=IslandDisplayMeshes.Create(type);displayMeshes.Add(type,mesh);owned.Add(mesh);}
   var go=new GameObject(name,typeof(MeshFilter),typeof(MeshRenderer));go.transform.SetParent(parent,false);go.transform.localPosition=p;go.transform.localScale=scale;go.layer=30;
   go.GetComponent<MeshFilter>().sharedMesh=mesh;go.GetComponent<MeshRenderer>().sharedMaterial=material;return go;
  }
  public void Build(Transform root,JObject map,Camera camera){
   IslandFrameBudget.Ensure(gameObject);
   bossAssets=Resources.Load<UnityBossAssets>("UnityBossAssets");
   world=root;actors.Clear();battleCamera=camera;groundingProfile=BattleGroundingProfile.Load();CreatedModels=ReusedModels=SampleCalls=CulledSamples=ThrottledSamples=0;
   ground=Mat("Moss · sage",new Color(.29f,.40f,.25f));edge=Mat("Earth · warm slate",new Color(.24f,.21f,.18f));
   bark=Mat("Bark · walnut",new Color(.23f,.16f,.12f));leaves=Mat("Canopy · pine",new Color(.13f,.28f,.22f));rock=Mat("Stone · blue slate",new Color(.32f,.39f,.40f));
   steel=Mat("Sword · silver",new Color(.73f,.83f,.84f),.55f);grip=Mat("Sword · leather",new Color(.22f,.10f,.15f));shadow=Mat("Contact shadow · moss",new Color(.13f,.21f,.14f));
   var sun=new GameObject("Battle 3D · warm key");sun.transform.SetParent(root,false);sun.transform.rotation=Quaternion.Euler(42,-32,0);
   var light=sun.AddComponent<Light>();light.type=LightType.Directional;light.color=new Color(1,.89f,.73f);light.intensity=.85f;light.shadows=LightShadows.Soft;light.cullingMask=1<<30;
   var fill=new GameObject("Battle 3D · cool fill");fill.transform.SetParent(root,false);fill.transform.rotation=Quaternion.Euler(35,150,0);var fl=fill.AddComponent<Light>();fl.type=LightType.Directional;fl.color=new Color(.58f,.75f,.84f);fl.intensity=.35f;fl.cullingMask=1<<30;
   var environmentAssets=Resources.Load<NatureEnvironmentAssets>("NatureEnvironmentAssets");
   mountMode=(bool?)map?["mountSunday"]==true;bool authoredMap=(bool?)map?["unityBossMode"]==true;
   if(authoredMap&&!mountMode){var scenery=new GameObject("Authored Nature Free map");scenery.transform.SetParent(root,false);authored=scenery.AddComponent<NatureAuthoredEnvironment>();authored.Initialize();}
   if(!authoredMap&&environmentAssets)Stream=new NatureEnvironmentStream(root,map,environmentAssets);
   if(Stream==null&&!authoredMap){
   if(map?["rooms"] is JArray rooms){
    for(int i=0;i<rooms.Count;i++){
     var r=rooms[i];float a=NativeCombatPresentation.N(r["x1"])*.48f,b=(NativeCombatPresentation.N(r["x2"])+1)*.48f,y=NativeCombatPresentation.N(r["elevation"])/100;
     Floor(a,b,y);
     // Background props never add collision or alter the server's walkable map.
     for(float x=a+1.2f;x<b;x+=2.8f){
      float z=1.6f+(i%3)*.24f;
      Shape("Forest trunk",PrimitiveType.Cylinder,root,new Vector3(x,y+1,z),new Vector3(.18f,1,.18f),bark);
      var tree=Shape("Forest canopy",PrimitiveType.Sphere,root,new Vector3(x,y+2.1f,z),new Vector3(1.1f,1.5f,.8f),leaves);tree.transform.localRotation=Quaternion.Euler(0,i*37,12);
      Shape("Trail stone",PrimitiveType.Sphere,root,new Vector3(x+.9f,y+.12f,1.0f),new Vector3(.45f,.3f,.32f),rock);
     }
    }
    if(map["gates"] is JArray gates)foreach(var gate in gates)if(gate["ledges"] is JArray ledges)foreach(var ledge in ledges){float x=NativeCombatPresentation.N(ledge["x"])/100,y=NativeCombatPresentation.N(ledge["elevation"])/100;Floor(x-.2f,x+.2f,y);}
   }else Floor(-10,60,0);
   }
   var nature=Resources.Load<NatureEnvironmentAssets>("NatureEnvironmentAssets");camera.backgroundColor=nature?nature.skyColor:new Color(.52f,.63f,.64f);if(!camera.GetComponentInParent<BattleCameraController>())camera.transform.rotation=Quaternion.Euler(9,0,0);camera.nearClipPlane=.1f;camera.farClipPlane=180;
   if((bool?)map?["unityBossMode"]==true&&bossAssets&&!mountMode)bossView=new UnityBossPresentation(root,bossAssets,map);
   
   IslandFrameBudget.Current.BindScenery(null);
   diorama=GetComponent<BattleDioramaLook>()??gameObject.AddComponent<BattleDioramaLook>();diorama.Initialize(world,camera);if(mountMode){var rig=camera.GetComponentInParent<BattleCameraController>();rig.side=new BattleCameraController.Preset(10,0,20,24,new Vector3(0,2,0));rig.quarter=new BattleCameraController.Preset(40,12,35,17,new Vector3(0,1.2f,1.8f));rig.lookAheadDistanceX=1.6f;rig.maxVelocityLookAhead=.7f;rig.velocityLookAheadMultiplier=.10f;rig.playerEdgePadding=1.2f;rig.lookAheadAccelSmoothTime=.08f;rig.verticalSmoothTime=.10f;rig.GetComponent<BattleForegroundOcclusion>().protectSideView=true;MountZoneStream.Ensure().Bind(camera,null,(int?)map["zone"]??0);}if(authored){authored.VisualChunkCreated+=OnVisualBranch;authored.VisualChunkRemoving+=OnVisualRemoving;}
  }
  void OnVisualBranch(Transform branch){if(diorama)diorama.ApplyBranch(branch);}
  void OnVisualRemoving(Transform branch){if(diorama)diorama.ForgetBranch(branch);}
  void Floor(float a,float b,float y){
   Shape("Server room · earth",PrimitiveType.Cube,world,new Vector3((a+b)/2,y-.35f,.5f),new Vector3(b-a,.65f,3),edge);
   Shape("Server room · grass lip",PrimitiveType.Cube,world,new Vector3((a+b)/2,y-.025f,.5f),new Vector3(b-a,.05f,3),ground);
  }
  Actor Create(string id,bool hero){
   if(!hero&&slimePool.Count>0){var pooled=slimePool.Pop();pooled.root.name=id+" · pooled slime visual";pooled.clip=null;pooled.serial=null;pooled.time=0;pooled.lastSampleSlot=int.MinValue;pooled.phase=Phase(id);pooled.placed=false;pooled.model.transform.localPosition=Vector3.zero;pooled.model.transform.localScale=Vector3.one*pooled.scale;pooled.root.SetActive(true);actors[id]=pooled;ReusedModels++;return pooled;}
   var prefab=hero?assets.hero:assets.slime;if(!prefab)return null;
   var root=new GameObject(hero?"Pink Glass · server hero":id+" · slime visual");root.transform.SetParent(world,false);
   var visual=new GameObject("Presentation deformation (grounded)");visual.transform.SetParent(root.transform,false);var model=Instantiate(prefab,visual.transform,false);model.name="Model";
   foreach(var t in model.GetComponentsInChildren<Transform>(true))t.gameObject.layer=30;root.layer=30;
   foreach(var animator in model.GetComponentsInChildren<Animator>())animator.enabled=false;
   var skin=model.GetComponentInChildren<SkinnedMeshRenderer>();
   var animation=new RuntimeAnimationPlayer(model);var clip=hero?assets.idle:assets.slimeIdle;if(clip)animation.Sample(clip,0);
   var profile=hero?groundingProfile?.Hero:groundingProfile?.Slime;
   if(profile!=null&&profile.Vertices!=skin.sharedMesh.vertexCount)profile=null;
   var bound=skin.localBounds;float height=Mathf.Max(.001f,profile!=null?profile.ReferenceHeight:bound.size.y*Mathf.Abs(skin.transform.lossyScale.y));
   if(profile!=null)skin.localBounds=profile.Bounds;
   var a=new Actor{root=root,model=model,presentationRoot=visual.transform,skin=skin,animation=animation,grounding=profile,phase=Phase(id),scale=(hero?assets.heroHeight:assets.slimeHeight*(mountMode?.5f:1f))/height};CreatedModels++;
   foreach(var renderer in model.GetComponentsInChildren<Renderer>()){
    renderer.sharedMaterial=hero?assets.heroMaterial:assets.slimeMaterial;
    renderer.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.On;renderer.receiveShadows=true;
   }
   skin.updateWhenOffscreen=false;
   foreach(var t in model.GetComponentsInChildren<Transform>()){
    if(t.name.EndsWith(":Hips"))a.pelvis=t;if(t.name.EndsWith(":LeftFoot"))a.leftFoot=t;if(t.name.EndsWith(":RightFoot"))a.rightFoot=t;
   }
   var low=skin.transform.TransformPoint(new Vector3(bound.center.x,bound.min.y,bound.center.z));
   a.baseFoot=profile!=null?profile.BaseFoot:root.transform.InverseTransformPoint(low).y;
   if(a.leftFoot&&a.rightFoot)a.soleOffset=Mathf.Min(root.transform.InverseTransformPoint(a.leftFoot.position).y,root.transform.InverseTransformPoint(a.rightFoot.position).y)-a.baseFoot;
   if(hero){
    Transform hand=null;foreach(var t in model.GetComponentsInChildren<Transform>())if(t.name.EndsWith(":RightHand")){hand=t;break;}
    if(hand){var sword=new GameObject("Presentation sword");a.weapon=sword.transform;sword.transform.SetParent(hand,false);sword.transform.localRotation=Quaternion.Euler(0,0,90);
     Shape("Leather grip",PrimitiveType.Cube,sword.transform,new Vector3(0,.02f,0),new Vector3(.055f,.18f,.055f),grip);
     Shape("Crossguard",PrimitiveType.Cube,sword.transform,new Vector3(0,.13f,0),new Vector3(.23f,.04f,.055f),steel);
     Shape("Blade",PrimitiveType.Cube,sword.transform,new Vector3(0,.43f,0),new Vector3(.075f,.60f,.025f),steel);
    }
   }
   Shape("Contact shadow",PrimitiveType.Cylinder,root.transform,new Vector3(0,.005f,0),new Vector3(hero?.48f:.6f,.004f,hero?.20f:.4f),shadow);
   if(diorama)diorama.ApplyBranch(root.transform);
   if(hero){var mat=Resources.Load<Material>("CombatPresentation/HeroOccluded");if(mat){
    // Reuse the original skin/bones. Depth-only visibility keeps the hero readable behind the boss.
    // Created once per actor; never BakeMesh, no extra animation graph or gameplay transform.
    var overlay=new GameObject("Occluded hero silhouette");overlay.layer=30;overlay.transform.SetParent(skin.transform,false);
    var silhouette=overlay.AddComponent<SkinnedMeshRenderer>();a.occlusionSkin=silhouette;silhouette.enabled=false;silhouette.sharedMesh=skin.sharedMesh;silhouette.bones=skin.bones;silhouette.rootBone=skin.rootBone;silhouette.localBounds=skin.localBounds;silhouette.quality=skin.quality;silhouette.updateWhenOffscreen=false;
    var materials=new Material[skin.sharedMesh.subMeshCount];for(int i=0;i<materials.Length;i++)materials[i]=mat;silhouette.sharedMaterials=materials;
    silhouette.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;silhouette.receiveShadows=false;silhouette.lightProbeUsage=UnityEngine.Rendering.LightProbeUsage.Off;silhouette.reflectionProbeUsage=UnityEngine.Rendering.ReflectionProbeUsage.Off;
   }}actors[id]=a;return a;
  }
  static int Phase(string id){unchecked{int h=17;foreach(char c in id)h=h*31+c;return h&0x7fffffff;}}
  public bool ShouldPresent(float coreX)=>!battleCamera||Mathf.Abs(coreX/100-battleCamera.transform.position.x)<14;
  public void BeginFrame(float heroX){if(authored)authored.Tick(new Vector3(heroX/100,0,HeroDepth),battleCamera);if(Stream!=null){var rig=battleCamera.GetComponentInParent<BattleCameraController>();Stream.ConfigureGround(rig&&rig.Mode!=ViewMode.Side25D?32:4,24,12);Stream.Tick(rig?rig.FocusWorldX:heroX/100,IslandFrameBudget.Current,rig?rig.VisibleGroundHalfWidth:6);}if(!battleCamera)return;GeometryUtility.CalculateFrustumPlanes(battleCamera,frustum);hasFrustum=true;}
  public float Draw(string id,string action,float x,float elevation,float facing,string serial,float age,float duration,float hitAt,string kind,float advance,float visualTime){
   bool hero=id=="hero";Actor a;if(!actors.TryGetValue(id,out a))a=Create(id,hero);if(a==null)return 0;
   var clip=hero&&bossAssets&&bossAssets.knockback&&(action=="knockback"||action=="knockdown"||action=="getup")?bossAssets.knockback:hero?assets.HeroClip(action):assets.slimeIdle;if(!clip)return 0;
   bool loop=!hero||clip==assets.idle||clip==assets.run||clip==assets.jumpLoop||clip==assets.slide;
   bool changed=a.clip!=clip||a.serial!=serial;
   if(a.clip!=clip||(!loop&&a.serial!=serial))a.time=0;
   a.clip=clip;a.serial=serial;
   // Distance-driven gait avoids skating at partial stick deflection and preserves phase on turns.
   float gaitAdvance=hero&&clip==assets.run&&a.placed?Mathf.Min(Vector2.Distance(new Vector2(x/100,HeroDepth),new Vector2(a.root.transform.position.x,a.root.transform.position.z))/(mountMode?3.8f:2.1f),Mathf.Max(0,advance)*2):advance;
   a.time+=Mathf.Max(0,gaitAdvance);
   float sample=loop?Mathf.Repeat(hero?a.time:visualTime,clip.length):Mathf.Min(a.time,clip.length);
   if(hero&&kind=="knockback"&&bossAssets&&clip==bossAssets.knockback)sample=Mathf.Clamp(age,0,clip.length);
   if(hero&&age>=0&&duration>0){
    if(kind=="attack"||kind=="skill"){
     float displayAge=age;
     if(kind=="attack"&&action=="attack1"&&Presentation!=null)displayAge=CombatPoseTiming.Limited(Mathf.Clamp01(age/duration),.32f,.58f,Presentation.SidePoseWeight)*duration;
     sample=NativeCombatPresentation.MotionTime(displayAge,duration,hitAt,clip.length,clip.length*.45f);
    }
    else if(kind=="rush"||kind=="dodge"||kind=="slide")sample=Mathf.Clamp01(age/duration)*clip.length;
   }
   var target=new Vector3(x/100,elevation/100,hero?HeroDepth:MobDepth);
   if(hero||!a.placed||Vector3.Distance(a.root.transform.position,target)>3)a.root.transform.position=target;
   else a.root.transform.position=Vector3.Lerp(a.root.transform.position,target,1-Mathf.Exp(-Mathf.Max(0,advance)*18));
   a.placed=true;a.root.transform.localScale=Vector3.one;
   var budget=IslandFrameBudget.Current;
   if(!hero){
    // A dedicated-camera bounds test avoids SceneView/isVisible and inactive-object traps.
    var bounds=a.skin.bounds;bounds.Expand(.6f);
    if(hasFrustum&&!GeometryUtility.TestPlanesAABB(frustum,bounds)){CulledSamples++;return sample;}
    float dx=battleCamera?Mathf.Abs(battleCamera.WorldToViewportPoint(a.root.transform.position).x-.5f):0;
    int rate=budget?budget.Policy.PoseHz(dx):dx<.25f?60:dx<.45f?30:15;
    int slot=Mathf.FloorToInt(visualTime*rate+(a.phase%997)/997f);
    if(!changed&&slot==a.lastSampleSlot){ThrottledSamples++;return sample;}
    if(budget&&!budget.AllowOptionalPose()){ThrottledSamples++;return sample;}a.lastSampleSlot=slot;
   }
   long poseStart=System.Diagnostics.Stopwatch.GetTimestamp();
   CombatPoseBlend policy=!hero?CombatPoseBlend.Locomotion:kind=="dodge"?CombatPoseBlend.DodgeCancel:kind=="knockback"?CombatPoseBlend.HitReaction:kind=="attack"?HeroAttackActive?CombatPoseBlend.AttackContact:HeroAttackProgress<.32f?CombatPoseBlend.AttackEntry:CombatPoseBlend.AttackRecovery:CombatPoseBlend.Locomotion;
   a.presentationRoot.localScale=Vector3.one;a.animation.Sample(clip,sample,advance,policy);SampleCalls++;if(!hero&&budget)budget.RecordPose(poseStart);
   // Mirror the side-on presentation without rotating the asymmetric rig through its back view.
   a.model.transform.localScale=new Vector3(a.scale,a.scale,a.scale*(hero&&!Planar&&facing<0?-1:1));
   a.model.transform.localRotation=Quaternion.Euler(0,hero?(Planar?HeroHeading:assets.heroYaw):0,0);
   a.model.transform.localPosition=Vector3.zero;
   float feet=a.baseFoot*a.scale,sourceHeight=0;
   bool cached=a.grounding!=null&&a.grounding.TryHeight(clip,sample,out sourceHeight);
   if(hero&&bossAssets&&clip==bossAssets.knockback&&bossAssets.knockbackGround.length>0){sourceHeight=bossAssets.knockbackGround.Evaluate(sample);cached=true;}
   if(cached)feet=sourceHeight*a.scale;
   else if(hero&&a.leftFoot&&a.rightFoot){
    var lp=a.root.transform.InverseTransformPoint(a.leftFoot.position);var rp=a.root.transform.InverseTransformPoint(a.rightFoot.position);
    feet=Mathf.Min(lp.y,rp.y)-a.soleOffset*a.scale;
   }
   if(hero&&a.pelvis){var p=a.root.transform.InverseTransformPoint(a.pelvis.position);a.model.transform.localPosition=new Vector3(-p.x,0,-p.z);}
   a.model.transform.localPosition+=Vector3.down*feet;

   if(!hero){
    float bounce=action.Contains("attack")?.06f:0;a.model.transform.localPosition+=Vector3.up*(Mathf.Abs(Mathf.Sin(visualTime*5))*bounce);
    if(action.Contains("death")||action.Contains("die"))a.model.transform.localScale=new Vector3(a.scale*1.25f,a.scale*.3f,a.scale*1.25f);
   }
   if(hero){if(kind=="attack"&&action=="attack1"&&Presentation!=null)a.presentationRoot.localScale=Presentation.Scale(HeroAttackProgress,.32f,.58f);HeroClipName=clip.name;HeroSampleTime=sample;HeroGroundError=a.model.transform.localPosition.y+feet;}
   return sample;
  }
  static Transform Find(Transform root,string name){foreach(var t in root.GetComponentsInChildren<Transform>())if(t.name==name)return t;return null;}
  public void ShowOnly(HashSet<string> shown){
   retired.Clear();foreach(var pair in actors){if(shown.Contains(pair.Key)){if(!pair.Value.root.activeSelf)pair.Value.root.SetActive(true);continue;}if(pair.Key=="hero"){pair.Value.root.SetActive(false);continue;}retired.Add(pair.Key);}
   foreach(var id in retired){var a=actors[id];actors.Remove(id);a.root.SetActive(false);if(slimePool.Count<MaximumPooledSlimes)slimePool.Push(a);else {if(diorama)diorama.ForgetBranch(a.root.transform);a.animation.Dispose();Destroy(a.root);}}
  }
  public void Follow(Camera camera,float x,float elevation,float delta){
   if(diorama)diorama.Tick(Planar?BossTarget:null);
   var rig=camera.GetComponentInParent<BattleCameraController>();if(rig){rig.Tick(delta);return;}
   var framing=camera.GetComponent<CameraHorizontalWidthLock>();
   var target=framing?framing.PositionForGround(new Vector3(x/100,elevation/100,0)):new Vector3(x/100,elevation/100+camera.orthographicSize*.70f+10*Mathf.Tan(9*Mathf.Deg2Rad),-10);
   camera.transform.position=Vector3.Lerp(camera.transform.position,target,1-Mathf.Exp(-delta*14));
  }
  void OnDestroy(){Clear();}
 }
}

