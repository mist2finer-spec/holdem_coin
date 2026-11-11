using System;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Rendering;
namespace IslandGame {
 // Bounded world-space pool. Events and ground targets come from the simulation;
 // camera orientation never changes the hit area or the effect's ground plane.
 public sealed class ReferenceCombatVfx:IDisposable {
  const int Capacity=12,Segments=48;
  sealed class Burst {
   public GameObject root;public Mesh mesh;public MeshRenderer renderer;public LineRenderer bolt,core,inner;public ParticleSystem particles;
   public readonly Vector3[] vertices=new Vector3[(Segments+1)*2];public readonly Color[] colors=new Color[(Segments+1)*2];
   public float born,life,radius;public int kind,facing,tier;public Color color;public bool active;
  }
  readonly LightningStrikeVfx lightning;public LightningStrikeVfx Lightning=>lightning;readonly Burst[] pool=new Burst[Capacity];readonly Material ribbons,embers,water;readonly Transform[] drops=new Transform[48];readonly LineRenderer[] tails=new LineRenderer[48];int cursor,lastAttack,lastImpact;float previous=-1;string session;int room=-1;
  public int ActiveEffects{get;private set;}public int ActiveDrops{get;private set;}public int PoolCapacity=>Capacity;public int ParticleCount{get;private set;}
  static float N(JToken t,float f=0)=>NativeCombatPresentation.N(t,f);
  public ReferenceCombatVfx(Transform parent){
   var shader=Resources.Load<Shader>("ElementalRibbon");ribbons=new Material(shader){name="Reference · ribbons"};embers=new Material(shader){name="Reference · sparks"};embers.SetFloat("_Soft",1);water=new Material(Resources.Load<Shader>("ElementalWater")){name="Combat water Fresnel"};
   lightning=new LightningStrikeVfx(parent,ribbons,embers);
   for(int i=0;i<drops.Length;i++){var orb=GameObject.CreatePrimitive(PrimitiveType.Sphere);UnityEngine.Object.Destroy(orb.GetComponent<Collider>());orb.name="Combat water droplet "+i;orb.layer=30;orb.transform.SetParent(parent,false);orb.GetComponent<Renderer>().sharedMaterial=water;orb.GetComponent<Renderer>().shadowCastingMode=ShadowCastingMode.Off;drops[i]=orb.transform;tails[i]=NewLine(parent,"Water wake "+i,8,true);orb.SetActive(false);tails[i].enabled=false;}
   var triangles=new int[Segments*6];var uv=new Vector2[(Segments+1)*2];for(int i=0;i<=Segments;i++){uv[i*2]=new Vector2((float)i/Segments,0);uv[i*2+1]=new Vector2((float)i/Segments,1);if(i==Segments)break;int k=i*6,v=i*2;triangles[k]=v;triangles[k+1]=v+1;triangles[k+2]=v+2;triangles[k+3]=v+1;triangles[k+4]=v+3;triangles[k+5]=v+2;}
   for(int i=0;i<Capacity;i++){
    var b=pool[i]=new Burst();b.root=new GameObject("Reference VFX pool "+i);b.root.transform.SetParent(parent,false);b.root.layer=30;
    b.mesh=new Mesh{name="Pooled crescent/ripple"};b.mesh.MarkDynamic();b.mesh.vertices=b.vertices;b.mesh.uv=uv;b.mesh.triangles=triangles;b.mesh.bounds=new Bounds(Vector3.zero,Vector3.one*16);
    b.root.AddComponent<MeshFilter>().sharedMesh=b.mesh;b.renderer=b.root.AddComponent<MeshRenderer>();b.renderer.sharedMaterial=ribbons;b.renderer.shadowCastingMode=ShadowCastingMode.Off;b.renderer.receiveShadows=false;
    var bolt=new GameObject("Lightning / wind");bolt.layer=30;bolt.transform.SetParent(b.root.transform,false);b.bolt=bolt.AddComponent<LineRenderer>();b.bolt.sharedMaterial=ribbons;b.bolt.useWorldSpace=false;b.bolt.positionCount=13;b.bolt.widthMultiplier=.065f;b.bolt.numCapVertices=2;b.bolt.shadowCastingMode=ShadowCastingMode.Off;b.core=NewLine(b.root.transform,"Luminous core",49,false);b.inner=NewLine(b.root.transform,"Inner blade streak",49,false);
    var sparks=new GameObject("Embers");sparks.layer=30;sparks.transform.SetParent(b.root.transform,false);b.particles=sparks.AddComponent<ParticleSystem>();b.particles.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
    var main=b.particles.main;main.loop=false;main.playOnAwake=false;main.duration=.6f;main.startLifetime=new ParticleSystem.MinMaxCurve(.16f,.48f);main.startSpeed=new ParticleSystem.MinMaxCurve(.6f,3.4f);main.startSize=new ParticleSystem.MinMaxCurve(.035f,.09f);main.gravityModifier=.3f;main.maxParticles=48;main.simulationSpace=ParticleSystemSimulationSpace.World;
    var emission=b.particles.emission;emission.enabled=false;var shape=b.particles.shape;shape.shapeType=ParticleSystemShapeType.Hemisphere;shape.radius=.15f;
    var color=b.particles.colorOverLifetime;color.enabled=true;var gradient=new Gradient();gradient.SetKeys(new[]{new GradientColorKey(Color.white,0),new GradientColorKey(Color.white,1)},new[]{new GradientAlphaKey(1,0),new GradientAlphaKey(0,1)});color.color=gradient;
    var size=b.particles.sizeOverLifetime;size.enabled=true;size.size=new ParticleSystem.MinMaxCurve(1,AnimationCurve.Linear(0,1,1,0));sparks.GetComponent<ParticleSystemRenderer>().sharedMaterial=embers;
    b.root.SetActive(false);
   }
  }
  LineRenderer NewLine(Transform parent,string name,int count,bool world){var g=new GameObject(name);g.layer=30;g.transform.SetParent(parent,false);var l=g.AddComponent<LineRenderer>();l.sharedMaterial=ribbons;l.useWorldSpace=world;l.positionCount=count;l.numCapVertices=3;l.shadowCastingMode=ShadowCastingMode.Off;l.receiveShadows=false;return l;}
  void Spawn(int kind,Vector3 position,float born,float radius,int facing=1,float yaw=0,float height=5.5f,int tier=1,float life=0){
   if(kind==2){lightning.Spawn(position,born,radius,Mathf.RoundToInt(born*1000),tier);return;}
   var b=pool[cursor++%Capacity];b.active=true;b.kind=kind;b.born=born;b.life=life>0?life:kind==0?.25f:kind==3?.34f:kind==8?1.1f:kind>=4?.48f:.72f;b.tier=tier;b.radius=radius;b.facing=facing;
   b.color=kind==2||kind==4?new Color(.85f,.44f,2.1f):kind==6||kind==7?new Color(.16f,1.05f,1.6f):kind==3?new Color(.55f,.9f,1.1f):new Color(2.1f,1.1f,.26f);
   b.root.transform.position=position;b.root.transform.rotation=Quaternion.Euler(0,yaw,0);b.root.SetActive(true);b.bolt.enabled=kind==1||kind==2||kind==3;b.core.enabled=kind==0||kind==2;b.inner.enabled=kind==0;b.core.positionCount=kind==2?13:49;
   b.particles.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
   if(kind<4||kind==6||kind==8){var main=b.particles.main;main.startColor=b.color;b.particles.Play();b.particles.Emit(kind==0?8:kind==3?12:40);b.particles.Pause();}
   if(kind==3)for(int i=0;i<13;i++)b.bolt.SetPosition(i,new Vector3(-facing*i*.12f,.2f+Mathf.Sin(i*.2f)*.1f,0));
   if(kind==1)for(int i=0;i<13;i++){float u=i/12f;b.bolt.SetPosition(i,new Vector3(facing*(1-u)*.8f,(1-u)*3.6f,0));}
  }
  public void Update(JObject state,float time,Transform hero,Vector3 bladeBase,Vector3 bladeTip){
   RpgAudio.Current?.Present(state,time);
   float delta=previous<0?0:Mathf.Clamp(time-previous,0,.1f);int nextRoom=(int?)state["room"]??0;string id=(string)state["id"];
   if(time<previous||room!=nextRoom||session!=id){lightning.Reset();foreach(var b in pool){b.active=false;b.root.SetActive(false);}lastAttack=lastImpact=0;room=nextRoom;session=id;}previous=time;
   var h=state["hero"];var motion=h?["motion"] as JObject;int attack=(int?)motion?["attackId"]??0;string kind=(string)motion?["kind"];
   if(kind=="cancel"){foreach(var b in pool)if(b.active&&b.kind==0){b.active=false;b.root.SetActive(false);}}
   float age=motion==null?0:time-N(motion["start"]),duration=N(motion?["duration"],1);int facing=(int)N(h?["facing"],1);float yaw=Mathf.Atan2(-N(h?["direction"]?["y"]),N(h?["direction"]?["x"],1))*Mathf.Rad2Deg;
   if(attack!=lastAttack&&age>=0){
    if(kind=="attack"&&age>=duration*N(motion?["timeline"]?["active"]?[0]?["from"],.32f)){lastAttack=attack;var active=motion["timeline"]?["active"]?[0];float start=N(active?["from"],.32f),end=N(active?["to"],.58f);Spawn(0,hero.position+Vector3.up*.25f,N(motion["start"])+duration*start,1.05f,1,yaw,5.5f,(int)N(motion["comboStep"],1),duration*(end-start)+.10f);}
    else if(kind=="rush"){lastAttack=attack;Spawn(3,hero.position,time,.8f,facing);}
    else if(kind=="skill"){lastAttack=attack;var target=motion["target"];bool storm=(string)motion["skillId"]=="storm-call",waterCast=(string)motion["skillId"]=="water-ring";Spawn(waterCast?7:storm?4:5,new Vector3(N(target?["x"])/100,hero.position.y+.05f,(N(target?["y"],5000)-5000)/100),N(motion["start"]),waterCast?1.1f:N(motion["radius"])/100,1,yaw,5.5f,1,N(motion["hitAt"],.48f));}
   }
   foreach(var fx in state["fx"] as JArray??new JArray()){
    int eventId=(int?)fx["id"]??0;string eventKind=(string)fx["kind"];
    if(eventId<=lastImpact||!(eventKind=="skill-impact"||eventKind=="elemental-strike"||eventKind=="elemental-splash"||eventKind=="boss-arrival"))continue;
    float born=N(fx["born"]);if(time<born)continue;lastImpact=eventId;if(time-born>.55f)continue;
    int effect=eventKind=="elemental-strike"?2:eventKind=="elemental-splash"?6:eventKind=="boss-arrival"?8:(string)fx["skillId"]=="storm-call"?2:1;
    if((bool?)fx["blocked"]==true&&effect==2)effect=6;
    Spawn(effect,new Vector3(N(fx["x"])/100,N(fx["elevation"])/100+.07f,(N(fx["z"],5000)-5000)/100),born,N(fx["radius"])/100,1,yaw,(bool?)state["mountSunday"]==true?5.5f:9,(int)N(fx["linkedSupports"]));
   }
   ActiveDrops=0;var projectiles=state["elementalProjectiles"] as JArray;bool charging=kind=="skill"&&(string)motion?["skillId"]=="water-ring"&&age<N(motion?["hitAt"]);
   int variant=(int)N(motion?["variant"],1),chargeCount=variant==1?8:variant==2?12:16;
   for(int i=0;i<drops.Length;i++){
    bool flying=projectiles!=null&&i<projectiles.Count,orbit=!flying&&charging&&i<chargeCount;drops[i].gameObject.SetActive(flying||orbit);tails[i].enabled=flying;if(!flying&&!orbit)continue;ActiveDrops++;
    Vector3 pos,velocity;float radius=.18f;
    if(flying){var p=projectiles[i];pos=new Vector3(N(p["x"])/100,N(p["elevation"])/100,(N(p["y"],5000)-5000)/100);velocity=new Vector3(N(p["vx"]),N(p["vz"]),N(p["vy"])).normalized;radius=N(p["radius"])/100;}
    else{float a=i*Mathf.PI*2/chargeCount+age*2;pos=hero.position+new Vector3(Mathf.Cos(a)*.65f,.6f+Mathf.Sin(age*6)*.1f,Mathf.Sin(a)*.65f);velocity=Vector3.zero;}
    drops[i].position=pos;drops[i].localScale=Vector3.one*radius*2;
    if(flying){var tail=tails[i];for(int j=0;j<8;j++)tail.SetPosition(j,pos-velocity*j*.065f);tail.startWidth=.10f;tail.endWidth=0;tail.startColor=new Color(.5f,1.1f,1.7f,.75f);tail.endColor=new Color(.1f,.5f,1,0);}
   }
   ActiveEffects=ActiveDrops;ParticleCount=0;
   foreach(var b in pool){if(!b.active)continue;float t=Mathf.Clamp01((time-b.born)/b.life);if(time-b.born>b.life){b.active=false;b.root.SetActive(false);continue;}ActiveEffects++;if(delta>0)b.particles.Simulate(delta,false,false,false);ParticleCount+=b.particles.particleCount;
    bool telegraph=b.kind==4||b.kind==5||b.kind==7;float fade=telegraph?.3f*(1-t):Mathf.Pow(1-t,1.5f),radius=b.kind==0?b.radius:telegraph?b.radius:b.radius*Mathf.Lerp(.25f,1,Mathf.Sqrt(t));
    float width=b.kind==0?.22f:telegraph?.025f:Mathf.Lerp(.22f,.03f,t);float head=-100+200*Mathf.Clamp01((time-b.born)/Mathf.Max(.01f,b.life-.10f));if(b.tier%2==0&&b.kind==0)head=-head;
    for(int i=0;i<=Segments;i++){
     float u=(float)i/Segments,a=(b.kind==0?Mathf.Lerp(head-(b.tier%2==0?-1:1)*70,head,u):u*360)*Mathf.Deg2Rad;
     float shimmer=b.kind==2?1+Mathf.Sin(u*50+time*15)*.025f:1;
     Vector3 dir=new Vector3(Mathf.Cos(a)*(b.kind==0?b.facing:1),0,Mathf.Sin(a));
     if(b.kind==0)dir=Quaternion.Euler(new ElementalAttackProfile(ElementalAttackKind.Sword,b.tier).Tilt*.12f,0,0)*dir;
     b.vertices[i*2]=dir*(radius-width)*shimmer;b.vertices[i*2+1]=dir*radius*shimmer;
     float alpha=fade*(b.kind==0?Mathf.Sin(u*Mathf.PI)*.9f:.85f);b.colors[i*2]=new Color(b.color.r,b.color.g,b.color.b,alpha*.35f);b.colors[i*2+1]=new Color(b.color.r,b.color.g,b.color.b,alpha);if(b.kind==0){b.core.SetPosition(i,dir*radius);b.inner.SetPosition(i,dir*radius*.78f);}
    }
    b.mesh.vertices=b.vertices;b.mesh.colors=b.colors;b.renderer.enabled=b.kind!=3;
    if(b.core.enabled){b.core.startColor=new Color(3.8f,2.9f,3.1f,0);b.core.endColor=new Color(3.8f,2.9f,3.1f,fade);b.core.widthMultiplier=b.kind==0?.022f:.035f*(1-t);}if(b.inner.enabled){b.inner.startColor=new Color(2,1.4f,.6f,0);b.inner.endColor=new Color(2,1.4f,.6f,fade*.7f);b.inner.widthMultiplier=.012f;}
    if(b.bolt.enabled){b.bolt.startColor=new Color(b.color.r,b.color.g,b.color.b,fade);b.bolt.endColor=new Color(b.color.r,b.color.g,b.color.b,fade*.2f);b.bolt.widthMultiplier=(b.kind==1?.27f:b.kind==2?.11f:.04f)*(1-t);}
   }
  }
  public void PresentLightning(Camera camera,JObject map,float time,ViewPresentationCoordinator profile){lightning.Present(camera,map,time,profile);ActiveEffects+=lightning.ActiveCount;ParticleCount+=lightning.ParticleCount;}
  public void Dispose(){lightning.Dispose();foreach(var d in drops)if(d)UnityEngine.Object.Destroy(d.gameObject);foreach(var t in tails)if(t)UnityEngine.Object.Destroy(t.gameObject);UnityEngine.Object.Destroy(water);foreach(var b in pool){if(b.root)UnityEngine.Object.Destroy(b.root);if(b.mesh)UnityEngine.Object.Destroy(b.mesh);}UnityEngine.Object.Destroy(ribbons);UnityEngine.Object.Destroy(embers);}
 }
}
