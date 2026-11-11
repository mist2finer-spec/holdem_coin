using System;
using System.Collections.Generic;
using UnityEngine;

namespace IslandGame {
 public sealed class ElementalLabTarget : MonoBehaviour {
  public Rigidbody Body;
  public Vector3 Home;
  public string Label;
  public float Damage,WetUntil,FlashUntil,MaxDisplacement;
  public int Hits;
  public Renderer Skin;
  public MaterialPropertyBlock Properties;
  void Awake(){Properties=new MaterialPropertyBlock();}
  public void ResetTarget(){Body.position=Home;Body.rotation=Quaternion.identity;Body.linearVelocity=Vector3.zero;Body.angularVelocity=Vector3.zero;Damage=WetUntil=FlashUntil=MaxDisplacement=0;Hits=0;}
 }

 public sealed partial class ElementalVfxLab {
  const int GroundLayer=26,TargetLayer=27,BlockerLayer=28;
  const int GroundMask=1<<GroundLayer,TargetMask=1<<TargetLayer,BlockerMask=1<<BlockerLayer;
  const float FixedStep=.02f;
  readonly Collider[] overlaps=new Collider[128];
  readonly RaycastHit[] casts=new RaycastHit[128];
  readonly HashSet<int> hitOwners=new HashSet<int>();
  readonly HashSet<int> chainOwners=new HashSet<int>();
  readonly List<ElementalLabTarget> targets=new List<ElementalLabTarget>();
  readonly List<LabHit> hitLog=new List<LabHit>();
  readonly Drop[] drops=new Drop[32];
  sealed class Drop {public bool Active,Launched;public Vector3 Position,Velocity;public float Age;public int Bounces;}
  [Serializable] public sealed class LabHit {public int cast;public string target,element;public float time,damage;public Vector3 point,velocity;}
  float clock,castStart,accumulator,nextAuto,previousAge;bool casting,released;int castId;
  ElementalAttackProfile profile;
  Vector3 lockedTarget;
  public int TotalHits{get;private set;}
  public int WallContacts{get;private set;}
  public int GroundContacts{get;private set;}
  public int QueryCount{get;private set;}
  public float Clock=>clock;
  public bool Casting=>casting;
  public float CastAge=>clock-castStart;
  public ElementalAttackProfile Profile=>profile;
  public IReadOnlyList<LabHit> HitLog=>hitLog;
  public IReadOnlyList<ElementalLabTarget> Targets=>targets;
  public float ProjectileSpeedOverride;
  public void Cast(ElementalAttackKind kind,int tier) {
   if(!Ready)return;
   if(ResetOnCast)ResetTargets();ClearVisuals();foreach(var d in drops){d.Active=false;d.Launched=false;}
   selectedKind=kind;selectedTier=tier;profile=new ElementalAttackProfile(kind,tier);castId++;castStart=clock;
   previousAge=0;accumulator=0;casting=true;released=false;hitOwners.Clear();chainOwners.Clear();hitLog.Clear();TotalHits=WallContacts=GroundContacts=QueryCount=0;
   lockedTarget=targets[1].Body.position;lockedTarget.y=.08f;nextAuto=clock+profile.Duration+1.1f;
   if(kind!=ElementalAttackKind.Sword)Ring(kind==ElementalAttackKind.Water?new Vector3(0,.06f,0):lockedTarget,kind==ElementalAttackKind.Water?1.15f:profile.Radius,ElementColor(kind),profile.Windup,true);
   PlayCue(kind,false);
  }
  public void ResetTargets(){foreach(var t in targets)t.ResetTarget();Physics.SyncTransforms();}
  public void Advance(float realSeconds) {
   if(!ready||Paused||!physicsScene.IsValid())return;
   accumulator+=Mathf.Min(realSeconds,.25f)*PlaybackSpeed;
   while(accumulator+1e-6f>=FixedStep){accumulator-=FixedStep;Step(FixedStep);}
  }
  public void ReviewStep(float seconds){int count=Mathf.RoundToInt(seconds/FixedStep);for(int i=0;i<count;i++){Step(FixedStep);RenderVisuals();}SampleActors();}
  void Step(float dt){
   clock+=dt;float age=CastAge;
   if(casting){
    if(profile.Kind==ElementalAttackKind.Sword){
     float from=Mathf.Clamp01((previousAge-profile.Windup)/profile.Active),to=Mathf.Clamp01((age-profile.Windup)/profile.Active);
     if(age>=profile.Windup&&previousAge<=profile.Windup+profile.Active)SweepSword(from,to);
    } else if(age>=profile.Windup&&!released){released=true;PlayCue(profile.Kind,true);if(profile.Kind==ElementalAttackKind.Water)ReleaseWater();else StrikeLightning();}
    if(profile.Kind==ElementalAttackKind.Water)StepWater(dt);
    previousAge=age;if(age>=profile.Duration){casting=false;foreach(var d in drops)d.Active=false;}
   }
   physicsScene.Simulate(dt);
   foreach(var t in targets)t.MaxDisplacement=Mathf.Max(t.MaxDisplacement,Vector3.Distance(t.Body.position,t.Home));
   if(AutoCycle&&clock>=nextAuto&&!casting){int n=selectedKind==ElementalAttackKind.Sword?5:3;if(++selectedTier>n){selectedTier=1;selectedKind=(ElementalAttackKind)(((int)selectedKind+1)%3);}Cast(selectedKind,selectedTier);}
  }
  void SweepSword(float from,float to){
   int steps=Mathf.Max(1,Mathf.CeilToInt((to-from)*210/3));
   for(int i=0;i<=steps;i++){
    float p=Mathf.Lerp(from,to,(float)i/steps);Vector3 a=profile.SwordPoint(p,.25f),b=profile.SwordPoint(p,profile.Radius);
    QueryCount++;int n=physicsScene.OverlapCapsule(a,b,.12f,overlaps,TargetMask,QueryTriggerInteraction.Collide);
    for(int j=0;j<n;j++){var t=overlaps[j].GetComponentInParent<ElementalLabTarget>();if(t&&Visible(new Vector3(0,.8f,0),t.Body.position+Vector3.up*.3f))Damage(t,b,profile.Damage,profile.Impulse,t.Body.position);}
   }
  }
  bool Visible(Vector3 from,Vector3 to){Vector3 v=to-from;QueryCount++;return v.sqrMagnitude<.0001f||!physicsScene.Raycast(from,v.normalized,out _,v.magnitude,BlockerMask,QueryTriggerInteraction.Ignore);}
  void Damage(ElementalLabTarget t,Vector3 point,float damage,float impulse,Vector3? travel=null){
   if(!hitOwners.Add(t.GetInstanceID()))return;
   if(profile.Kind==ElementalAttackKind.Water)t.WetUntil=clock+4;
   if(profile.Kind==ElementalAttackKind.Lightning&&t.WetUntil>clock)damage*=1.25f;
   Vector3 away=travel??(t.Body.position-point);away.y=0;if(away.sqrMagnitude<.01f)away=t.Body.position;if(away.sqrMagnitude<.01f)away=Vector3.right;
   Vector3 kick=away.normalized*impulse+Vector3.up*.45f;t.Body.AddForce(kick,ForceMode.Impulse);
   t.Damage+=damage;t.Hits++;t.FlashUntil=clock+.18f;TotalHits++;
   hitLog.Add(new LabHit{cast=castId,target=t.Label,element=profile.Kind.ToString(),time=clock-castStart,damage=damage,point=point,velocity=kick});
   Spark(t.Body.position+Vector3.up*.3f,ElementColor(profile.Kind),12);Ring(t.Body.position+Vector3.up*.05f,.55f,ElementColor(profile.Kind),.38f);
  }
  float DropDelay(int i)=>profile.Tier==1?0:profile.Tier==2?(i>=profile.Count/2?.28f:0):i*.028f;
  float DropAngle(int i)=>profile.Tier==2?(i%(profile.Count/2))*Mathf.PI*4/profile.Count+(i>=profile.Count/2?Mathf.PI*2/profile.Count:0):i*Mathf.PI*2/profile.Count;
  void ReleaseWater(){
   Ring(new Vector3(0,.06f,0),1.8f,WaterColor,.65f);Spark(new Vector3(0,.6f,0),WaterColor,24);
  }
  void StepWater(float dt){
   if(!released)return;
   for(int i=0;i<profile.Count;i++)if(!drops[i].Launched&&CastAge>=profile.Windup+DropDelay(i)){
    var d=drops[i];float angle=DropAngle(i);Vector3 dir=new Vector3(Mathf.Cos(angle),0,Mathf.Sin(angle));d.Launched=d.Active=true;d.Position=dir*.62f+Vector3.up*.8f;
    d.Velocity=dir*(ProjectileSpeedOverride>0?ProjectileSpeedOverride:4.2f+profile.Tier*.75f)+Vector3.up*(profile.Tier==3?.6f:.15f);d.Age=0;d.Bounces=0;
    if(profile.Tier==2&&i==profile.Count/2)Ring(new Vector3(0,.06f,0),2.2f,WaterColor,.65f);
   }
   foreach(var d in drops){if(!d.Active)continue;d.Age+=dt;d.Velocity+=Vector3.down*.75f*dt;
    float remaining=dt;
    for(int iteration=0;iteration<3&&d.Active&&remaining>.00001f;iteration++){
     QueryCount++;int n=physicsScene.OverlapSphere(d.Position,profile.Radius,overlaps,TargetMask|BlockerMask|GroundMask,QueryTriggerInteraction.Collide);
     bool overlap=false;for(int j=0;j<n;j++){
      var t=overlaps[j].GetComponentInParent<ElementalLabTarget>();if(t){Damage(t,d.Position,profile.Damage,profile.Impulse,d.Velocity);d.Active=false;overlap=true;break;}
      if(overlaps[j].gameObject.layer==BlockerLayer||overlaps[j].gameObject.layer==GroundLayer){d.Active=false;overlap=true;WallContacts+=overlaps[j].gameObject.layer==BlockerLayer?1:0;break;}
     }
     if(overlap){Spark(d.Position,WaterColor,10);break;}
     Vector3 delta=d.Velocity*remaining;float distance=delta.magnitude;
     QueryCount++;int found=physicsScene.SphereCast(d.Position,profile.Radius,delta.normalized,casts,distance,TargetMask|BlockerMask|GroundMask,QueryTriggerInteraction.Collide);
     int nearest=-1;float best=float.MaxValue;for(int j=0;j<found;j++)if(casts[j].distance<best){best=casts[j].distance;nearest=j;}
     if(nearest<0){d.Position+=delta;break;}
     var hit=casts[nearest];d.Position+=delta.normalized*Mathf.Max(0,hit.distance-.006f);remaining*=1-Mathf.Clamp01(hit.distance/Mathf.Max(.0001f,distance));
     var target=hit.collider.GetComponentInParent<ElementalLabTarget>();
     if(target){Damage(target,d.Position,profile.Damage,profile.Impulse,d.Velocity);d.Active=false;}
     else if(hit.collider.gameObject.layer==BlockerLayer){WallContacts++;if(d.Bounces++<1){d.Velocity=Vector3.Reflect(d.Velocity,hit.normal)*.65f;d.Position+=hit.normal*.025f;}else d.Active=false;}
     else{GroundContacts++;d.Active=false;}
     Spark(hit.point,WaterColor,10);Ring(new Vector3(hit.point.x,.035f,hit.point.z),.6f,WaterColor,.4f);
    }
    if(d.Age>2.5f||d.Position.y<-.2f||d.Position.sqrMagnitude>160)d.Active=false;
   }
  }
  void StrikeLightning(){
   StrikeAt(lockedTarget,profile.Radius);
   if(profile.Tier==2){
    Vector3 from=lockedTarget;for(int hop=0;hop<2;hop++){
     ElementalLabTarget best=null;float distance=3.6f;
     foreach(var t in targets){if(hitOwners.Contains(t.GetInstanceID())||chainOwners.Contains(t.GetInstanceID()))continue;float d=Vector3.Distance(t.Body.position,from);if(d<distance&&Visible(from+Vector3.up*.8f,t.Body.position+Vector3.up*.5f)){best=t;distance=d;}}
     if(!best)break;chainOwners.Add(best.GetInstanceID());Vector3 to=best.Body.position;Bolt(from+Vector3.up*.7f,to+Vector3.up*.5f,LightningColor,.42f);Damage(best,to,profile.Damage*.7f,profile.Impulse);from=to;
    }
   } else if(profile.Tier==3){for(int i=0;i<4;i++){float a=i*Mathf.PI*.5f;StrikeAt(lockedTarget+new Vector3(Mathf.Cos(a),0,Mathf.Sin(a))*1.3f,1.15f);}}
  }
  void StrikeAt(Vector3 ground,float radius){
   Vector3 top=ground+Vector3.up*6;QueryCount++;
   if(physicsScene.Raycast(top,Vector3.down,out var roof,6,BlockerMask,QueryTriggerInteraction.Ignore)){Bolt(top,roof.point,LightningColor,.36f);WallContacts++;return;}
   Bolt(top,ground,LightningColor,.48f);Ring(ground,radius,LightningColor,.6f);Spark(ground+Vector3.up*.12f,LightningColor,22);
   QueryCount++;int count=physicsScene.OverlapSphere(ground+Vector3.up*.4f,radius,overlaps,TargetMask,QueryTriggerInteraction.Collide);
   // Damage/Spark do not reuse the query buffer; compound colliders are deduplicated by owner.
   for(int i=0;i<count;i++){var t=overlaps[i].GetComponentInParent<ElementalLabTarget>();if(t&&Visible(ground+Vector3.up*.45f,t.Body.position+Vector3.up*.3f))Damage(t,ground,profile.Damage,profile.Impulse);}
  }
 }
}
