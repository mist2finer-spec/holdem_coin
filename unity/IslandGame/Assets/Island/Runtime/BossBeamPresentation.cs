using System;
using System.IO;
using System.Reflection;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 // Kit boss rune beams (2026-11-22, boss-beam-camera-20261122). The kernel (src/lib/rpg-boss-beam.ts) owns the timeline and the hit;
 // state "beams" lists each beam (origin = boss centre, forward, height, angle at the fire, turn rad/s, chargeAt/fireAt/stopAt/endAt,
 // length cm, RuneBeam width and Size, package clip/charge). Each beam is one instance of the RuneBeam package prefab
 // (Resources/BossBeam/RuneBeam_Island, playOnEnable off): its own component builds the mesh in OnEnable and is then switched off, and
 // this class sets the package shader properties on the kernel clock (same property contract as RuneBeam.Show), so the charge seals
 // (the warning), the fire and the fade line up with the kernel judgement. Frame budget level >= LiteBudgetLevel: the beam mesh is cut
 // to the seals, the painted core and the orb (no strands, motes, sparks, fragments, sheath or ground light); the judgement is the same.
 public sealed class BossBeamPresentation:IDisposable {
  public const string PrefabPath="BossBeam/RuneBeam_Island";public const int LiteBudgetLevel=1,MaxBeams=8;
  // QA hooks: force a budget level (-1 = IslandFrameBudget), draw the kernel judgement edges at beam height.
  public static int LevelOverride=-1;public static bool DebugJudgement;public static float DebugHeroRadius=.22f;
  static readonly int TimingId=Shader.PropertyToID("_Timing"),PlacementId=Shader.PropertyToID("_Placement"),TintId=Shader.PropertyToID("_Tint");
  sealed class Slot{public GameObject go;public MeshRenderer renderer;public MeshFilter filter;public Mesh full;public LineRenderer debug;}
  readonly Slot[] slots=new Slot[MaxBeams];readonly Transform root;readonly MaterialPropertyBlock block=new MaterialPropertyBlock();Mesh lite;Material debugMaterial;
  public bool Ready{get;private set;}public int Shown{get;private set;}public bool LiteShown{get;private set;}
  public Transform SlotTransform(int i)=>slots[i]?.go?slots[i].go.transform:null;public Renderer SlotRenderer(int i)=>slots[i]?.renderer;
  public float intensity=1,groundGlow=1;public Color tint=Color.white;
  bool built;
  // The instances are made on the first snapshot with a "beams" key (kit fight start; legacy and no-kit fights never build them).
  public BossBeamPresentation(Transform parent){root=new GameObject("Boss rune beams").transform;root.gameObject.layer=30;root.SetParent(parent,false);}
  public void Build(){
   if(built)return;built=true;var prefab=Resources.Load<GameObject>(PrefabPath);if(!prefab){Debug.LogWarning("BossBeamPresentation: "+PrefabPath+" missing; beams are not shown (the kernel still hits).");return;}
   for(int i=0;i<MaxBeams;i++){
    var go=UnityEngine.Object.Instantiate(prefab,root,false);go.name="Rune beam "+i;go.layer=30;var player=go.GetComponent("RuneBeam") as Behaviour;if(player)player.enabled=false;
    var s=new Slot{go=go,renderer=go.GetComponent<MeshRenderer>(),filter=go.GetComponent<MeshFilter>()};s.full=s.filter?s.filter.sharedMesh:null;
    if(s.renderer){s.renderer.enabled=false;s.renderer.shadowCastingMode=ShadowCastingMode.Off;s.renderer.receiveShadows=false;s.renderer.lightProbeUsage=LightProbeUsage.Off;s.renderer.reflectionProbeUsage=ReflectionProbeUsage.Off;}
    slots[i]=s;
   }
   Ready=slots[0].renderer&&slots[0].full;if(!Ready)Debug.LogWarning("BossBeamPresentation: the RuneBeam prefab did not build its mesh.");
   lite=BuildLite(prefab);
  }
  // Shader phase on the kernel clock (rpg-boss-beam.ts beamPhase).
  public static float Phase(float t,float chargeAt,float fireAt,float stopAt,float clip,float charge){
   float a=fireAt+.1f*clip,pa=charge+.1f,b=stopAt-.14f*clip;
   if(t<=a)return Mathf.Clamp01((t-chargeAt)/clip);
   if(b<=a)return Mathf.Clamp01(pa+(t-a)/clip);
   if(t<=b)return pa+(.7f-pa)*(t-a)/(b-a);
   return Mathf.Clamp01(.7f+(t-b)/clip);
  }
  // Beam angle (rad, kernel plane = Unity x/z) at time t (rpg-boss-beam.ts beamAngle).
  public static float Angle(float t,float angle,float turn,float fireAt,float stopAt)=>angle+turn*Mathf.Clamp(t-fireAt,0,stopAt-fireAt);
  static float Smooth(float a,float b,float x){float t=Mathf.Clamp01((x-a)/(b-a));return t*t*(3-2*t);}
  public static float Front(float phase,float charge)=>Smooth(charge-.003f,charge+.072f,phase);
  // Judgement half width (m) at distance d (m) from the pivot (rpg-boss-beam.ts beamHalfWidth).
  public static float HalfWidth(float d,float length,float width,float size,float front){
   float len=length/size,z=d/size,s=Mathf.Clamp01((z+.24f)/Mathf.Max(1e-6f,(len+.24f)*front));
   return .8f*(.044f+.225f*Smooth(0,.33f,s)+.27f*s)*width*size;
  }
  static float N(JToken t,float f=0)=>NativeCombatPresentation.N(t,f);
  public void Update(JObject state,float visualTime){
   if(!built){if(!(state?["beams"] is JArray))return;Build();}
   if(!Ready)return;int level=LevelOverride>=0?LevelOverride:IslandFrameBudget.Current?IslandFrameBudget.Current.Policy.Level:0;bool useLite=lite&&level>=LiteBudgetLevel;
   int n=0;if(state?["beams"] is JArray beams)foreach(var token in beams){if(n>=MaxBeams)break;var b=token as JObject;if(b==null)continue;
    if(visualTime<N(b["chargeAt"])||visualTime>=N(b["endAt"]))continue;Show(slots[n++],b,visualTime,useLite);}
   for(int i=n;i<MaxBeams;i++){slots[i].renderer.enabled=false;if(slots[i].debug)slots[i].debug.enabled=false;}
   Shown=n;LiteShown=useLite&&n>0;
  }
  void Show(Slot s,JObject b,float t,bool useLite){
   float clip=N(b["clip"],3.6f),charge=N(b["charge"],.36f),size=Mathf.Max(.05f,N(b["size"],1)),width=N(b["width"],1),length=Mathf.Max(.1f,N(b["length"],750)/100),height=N(b["height"])/100,forward=N(b["forward"])/100;
   float fireAt=N(b["fireAt"]),stopAt=N(b["stopAt"]),phase=Phase(t,N(b["chargeAt"]),fireAt,stopAt,clip,charge),a=Angle(t,N(b["angle"]),N(b["turn"]),fireAt,stopAt);
   var dir=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a));var pivot=new Vector3(N(b["originX"])/100,N(b["elevation"])/100,N(b["originZ"])/100)+dir*forward+Vector3.up*height;
   s.go.transform.localPosition=pivot;s.go.transform.localRotation=Quaternion.LookRotation(dir,Vector3.up);
   var mesh=useLite?lite:s.full;if(s.filter.sharedMesh!=mesh)s.filter.sharedMesh=mesh;
   float len=length/size,floor=height/size;
   s.renderer.localBounds=new Bounds(new Vector3(0,-floor*.5f,(len-.3f)*.5f)*size,new Vector3(6+width,6+floor+width,len+5)*size);
   block.SetVector(TimingId,new Vector4(phase,charge,len,width));block.SetVector(PlacementId,new Vector4(size,Mathf.Max(0,intensity),useLite?0:groundGlow,floor));block.SetColor(TintId,tint);
   s.renderer.SetPropertyBlock(block);s.renderer.enabled=true;
   if(DebugJudgement)DrawJudgement(s,pivot,dir,length,width,size,t>=fireAt&&t<stopAt?Front(phase,charge):0);else if(s.debug)s.debug.enabled=false;
  }
  // Outline of the kernel hit area at beam height: core half width (+ hero radius, dashed by the second loop) from the seals to the front.
  void DrawJudgement(Slot s,Vector3 pivot,Vector3 dir,float length,float width,float size,float front){
   if(!s.debug){if(!debugMaterial){debugMaterial=new Material(Shader.Find("Sprites/Default"));}var go=new GameObject("Beam judgement (debug)");go.layer=30;go.transform.SetParent(root,false);var l=go.AddComponent<LineRenderer>();l.useWorldSpace=false;l.sharedMaterial=debugMaterial;l.widthMultiplier=.035f;l.startColor=l.endColor=new Color(0,1,1,1);l.loop=true;l.shadowCastingMode=ShadowCastingMode.Off;s.debug=l;}
   if(front<=0){s.debug.enabled=false;return;}
   var side=new Vector3(dir.z,0,-dir.x);float near=-.24f*size,reach=near+(length+.24f*size)*front;const int k=16;var pts=new List<Vector3>(2*k+2);
   for(int i=0;i<=k;i++){float d=Mathf.Lerp(near,reach,i/(float)k);pts.Add(pivot+dir*d+side*(HalfWidth(Mathf.Max(0,d),length,width,size,front)+DebugHeroRadius));}
   for(int i=k;i>=0;i--){float d=Mathf.Lerp(near,reach,i/(float)k);pts.Add(pivot+dir*d-side*(HalfWidth(Mathf.Max(0,d),length,width,size,front)+DebugHeroRadius));}
   s.debug.positionCount=pts.Count;s.debug.SetPositions(pts.ToArray());s.debug.enabled=true;
  }
  // Lite mesh: the package geometry (RuneBeam.geometry, RuneGeometry.bytes; format of RuneBeam.ReadMesh) keeping only part codes
  // 0 (rune seals = the warning), 1 (painted core) and 3 (orb).
  public static Mesh BuildLite(GameObject prefab){
   var player=prefab?prefab.GetComponent("RuneBeam"):null;var field=player?player.GetType().GetField("geometry",BindingFlags.NonPublic|BindingFlags.Public|BindingFlags.Instance):null;
   var source=field?.GetValue(player) as TextAsset;if(!source)return null;
   using(var reader=new BinaryReader(new MemoryStream(source.bytes))){
    if(reader.ReadUInt32()!=0x314d4252u)return null;int vc=reader.ReadInt32(),ic=reader.ReadInt32();
    var pos=new Vector3[vc];var uv=new Vector2[vc];var motion=new List<Vector4>(vc);var shape=new List<Vector4>(vc);
    for(int i=0;i<vc;i++){pos[i]=new Vector3(reader.ReadSingle(),reader.ReadSingle(),reader.ReadSingle());uv[i]=new Vector2(reader.ReadSingle(),reader.ReadSingle());
     motion.Add(new Vector4(reader.ReadSingle(),reader.ReadSingle(),reader.ReadSingle(),reader.ReadSingle()));shape.Add(new Vector4(reader.ReadSingle(),reader.ReadSingle(),reader.ReadSingle(),reader.ReadSingle()));}
    var keep=new List<int>(ic);var idx=new int[3];
    for(int i=0;i<ic;i+=3){for(int j=0;j<3;j++)idx[j]=reader.ReadUInt16();bool ok=true;for(int j=0;j<3;j++){float k=pos[idx[j]].y;if(!(k<.5f||k>.5f&&k<1.5f||k>2.5f&&k<3.5f))ok=false;}if(ok)keep.AddRange(idx);}
    var mesh=new Mesh{name="Rune Beam (lite)",hideFlags=HideFlags.HideAndDontSave};mesh.vertices=pos;mesh.uv=uv;mesh.SetUVs(1,motion);mesh.SetUVs(2,shape);mesh.SetTriangles(keep,0,false);mesh.bounds=new Bounds(Vector3.zero,new Vector3(10,8,9));mesh.UploadMeshData(false);return mesh;
   }
  }
  public int LiteTriangles=>lite?lite.triangles.Length/3:0;public int FullTriangles=>slots[0]?.full?(int)slots[0].full.GetIndexCount(0)/3:0;
  public void Dispose(){if(root)Destroy(root.gameObject);if(lite)Destroy(lite);if(debugMaterial)Destroy(debugMaterial);}
  static void Destroy(UnityEngine.Object o){if(!o)return;if(Application.isPlaying)UnityEngine.Object.Destroy(o);else UnityEngine.Object.DestroyImmediate(o);}
 }
}
