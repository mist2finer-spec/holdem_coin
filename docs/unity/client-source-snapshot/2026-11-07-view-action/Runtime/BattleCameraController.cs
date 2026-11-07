using System;
using UnityEngine;
namespace IslandGame {
 public enum ViewMode { Side25D, QuarterView, TopDown1945 }
 [DisallowMultipleComponent]
 public sealed class BattleCameraController:MonoBehaviour {
  [Serializable] public struct Preset {
   public float pitch,yaw,verticalFov,distance;public Vector3 pivotOffset;
   public Preset(float p,float y,float f,float d,Vector3 o){pitch=p;yaw=y;verticalFov=f;distance=d;pivotOffset=o;}
  }
  public Vector3 ImpactOffset {get;set;}
  public float ImpactFov {get;set;}
  public float TransitionProgress=>transitionDuration>0?Mathf.Clamp01(blendAge/transitionDuration):1;
  public bool IsTransitioning=>TransitionProgress<1;
  public int TransitionSerial{get;private set;}
  public float QuarterWeight{get;private set;}
  float fromQuarter;bool transitionPrepared;
  public Vector2 FacingWorld {get;set;}=Vector2.right;
  public bool WarningActive{get;set;}public Bounds WarningBounds{get;set;}
  public void SetPresentationImpact(Vector3 offset,float fov){ImpactOffset=Vector3.ClampMagnitude(offset,.08f);ImpactFov=Mathf.Clamp(fov,-1,1);}
  public void PrepareTransition(float dt){AdvanceTransition(Mathf.Clamp(dt,0,maxCameraStep));transitionPrepared=true;}
  void AdvanceTransition(float dt){
   blendAge+=dt;float t=Mathf.SmoothStep(0,1,TransitionProgress);var targetPreset=Desired;
   QuarterWeight=Mathf.Lerp(fromQuarter,Mode==ViewMode.Side25D?0:1,t);
   current=new Preset(Mathf.Lerp(from.pitch,targetPreset.pitch,t),Mathf.LerpAngle(from.yaw,targetPreset.yaw,t),Mathf.Lerp(from.verticalFov,targetPreset.verticalFov,t),Mathf.Lerp(from.distance,targetPreset.distance,t),Vector3.Lerp(from.pivotOffset,targetPreset.pivotOffset,t));
  }
  public Camera view;public Transform playerTarget;public bool externallyDriven;
  public ViewMode Mode{get;private set;}=ViewMode.Side25D;
  public Preset side=new Preset(10,0,18,28,new Vector3(0,2,0));
  public Preset quarter=new Preset(42,12,35,20,new Vector3(0,1.2f,2.5f));
  public Preset top=new Preset(82,0,40,24,new Vector3(0,0,3));
  [Header("Portrait projection and ground")]
  public float referenceAspect=9f/16f;[Range(.05f,.4f)]public float groundViewportY=.18f;
  public bool keepGroundFraming=true;public float verticalDeadzone=1.2f,verticalSmoothTime=.15f;
  [Header("Directional anticipation")]
  public float lookAheadDistanceX=2.8f,turnConfirmDelay=.12f,turnConfirmTravel=.35f;
  public float velocityLookAheadMultiplier=.4f,maxVelocityLookAhead=2,playerEdgePadding=.75f;
  public float lookAheadAccelSmoothTime=.18f,lookAheadDecelSmoothTime=.35f;
  [Header("Boss framing")]
  public float transitionDuration=1.2f,maxBossDistance=32,bossWeight=.35f,framingMargin=1.15f;
  public float maxCameraStep=.05f;
  public float CurrentLookAhead{get;private set;}public float CurrentDistance{get;private set;}
  public float ConfirmedFacing=>facing;public bool ChamberClampActive=>clamp;
  public float GroundViewportPosition=>view?view.WorldToViewportPoint(new Vector3(pose.x,ground,pose.z)).y:0;
  public float VisibleGroundHalfWidth=>view?CurrentDistance*Mathf.Tan(view.fieldOfView*Mathf.Deg2Rad*.5f)*view.aspect+3:9;
  public float FocusWorldX=>transform.position.x;
  Transform boss;Renderer[] bossRenderers=Array.Empty<Renderer>();
  BattleForegroundOcclusion occlusion;
  Vector3 pose,previousPose;float ground,rawFacing=1,velocityX,facing=1,candidate=1,turnAge,turnX;
  float lookVelocity,xVelocity,yVelocity,zVelocity,zoomVelocity,offsetY;bool initialized,hasPose,clamp;
  float minX,maxX,blendAge;Preset from,current;Quaternion fromRotation;Vector3 transitionFromPosition;
  void Awake(){if(!view)view=GetComponentInChildren<Camera>();occlusion=GetComponent<BattleForegroundOcclusion>()??gameObject.AddComponent<BattleForegroundOcclusion>();current=side;CurrentDistance=side.distance;from=side;blendAge=transitionDuration;fromRotation=Quaternion.Euler(side.pitch,side.yaw,0);if(view){view.orthographic=false;view.nearClipPlane=.1f;view.farClipPlane=180;}}
  public void Bind(Camera camera){view=camera;if(!occlusion)occlusion=GetComponent<BattleForegroundOcclusion>()??gameObject.AddComponent<BattleForegroundOcclusion>();if(view.transform.parent!=transform)view.transform.SetParent(transform,false);view.orthographic=false;view.nearClipPlane=.1f;view.farClipPlane=180;ApplyProjection();}
  public void SetPose(Vector3 worldFoot,float facingDirection,float groundHeight,float horizontalVelocity){
   if(!Finite(worldFoot)||!IsFinite(groundHeight)||!IsFinite(horizontalVelocity))return;
   pose=worldFoot;ground=groundHeight;rawFacing=Mathf.Abs(facingDirection)>.01f?Mathf.Sign(facingDirection):rawFacing;velocityX=horizontalVelocity;hasPose=true;
  }
  public void SetChamberBounds(float lower,float upper,bool active){
   if(!IsFinite(lower)||!IsFinite(upper)){clamp=false;return;}minX=Mathf.Min(lower,upper);maxX=Mathf.Max(lower,upper);clamp=active;
  }
  public void SetViewMode(ViewMode mode,Transform bossTarget=null){
   if(Mode==mode&&boss==bossTarget)return;
   fromQuarter=QuarterWeight;TransitionSerial++;from=current;from.distance=CurrentDistance;fromRotation=transform.rotation;transitionFromPosition=transform.position;blendAge=0;Mode=mode;boss=bossTarget;
   bossRenderers=boss?boss.GetComponentsInChildren<Renderer>(true):Array.Empty<Renderer>();
   if(mode==ViewMode.Side25D){candidate=rawFacing;turnAge=0;turnX=pose.x;}
  }
  public void ResetPose(){ImpactOffset=Vector3.zero;ImpactFov=0;WarningActive=false;QuarterWeight=fromQuarter=Mode==ViewMode.Side25D?0:1;transitionPrepared=false;initialized=false;lookVelocity=xVelocity=yVelocity=zVelocity=zoomVelocity=0;CurrentLookAhead=0;facing=candidate=rawFacing;turnAge=0;turnX=pose.x;current=from=Desired;CurrentDistance=Desired.distance;fromRotation=Quaternion.Euler(current.pitch,current.yaw,0);blendAge=transitionDuration;}
  Preset Desired=>Mode==ViewMode.QuarterView?quarter:Mode==ViewMode.TopDown1945?top:side;
  public void ApplyProjection(){if(!view)return;view.orthographic=false;float rectAspect=Mathf.Max(.01f,referenceAspect*view.rect.width/Mathf.Max(.01f,view.rect.height));view.fieldOfView=LockedVerticalFov(current.verticalFov,rectAspect,view.aspect);}
  public static float LockedVerticalFov(float vertical,float referenceViewportAspect,float actualViewportAspect){
   float f=Mathf.Clamp(vertical,1,110);if(actualViewportAspect>=referenceViewportAspect)return f;
   return Mathf.Clamp(2*Mathf.Atan(Mathf.Tan(f*Mathf.Deg2Rad*.5f)*referenceViewportAspect/Mathf.Max(.01f,actualViewportAspect))*Mathf.Rad2Deg,1,120);
  }
  public void Tick(float delta){
   if(!view)return;if(!hasPose&&playerTarget){pose=playerTarget.position;ground=pose.y;rawFacing=1;hasPose=true;}if(!hasPose)return;
   float dt=Mathf.Clamp(delta,0,maxCameraStep);if(dt<=0)return;
   if(!externallyDriven&&playerTarget){Vector3 p=playerTarget.position;velocityX=initialized?(p.x-previousPose.x)/dt:0;pose=p;previousPose=p;}
   if(!transitionPrepared)AdvanceTransition(dt);transitionPrepared=false;
   var targetPreset=Desired;float t=Mathf.SmoothStep(0,1,TransitionProgress);
   transform.rotation=Quaternion.Slerp(fromRotation,Quaternion.Euler(targetPreset.pitch,targetPreset.yaw,0),t);ApplyProjection();view.fieldOfView=Mathf.Clamp(view.fieldOfView+ImpactFov,1,120);
   UpdateFacing(dt);
   float desiredLook=0;
   if(Mode==ViewMode.Side25D){float boost=Mathf.Clamp(velocityX*velocityLookAheadMultiplier,-maxVelocityLookAhead,maxVelocityLookAhead);desiredLook=facing*lookAheadDistanceX+boost;float limit=Mathf.Max(.5f,current.distance*Mathf.Tan(view.fieldOfView*Mathf.Deg2Rad*.5f)*view.aspect-playerEdgePadding);desiredLook=Mathf.Clamp(desiredLook,-limit,limit);}
   bool accelerate=Mathf.Abs(desiredLook)>Mathf.Abs(CurrentLookAhead)||Mathf.Sign(desiredLook)!=Mathf.Sign(CurrentLookAhead);
   CurrentLookAhead=Mathf.SmoothDamp(CurrentLookAhead,desiredLook,ref lookVelocity,accelerate?lookAheadAccelSmoothTime:lookAheadDecelSmoothTime,Mathf.Infinity,dt);
   Vector3 target=new Vector3(pose.x,ground,pose.z)+current.pivotOffset;target.x+=CurrentLookAhead;
   float air=Mathf.Max(0,pose.y-ground-verticalDeadzone);target.y+=air*.35f;
   float distance=current.distance;
   if(Mode==ViewMode.Side25D&&keepGroundFraming){
    // Solve the ground projection rather than assuming offset +2 maps to a fixed screen row.
    float q=(groundViewportY*2-1)*Mathf.Tan(view.fieldOfView*Mathf.Deg2Rad*.5f),p=current.pitch*Mathf.Deg2Rad;
    float framedY=-q*distance/Mathf.Max(.1f,Mathf.Cos(p)+q*Mathf.Sin(p));
    target.y+=framedY-current.pivotOffset.y;
   }
   if(boss&&boss.gameObject.activeInHierarchy){
    float separation=Vector3.Distance(new Vector3(pose.x,ground,pose.z),boss.position);float bossInfluence=1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(12,24,separation));
    Vector3 center=Vector3.Lerp(new Vector3(pose.x,ground,pose.z),boss.position,bossWeight*bossInfluence);
    target=center+current.pivotOffset+new Vector3(FacingWorld.x,0,FacingWorld.y)*(.65f*QuarterWeight);
    // The giant's bounds determine zoom; root-only distance misses its head and shoulders.
    var heroBounds=new Bounds(new Vector3(pose.x,ground+.65f,pose.z),new Vector3(.9f,1.5f,.7f));
    float required=RequiredDistance(heroBounds,target,transform.rotation,view.fieldOfView,view.aspect);
    foreach(var r in bossRenderers)if(r&&r.enabled)required=Mathf.Max(required,Mathf.Lerp(current.distance,RequiredDistance(r.bounds,target,transform.rotation,view.fieldOfView,view.aspect),bossInfluence));
    distance=Mathf.Clamp(Mathf.Max(current.distance,required),current.distance,maxBossDistance);
   }
   if(WarningActive)distance=Mathf.Max(distance,RequiredDistance(WarningBounds,target,transform.rotation,view.fieldOfView,view.aspect));
   if(initialized&&t<1){target=Vector3.Lerp(transitionFromPosition,target,t);distance=Mathf.Lerp(from.distance,distance,t);}
   if(clamp)target.x=Mathf.Clamp(target.x,minX,maxX);
   if(!initialized){transform.position=target;CurrentDistance=distance;initialized=true;}
   else {
    var position=transform.position;
    position.x=Mathf.SmoothDamp(position.x,target.x,ref xVelocity,Mode==ViewMode.Side25D?.1f:.18f,Mathf.Infinity,dt);if(clamp)position.x=Mathf.Clamp(position.x,minX,maxX);
    position.y=Mathf.SmoothDamp(position.y,target.y,ref yVelocity,verticalSmoothTime,Mathf.Infinity,dt);
    position.z=Mathf.SmoothDamp(position.z,target.z,ref zVelocity,.18f,Mathf.Infinity,dt);transform.position=position;
    CurrentDistance=Mathf.SmoothDamp(CurrentDistance,distance,ref zoomVelocity,.18f,Mathf.Infinity,dt);
   }
   // Recheck framing after transition smoothing and offsets. Threats never depend on preset timing.
   float safe=RequiredDistance(new Bounds(new Vector3(pose.x,ground+.7f,pose.z),new Vector3(1,1.6f,1)),transform.position,transform.rotation,view.fieldOfView,view.aspect);
   if(WarningActive)safe=Mathf.Max(safe,RequiredDistance(WarningBounds,transform.position,transform.rotation,view.fieldOfView,view.aspect));
   if(boss&&boss.gameObject.activeInHierarchy&&Vector3.Distance(pose,boss.position)<12)foreach(var r in bossRenderers)if(r&&r.enabled)safe=Mathf.Max(safe,RequiredDistance(r.bounds,transform.position,transform.rotation,view.fieldOfView,view.aspect));
   CurrentDistance=Mathf.Max(CurrentDistance,safe+ImpactOffset.magnitude);
   view.transform.localPosition=new Vector3(0,0,-CurrentDistance)+ImpactOffset;view.transform.localRotation=Quaternion.identity;
   if(occlusion)occlusion.Apply(view,new Vector3(pose.x,ground,pose.z),current.pitch);
  }
  void UpdateFacing(float dt){
   if(rawFacing==facing){candidate=facing;turnAge=0;turnX=pose.x;return;}
   if(candidate!=rawFacing){candidate=rawFacing;turnAge=0;turnX=pose.x;}
   turnAge+=dt;if(turnAge>=turnConfirmDelay||Mathf.Abs(pose.x-turnX)>=turnConfirmTravel){facing=candidate;turnAge=0;turnX=pose.x;}
  }
  float RequiredDistance(Bounds bounds,Vector3 pivot,Quaternion rotation,float fov,float aspect){
   Quaternion inverse=Quaternion.Inverse(rotation);float tan=Mathf.Tan(fov*Mathf.Deg2Rad*.5f),required=0;
   for(int i=0;i<8;i++){Vector3 corner=bounds.center+Vector3.Scale(bounds.extents,new Vector3((i&1)==0?-1:1,(i&2)==0?-1:1,(i&4)==0?-1:1));Vector3 local=inverse*(corner-pivot);required=Mathf.Max(required,Mathf.Max(Mathf.Abs(local.x)*framingMargin/(tan*Mathf.Max(.01f,aspect))-local.z,Mathf.Abs(local.y)*framingMargin/tan-local.z));}return required;
  }
  void LateUpdate(){if(!externallyDriven)Tick(Time.unscaledDeltaTime);}
  static bool IsFinite(float x)=>!float.IsNaN(x)&&!float.IsInfinity(x);
  static bool Finite(Vector3 v)=>IsFinite(v.x)&&IsFinite(v.y)&&IsFinite(v.z);
 }
}
