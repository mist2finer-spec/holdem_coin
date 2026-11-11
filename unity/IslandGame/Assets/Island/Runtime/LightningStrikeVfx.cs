using System;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
namespace IslandGame {
 // Eight reusable strikes, including a five-strike storm. Geometry follows the final camera pose.
 public sealed class LightningStrikeVfx:IDisposable {
  public const int Capacity=8;const int BeamPoints=25,ArcPoints=12,RingSteps=48,Rings=4;
  sealed class Strike {
   public GameObject root;public LineRenderer core,glow,halo;
   public readonly LineRenderer[] branches=new LineRenderer[6],ground=new LineRenderer[18];
   public readonly Vector3[] beam=new Vector3[BeamPoints],branch=new Vector3[7],scratch=new Vector3[ArcPoints];
   public readonly Vector3[][] arcs=new Vector3[9][];
   public Mesh mesh;public MeshRenderer flash;public MaterialPropertyBlock block=new MaterialPropertyBlock();public ParticleSystem sparks;
   public Vector3 target;public float born,radius,lastTime;public int seed,supports;public bool active,prepared;
  }
  readonly Strike[] pool=new Strike[Capacity];readonly Material ribbon,sparkMaterial,groundMaterial,groundArcMaterial;int cursor;
  public int ActiveCount{get;private set;}public int ActiveGroundArcs{get;private set;}public int ParticleCount{get;private set;}
  public Vector3 LatestStart{get;private set;}public Vector3 LatestTarget{get;private set;}public int LatestSupports{get;private set;}public float LatestAge{get;private set;}
  public LightningStrikeVfx(Transform parent,Material ribbon,Material sparkMaterial){
   this.ribbon=ribbon;this.sparkMaterial=sparkMaterial;groundMaterial=new Material(Resources.Load<Shader>("LightningGround")){name="Lightning · ground flash"};groundArcMaterial=new Material(Resources.Load<Shader>("LightningGroundArc")){name="Lightning · visible ground arcs"};
   for(int i=0;i<Capacity;i++){
    var s=pool[i]=new Strike();s.root=new GameObject("Screen-top lightning "+i);s.root.layer=30;s.root.transform.SetParent(parent,false);
    s.core=Line(s,"White core",BeamPoints);s.glow=Line(s,"Cyan violet glow",BeamPoints);s.halo=Line(s,"Diffuse halo",BeamPoints);
    for(int b=0;b<6;b++)s.branches[b]=Line(s,"Diagonal branch "+b,7);
    for(int b=0;b<18;b++){s.ground[b]=Line(s,"Ground arc "+b,ArcPoints);s.ground[b].sharedMaterial=groundArcMaterial;}
    for(int a=0;a<9;a++)s.arcs[a]=new Vector3[ArcPoints];
    var floor=new GameObject("Terrain impact ring");floor.layer=30;floor.transform.SetParent(s.root.transform,false);s.mesh=new Mesh{name="Terrain conforming lightning flash"};floor.AddComponent<MeshFilter>().sharedMesh=s.mesh;s.flash=floor.AddComponent<MeshRenderer>();s.flash.sharedMaterial=groundMaterial;s.flash.shadowCastingMode=ShadowCastingMode.Off;s.flash.receiveShadows=false;
    var spark=new GameObject("Radial sparks");spark.layer=30;spark.transform.SetParent(s.root.transform,false);spark.transform.rotation=Quaternion.Euler(-90,0,0);s.sparks=spark.AddComponent<ParticleSystem>();s.sparks.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
    var m=s.sparks.main;m.loop=false;m.playOnAwake=false;m.startLifetime=new ParticleSystem.MinMaxCurve(.08f,.22f);m.startSpeed=new ParticleSystem.MinMaxCurve(2.6f,7);m.startSize=new ParticleSystem.MinMaxCurve(.025f,.065f);m.maxParticles=40;m.simulationSpace=ParticleSystemSimulationSpace.World;m.gravityModifier=.5f;
    var e=s.sparks.emission;e.enabled=false;var shape=s.sparks.shape;shape.shapeType=ParticleSystemShapeType.Cone;shape.angle=80;shape.radius=.08f;
    var color=s.sparks.colorOverLifetime;color.enabled=true;var gradient=new Gradient();gradient.SetKeys(new[]{new GradientColorKey(new Color(1.5f,1.9f,2.5f),0),new GradientColorKey(new Color(.35f,.5f,1.7f),1)},new[]{new GradientAlphaKey(1,0),new GradientAlphaKey(0,1)});color.color=gradient;
    spark.GetComponent<ParticleSystemRenderer>().sharedMaterial=sparkMaterial;s.root.SetActive(false);
   }
  }
  LineRenderer Line(Strike s,string name,int count){var g=new GameObject(name);g.layer=30;g.transform.SetParent(s.root.transform,false);var l=g.AddComponent<LineRenderer>();l.sharedMaterial=ribbon;l.positionCount=count;l.useWorldSpace=true;l.alignment=LineAlignment.View;l.numCapVertices=3;l.numCornerVertices=2;l.shadowCastingMode=ShadowCastingMode.Off;l.receiveShadows=false;return l;}
  public void Spawn(Vector3 target,float born,float radius,int seed,int supports){
   var s=pool[cursor++%Capacity];s.target=target;s.born=s.lastTime=born;s.radius=Mathf.Max(.1f,radius);s.seed=seed;s.supports=Mathf.Clamp(supports,0,5);s.active=true;s.prepared=false;s.root.SetActive(true);
   s.sparks.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);s.sparks.transform.position=target+Vector3.up*.05f;s.sparks.useAutoRandomSeed=false;s.sparks.randomSeed=(uint)Mathf.Max(1,seed);s.sparks.Play();s.sparks.Emit(24+s.supports*3);s.sparks.Pause();
  }
  static float Ground(JObject map,Vector3 p,float fallback){return map?["terrain"]?["heights"] is JArray?NativeCombatPresentation.UnityGroundHeight(map,p.x*100,p.z)/100:fallback;}
  void PrepareGround(Strike s,JObject map){
   int count=1+Rings*RingSteps;var vertices=new Vector3[count];var uv=new Vector2[count];var triangles=new int[RingSteps*(3+(Rings-1)*6)];vertices[0]=s.target+Vector3.up*.035f;uv[0]=Vector2.one*.5f;int ti=0;
   for(int ring=1;ring<=Rings;ring++)for(int k=0;k<RingSteps;k++){
    float a=k*Mathf.PI*2/RingSteps,r=ring/(float)Rings;int n=1+(ring-1)*RingSteps+k;Vector3 p=s.target+new Vector3(Mathf.Cos(a),0,Mathf.Sin(a))*s.radius*r;p.y=Ground(map,p,s.target.y)+.04f;vertices[n]=p;uv[n]=new Vector2(Mathf.Cos(a),Mathf.Sin(a))*r*.5f+Vector2.one*.5f;
    int next=1+(ring-1)*RingSteps+(k+1)%RingSteps;if(ring==1){triangles[ti++]=0;triangles[ti++]=next;triangles[ti++]=n;}else{int inner=n-RingSteps,innerNext=next-RingSteps;triangles[ti++]=inner;triangles[ti++]=next;triangles[ti++]=n;triangles[ti++]=inner;triangles[ti++]=innerNext;triangles[ti++]=next;}
   }
   s.mesh.Clear();s.mesh.vertices=vertices;s.mesh.uv=uv;s.mesh.triangles=triangles;s.mesh.RecalculateBounds();
   int arcs=ScreenTopLightning.GroundArcs(s.supports);float extent=s.supports==1?.6f:s.supports<4?.8f:1;
   for(int a=0;a<arcs;a++){
    float angle=a*Mathf.PI*2/arcs+ScreenTopLightning.Noise(s.seed,a)*.24f;var direction=new Vector3(Mathf.Cos(angle),0,Mathf.Sin(angle));var side=new Vector3(-direction.z,0,direction.x);bool blocked=false;
    for(int i=0;i<ArcPoints;i++){
     float t=i/(float)(ArcPoints-1);var p=s.target+direction*(s.radius*extent*t)+side*(ScreenTopLightning.Noise(s.seed,a*31+i)*.12f*Mathf.Sin(t*Mathf.PI));
     foreach(var obstacle in map?["obstacles"] as JArray??Empty){float ox=NativeCombatPresentation.N(obstacle["x"])/100,oz=(NativeCombatPresentation.N(obstacle["y"],5000)-5000)/100,rad=NativeCombatPresentation.N(obstacle["radius"])/100;if(new Vector2(p.x-ox,p.z-oz).sqrMagnitude<rad*rad)blocked=true;}
     p.y=Ground(map,p,s.target.y)+.055f;s.arcs[a][i]=blocked&&i>0?s.arcs[a][i-1]:p;
    }
   }
   s.prepared=true;
  }
  static readonly JArray Empty=new JArray();
  static void Style(LineRenderer line,Color color,float alpha,float width,float taper=.12f){color.a=alpha;line.startColor=line.endColor=color;line.widthMultiplier=1;line.startWidth=width;line.endWidth=width*taper;}
  public void Present(Camera camera,JObject map,float time,ViewPresentationCoordinator profile){
   if(camera)camera.GetUniversalAdditionalCameraData().requiresDepthTexture=true;
   ActiveCount=ActiveGroundArcs=ParticleCount=0;float newest=-1;
   foreach(var s in pool){if(!s.active)continue;float age=time-s.born;if(age<0||age>ScreenTopLightning.Life){s.active=false;s.root.SetActive(false);continue;}
    if(!s.prepared)PrepareGround(s,map);ActiveCount++;float dt=Mathf.Max(0,time-s.lastTime);s.lastTime=time;if(dt>0)s.sparks.Simulate(Mathf.Min(.1f,dt),false,false,false);ParticleCount+=s.sparks.particleCount;
    bool visible=ScreenTopLightning.Build(camera,s.target,s.beam,s.seed,age);s.core.enabled=s.glow.enabled=s.halo.enabled=visible;
    float fade=age<ScreenTopLightning.ArcSeconds?1:Mathf.Pow(1-Mathf.InverseLerp(ScreenTopLightning.ArcSeconds,ScreenTopLightning.Life,age),2),flash=age<ScreenTopLightning.FlashSeconds?1.5f:1;
    if(visible){
     float worldHeight=ScreenTopLightning.WorldHeight(camera,camera.WorldToViewportPoint(s.target).z);s.core.SetPositions(s.beam);s.glow.SetPositions(s.beam);s.halo.SetPositions(s.beam);
     Style(s.core,new Color(3.3f,3.5f,3.7f),fade,worldHeight*.013f*flash);Style(s.glow,new Color(.45f,.8f,2.5f),fade*.62f,worldHeight*.037f*flash);Style(s.halo,new Color(.3f,.25f,1.4f),fade*.12f,worldHeight*.075f*flash);
     if(s.born>=newest){newest=s.born;LatestStart=s.beam[0];LatestTarget=s.target;LatestSupports=s.supports;LatestAge=age;}
     for(int b=0;b<3;b++){
      int joint=7+b*4;Vector3 origin=s.beam[joint],end=origin+camera.transform.right*((b%2==0?1:-1)*worldHeight*(.055f+b*.008f))-camera.transform.up*worldHeight*.11f;
      for(int k=0;k<7;k++){float t=k/6f;s.branch[k]=Vector3.Lerp(origin,end,t)+camera.transform.right*ScreenTopLightning.Noise(s.seed,b*79+k+Mathf.Min(6,Mathf.FloorToInt(age*60)))*worldHeight*.006f*Mathf.Sin(t*Mathf.PI);}
      s.branches[b*2].SetPositions(s.branch);s.branches[b*2+1].SetPositions(s.branch);Style(s.branches[b*2],new Color(2,2.5f,3),fade*.7f,worldHeight*.0038f);Style(s.branches[b*2+1],new Color(.4f,.65f,2),fade*.3f,worldHeight*.013f);
     }
    }
    foreach(var b in s.branches)b.enabled=visible&&age>=ScreenTopLightning.FlashSeconds;
    int groundArcs=ScreenTopLightning.GroundArcs(s.supports);float groundFade=Mathf.Sin(Mathf.Clamp01(age/.03f)*Mathf.PI*.5f)*Mathf.Pow(1-Mathf.Clamp01(age/ScreenTopLightning.Life),1.2f);float growth=Mathf.Clamp01((age-.015f)/.10f);
    for(int a=0;a<9;a++){
     bool on=a<groundArcs&&age>.015f;s.ground[a*2].enabled=s.ground[a*2+1].enabled=on;if(!on)continue;ActiveGroundArcs++;
     for(int k=0;k<ArcPoints;k++){float f=k*growth;int n=Mathf.FloorToInt(f);s.scratch[k]=Vector3.Lerp(s.arcs[a][n],s.arcs[a][Mathf.Min(n+1,ArcPoints-1)],f-n);}
     s.ground[a*2].SetPositions(s.scratch);s.ground[a*2+1].SetPositions(s.scratch);Style(s.ground[a*2],new Color(1.6f,2,3),groundFade,.045f);Style(s.ground[a*2+1],new Color(.35f,.5f,2),groundFade*.45f,.13f);
    }
    s.block.SetFloat("_Age",age);s.block.SetFloat("_Strength",profile==null?1:Mathf.Lerp(.7f,1.25f,profile.FlashStrength));s.flash.SetPropertyBlock(s.block);
   }
  }
  public void Reset(){foreach(var s in pool){s.active=false;s.root.SetActive(false);}ActiveCount=ActiveGroundArcs=ParticleCount=0;}
  public JArray Inspect(Camera camera,JObject map){
   var result=new JArray();foreach(var s in pool){if(!s.active||!s.core.enabled)continue;var a=camera.WorldToViewportPoint(s.beam[0]);var b=camera.WorldToViewportPoint(s.target);float error=0,extent=0;
    for(int arc=0;arc<ScreenTopLightning.GroundArcs(s.supports);arc++)foreach(var p in s.arcs[arc]){error=Mathf.Max(error,Mathf.Abs(p.y-Ground(map,p,s.target.y)-.055f));extent=Mathf.Max(extent,new Vector2(p.x-s.target.x,p.z-s.target.z).magnitude);}
    result.Add(new JObject{{"startY",a.y},{"startX",a.x},{"targetX",b.x},{"targetY",b.y},{"depthError",Mathf.Abs(a.z-b.z)},{"endError",Vector3.Distance(s.beam[BeamPoints-1],s.target)},{"supports",s.supports},{"groundArcs",ScreenTopLightning.GroundArcs(s.supports)},{"groundError",error},{"extent",extent},{"damageRadius",s.radius}});
   }return result;
  }
  public void Dispose(){foreach(var s in pool){UnityEngine.Object.Destroy(s.mesh);UnityEngine.Object.Destroy(s.root);}UnityEngine.Object.Destroy(groundMaterial);UnityEngine.Object.Destroy(groundArcMaterial);}
 }
}
