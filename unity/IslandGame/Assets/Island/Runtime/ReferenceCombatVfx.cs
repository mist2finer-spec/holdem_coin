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
   public GameObject root;public Mesh mesh;public MeshRenderer renderer;public LineRenderer bolt;public readonly LineRenderer[] forks=new LineRenderer[3];public ParticleSystem particles;
   public readonly Vector3[] vertices=new Vector3[(Segments+1)*2];public readonly Color[] colors=new Color[(Segments+1)*2];
   public float born,life,radius;public int kind,facing;public Color color;public bool active;
  }
  readonly Burst[] pool=new Burst[Capacity];readonly Material ribbons,embers;int cursor,lastAttack,lastImpact;float previous=-1;string session;int room=-1;
  public int ActiveEffects{get;private set;}public int ParticleCount{get;private set;}
  static float N(JToken t,float f=0)=>NativeCombatPresentation.N(t,f);
  public ReferenceCombatVfx(Transform parent){
   var shader=Resources.Load<Shader>("ReferenceEffects");ribbons=new Material(shader){name="Reference · ribbons"};embers=new Material(shader){name="Reference · sparks"};embers.SetFloat("_Radial",1);
   var triangles=new int[Segments*6];var uv=new Vector2[(Segments+1)*2];for(int i=0;i<=Segments;i++){uv[i*2]=new Vector2((float)i/Segments,0);uv[i*2+1]=new Vector2((float)i/Segments,1);if(i==Segments)break;int k=i*6,v=i*2;triangles[k]=v;triangles[k+1]=v+1;triangles[k+2]=v+2;triangles[k+3]=v+1;triangles[k+4]=v+3;triangles[k+5]=v+2;}
   for(int i=0;i<Capacity;i++){
    var b=pool[i]=new Burst();b.root=new GameObject("Reference VFX pool "+i);b.root.transform.SetParent(parent,false);b.root.layer=30;
    b.mesh=new Mesh{name="Pooled crescent/ripple"};b.mesh.MarkDynamic();b.mesh.vertices=b.vertices;b.mesh.uv=uv;b.mesh.triangles=triangles;b.mesh.bounds=new Bounds(Vector3.zero,Vector3.one*16);
    b.root.AddComponent<MeshFilter>().sharedMesh=b.mesh;b.renderer=b.root.AddComponent<MeshRenderer>();b.renderer.sharedMaterial=ribbons;b.renderer.shadowCastingMode=ShadowCastingMode.Off;b.renderer.receiveShadows=false;
    var bolt=new GameObject("Lightning / wind");bolt.layer=30;bolt.transform.SetParent(b.root.transform,false);b.bolt=bolt.AddComponent<LineRenderer>();b.bolt.sharedMaterial=ribbons;b.bolt.useWorldSpace=false;b.bolt.positionCount=13;b.bolt.widthMultiplier=.065f;b.bolt.numCapVertices=2;b.bolt.shadowCastingMode=ShadowCastingMode.Off;
    for(int f=0;f<3;f++){var child=new GameObject("Lightning fork "+f);child.layer=30;child.transform.SetParent(b.root.transform,false);var line=b.forks[f]=child.AddComponent<LineRenderer>();line.sharedMaterial=ribbons;line.useWorldSpace=false;line.positionCount=13;line.numCapVertices=2;line.shadowCastingMode=ShadowCastingMode.Off;}
    var sparks=new GameObject("Embers");sparks.layer=30;sparks.transform.SetParent(b.root.transform,false);b.particles=sparks.AddComponent<ParticleSystem>();b.particles.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
    var main=b.particles.main;main.loop=false;main.playOnAwake=false;main.duration=.6f;main.startLifetime=new ParticleSystem.MinMaxCurve(.16f,.48f);main.startSpeed=new ParticleSystem.MinMaxCurve(.6f,3.4f);main.startSize=new ParticleSystem.MinMaxCurve(.035f,.09f);main.gravityModifier=.3f;main.maxParticles=48;main.simulationSpace=ParticleSystemSimulationSpace.World;
    var emission=b.particles.emission;emission.enabled=false;var shape=b.particles.shape;shape.shapeType=ParticleSystemShapeType.Hemisphere;shape.radius=.15f;
    var color=b.particles.colorOverLifetime;color.enabled=true;var gradient=new Gradient();gradient.SetKeys(new[]{new GradientColorKey(Color.white,0),new GradientColorKey(Color.white,1)},new[]{new GradientAlphaKey(1,0),new GradientAlphaKey(0,1)});color.color=gradient;
    var size=b.particles.sizeOverLifetime;size.enabled=true;size.size=new ParticleSystem.MinMaxCurve(1,AnimationCurve.Linear(0,1,1,0));sparks.GetComponent<ParticleSystemRenderer>().sharedMaterial=embers;
    b.root.SetActive(false);
   }
  }
  void Spawn(int kind,Vector3 position,float born,float radius,int facing=1,float yaw=0,float height=5.5f){
   var b=pool[cursor++%Capacity];b.active=true;b.kind=kind;b.born=born;b.life=kind==0?.25f:kind==3?.34f:kind>=4?.48f:.72f;b.radius=radius;b.facing=facing;
   b.color=kind==2||kind==4?new Color(.22f,1.1f,2.3f):kind==3?new Color(.55f,.9f,1.1f):new Color(1.65f,.62f,.12f);
   b.root.transform.position=position;b.root.transform.rotation=Quaternion.Euler(0,yaw,0);b.root.SetActive(true);b.bolt.enabled=kind==1||kind==2||kind==3;
   for(int f=0;f<3;f++){b.forks[f].enabled=kind==2;for(int i=0;i<13;i++){float u=i/12f;float spread=f==0?-.8f:f==1?.85f:.1f;float zig=Mathf.Sin(i*12.8f+born*3+f)*.16f*Mathf.Sin(u*Mathf.PI);b.forks[f].SetPosition(i,new Vector3(spread*u+zig,(1-u)*(f==2?5.5f:3.1f),f==2?0:spread*u*.4f));}}
   b.particles.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
   if(kind<4){var main=b.particles.main;main.startColor=b.color;b.particles.Play();b.particles.Emit(kind==0?8:kind==3?12:40);}
   if(kind==2)for(int i=0;i<13;i++){float t=i/12f;float zig=i==0||i==12?0:Mathf.Sin(i*19.3f+born*7)*.24f;b.bolt.SetPosition(i,new Vector3(zig,(1-t)*height,Mathf.Cos(i*8.7f)*zig));}
   if(kind==3)for(int i=0;i<13;i++)b.bolt.SetPosition(i,new Vector3(-facing*i*.12f,.2f+Mathf.Sin(i*.2f)*.1f,0));
   if(kind==1)for(int i=0;i<13;i++){float u=i/12f;b.bolt.SetPosition(i,new Vector3(facing*(1-u)*.8f,(1-u)*3.6f,0));}
  }
  public void Update(JObject state,float time,Transform hero,Vector3 bladeBase,Vector3 bladeTip){
   int nextRoom=(int?)state["room"]??0;string id=(string)state["id"];
   if(time<previous||room!=nextRoom||session!=id){foreach(var b in pool){b.active=false;b.root.SetActive(false);}lastAttack=lastImpact=0;room=nextRoom;session=id;}previous=time;
   var h=state["hero"];var motion=h?["motion"] as JObject;int attack=(int?)motion?["attackId"]??0;string kind=(string)motion?["kind"];
   float age=motion==null?0:time-N(motion["start"]),duration=N(motion?["duration"],1);int facing=(int)N(h?["facing"],1);float yaw=Mathf.Atan2(-N(h?["direction"]?["y"]),N(h?["direction"]?["x"],1))*Mathf.Rad2Deg;
   if(attack!=lastAttack&&age>=0){
    if(kind=="attack"&&age>=duration*.32f){lastAttack=attack;Spawn(0,hero.position+Vector3.up*.25f,time,1.05f,1,yaw);}
    else if(kind=="rush"){lastAttack=attack;Spawn(3,hero.position,time,.8f,facing);}
    else if(kind=="skill"){lastAttack=attack;var target=motion["target"];bool storm=(string)motion["skillId"]=="storm-call";Spawn(storm?4:5,new Vector3(N(target?["x"])/100,hero.position.y+.05f,(N(target?["y"],5000)-5000)/100),N(motion["start"]),N(motion["radius"])/100);}
   }
   foreach(var fx in state["fx"] as JArray??new JArray()){
    int eventId=(int?)fx["id"]??0;if((string)fx["kind"]!="skill-impact"||eventId<=lastImpact)continue;float born=N(fx["born"]);if(time<born)continue;lastImpact=eventId;if(time-born>.45f)continue;
    Spawn((string)fx["skillId"]=="storm-call"?2:1,new Vector3(N(fx["x"])/100,N(fx["elevation"])/100+.07f,(N(fx["z"],5000)-5000)/100),born,N(fx["radius"])/100,1,yaw,(bool?)state["mountSunday"]==true?5.5f:9);
   }
   ActiveEffects=ParticleCount=0;
   foreach(var b in pool){if(!b.active)continue;float t=Mathf.Clamp01((time-b.born)/b.life);if(time-b.born>b.life){b.active=false;b.root.SetActive(false);continue;}ActiveEffects++;ParticleCount+=b.particles.particleCount;
    float fade=b.kind>=4?.18f*(1-t):Mathf.Pow(1-t,1.5f),radius=b.kind==0?b.radius:b.kind>=4?b.radius:b.radius*Mathf.Lerp(.25f,1,Mathf.Sqrt(t));
    float width=b.kind==0?.22f:b.kind>=4?.025f:Mathf.Lerp(.22f,.03f,t);float head=-100+200*t;
    for(int i=0;i<=Segments;i++){
     float u=(float)i/Segments,a=(b.kind==0?Mathf.Lerp(head-90,head,u):u*360)*Mathf.Deg2Rad;
     float shimmer=b.kind==2?1+Mathf.Sin(u*50+time*15)*.025f:1;
     Vector3 dir=new Vector3(Mathf.Cos(a)*(b.kind==0?b.facing:1),0,Mathf.Sin(a));
     b.vertices[i*2]=dir*(radius-width)*shimmer;b.vertices[i*2+1]=dir*radius*shimmer;
     float alpha=fade*(b.kind==0?Mathf.Sin(u*Mathf.PI)*.9f:.85f);b.colors[i*2]=new Color(b.color.r,b.color.g,b.color.b,alpha*.35f);b.colors[i*2+1]=new Color(b.color.r,b.color.g,b.color.b,alpha);
    }
    b.mesh.vertices=b.vertices;b.mesh.colors=b.colors;b.renderer.enabled=b.kind!=3;
    if(b.bolt.enabled){b.bolt.startColor=new Color(b.color.r,b.color.g,b.color.b,fade);b.bolt.endColor=new Color(b.color.r,b.color.g,b.color.b,fade*.2f);b.bolt.widthMultiplier=(b.kind==1?.27f:b.kind==2?.11f:.04f)*(1-t);}
    for(int f=0;f<3;f++)if(b.forks[f].enabled){b.forks[f].startColor=new Color(.25f,.8f,2,fade*(f==2?.25f:.65f));b.forks[f].endColor=new Color(.5f,1.1f,2,fade*.4f);b.forks[f].widthMultiplier=(f==2?.32f:.045f)*(1-t);}
   }
  }
  public void Dispose(){foreach(var b in pool){if(b.root)UnityEngine.Object.Destroy(b.root);if(b.mesh)UnityEngine.Object.Destroy(b.mesh);}UnityEngine.Object.Destroy(ribbons);UnityEngine.Object.Destroy(embers);}
 }
}
