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
   public Transform leftFoot,rightFoot,pelvis,shoulder;
   public AnimationClip clip;
   public string serial;
   public float time, scale, baseFoot, soleOffset;
   public Battle3DAssets set;public bool kit;public Transform[] pins;public AnimationClip kitClip;public string kitSerial;public float kitSample;
   // Kit tempo clipMap of the current motion, read once when the serial changes (K6).
   public string mapSerial;public float[] mapAge,mapClip;public int mapCount;
   // K5: a kit skill that follows an attack cancel enters with the longer default blend.
   public string lastKind;public bool afterCancel;
   public Vector3 weaponBaseLocal=new Vector3(0,.13f,0),weaponTipLocal=new Vector3(0,.73f,0);
   public Transform contactShadow;public Vector3 contactShadowScale;
  }
  public Battle3DAssets assets;
  // Hero kit display (local test builds). assets = the kit asset when present; legacyAssets = the original hero for a snapshot without heroKit.
  public Battle3DAssets legacyAssets;public string HeroKit;public JObject HeroMotion;public float SnapshotElapsed;
  public bool KitHeroActive=>assets&&assets.IsKit&&HeroKit==assets.kit;
  Battle3DAssets HeroSet=>assets&&assets.IsKit&&!KitHeroActive&&legacyAssets?legacyAssets:assets;
  public float HeroHeight=>HeroSet?HeroSet.heroHeight:1.3f;
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
  // HeroAir: the jump / knockback height above the ground (m) included in the hero elevation Draw gets. HeroShadowOnGround (side view):
  // the hero contact shadow stays on the ground below it; off (quarter view) it keeps riding with the hero as before (see PlaceContactShadow).
  Transform world;NatureAuthoredEnvironment authored;public float HeroDepth,HeroHeading,MobDepth,HeroAir;public bool HeroShadowOnGround=true;bool mountMode,zoneTenArena;public bool Planar;
  public NatureEnvironmentStream Stream{get;private set;}
  ReferenceCombatVfx referenceVfx;BossContactDebug contactDebug;CombatFeedbackRouter contactFeedback;BattleDioramaLook diorama;
  public BattleDioramaLook Diorama=>diorama;
  public CombatFeedbackRouter ContactFeedback=>contactFeedback;
  public ViewPresentationCoordinator Presentation{get;private set;}
  public int HeroAttackId{get;private set;}public float HeroAttackProgress{get;private set;}public bool HeroAttackActive{get;private set;}
  // REV2-PORT-HOOK(BLADE-TRAIL): the trail follows these points; with the kit they come from the baked blade bone (guard / tip).
  public Vector3 HeroWeaponBase=>actors.TryGetValue("hero",out var a)&&a.weapon?a.weapon.TransformPoint(a.weaponBaseLocal):Vector3.zero;
  public Vector3 HeroWeaponTip=>actors.TryGetValue("hero",out var a)&&a.weapon?a.weapon.TransformPoint(a.weaponTipLocal):Vector3.zero;
  public void PreparePresentation(JObject state,JObject hero,float time,BattleCameraController rig){
   if(Presentation==null)Presentation=new ViewPresentationCoordinator();Presentation.Sync(rig);bossView?.SetPresentation(Presentation);
   var m=hero?["motion"] as JObject;HeroAttackId=(int?)m?["attackId"]??0;HeroAttackProgress=m==null?0:Mathf.Clamp01((time-NativeCombatPresentation.N(m["start"]))/Mathf.Max(.001f,NativeCombatPresentation.N(m["duration"])));
   var window=(m?["timeline"]?["active"] as JArray)?.Count>0?m["timeline"]["active"][0]:null;bool kitRow=m?["kit"]!=null&&window!=null;
   HeroAttackActive=(string)m?["kind"]=="attack"&&(kitRow?HeroAttackProgress>=NativeCombatPresentation.N(window["from"])&&HeroAttackProgress<=NativeCombatPresentation.N(window["to"]):HeroAttackProgress>=.32f&&HeroAttackProgress<=HeroMeleePose.ActiveTo((string)hero["action"]));
  }
  Transform FeedbackTarget(string id){if(id=="boss")return BossTarget;if(actors.TryGetValue(id,out var a))return a.root.transform;return null;}
  public BossContactDebug ContactDebug=>contactDebug;
  public bool BossEnvironmentReady=>!mountMode&&bossView!=null&&HeroTarget&&(zoneTenArena?MountZoneStream.Current&&MountZoneStream.Current.ActiveZone==9&&!MountZoneStream.Current.Busy&&MountZoneStream.Current.LoadedCount==1:authored&&authored.IsReadyNear(HeroTarget.position)&&(!MountZoneStream.Current||MountZoneStream.Current.LoadedCount==0));
  public Transform HeroTarget=>actors.TryGetValue("hero",out var actor)?actor.root.transform:null;
  // REV2-PORT-HOOK(HIT-FLASH): normal-zone hit flash/spark/sound/shake run in contactFeedback.Update (CombatFeedbackRouter); the test scene burst would be styled there.
  // REV2-PORT-HOOK(DEBUG-HITBOX): the normal-zone branch below has no hero/mob hitbox drawing (BossContactDebug is boss only); a kit hitbox view (test scene F4) goes here.
  // V2 (BLADE-TRAIL / HIT-FLASH): the kit hero in a normal zone uses IaiBladeVfx (arc, star, embers, 3rd hit, sheathe glint) instead of
  // the crescent, tip smear and contact spark. Zone 10 (boss branch below), the old hero and a missing kit keep the old effect.
  IaiBladeVfx iaiVfx;
  public void UpdateContact(JObject state,float visualTime){if(!HeroTarget)return;IaiAllocProbe.Begin();try{UpdateContactCore(state,visualTime);}finally{IaiAllocProbe.End();}}
  void UpdateContactCore(JObject state,float visualTime){if(referenceVfx==null)referenceVfx=new ReferenceCombatVfx(world);
   // boss-kit-hero-20261121: the kit hero in the boss fight (zone 10 / boss mode) uses the same blade effect; the old hero keeps the old one.
   bool iai=KitHeroActive&&IaiBladeVfx.Enabled&&battleCamera;if(iai&&iaiVfx==null)iaiVfx=new IaiBladeVfx();iai&=iaiVfx!=null&&iaiVfx.Ready;if(!iai&&iaiVfx!=null&&iaiVfx.Ready){iaiVfx.Dispose();iaiVfx=null;}if(iai)iaiVfx.PlanarYaw=Planar?HeroHeading-90:float.NaN;
   referenceVfx.SuppressHeroSlash=iai;referenceVfx.Update(state,visualTime,HeroTarget,HeroWeaponBase,HeroWeaponTip);if(mountMode){if(contactFeedback==null)contactFeedback=new CombatFeedbackRouter(gameObject,battleCamera.GetComponentInParent<BattleCameraController>(),Presentation??(Presentation=new ViewPresentationCoordinator()),FeedbackTarget);contactFeedback.SuppressKitSpark=iai;contactFeedback.Update(state,visualTime);contactFeedback.Smear(0,HeroAttackId,HeroAttackActive&&!iai,HeroWeaponTip,visualTime);if(iai)iaiVfx.Update(state,visualTime,battleCamera,HeroTarget,HeroWeaponBase,HeroWeaponTip,HeroHeight,HeroClipName,HeroSampleTime);return;}
   if(contactFeedback!=null)contactFeedback.SuppressKitSpark=false;if(bossView==null)return;if(diorama)diorama.ProtectAttack(bossView.ContactPoint(1),bossView.ContactPoint(3),bossView.WarningTarget,bossView.BossVisible&&bossView.HookActive);if(contactFeedback==null)contactFeedback=new CombatFeedbackRouter(gameObject,battleCamera.GetComponentInParent<BattleCameraController>(),Presentation??(Presentation=new ViewPresentationCoordinator()),FeedbackTarget);contactFeedback.SuppressKitSpark=iai;contactFeedback.Update(state,visualTime);
   if(actors.TryGetValue("hero",out var readable)&&readable.occlusionSkin){
    // Imported skinned bounds include the full animation envelope and falsely cover nearby heroes.
    // Use the calibrated torso volume as a conservative gate; the shader checks actual rendered depth.
    bool blocked=false;if(bossView.BossVisible&&BossTarget&&battleCamera){var cameraPosition=battleCamera.transform.position;float height=bossView.Height;float radius=NativeCombatPresentation.N(state["bodyRadius"],140)/100;var bounds=new Bounds(BossTarget.position+Vector3.up*(height*.5f),new Vector3(radius*2,height,radius*2));
     for(int i=0;i<3&&!blocked;i++){var delta=HeroTarget.position+Vector3.up*(.2f+i*.4f)-cameraPosition;float distance=delta.magnitude;blocked=distance>.01f&&bounds.IntersectRay(new Ray(cameraPosition,delta/distance),out float near)&&near<distance-.15f;}
    }readable.occlusionSkin.enabled=blocked;
   }
   contactFeedback.Smear(0,HeroAttackId,HeroAttackActive&&!iai,HeroWeaponTip,visualTime);if(iai)iaiVfx.Update(state,visualTime,battleCamera,HeroTarget,HeroWeaponBase,HeroWeaponTip,HeroHeight,HeroClipName,HeroSampleTime);
   var bm=BossContactProfile.Boss(state)?["motion"] as JObject;int bid=(int?)bm?["attackId"]??0;float bp=bm==null?0:(visualTime-NativeCombatPresentation.N(bm["start"]))/Mathf.Max(.001f,NativeCombatPresentation.N(bm["duration"]));
   for(int h=0;h<2;h++)contactFeedback.Smear(h+1,bid,bossView.BossVisible&&bossView.HookActive&&BossContactProfile.Active(bp,h),bossView.ContactPoint(h*2+1),visualTime);if(contactDebug==null)contactDebug=new BossContactDebug(world);contactDebug.Update(state,visualTime,bossView.BossTarget,HeroTarget,bossView.ContactPoint(0),bossView.ContactPoint(1),bossView.ContactPoint(2),bossView.ContactPoint(3),HeroWeaponBase,HeroWeaponTip,HeroAttackId,HeroAttackProgress,HeroAttackActive,Presentation.State.ToString());}
  UnityBossPresentation bossView;UnityBossAssets bossAssets;
  // Kit boss fight look (2026-11-21, user: the boss is too big): the zone-10 QuarterView preset used when the kit hero fights the boss.
  // The boss display height comes from the kernel (state bossScale: 3.2 m / 6.5 m with the kit, which also scales the boss hitbox).
  // The legacy hero option (bossHero "legacy") keeps the 6.5 m boss and the old preset.
  // Brief 4 (2026-11-22, user: "like the video, higher"): a high telephoto view like the reference (~55 deg, fixed, hero-centred). The rig's
  // heroCentricBoss framing (set below for the kit boss fight) keeps the hero, the warning disc and the boss feet in view and lets the boss
  // head leave the top. Editor sweep (1080x2340, one scripted fight): hero median 10.8 % (standing 11.3 %), warning disc and hero 100 %,
  // boss feet 100 % and below the top HUD. yaw 70 runs the hero-boss line (world x) diagonally up the portrait screen; 60 and 45 push the
  // camera out (the boss leaves the narrow portrait width). fov 12 (28.8 deg in portrait) at distance 14 = the old hero size with less
  // perspective. Before: (45,90,22,6,(-.6,.8,-.15)) with whole-boss framing.
  // Boss beams (2026-11-22, brief: "about twice as far, the portrait screen can show more"): same angle and lens, distance 14 -> 28,
  // so the hero is about half the screen height it was (editor fight median 11.6 % -> 6.2 %) and more of the arena and the beams is in view.
  // Camera diagonal brief 2 (2026-11-22, user: "a little more diagonal"): yaw 70 -> 55. yaw is Unity Euler y (0 = looking along +z, 90 = along
  // +x, the hero-boss line), so 45 is the world diagonal; 55 lays the arena floor and the hero-boss line diagonally across the portrait
  // screen (line ~50 deg from horizontal on screen, was ~66). Pitch, lens and distance unchanged (hero height does not depend on yaw).
  public static BattleCameraController.Preset KitBossQuarter=new BattleCameraController.Preset(55,55,12,28,new Vector3(-.8f,.8f,0));
  bool KitBoss=>assets&&assets.IsKit&&!Battle3DAssets.BossHeroLegacy;
  public Transform BossTarget=>bossView!=null?bossView.BossTarget:null;
  public string BossClipName=>bossView?.BossClipName;
  public float BossSampleTime=>bossView?.BossSampleTime??0;
  public void UpdateEncounter(JObject state,float visualTime){if(bossView!=null)bossView.Update(state,visualTime);}
  public string HeroClipName {get;private set;}
  public float HeroSampleTime {get;private set;}
  public float HeroGroundError {get;private set;}
  public LightningStrikeVfx Lightning=>referenceVfx?.Lightning;
  public void PresentLightning(JObject map,float time){referenceVfx?.PresentLightning(battleCamera,map,time,Presentation);}
  public int ActiveReferenceEffects=>referenceVfx?.ActiveEffects??0;public int ReferenceParticles=>referenceVfx?.ParticleCount??0;public int ActorCount=>actors.Count;
  Material ground,edge,bark,leaves,rock,steel,grip,shadow;
  public void Clear(){referenceVfx?.Dispose();referenceVfx=null;iaiVfx?.Dispose();iaiVfx=null;if((mountMode||zoneTenArena)&&MountZoneStream.Current)MountZoneStream.Current.Release();mountMode=zoneTenArena=false;Presentation=null;HeroAttackId=0;HeroAttackActive=false;contactFeedback?.Dispose();contactFeedback=null;contactDebug?.Dispose();contactDebug=null;if(authored){authored.VisualChunkCreated-=OnVisualBranch;authored.VisualChunkRemoving-=OnVisualRemoving;}if(diorama){diorama.Dispose();diorama=null;}foreach(var a in actors.Values)a.animation?.Dispose();foreach(var a in slimePool)a.animation?.Dispose();if(authored){Destroy(authored.gameObject);authored=null;}if(bossView!=null){bossView.Dispose();bossView=null;}if(Stream!=null){Stream.Dispose();Stream=null;}actors.Clear();slimePool.Clear();displayMeshes.Clear();world=null;hasFrustum=false;foreach(var o in owned)if(o)Destroy(o);owned.Clear();}
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
   var light=sun.AddComponent<Light>();light.type=LightType.Directional;light.color=new Color(1,.89f,.73f);light.intensity=.85f;light.shadows=LightShadows.Soft;light.cullingMask=1<<30;light.shadowBias=.035f;light.shadowNormalBias=.3f;light.shadowStrength=.85f;RenderSettings.sun=light;
   var fill=new GameObject("Battle 3D · cool fill");fill.transform.SetParent(root,false);fill.transform.rotation=Quaternion.Euler(35,150,0);var fl=fill.AddComponent<Light>();fl.type=LightType.Directional;fl.color=new Color(.58f,.75f,.84f);fl.intensity=.35f;fl.cullingMask=1<<30;
   var environmentAssets=Resources.Load<NatureEnvironmentAssets>("NatureEnvironmentAssets");
   mountMode=(bool?)map?["mountSunday"]==true;zoneTenArena=(bool?)map?["zoneTenArena"]==true;bool authoredMap=(bool?)map?["unityBossMode"]==true;
   if(authoredMap&&!mountMode&&!zoneTenArena){var scenery=new GameObject("Authored Nature Free map");scenery.transform.SetParent(root,false);authored=scenery.AddComponent<NatureAuthoredEnvironment>();authored.Initialize();}
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
   diorama=GetComponent<BattleDioramaLook>()??gameObject.AddComponent<BattleDioramaLook>();diorama.Initialize(world,camera);if(mountMode||zoneTenArena){var rig=camera.GetComponentInParent<BattleCameraController>();rig.side=new BattleCameraController.Preset(10,0,20,24,new Vector3(0,2,0));rig.quarter=zoneTenArena?(KitBoss?KitBossQuarter:new BattleCameraController.Preset(38,25,38,19,new Vector3(0,2.2f,.6f))):new BattleCameraController.Preset(40,35,35,17,new Vector3(0,1.2f,1.8f));rig.heroCentricBoss=zoneTenArena&&KitBoss;rig.fixedQuarterDistance=zoneTenArena&&KitBoss?KitBossQuarter.distance:0;rig.lookAheadDistanceX=1.6f;rig.maxVelocityLookAhead=.7f;rig.velocityLookAheadMultiplier=.10f;rig.playerEdgePadding=1.2f;rig.lookAheadAccelSmoothTime=.08f;rig.verticalSmoothTime=.10f;rig.GetComponent<BattleForegroundOcclusion>().protectSideView=true;MountZoneStream.Ensure().Bind(camera,null,(int?)map["zone"]??0);}if(authored){authored.VisualChunkCreated+=OnVisualBranch;authored.VisualChunkRemoving+=OnVisualRemoving;}
  }
  void OnVisualBranch(Transform branch){if(diorama)diorama.ApplyBranch(branch);}
  void OnVisualRemoving(Transform branch){if(diorama)diorama.ForgetBranch(branch);}
  void Floor(float a,float b,float y){
   Shape("Server room · earth",PrimitiveType.Cube,world,new Vector3((a+b)/2,y-.35f,.5f),new Vector3(b-a,.65f,3),edge);
   Shape("Server room · grass lip",PrimitiveType.Cube,world,new Vector3((a+b)/2,y-.025f,.5f),new Vector3(b-a,.05f,3),ground);
  }
  Actor Create(string id,bool hero){
   if(!hero&&slimePool.Count>0){var pooled=slimePool.Pop();pooled.root.name=id+" · pooled slime visual";pooled.clip=null;pooled.serial=null;pooled.time=0;pooled.lastSampleSlot=int.MinValue;pooled.phase=Phase(id);pooled.placed=false;pooled.model.transform.localPosition=Vector3.zero;pooled.model.transform.localScale=Vector3.one*pooled.scale;pooled.root.SetActive(true);actors[id]=pooled;ReusedModels++;return pooled;}
   var set=hero?HeroSet:assets;var prefab=hero?set.hero:assets.slime;if(!prefab)return null;bool kit=hero&&set.IsKit;
   var root=new GameObject(hero?"Pink Glass · server hero":id+" · slime visual");root.transform.SetParent(world,false);
   var visual=new GameObject("Presentation deformation (grounded)");visual.transform.SetParent(root.transform,false);var model=Instantiate(prefab,visual.transform,false);model.name="Model";
   if(kit)foreach(var s in model.GetComponentsInChildren<SkinnedMeshRenderer>(true)){var clean=CleanKitMesh(s.sharedMesh);if(clean)s.sharedMesh=clean;}
   foreach(var t in model.GetComponentsInChildren<Transform>(true))t.gameObject.layer=30;root.layer=30;
   foreach(var animator in model.GetComponentsInChildren<Animator>())animator.enabled=false;
   var skin=model.GetComponentInChildren<SkinnedMeshRenderer>();
   var animation=new RuntimeAnimationPlayer(model);var clip=hero?set.idle:assets.slimeIdle;if(clip)animation.Sample(clip,0);
   var profile=kit?null:hero?groundingProfile?.Hero:groundingProfile?.Slime;
   if(profile!=null&&profile.Vertices!=skin.sharedMesh.vertexCount)profile=null;
   var bound=skin.localBounds;float height=Mathf.Max(.001f,profile!=null?profile.ReferenceHeight:bound.size.y*Mathf.Abs(skin.transform.lossyScale.y));
   // Kit: the first skinned renderer is a hand, so the height is a bone height (idle pose, model root space; the root is the ground).
   Transform heightBone=kit&&!string.IsNullOrEmpty(set.heightBone)?Find(model.transform,set.heightBone):null;if(heightBone)height=Mathf.Max(.001f,model.transform.InverseTransformPoint(heightBone.position).y);
   if(profile!=null)skin.localBounds=profile.Bounds;
   var a=new Actor{root=root,model=model,presentationRoot=visual.transform,skin=skin,animation=animation,grounding=profile,phase=Phase(id),scale=(hero?set.heroHeight:assets.slimeHeight*(mountMode?.5f:1f))/height,set=set,kit=kit};CreatedModels++;
   foreach(var renderer in model.GetComponentsInChildren<Renderer>()){
    if(!(kit&&set.keepModelMaterials))renderer.sharedMaterial=hero?set.heroMaterial:assets.slimeMaterial;
    renderer.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.On;renderer.receiveShadows=true;
   }
   skin.updateWhenOffscreen=false;
   foreach(var t in model.GetComponentsInChildren<Transform>()){
    if(t.name.EndsWith(":RightArm"))a.shoulder=t;if(t.name.EndsWith(":Hips"))a.pelvis=t;if(t.name.EndsWith(":LeftFoot"))a.leftFoot=t;if(t.name.EndsWith(":RightFoot"))a.rightFoot=t;
   }
   var low=skin.transform.TransformPoint(new Vector3(bound.center.x,bound.min.y,bound.center.z));
   a.baseFoot=profile!=null?profile.BaseFoot:root.transform.InverseTransformPoint(low).y;
   if(a.leftFoot&&a.rightFoot)a.soleOffset=Mathf.Min(root.transform.InverseTransformPoint(a.leftFoot.position).y,root.transform.InverseTransformPoint(a.rightFoot.position).y)-a.baseFoot;
   if(kit){
    // Baked clips stand on the model root. Body clips (groundedClips) are pinned by their lowest bone instead; soleOffset = that height when standing.
    a.baseFoot=0;var pins=new List<Transform>();foreach(var t in model.GetComponentsInChildren<Transform>())if(!t.GetComponent<Renderer>()&&(t.name.EndsWith("Foot")||t.name.EndsWith("ToeBase")||t.name.EndsWith("Toe_End")||t.name.EndsWith(":Hips")||t.name.EndsWith(":Head")||t.name.EndsWith(":HeadTop_End")||t.name.EndsWith("Hand")))pins.Add(t);a.pins=pins.ToArray();
    float sole=float.PositiveInfinity;foreach(var t in a.pins)sole=Mathf.Min(sole,model.transform.InverseTransformPoint(t.position).y);a.soleOffset=float.IsInfinity(sole)?0:sole;
    var blade=string.IsNullOrEmpty(set.bladeBone)?null:set.bladeBone.Contains("/")?model.transform.Find(set.bladeBone):Find(model.transform,set.bladeBone);if(blade){a.weapon=blade;a.weaponBaseLocal=set.bladeGuardLocal;a.weaponTipLocal=set.bladeTipLocal;}
   }
   if(hero&&!kit){
    Transform hand=null;foreach(var t in model.GetComponentsInChildren<Transform>())if(t.name.EndsWith(":RightHand")){hand=t;break;}
    if(hand){var sword=new GameObject("Presentation sword");a.weapon=sword.transform;sword.transform.SetParent(hand,false);sword.transform.localRotation=Quaternion.Euler(0,0,90);
     Shape("Leather grip",PrimitiveType.Cube,sword.transform,new Vector3(0,.02f,0),new Vector3(.055f,.18f,.055f),grip);
     Shape("Crossguard",PrimitiveType.Cube,sword.transform,new Vector3(0,.13f,0),new Vector3(.23f,.04f,.055f),steel);
     Shape("Blade",PrimitiveType.Cube,sword.transform,new Vector3(0,.43f,0),new Vector3(.075f,.60f,.025f),steel);
    }
   }
   a.contactShadowScale=new Vector3(hero?.48f:.6f,.004f,hero?.20f:.4f);a.contactShadow=Shape("Contact shadow",PrimitiveType.Cylinder,root.transform,new Vector3(0,.005f,0),a.contactShadowScale,shadow).transform;
   if(diorama)diorama.ApplyBranch(root.transform);
   if(hero&&!kit){var mat=Resources.Load<Material>("CombatPresentation/HeroOccluded");if(mat){
    // Reuse the original skin/bones. Depth-only visibility keeps the hero readable behind the boss.
    // Created once per actor; never BakeMesh, no extra animation graph or gameplay transform.
    var overlay=new GameObject("Occluded hero silhouette");overlay.layer=30;overlay.transform.SetParent(skin.transform,false);
    var silhouette=overlay.AddComponent<SkinnedMeshRenderer>();a.occlusionSkin=silhouette;silhouette.enabled=false;silhouette.sharedMesh=skin.sharedMesh;silhouette.bones=skin.bones;silhouette.rootBone=skin.rootBone;silhouette.localBounds=skin.localBounds;silhouette.quality=skin.quality;silhouette.updateWhenOffscreen=false;
    var materials=new Material[skin.sharedMesh.subMeshCount];for(int i=0;i<materials.Length;i++)materials[i]=mat;silhouette.sharedMaterials=materials;
    silhouette.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;silhouette.receiveShadows=false;silhouette.lightProbeUsage=UnityEngine.Rendering.LightProbeUsage.Off;silhouette.reflectionProbeUsage=UnityEngine.Rendering.ReflectionProbeUsage.Off;
   }}actors[id]=a;return a;
  }
  // Contact shadow (camera-shadow-slide brief, 2026-11-23, user: "in the side view the shadow stays in the air when she jumps"): the disc
  // (from the old small hero) is a child of the actor root, and the root carries the jump / knockback height (Draw gets elevation + air), so
  // it rode up with the hero: in the side view a disc under the feet in mid-air. Side view: keep it on the ground under the hero (root -
  // air) and shrink it with height (1 -> .55 at 1.2 m). Standing (air 0): unchanged. The quarter view keeps the riding disc on purpose:
  // from the high 55 deg camera it sits by the feet and reads as the shadow the user called natural; on the ground it would be ~80 px
  // below the feet and hidden in the arena grass (Editor, apex).
  public static void PlaceContactShadow(Transform shadow,Vector3 baseScale,float air){
   air=Mathf.Max(0,air);float k=Mathf.Lerp(1,.55f,Mathf.Clamp01(air/1.2f));
   shadow.localPosition=new Vector3(0,.005f-air,0);shadow.localScale=new Vector3(baseScale.x*k,baseScale.y,baseScale.z*k);
  }
  // Kit hair stray chips (camera-shadow-slide brief, 2026-11-23, user: "something like particles behind her back while sliding"): the hair
  // mesh of the kit hero (PinkGlass_ArtLead_cloth_review.glb, SM_Hair) has three tiny islands (4 + 4 + 6 vertices, 100 % mixamorig:Head)
  // 15-20 cm below the hair, inside the jacket at the nape. In the slide pose the head pitches against the torso and they show behind the
  // back as floating specks. Display only: a copy of the mesh without the triangles of islands of at most StrayMaxVertices vertices whose
  // centre lies more than StrayMinGap (mesh units = m) outside the bounds of the mesh's biggest island. Vertices, weights and blend shapes
  // are kept. Checked over every kit mesh: only these three hair islands match (next nearest small island: 3.6 cm out). The source asset
  // is unchanged (the art fix belongs to the glb); once the glb drops them this finds nothing and the original mesh is used.
  public const int StrayMaxVertices=8;public const float StrayMinGap=.1f;
  static readonly Dictionary<Mesh,Mesh> cleanKitMeshes=new Dictionary<Mesh,Mesh>();
  static Mesh CleanKitMesh(Mesh source){if(!source||!source.isReadable)return null;if(cleanKitMeshes.TryGetValue(source,out var known)&&(ReferenceEquals(known,null)||known))return known;var clean=WithoutStrayIslands(source,out _,out _);cleanKitMeshes[source]=clean;return clean;}
  public static Mesh WithoutStrayIslands(Mesh source,out int removedVertices,out int removedTriangles){
   removedVertices=removedTriangles=0;if(!source||!source.isReadable)return null;var v=source.vertices;int n=v.Length;if(n==0)return null;
   var parent=new int[n];for(int i=0;i<n;i++)parent[i]=i;
   int Root(int i){while(parent[i]!=i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
   void Join(int a,int b){a=Root(a);b=Root(b);if(a!=b)parent[a]=b;}
   var at=new Dictionary<Vector3,int>(n);for(int i=0;i<n;i++){if(at.TryGetValue(v[i],out var j))Join(i,j);else at[v[i]]=i;}
   var tris=new int[source.subMeshCount][];for(int m=0;m<tris.Length;m++){tris[m]=source.GetTriangles(m);var t=tris[m];for(int i=0;i+2<t.Length;i+=3){Join(t[i],t[i+1]);Join(t[i+1],t[i+2]);}}
   var count=new Dictionary<int,int>();var sum=new Dictionary<int,Vector3>();for(int i=0;i<n;i++){int r=Root(i);count[r]=count.TryGetValue(r,out var c)?c+1:1;sum[r]=(sum.TryGetValue(r,out var p)?p:Vector3.zero)+v[i];}
   int big=-1;foreach(var e in count)if(big<0||e.Value>count[big])big=e.Key;
   var bounds=new Bounds(v[big],Vector3.zero);for(int i=0;i<n;i++)if(Root(i)==big)bounds.Encapsulate(v[i]);
   var drop=new HashSet<int>();foreach(var e in count)if(e.Key!=big&&e.Value<=StrayMaxVertices&&bounds.SqrDistance(sum[e.Key]/e.Value)>StrayMinGap*StrayMinGap){drop.Add(e.Key);removedVertices+=e.Value;}
   if(drop.Count==0)return null;
   var clean=Instantiate(source);clean.name=source.name+" (stray chips dropped)";
   for(int m=0;m<tris.Length;m++){var t=tris[m];var keep=new List<int>(t.Length);for(int i=0;i+2<t.Length;i+=3){if(drop.Contains(Root(t[i]))){removedTriangles++;continue;}keep.Add(t[i]);keep.Add(t[i+1]);keep.Add(t[i+2]);}clean.SetTriangles(keep,m,false);}
   return clean;
  }
  static int Phase(string id){unchecked{int h=17;foreach(char c in id)h=h*31+c;return h&0x7fffffff;}}
  public bool ShouldPresent(float coreX)=>!battleCamera||Mathf.Abs(coreX/100-battleCamera.transform.position.x)<14;
  public void BeginFrame(float heroX){if(authored)authored.Tick(new Vector3(heroX/100,0,HeroDepth),battleCamera);if(Stream!=null){var rig=battleCamera.GetComponentInParent<BattleCameraController>();Stream.ConfigureGround(rig&&rig.Mode!=ViewMode.Side25D?32:4,24,12);Stream.Tick(rig?rig.FocusWorldX:heroX/100,IslandFrameBudget.Current,rig?rig.VisibleGroundHalfWidth:6);}if(!battleCamera)return;GeometryUtility.CalculateFrustumPlanes(battleCamera,frustum);hasFrustum=true;}
  public float HeroRequestedSpeed;
  public float Draw(string id,string action,float x,float elevation,float facing,string serial,float age,float duration,float hitAt,string kind,float advance,float visualTime){
   bool hero=id=="hero";Actor a;
   // A snapshot without heroKit (server path without the kit, or the boss with bossHero legacy) shows the original hero: swap the kit model, and back.
   if(hero&&actors.TryGetValue(id,out a)&&a.set!=HeroSet){actors.Remove(id);if(diorama)diorama.ForgetBranch(a.root.transform);a.animation?.Dispose();Destroy(a.root);}
   if(!actors.TryGetValue(id,out a))a=Create(id,hero);if(a==null)return 0;
   var set=hero?a.set:assets;bool kit=hero&&a.kit;
   var clip=hero&&!kit&&bossAssets&&bossAssets.knockback&&(action=="knockback"||action=="knockdown"||action=="getup")?bossAssets.knockback:hero?set.HeroClip(action,kit?(string)HeroMotion?["after"]:null):assets.slimeIdle;if(!clip)return 0;
   // quarter-run-v1: the QuarterView shows the quarter run instead of the side run (kit only; Side25D unchanged).
   if(hero&&kit)clip=set.ViewClip(clip,Planar);
   bool loop=!hero||set.Loops(clip);
   bool changed=a.clip!=clip||a.serial!=serial;
   // Side <-> quarter while running: keep the gait phase (both cycles start on the left foot contact); the 0.12 s blend does the rest.
   if(hero&&kit&&a.clip!=clip&&set.IsRun(a.clip)&&set.IsRun(clip))a.time=Mathf.Repeat(a.time,a.clip.length)/a.clip.length*clip.length;
   else if(a.clip!=clip||(!loop&&a.serial!=serial))a.time=0;
   a.clip=clip;a.serial=serial;
   // Use intended stride as a floor: collision stops translation, not a held run cycle.
   // Partial stick input scales cadence; idle/action clips and pause keep their own clocks.
   float gaitAdvance=advance;
   // Stride: metres per run-clip second (kit: one baked cycle = runStrideMeters, port_manifest; original: 3.8).
   float stride=set.StridePerClipSecond(clip);
   if(hero&&set.IsRun(clip)&&a.placed){float dt=Mathf.Max(0,advance);float distance=Vector2.Distance(new Vector2(x/100,HeroDepth),new Vector2(a.root.transform.position.x,a.root.transform.position.z));gaitAdvance=Mathf.Min(Mathf.Max(distance,HeroRequestedSpeed*dt)/stride,dt*2);}
   a.time+=Mathf.Max(0,gaitAdvance);
   float sample=loop?Mathf.Repeat(hero?a.time:visualTime,clip.length):Mathf.Min(a.time,clip.length);
   if(hero&&kind=="knockback"&&(kit?clip==set.knockback:bossAssets&&clip==bossAssets.knockback))sample=Mathf.Clamp(age,0,clip.length);
   if(kit&&age>=0&&duration>0){
    if(kind=="attack"||kind=="recover"||kind=="skill"){
     // REV2-PORT-HOOK(READY-HOLD): kit clips are baked 1:1 with kernel time at tempo stage 0 (iai1 holds the ready entry, recover the hold/release). elapsed - start is the kernel age;
     // clipFrom 0.12 arrives as a start already moved back, so the sample begins at 0.12 and blends from the previous pose. No MotionTime remap.
     float clipAge=age;
     // REV2-PORT-HOOK(HITSTOP): during the kernel hitstop the motion start moves 0.02 s per tick; hold the snapshot clock so the pose does not shake.
     bool held=NativeCombatPresentation.N(HeroMotion?["hitstopUntil"],-1)>visualTime;
     if(held)clipAge=SnapshotElapsed-(visualTime-age);
     // K6 tempo: kernel age -> clip time by the motion's clipMap (stage 1/2 rows and recover). Read once per motion; no map = 1:1.
     if(a.mapSerial!=serial){a.mapSerial=serial;a.mapCount=NativeCombatPresentation.ReadClipMap(HeroMotion?["clipMap"] as JArray,ref a.mapAge,ref a.mapClip);}
     clipAge=NativeCombatPresentation.ClipAt(a.mapAge,a.mapClip,a.mapCount,clipAge);
     // Kernel and clip lengths differ by one frame: the clip stops on its last key.
     sample=Mathf.Clamp(clipAge,0,clip.length);
     // One motion never plays backwards. The snapshot clock lags VisualTime, so the held time is behind the pose already shown
     // (Editor: 0.28 -> 0.24 s at the iai1 contact); hold the shown pose during the stop, and do not step back after it.
     // With a tempo map the windup covers more clip per frame, so the shown pose can be well before the cut (Editor stage 1: iai1 0.240, iai2 0.150 vs activeFrom 0.287 / 0.183).
     // A hitstop only follows a contact, and contact is at or after hitAt: there the held pose is never before ClipAt(hitAt) = activeFrom. Constant during the stop.
     // T1: the floor holds at every stage (stage 0: no map, ClipAt = 1:1 = activeFrom) and on the first frame of a new serial too (the row can already be
     // in its hitstop when the display first draws it). Attack rows only; the skill and the recover keep their hold.
     float hitFloor=held&&kind=="attack"?Mathf.Min(clip.length,NativeCombatPresentation.ClipAt(a.mapAge,a.mapClip,a.mapCount,hitAt)):0;
     if(a.kitClip==clip&&a.kitSerial==serial)sample=held?(kind=="attack"||a.mapCount>0?Mathf.Max(Mathf.Max(sample,a.kitSample),hitFloor):a.kitSample):Mathf.Max(sample,a.kitSample);
     else if(held)sample=Mathf.Max(sample,hitFloor);
     a.kitClip=clip;a.kitSerial=serial;a.kitSample=sample;
    }
    else if(kind=="rush"||kind=="dodge"||kind=="slide")sample=Mathf.Clamp01(age/duration)*clip.length;
   }
   else if(hero&&age>=0&&duration>0){
    if(kind=="attack"||kind=="skill"){
     float displayAge=age;
     if(kind=="attack"&&action=="attack1"&&Presentation!=null)displayAge=CombatPoseTiming.Limited(Mathf.Clamp01(age/duration),.32f,.58f,Presentation.SidePoseWeight)*duration;
     float segment=kind=="skill"&&action=="skill1"?Mathf.Min(1.25f,clip.length):clip.length;
     sample=NativeCombatPresentation.MotionTime(displayAge,duration,hitAt,segment,segment*.45f);
    }
    else if(kind=="rush"||kind=="dodge"||kind=="slide")sample=Mathf.Clamp01(age/duration)*clip.length;
   }
   var target=new Vector3(x/100,elevation/100,hero?HeroDepth:MobDepth);
   if(hero||!a.placed||mountMode||bossView!=null||Vector3.Distance(a.root.transform.position,target)>3)a.root.transform.position=target;
   else a.root.transform.position=Vector3.Lerp(a.root.transform.position,target,1-Mathf.Exp(-Mathf.Max(0,advance)*18));
   a.placed=true;a.root.transform.localScale=Vector3.one;
   if(a.contactShadow)PlaceContactShadow(a.contactShadow,a.contactShadowScale,hero&&HeroShadowOnGround?HeroAir:0);
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
   // K5 (U0): cut -> 0.04 s cancel (idle) -> skill snapped in 0.03 + 0.045 s in the Editor; after a cancel the kit skill blends over the default 0.12 s instead.
   if(hero&&kind!=a.lastKind){a.afterCancel=kit&&kind=="skill"&&a.lastKind=="cancel";a.lastKind=kind;}
   CombatPoseBlend policy=!hero?CombatPoseBlend.Locomotion:(kind=="dodge"||kind=="cancel"||kind=="jump"||kind=="slide")?CombatPoseBlend.DodgeCancel:kind=="knockback"?CombatPoseBlend.HitReaction:kind=="rush"?CombatPoseBlend.DodgeCancel:kind=="skill"?(a.afterCancel?CombatPoseBlend.Locomotion:CombatPoseBlend.AttackEntry):kind=="attack"?HeroAttackActive?CombatPoseBlend.AttackContact:HeroAttackProgress<.32f?CombatPoseBlend.AttackEntry:CombatPoseBlend.AttackRecovery:CombatPoseBlend.Locomotion;
   if(!a.animation.Sample(clip,sample,advance,policy))return sample;
   a.presentationRoot.localScale=Vector3.one;SampleCalls++;if(!hero&&budget)budget.RecordPose(poseStart);
   // Mirror the side-on presentation without rotating the asymmetric rig through its back view.
   a.model.transform.localScale=new Vector3(a.scale,a.scale,a.scale*(hero&&!Planar&&facing<0?-1:1));
   a.model.transform.localRotation=Quaternion.Euler(0,hero?(Planar?HeroHeading:assets.heroYaw):0,0);
   a.model.transform.localPosition=Vector3.zero;
   float feet=a.baseFoot*a.scale,sourceHeight=0;bool grounded=kit&&set.Grounded(clip);
   bool cached=a.grounding!=null&&a.grounding.TryHeight(clip,sample,out sourceHeight);
   if(hero&&!kit&&bossAssets&&clip==bossAssets.knockback&&bossAssets.knockbackGround.length>0){sourceHeight=bossAssets.knockbackGround.Evaluate(sample);cached=true;}
   if(kit){if(grounded){float low=float.PositiveInfinity;foreach(var t in a.pins)low=Mathf.Min(low,a.root.transform.InverseTransformPoint(t.position).y);if(!float.IsInfinity(low))feet=low-a.soleOffset*a.scale;}}
   else if(cached)feet=sourceHeight*a.scale;
   else if(hero&&a.leftFoot&&a.rightFoot){
    var lp=a.root.transform.InverseTransformPoint(a.leftFoot.position);var rp=a.root.transform.InverseTransformPoint(a.rightFoot.position);
    feet=Mathf.Min(lp.y,rp.y)-a.soleOffset*a.scale;
   }
   // Kit core clips keep their baked hip offsets (travel was removed at bake time); body clips are centred like the original hero.
   if(hero&&a.pelvis&&(!kit||grounded)){var p=a.root.transform.InverseTransformPoint(a.pelvis.position);a.model.transform.localPosition=new Vector3(-p.x,0,-p.z);}
   a.model.transform.localPosition+=Vector3.down*feet;
   if(hero&&!kit&&kind=="skill")ReferenceSkillPose.Apply(action,duration>0?age/duration:0,a.pelvis,a.shoulder);
   if(hero&&!kit&&mountMode&&kind=="attack")HeroMeleePose.Apply(action,duration>0?age/duration:0,a.shoulder,a.weapon,elevation/100);

   if(!hero){
    float bounce=action.Contains("attack")?.06f:0;a.model.transform.localPosition+=Vector3.up*(Mathf.Abs(Mathf.Sin(visualTime*5))*bounce);
    if(action.Contains("death")||action.Contains("die"))a.model.transform.localScale=new Vector3(a.scale*1.25f,a.scale*.3f,a.scale*1.25f);
   }
   if(hero){if(!kit&&kind=="attack"&&action=="attack1"&&Presentation!=null)a.presentationRoot.localScale=Presentation.Scale(HeroAttackProgress,.32f,.58f);HeroClipName=clip.name;HeroSampleTime=sample;HeroGroundError=a.model.transform.localPosition.y+feet;}
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

