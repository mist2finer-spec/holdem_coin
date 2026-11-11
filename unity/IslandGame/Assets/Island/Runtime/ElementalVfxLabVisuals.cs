using UnityEngine;
using UnityEngine.Rendering;

namespace IslandGame {
 public sealed partial class ElementalVfxLab {
  static readonly Color SwordColor=new Color(2.1f,1.1f,.26f),WaterColor=new Color(.16f,1.05f,1.6f),LightningColor=new Color(.85f,.44f,2.1f);
  static Color ElementColor(ElementalAttackKind k)=>k==ElementalAttackKind.Sword?SwordColor:k==ElementalAttackKind.Water?WaterColor:LightningColor;
  VolumeProfile postProfile;
  void SetupPostProcessing(){
   var data=labCamera.GetComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>();
   data.renderPostProcessing=true;data.volumeLayerMask=1<<29;labCamera.allowHDR=true;
   var go=new GameObject("Lab subtle bloom");go.transform.SetParent(world,false);go.layer=29;
   var volume=go.AddComponent<Volume>();volume.isGlobal=true;volume.priority=30;
   postProfile=ScriptableObject.CreateInstance<VolumeProfile>();volume.sharedProfile=postProfile;
   var bloom=postProfile.Add<UnityEngine.Rendering.Universal.Bloom>(true);bloom.threshold.value=1;bloom.intensity.value=.35f;bloom.scatter.value=.45f;
  }
  const int Segments=64;
  sealed class Ribbon {public GameObject Root;public Mesh Mesh;public readonly Vector3[] V=new Vector3[(Segments+1)*2];public readonly Color[] C=new Color[(Segments+1)*2];public float Born,Life,Radius;public bool Active,Telegraph;public Color Color;}
  sealed class BoltFx {public LineRenderer Glow,Core;public readonly LineRenderer[] Forks=new LineRenderer[3];public float Born,Life;public bool Active;public Color Color;}
  sealed class SparkFx {public ParticleSystem System;public float Born;}
  readonly Ribbon[] rings=new Ribbon[32],swordRibbons=new Ribbon[4];readonly BoltFx[] bolts=new BoltFx[16];readonly SparkFx[] sparks=new SparkFx[16];
  readonly Transform[] waterVisuals=new Transform[32];readonly LineRenderer[] waterTrails=new LineRenderer[32];readonly LineRenderer[] hitShapes=new LineRenderer[9];
  readonly Vector3[][] trailPositions=new Vector3[32][];
  Material additive,waterMaterial,particleMaterial,distortionMaterial;int ringCursor,boltCursor,sparkCursor;float renderedClock;
  public int ParticleCount{get;private set;}
  public int ActiveDropCount{get;private set;}
  public int VisualPoolSlots=>32+16+16+32+4;
  Ribbon NewRibbon(string name){
   var r=new Ribbon();r.Root=new GameObject(name);r.Root.transform.SetParent(world,false);r.Mesh=new Mesh{name=name};r.Mesh.MarkDynamic();
   int[] triangles=new int[Segments*6];var uv=new Vector2[r.V.Length];for(int i=0;i<=Segments;i++){uv[i*2]=new Vector2(i/(float)Segments,0);uv[i*2+1]=new Vector2(i/(float)Segments,1);if(i==Segments)break;int k=i*6,v=i*2;triangles[k]=v;triangles[k+1]=v+1;triangles[k+2]=v+2;triangles[k+3]=v+1;triangles[k+4]=v+3;triangles[k+5]=v+2;}
   r.Mesh.vertices=r.V;r.Mesh.uv=uv;r.Mesh.colors=r.C;r.Mesh.triangles=triangles;r.Mesh.bounds=new Bounds(Vector3.zero,Vector3.one*24);r.Root.AddComponent<MeshFilter>().sharedMesh=r.Mesh;
   var renderer=r.Root.AddComponent<MeshRenderer>();renderer.sharedMaterial=additive;renderer.shadowCastingMode=ShadowCastingMode.Off;renderer.receiveShadows=false;r.Root.SetActive(false);return r;
  }
  LineRenderer Line(string name,int count,float width){var go=new GameObject(name);go.transform.SetParent(world,false);var line=go.AddComponent<LineRenderer>();line.sharedMaterial=additive;line.useWorldSpace=true;line.positionCount=count;line.widthMultiplier=width;line.numCapVertices=3;line.shadowCastingMode=ShadowCastingMode.Off;line.receiveShadows=false;return line;}
  void BuildVisualPool(){
   additive=new Material(Resources.Load<Shader>("ElementalRibbon")){name="Lab · additive ribbons"};waterMaterial=new Material(Resources.Load<Shader>("ElementalWater")){name="Lab · water Fresnel"};particleMaterial=new Material(additive){name="Lab · soft droplets"};particleMaterial.SetFloat("_Soft",1);
   for(int i=0;i<rings.Length;i++)rings[i]=NewRibbon("Ring pool "+i);
   distortionMaterial=new Material(Resources.Load<Shader>("ElementalDistortion")){name="Lab · subtle blade distortion"};
   for(int i=0;i<4;i++)swordRibbons[i]=NewRibbon("Sword luminous layer "+i);swordRibbons[3].Root.GetComponent<MeshRenderer>().sharedMaterial=distortionMaterial;
   for(int i=0;i<bolts.Length;i++){var b=bolts[i]=new BoltFx();b.Glow=Line("Bolt aura "+i,25,.23f);b.Core=Line("Bolt core "+i,25,.035f);for(int j=0;j<3;j++)b.Forks[j]=Line("Bolt branch "+i+"/"+j,10,.028f);HideBolt(b);}
   for(int i=0;i<sparks.Length;i++){
    var go=new GameObject("Spark pool "+i);go.transform.SetParent(world,false);var p=go.AddComponent<ParticleSystem>();p.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
    var main=p.main;main.loop=false;main.playOnAwake=false;main.startSpeed=new ParticleSystem.MinMaxCurve(.5f,2.4f);main.startLifetime=new ParticleSystem.MinMaxCurve(.18f,.48f);main.startSize=new ParticleSystem.MinMaxCurve(.025f,.075f);main.maxParticles=48;main.gravityModifier=.23f;main.simulationSpace=ParticleSystemSimulationSpace.World;
    var emission=p.emission;emission.enabled=false;var shape=p.shape;shape.shapeType=ParticleSystemShapeType.Sphere;shape.radius=.08f;var size=p.sizeOverLifetime;size.enabled=true;size.size=new ParticleSystem.MinMaxCurve(1,AnimationCurve.Linear(0,1,1,0));
    var colors=p.colorOverLifetime;colors.enabled=true;var g=new Gradient();g.SetKeys(new[]{new GradientColorKey(Color.white,0),new GradientColorKey(Color.white,1)},new[]{new GradientAlphaKey(1,0),new GradientAlphaKey(0,1)});colors.color=g;go.GetComponent<ParticleSystemRenderer>().sharedMaterial=particleMaterial;sparks[i]=new SparkFx{System=p};
   }
   for(int i=0;i<waterVisuals.Length;i++){var orb=Shape("Water sphere "+i,PrimitiveType.Sphere,Vector3.zero,Vector3.one*.4f,waterMaterial,0,false);waterVisuals[i]=orb.transform;orb.SetActive(false);waterTrails[i]=Line("Droplet tail "+i,8,.08f);waterTrails[i].enabled=false;trailPositions[i]=new Vector3[8];}
   for(int i=0;i<hitShapes.Length;i++){hitShapes[i]=Line("Collision guide "+i,65,.012f);hitShapes[i].startColor=hitShapes[i].endColor=new Color(.22f,.7f,.9f,.28f);}
  }
  void ClearVisuals(){foreach(var r in rings){r.Active=false;r.Root.SetActive(false);}foreach(var r in swordRibbons)r.Root.SetActive(false);foreach(var b in bolts){b.Active=false;HideBolt(b);}foreach(var s in sparks)s.System.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);foreach(var d in waterVisuals)d.gameObject.SetActive(false);foreach(var t in waterTrails)t.enabled=false;renderedClock=clock;}
  void Ring(Vector3 position,float radius,Color color,float life,bool telegraph=false){var r=rings[ringCursor++%rings.Length];r.Root.transform.position=position;r.Radius=radius;r.Color=color;r.Born=clock;r.Life=life;r.Telegraph=telegraph;r.Active=true;r.Root.SetActive(true);}
  void Spark(Vector3 position,Color color,int count){var s=sparks[sparkCursor++%sparks.Length];s.Born=clock;s.System.transform.position=position;s.System.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);var main=s.System.main;main.startColor=color;s.System.Emit(count);s.System.Pause();}
  void Bolt(Vector3 from,Vector3 to,Color color,float life){
   var b=bolts[boltCursor++%bolts.Length];b.Active=true;b.Born=clock;b.Life=life;b.Color=color;b.Glow.enabled=b.Core.enabled=true;Vector3 direction=to-from;Vector3 right=Vector3.Cross(direction.normalized,Vector3.forward);if(right.sqrMagnitude<.1f)right=Vector3.right;Vector3 up=Vector3.Cross(direction.normalized,right).normalized;
   for(int i=0;i<25;i++){float t=i/24f,envelope=Mathf.Sin(t*Mathf.PI);float noise=Mathf.Sin(i*17.13f+castId*4.2f)*.20f;Vector3 p=Vector3.Lerp(from,to,t)+(right*noise+up*Mathf.Cos(i*8.73f+castId)*.1f)*envelope;b.Glow.SetPosition(i,p);b.Core.SetPosition(i,p);}
   for(int f=0;f<3;f++){var line=b.Forks[f];line.enabled=true;Vector3 start=b.Core.GetPosition(7+f*4);Vector3 end=Vector3.Lerp(start,to,.6f)+right*(f%2==0?1:-1)*(.4f+f*.15f);for(int i=0;i<10;i++){float u=i/9f;line.SetPosition(i,Vector3.Lerp(start,end,u)+up*Mathf.Sin(i*14+f)*.08f*Mathf.Sin(u*Mathf.PI));}}
  }
  static void HideBolt(BoltFx b){b.Core.enabled=b.Glow.enabled=false;foreach(var f in b.Forks)if(f)f.enabled=false;}
  void RenderVisuals(){
   if(!Ready)return;float delta=clock-renderedClock;renderedClock=clock;ParticleCount=ActiveDropCount=0;
   foreach(var s in sparks){if(delta>0)s.System.Simulate(delta,false,false,false);ParticleCount+=s.System.particleCount;}
   foreach(var r in rings){if(!r.Active)continue;float u=(clock-r.Born)/r.Life;if(u>=1){r.Active=false;r.Root.SetActive(false);continue;}
    float radius=r.Radius*(r.Telegraph?1:Mathf.Lerp(.25f,1,Mathf.Sqrt(u)));float width=r.Telegraph?.025f:Mathf.Lerp(.13f,.018f,u);float fade=r.Telegraph?.34f:Mathf.Pow(1-u,1.4f);
    for(int i=0;i<=Segments;i++){float a=i*Mathf.PI*2/Segments;Vector3 dir=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a));r.V[i*2]=dir*(radius-width);r.V[i*2+1]=dir*radius;r.C[i*2]=new Color(r.Color.r,r.Color.g,r.Color.b,fade*.2f);r.C[i*2+1]=new Color(r.Color.r,r.Color.g,r.Color.b,fade);}
    r.Mesh.vertices=r.V;r.Mesh.colors=r.C;
   }
   float phase=(CastAge-profile.Windup)/profile.Active;
   for(int layer=0;layer<4;layer++){var r=swordRibbons[layer];bool show=casting&&profile.Kind==ElementalAttackKind.Sword&&phase>=0&&phase<1.55f;r.Root.SetActive(show);if(!show)continue;
    float end=Mathf.Clamp01(phase),tail=Mathf.Max(0,end-.34f),fade=Mathf.Clamp01((1.55f-phase)/.55f);float radius=profile.Radius*(layer==2?.78f:1),width=layer==3?.4f:layer==0?.31f:layer==1?.035f:.015f;
    for(int i=0;i<=Segments;i++){float u=i/(float)Segments,p=Mathf.Lerp(tail,end,u);r.V[i*2]=profile.SwordPoint(p,radius-width);r.V[i*2+1]=profile.SwordPoint(p,radius);float alpha=Mathf.Pow(u,.65f)*fade;var c=layer==1?new Color(2.4f,2.0f,1.1f):SwordColor;r.C[i*2]=new Color(c.r,c.g,c.b,alpha*(layer==0?.04f:.8f));r.C[i*2+1]=new Color(c.r,c.g,c.b,alpha*(layer==0?.7f:1));}
    r.Mesh.vertices=r.V;r.Mesh.colors=r.C;
   }
   foreach(var b in bolts){if(!b.Active)continue;float u=(clock-b.Born)/b.Life;if(u>=1){b.Active=false;HideBolt(b);continue;}float alpha=Mathf.Pow(1-u,1.2f)*(u<.12f?1: .85f+.15f*Mathf.Sin(u*52));b.Core.startColor=b.Core.endColor=new Color(3.8f,2.9f,5.2f,alpha);b.Glow.startColor=b.Glow.endColor=new Color(b.Color.r,b.Color.g,b.Color.b,alpha*.26f);b.Core.widthMultiplier=.04f*(1-u);b.Glow.widthMultiplier=.22f*(1-u);foreach(var f in b.Forks){f.startColor=new Color(b.Color.r,b.Color.g,b.Color.b,alpha*.8f);f.endColor=new Color(b.Color.r,b.Color.g,b.Color.b,0);f.widthMultiplier=.028f*(1-u);}}
   for(int i=0;i<waterVisuals.Length;i++){
    bool orbit=casting&&profile.Kind==ElementalAttackKind.Water&&i<profile.Count&&!drops[i].Launched;bool active=drops[i].Active||orbit;var orb=waterVisuals[i];orb.gameObject.SetActive(active);waterTrails[i].enabled=active&&!orbit;if(!active)continue;ActiveDropCount++;
    Vector3 position;if(orbit){float u=Mathf.Clamp01(CastAge/(profile.Windup+DropDelay(i))),a=DropAngle(i)+Mathf.Sin(u*Mathf.PI)*.7f;position=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a))*Mathf.Lerp(1.1f,.62f,u)+Vector3.up*(.8f+Mathf.Sin(u*Mathf.PI)*.3f);}else position=drops[i].Position;
    orb.position=position;orb.localScale=Vector3.one*(profile.Radius*2)*(orbit?Mathf.SmoothStep(.2f,1,CastAge/profile.Windup):1);
    var trail=waterTrails[i];for(int j=0;j<8;j++){float u=j/7f;trailPositions[i][j]=position-(released?drops[i].Velocity.normalized:Vector3.right)*u*.55f+Vector3.up*Mathf.Sin(u*Mathf.PI)*.04f;}trail.SetPositions(trailPositions[i]);trail.startColor=new Color(.5f,1.1f,1.7f,.75f);trail.endColor=new Color(.1f,.5f,1,0);trail.startWidth=profile.Radius*.7f;trail.endWidth=0;
   }
   for(int i=0;i<targets.Count;i++){var line=hitShapes[i];line.enabled=ShowHitShapes;Vector3 center=targets[i].Body.position;center.y=.028f;for(int j=0;j<65;j++){float a=j*Mathf.PI*2/64;line.SetPosition(j,center+new Vector3(Mathf.Cos(a),0,Mathf.Sin(a))*.42f);}}
   var guide=hitShapes[7];guide.enabled=ShowHitShapes&&casting;Color gc=ElementColor(profile.Kind);guide.startColor=guide.endColor=new Color(gc.r,gc.g,gc.b,.35f);
   for(int i=0;i<65;i++){float a=i*Mathf.PI*2/64;Vector3 p=profile.Kind==ElementalAttackKind.Sword?profile.SwordPoint(i/64f,profile.Radius):(profile.Kind==ElementalAttackKind.Lightning?lockedTarget:Vector3.zero)+new Vector3(Mathf.Cos(a),0,Mathf.Sin(a))*(profile.Kind==ElementalAttackKind.Lightning?profile.Radius:1.1f);guide.SetPosition(i,p+Vector3.up*.025f);}hitShapes[8].enabled=false;
  }
  void DisposeVisuals(){foreach(var r in rings)if(r?.Mesh)Destroy(r.Mesh);foreach(var r in swordRibbons)if(r?.Mesh)Destroy(r.Mesh);if(additive)Destroy(additive);if(waterMaterial)Destroy(waterMaterial);if(particleMaterial)Destroy(particleMaterial);if(distortionMaterial)Destroy(distortionMaterial);}
 }
}
