using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json.Linq;
using Spine;
using Spine.Unity;
using UnityEngine;
using UnityEngine.Rendering;

namespace IslandGame.BossTrials {
 /// <summary>Original recovered meshes/UVs in native Unity XYZ. No panorama or /100 map scale.</summary>
 public sealed class BossTrialRenderer : MonoBehaviour {
  public RenderTexture Output { get; private set; }
  public string Diagnostic { get; private set; }
  public bool SourceCamera { get; private set; }
  public float GroundY { get; private set; }=10;
  public float DepthX { get; private set; }=-4;
  public JObject MapContract { get; private set; }
  const int Layer=29;
  GameObject world;
  Camera cameraView;
  JObject scene,index;
  Vector3 sourcePosition;
  Quaternion sourceRotation;
  readonly List<UnityEngine.Object> owned=new List<UnityEngine.Object>();
  readonly Dictionary<string,SkeletonDataAsset> skeletons=new Dictionary<string,SkeletonDataAsset>();
  readonly Dictionary<int,ActorView> actors=new Dictionary<int,ActorView>();
  readonly Dictionary<int,HazardView> hazards=new Dictionary<int,HazardView>();
  ActorView hero;
  BossTrialSimulation simulation;
  Material overlayMaterial;
  sealed class ActorView {
   public SkeletonAnimation Spine;
   public float BaseHeight;
   public string Clip="",Path;
   public int Serial=-1;
   public float LastTime;
   public HashSet<string> Feet=new HashSet<string>();
   public GameObject Shadow;
   public LineRenderer ShadowLine;
  }
  sealed class HazardView {
   public GameObject Root;
   public Mesh Mesh;
   public MeshRenderer Renderer;
   public LineRenderer Circle;
  }
  public void Build(BossTrialSimulation state) {
   Clear();simulation=state;Diagnostic="";
   var asset=Resources.Load<TextAsset>("BossTrials/map-contract");
   MapContract=asset?JObject.Parse(asset.text):null;
   var native=Resources.Load<TextAsset>((string)MapContract?["sceneResource"]??"WebAssets/rpg/maps/candle-dungeon/scene");
   var actorIndex=Resources.Load<TextAsset>("AssetIndex");
   if(!native||!actorIndex){Diagnostic="원본 scene / AssetIndex 없음 · 자산 준비 후 다시 입장하세요.";return;}
   scene=JObject.Parse(native.text);index=JObject.Parse(actorIndex.text);
   GroundY=MapContract?["playable"]?.Value<float?>("groundY")??10;
   DepthX=MapContract?["playable"]?.Value<float?>("depthX")??-4;
   world=new GameObject("Boss trial · native Map002_001 · local sandbox");
   Output=new RenderTexture(1152,648,24){name="Boss trial native viewport",antiAliasing=1};Output.Create();owned.Add(Output);
   var cameraObject=new GameObject("Recovered CombatCamera + bounded trial framing");cameraObject.transform.SetParent(world.transform,false);
   cameraView=cameraObject.AddComponent<Camera>();cameraView.targetTexture=Output;cameraView.cullingMask=1<<Layer;cameraView.clearFlags=CameraClearFlags.SolidColor;cameraView.backgroundColor=new Color(.025f,.027f,.035f);cameraView.nearClipPlane=.3f;cameraView.farClipPlane=200;
   var matrix=Matrix(scene["camera"]["world"]);sourcePosition=matrix.GetColumn(3);sourceRotation=Quaternion.LookRotation(matrix.GetColumn(2),matrix.GetColumn(1));
   cameraView.transform.rotation=sourceRotation;
   Shader overlay=Shader.Find("Sprites/Default");if(!overlay)overlay=Shader.Find("Unlit/Transparent");
   overlayMaterial=new Material(overlay){name="Trial exact hit volumes"};owned.Add(overlayMaterial);
   BuildMap();BuildFloorColliders();SetSourceCamera(false);
   hero=CreateActor((string)index["heroes"]?[state.Weapon]??(string)index["heroes"]?["axe"],new HashSet<string>{"Rleg","Lleg2","Lleg"},"Hong · native weapon");
   if(hero==null)Diagnostic="홍 Spine 자산 없음 · prepare.ps1과 Spine 임포트를 확인하세요.";
   UpdateView();
  }
  void BuildMap() {
   var textures=new Dictionary<string,Texture2D>();
   foreach(var property in ((JObject)scene["textures"]).Properties()) {
    string path=(string)property.Value["file"];
    if(!string.IsNullOrEmpty(path))textures[property.Name]=Resources.Load<Texture2D>(((string)MapContract?["textureResourceRoot"]??"WebAssets/rpg/maps/candle-dungeon/")+Path.ChangeExtension(path,null));
   }
   var materials=new Dictionary<string,Material>();
   Shader shader=Resources.Load<Shader>("BossTrials/BossTrialRecoveredMap")??Shader.Find("Island/BossTrialRecoveredMap");
   if(!shader){shader=Shader.Find("Unlit/Transparent Cutout");Diagnostic="복원 맵 셰이더 없음 · 기본 Cutout으로 표시 중";}
   foreach(var property in ((JObject)scene["materials"]).Properties()) {
    var source=property.Value;var material=new Material(shader){name="Recovered · "+(string)source["name"]};
    Texture2D texture;textures.TryGetValue((string)source["texture"]??"",out texture);material.mainTexture=texture;
    if(!texture)Diagnostic="일부 원본 텍스처 누락 · prepare.ps1을 실행하세요.";
    material.mainTextureScale=V2(source["uvScale"],Vector2.one);material.mainTextureOffset=V2(source["uvOffset"],Vector2.zero);
    if(material.HasProperty("_Color"))material.SetColor("_Color",ColorOf(source["color"],Color.white));
    if(material.HasProperty("_Cutoff"))material.SetFloat("_Cutoff",source.Value<float?>("cutoff")??.5f);
    owned.Add(material);materials[property.Name]=material;
   }
   foreach(var r in scene["renderers"] as JArray??new JArray()) {
    var geometry=scene["geometry"]?[(string)r["geometry"]];if(geometry==null)continue;
    var positions=geometry["positions"] as JArray;if(positions==null||positions.Count==0)continue;
    var transformMatrix=Matrix(r["world"]);var vertices=new Vector3[positions.Count];
    for(int i=0;i<vertices.Length;i++)vertices[i]=transformMatrix.MultiplyPoint3x4(V3(positions[i]));
    var mesh=new Mesh{name="Recovered · "+(string)geometry["name"]};if(vertices.Length>65535)mesh.indexFormat=IndexFormat.UInt32;
    mesh.vertices=vertices;mesh.uv=Vectors2(geometry["uv"]);if(geometry["uv2"] is JArray)mesh.uv2=Vectors2(geometry["uv2"]);
    var all=geometry["submeshes"] as JArray;var selected=r["submeshes"] as JArray;var materialKeys=r["materials"] as JArray;
    int count=selected?.Count??all?.Count??0;if(count==0){Destroy(mesh);continue;}
    mesh.subMeshCount=count;var slots=new Material[count];
    for(int sub=0;sub<count;sub++) {
     int indexSub=selected==null?sub:selected[sub].Value<int>();var triangles=all?[indexSub] as JArray;var indices=new List<int>();
     foreach(var triangle in triangles??new JArray())foreach(var vertex in triangle as JArray??new JArray())indices.Add(vertex.Value<int>());
     mesh.SetTriangles(indices,sub);string key=materialKeys!=null&&materialKeys.Count>0?(string)materialKeys[Math.Min(sub,materialKeys.Count-1)]:"";
     Material material;materials.TryGetValue(key??"",out material);slots[sub]=material;
    }
    mesh.RecalculateBounds();mesh.RecalculateNormals();owned.Add(mesh);
    var go=new GameObject("Original · "+(string)r["name"]);go.layer=Layer;go.transform.SetParent(world.transform,false);go.AddComponent<MeshFilter>().sharedMesh=mesh;
    var renderer=go.AddComponent<MeshRenderer>();renderer.sharedMaterials=slots;renderer.shadowCastingMode=ShadowCastingMode.Off;renderer.receiveShadows=false;
    // Original lightmap UV2 is retained. This unlit shader adapter does not pretend PNG is Unity HDR data.
   }
  }
  void BuildFloorColliders() {
   foreach(var c in MapContract?["colliders"] as JArray??new JArray()) {
    var positions=c["positions"] as JArray;var triangles=c["triangles"] as JArray;if(positions==null||triangles==null)continue;
    var vertices=new Vector3[positions.Count];for(int i=0;i<vertices.Length;i++)vertices[i]=V3(positions[i]);
    var indices=new List<int>();foreach(var triangle in triangles)foreach(var n in triangle)indices.Add(n.Value<int>());
    var mesh=new Mesh{name="Native clipped floor collision"};if(vertices.Length>65535)mesh.indexFormat=IndexFormat.UInt32;mesh.vertices=vertices;mesh.triangles=indices.ToArray();mesh.RecalculateBounds();owned.Add(mesh);
    var go=new GameObject("Original floor Y10 · collision only");go.layer=Layer;go.transform.SetParent(world.transform,false);go.AddComponent<MeshCollider>().sharedMesh=mesh;
   }
  }
  public void SetSourceCamera(bool original) {
   SourceCamera=original;if(!cameraView||simulation==null)return;
   var raw=scene["camera"]["raw"];cameraView.orthographic=raw.Value<bool?>("orthographic")??false;
   cameraView.fieldOfView=raw.Value<float?>("field of view")??36;cameraView.orthographicSize=raw.Value<float?>("orthographic size")??5;
   cameraView.nearClipPlane=raw.Value<float?>("near clip plane")??.3f;cameraView.farClipPlane=raw.Value<float?>("far clip plane")??200;
   cameraView.transform.rotation=sourceRotation;
   if(original) {
    cameraView.transform.position=sourcePosition;cameraView.usePhysicalProperties=raw.Value<int?>("m_projectionMatrixMode")==2;
    cameraView.sensorSize=new Vector2(raw["m_SensorSize"].Value<float>("x"),raw["m_SensorSize"].Value<float>("y"));cameraView.focalLength=raw.Value<float>("m_FocalLength");
    cameraView.lensShift=new Vector2(raw["m_LensShift"].Value<float>("x"),raw["m_LensShift"].Value<float>("y"));cameraView.gateFit=(Camera.GateFitMode)(raw.Value<int?>("m_GateFitMode")??2);
   } else {
    // Explicit combat framing: original rotation and 36° FOV, +4 native X setback,
    // native-Z arena centre, zero projection lens shift. Geometry/actor coordinates stay untouched.
    cameraView.usePhysicalProperties=false;cameraView.lensShift=Vector2.zero;cameraView.fieldOfView=raw.Value<float?>("field of view")??36;
    cameraView.transform.position=new Vector3(sourcePosition.x+4,sourcePosition.y,(simulation.MinZ+simulation.MaxZ)*.5f);
   }
   cameraView.aspect=16f/9;
   if(!original) {
    float distance=Vector3.Dot(Point((simulation.MinZ+simulation.MaxZ)*.5f,1.3f)-cameraView.transform.position,cameraView.transform.forward);
    float visibleWidth=2*distance*Mathf.Tan(cameraView.fieldOfView*.5f*Mathf.Deg2Rad)*cameraView.aspect;
    if(visibleWidth<simulation.MaxZ-simulation.MinZ+1.4f)Diagnostic="전투 카메라 시야가 경기장보다 좁습니다. 16:9 출력과 카메라 계약을 확인하세요.";
   }
  }
  ActorView CreateActor(string path,HashSet<string> feet,string title) {
   if(string.IsNullOrEmpty(path))return null;
   SkeletonDataAsset data;
   if(!skeletons.TryGetValue(path,out data)) {
    var json=Resources.Load<TextAsset>("WebAssets/rpg/"+path);string directory=Path.GetDirectoryName(path).Replace('\\','/');var atlases=Resources.LoadAll<SpineAtlasAsset>("WebAssets/rpg/"+directory);
    if(!json||atlases.Length==0){Diagnostic="Spine 누락: "+path;return null;}
    data=SkeletonDataAsset.CreateRuntimeInstance(json,atlases,true);skeletons[path]=data;owned.Add(data);
   }
   var actor=SkeletonAnimation.NewSkeletonAnimationGameObject(data);actor.name=title;actor.transform.SetParent(world.transform,false);LayerAll(actor.transform);
   actor.UpdateTiming=UpdateTiming.ManualUpdate;actor.updateWhenInvisible=UpdateMode.FullUpdate;
   actor.AnimationState.SetAnimation(0,actor.Skeleton.Data.FindAnimation("stay1")??actor.Skeleton.Data.Animations.Items[0],true);
   actor.AnimationState.Apply(actor.Skeleton);actor.Skeleton.UpdateWorldTransform(Spine.Skeleton.Physics.Pose);
   float min,max;Bounds(actor.Skeleton,null,out min,out max);
   var visual=new ActorView{Spine=actor,BaseHeight=Math.Max(.001f,max-min),Feet=feet,Path=path};
   visual.Shadow=new GameObject("Ground anchor shadow");visual.Shadow.layer=Layer;visual.Shadow.transform.SetParent(world.transform,false);visual.ShadowLine=visual.Shadow.AddComponent<LineRenderer>();
   visual.ShadowLine.sharedMaterial=overlayMaterial;visual.ShadowLine.useWorldSpace=true;visual.ShadowLine.loop=true;visual.ShadowLine.positionCount=24;visual.ShadowLine.widthMultiplier=.15f;visual.ShadowLine.startColor=visual.ShadowLine.endColor=new Color(0,0,0,.28f);
   return visual;
  }
  ActorView Monster(TrialActor actor) {
   ActorView visual;string path=(string)index["monsters"]?[actor.MonsterId.ToString()]?["skeleton"];
   if(actors.TryGetValue(actor.Id,out visual)) {
    if(visual.Path==path)return visual;
    Destroy(visual.Spine.gameObject);Destroy(visual.Shadow);actors.Remove(actor.Id);
   }
   var feet=new HashSet<string>();foreach(var f in index["monsters"]?[actor.MonsterId.ToString()]?["groundSlots"] as JArray??new JArray())feet.Add(f.Value<string>());
   visual=CreateActor(path,feet,actor.Primary?simulation.Definition.Id+" · substitute "+actor.Id:actor.Name);
   if(visual!=null)actors[actor.Id]=visual;return visual;
  }
  public void UpdateView() {
   if(!world||simulation==null)return;
   var h=simulation.Hero;string action=h.Action==TrialAction.Attack?"attack"+(h.Combo==0?3:h.Combo):h.Action==TrialAction.Skill?"skill1":h.Action==TrialAction.Jump?"jump1":h.Action==TrialAction.Slide?"sliding1":h.Action==TrialAction.Dodge?"avoid1":h.Action==TrialAction.Move?"run1":h.Action==TrialAction.Hurt?"knockdown1":"stay1";
   if(simulation.Result==TrialResult.Victory)action="victory1";if(simulation.Result==TrialResult.Defeat)action="die1";
   DrawActor(hero,action,h.Z,h.Air,2.6f,h.Facing,h.AttackSerial,h.HurtRemaining>0?new Color(1,.55f,.55f):Color.white,false);
   var shown=new HashSet<int>();
   foreach(var actor in simulation.Actors) {
    var visual=Monster(actor);if(visual==null)continue;shown.Add(actor.Id);
    visual.Spine.gameObject.SetActive(actor.Alive||actor.Primary);visual.Shadow.SetActive(actor.Alive&&!actor.Clone);
    string clip=!actor.Alive?"die1":actor.Motion=="move"?"run1":actor.Motion=="attack"||actor.Motion=="windup"?"attack1":"stay1";
    float hover=0;
    if(actor.Primary&&simulation.Definition.Id=="B01"&&!simulation.WingGrounded&&(simulation.Phase==1||simulation.Phase==3))hover=.35f;
    if(actor.Primary&&simulation.Definition.Id=="B08")hover=.35f;
    Color tint=actor.Clone?new Color(.55f,.73f,.92f,.55f):actor.Egg?new Color(.65f,1,.45f):Color.white;
    if(actor.Shield>0)tint=new Color(.6f,.8f,1);
    if(actor.InvulnerableUntil>simulation.Time)tint=new Color(.7f,.65f,1,.65f);
    if(actor.VulnerableUntil>simulation.Time&&actor.InvulnerableUntil<=simulation.Time)tint=new Color(1,.65f,.35f);
    DrawActor(visual,clip,actor.Z,hover,actor.Height,actor.Facing,actor.Cast?.Serial??0,tint,actor.Clone);
   }
   var staleActors=new List<int>();
   foreach(var pair in actors)if(!shown.Contains(pair.Key)){Destroy(pair.Value.Spine.gameObject);Destroy(pair.Value.Shadow);staleActors.Add(pair.Key);}
   foreach(int key in staleActors)actors.Remove(key);
   var active=new HashSet<int>();
   foreach(var hazard in simulation.Hazards){if(hazard.Consumed)continue;active.Add(hazard.Id);DrawHazard(hazard);}
   var remove=new List<int>();foreach(var pair in hazards)if(!active.Contains(pair.Key)){Destroy(pair.Value.Root);owned.Remove(pair.Value.Mesh);Destroy(pair.Value.Mesh);remove.Add(pair.Key);}
   foreach(int key in remove)hazards.Remove(key);
  }
  void DrawActor(ActorView visual,string desired,float z,float air,float height,float facing,int serial,Color tint,bool noShadow) {
   if(visual==null||!visual.Spine)return;
   var actor=visual.Spine;var clip=actor.Skeleton.Data.FindAnimation(desired)??actor.Skeleton.Data.FindAnimation("stay1")??actor.Skeleton.Data.Animations.Items[0];
   bool loop=desired=="run1"||desired=="stay1";
   if(visual.Clip!=clip.Name||(!loop&&visual.Serial!=serial)){actor.AnimationState.SetAnimation(0,clip,loop);visual.Clip=clip.Name;visual.Serial=serial;}
   actor.Skeleton.ScaleX=facing<0?-1:1;actor.Skeleton.R=tint.r;actor.Skeleton.G=tint.g;actor.Skeleton.B=tint.b;actor.Skeleton.A=tint.a;
   float delta=simulation.Paused?0:simulation.Result==TrialResult.Playing?Mathf.Clamp(simulation.Time-visual.LastTime,0,.25f):Time.unscaledDeltaTime;
   visual.LastTime=simulation.Time;actor.AnimationState.Update(delta);
   actor.AnimationState.Apply(actor.Skeleton);actor.Skeleton.UpdateWorldTransform(Spine.Skeleton.Physics.Pose);
   float low,high;Bounds(actor.Skeleton,visual.Feet,out low,out high);float scale=height/visual.BaseHeight;
   if(desired=="sliding1") {
    float allLow,allHigh;Bounds(actor.Skeleton,null,out allLow,out allHigh);
    // Keep the rendered upper edge inside the same .72m low stance used by collision.
    scale=Math.Min(scale,.72f/Math.Max(.001f,allHigh-low));
   }
   actor.transform.rotation=cameraView.transform.rotation;actor.transform.localScale=Vector3.one*scale;
   actor.transform.position=Point(z,air)-actor.transform.rotation*(Vector3.up*low*scale);
   for(int i=0;i<24;i++){float angle=i*Mathf.PI*2/24;visual.ShadowLine.SetPosition(i,new Vector3(DepthX+Mathf.Cos(angle)*.4f,GroundY+.035f,z+Mathf.Sin(angle)*.65f));}
   visual.Shadow.SetActive(!noShadow&&simulation.Result!=TrialResult.Defeat);
  }
  void DrawHazard(TrialHazard h) {
   HazardView visual;
   if(!hazards.TryGetValue(h.Id,out visual)) {
    visual=new HazardView{Root=new GameObject("Hit volume · "+h.Label),Mesh=new Mesh{name="Shared visual/collision bounds"}};owned.Add(visual.Mesh);visual.Root.layer=Layer;visual.Root.transform.SetParent(world.transform,false);
    visual.Root.AddComponent<MeshFilter>().sharedMesh=visual.Mesh;visual.Renderer=visual.Root.AddComponent<MeshRenderer>();visual.Renderer.sharedMaterial=overlayMaterial;
    var ring=new GameObject("Ground footprint");ring.layer=Layer;ring.transform.SetParent(visual.Root.transform,false);visual.Circle=ring.AddComponent<LineRenderer>();visual.Circle.sharedMaterial=overlayMaterial;visual.Circle.useWorldSpace=true;visual.Circle.loop=true;visual.Circle.widthMultiplier=.08f;hazards[h.Id]=visual;
   }
   bool warning=h.Telegraph(simulation.Time);Color color=h.Friendly?new Color(.3f,.8f,1,.55f):warning?new Color(1,.72f,.15f,.28f):new Color(1,.12f,.12f,.62f);
   if(h.Damage==0)color=new Color(.6f,.4f,1,.22f);
   var block=new MaterialPropertyBlock();block.SetColor("_Color",color);visual.Renderer.SetPropertyBlock(block);visual.Circle.startColor=visual.Circle.endColor=new Color(color.r,color.g,color.b,.9f);
   var vertices=new List<Vector3>();var indices=new List<int>();
   if(h.Shape==TrialShape.Ring) {
    // Warning covers the future expanding path. Active bands match the collision
    // sweep, including the previous radius and the exact .32m half-width.
    float inner=Math.Max(0,Math.Min(h.PreviousRadius,h.Radius)-.32f),outer=Math.Max(h.PreviousRadius,h.Radius)+.32f;
    float radius=warning?Math.Abs(h.Speed)*(h.EndsAt-h.ActiveAt)+.32f:h.Radius;
    if(warning)Quad(vertices,indices,h.OriginZ-radius,h.OriginZ+radius,h.Y0,h.Y1);
    else {Quad(vertices,indices,h.OriginZ-outer,h.OriginZ-inner,h.Y0,h.Y1);Quad(vertices,indices,h.OriginZ+inner,h.OriginZ+outer,h.Y0,h.Y1);}
    GroundCircle(visual.Circle,h.OriginZ,radius);
   } else {
    float min=h.MinZ,max=h.MaxZ;
    if(h.Shape==TrialShape.Projectile&&!warning){min=Math.Min(min,h.PreviousZ-h.Radius);max=Math.Max(max,h.PreviousZ+h.Radius);}
    Quad(vertices,indices,min,max,h.Y0,h.Y1);
    if(h.Shape==TrialShape.Column)GroundCircle(visual.Circle,(h.Z0+h.Z1)*.5f,(h.MaxZ-h.MinZ)*.5f);
    else {visual.Circle.positionCount=4;visual.Circle.SetPositions(new[]{new Vector3(DepthX-.45f,GroundY+.05f,min),new Vector3(DepthX-.45f,GroundY+.05f,max),new Vector3(DepthX+.45f,GroundY+.05f,max),new Vector3(DepthX+.45f,GroundY+.05f,min)});}
   }
   visual.Mesh.Clear();visual.Mesh.SetVertices(vertices);visual.Mesh.SetTriangles(indices,0);visual.Mesh.RecalculateBounds();
  }
  void Quad(List<Vector3> vertices,List<int> indices,float z0,float z1,float y0,float y1) {
   int start=vertices.Count;float front=DepthX+.12f;
   vertices.Add(new Vector3(front,GroundY+y0,z0));vertices.Add(new Vector3(front,GroundY+y0,z1));vertices.Add(new Vector3(front,GroundY+y1,z1));vertices.Add(new Vector3(front,GroundY+y1,z0));
   indices.AddRange(new[]{start,start+1,start+2,start,start+2,start+3});
  }
  void GroundCircle(LineRenderer line,float z,float radius) { line.positionCount=40;for(int i=0;i<40;i++){float angle=i*Mathf.PI*2/40;line.SetPosition(i,new Vector3(DepthX+Mathf.Cos(angle)*Math.Min(radius,2),GroundY+.06f,z+Mathf.Sin(angle)*radius));} }
  public Vector2 Viewport(float z,float y) { if(!cameraView)return Vector2.zero;var p=cameraView.WorldToViewportPoint(Point(z,y));return new Vector2(p.x,1-p.y); }
  Vector3 Point(float z,float y) { return new Vector3(DepthX,GroundY+y,z); }
  static void Bounds(Skeleton skeleton,HashSet<string> feet,out float low,out float high) {
   low=float.PositiveInfinity;high=float.NegativeInfinity;
   foreach(var slot in skeleton.Slots) {
    if(feet!=null&&feet.Count>0&&!feet.Contains(slot.Data.Name))continue;
    float[] vertices;var mesh=slot.Attachment as MeshAttachment;var region=slot.Attachment as RegionAttachment;
    if(mesh!=null){vertices=new float[mesh.WorldVerticesLength];mesh.ComputeWorldVertices(slot,0,vertices.Length,vertices,0,2);}
    else if(region!=null){vertices=new float[8];region.ComputeWorldVertices(slot,vertices,0,2);}else continue;
    for(int n=1;n<vertices.Length;n+=2){low=Math.Min(low,vertices[n]);high=Math.Max(high,vertices[n]);}
   }
   if(float.IsInfinity(low)){if(feet!=null){Bounds(skeleton,null,out low,out high);return;}low=0;high=100;}
  }
  static void LayerAll(Transform root) { root.gameObject.layer=Layer;foreach(Transform child in root)LayerAll(child); }
  static Matrix4x4 Matrix(JToken token) { var m=Matrix4x4.identity;if(token==null)return m;for(int r=0;r<4;r++)for(int c=0;c<4;c++)m[r,c]=token[r][c].Value<float>();return m; }
  static Vector3 V3(JToken t) { return new Vector3(t[0].Value<float>(),t[1].Value<float>(),t[2].Value<float>()); }
  static Vector2 V2(JToken t,Vector2 fallback) { return t is JArray?new Vector2(t[0].Value<float>(),t[1].Value<float>()):fallback; }
  static Vector2[] Vectors2(JToken token) { var data=token as JArray;if(data==null)return new Vector2[0];var r=new Vector2[data.Count];for(int i=0;i<r.Length;i++)r[i]=V2(data[i],Vector2.zero);return r; }
  static Color ColorOf(JToken t,Color fallback) { return t==null?fallback:new Color(t.Value<float>("r"),t.Value<float>("g"),t.Value<float>("b"),t.Value<float?>("a")??1); }
  public void Clear() {
   if(cameraView)cameraView.targetTexture=null;if(Output)Output.Release();
   if(world)Destroy(world);world=null;cameraView=null;hero=null;actors.Clear();hazards.Clear();skeletons.Clear();
   foreach(var item in owned)if(item)Destroy(item);owned.Clear();Output=null;simulation=null;
  }
  void OnDestroy() { Clear(); }
 }
}
