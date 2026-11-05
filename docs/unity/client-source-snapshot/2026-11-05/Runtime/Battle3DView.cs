using System;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json.Linq;

namespace IslandGame {
 // Visual adapter only. The existing server, presentation clock and HUD own gameplay/time.
 public sealed class Battle3DView : MonoBehaviour {
  sealed class Actor {
   public GameObject root, model;
   public SkinnedMeshRenderer skin;
   public Mesh baked;public readonly List<Vector3> vertices=new List<Vector3>();
   public Transform leftFoot,rightFoot,pelvis;
   public AnimationClip clip;
   public string serial;
   public float time, scale, baseFoot, soleOffset;
  }
  public Battle3DAssets assets;
  readonly Dictionary<string,Actor> actors=new Dictionary<string,Actor>();
  readonly List<UnityEngine.Object> owned=new List<UnityEngine.Object>();
  Transform world;
  public string HeroClipName {get;private set;}
  public float HeroSampleTime {get;private set;}
  public float HeroGroundError {get;private set;}
  public int ActorCount=>actors.Count;
  Material ground,edge,bark,leaves,rock,steel,grip,shadow;
  public void Clear(){actors.Clear();world=null;foreach(var o in owned)if(o)Destroy(o);owned.Clear();}
  Material Mat(string name,Color color,float metallic=0){var m=new Material(Shader.Find("Standard")){name=name,color=color};m.SetFloat("_Glossiness",.2f);m.SetFloat("_Metallic",metallic);owned.Add(m);return m;}
  GameObject Shape(string name,PrimitiveType type,Transform parent,Vector3 p,Vector3 scale,Material material){
   var go=GameObject.CreatePrimitive(type);go.name=name;go.transform.SetParent(parent,false);go.transform.localPosition=p;go.transform.localScale=scale;go.layer=30;
   go.GetComponent<Renderer>().sharedMaterial=material;var collider=go.GetComponent<Collider>();if(collider)Destroy(collider);return go;
  }
  public void Build(Transform root,JObject map,Camera camera){
   world=root;actors.Clear();
   ground=Mat("Moss · sage",new Color(.29f,.40f,.25f));edge=Mat("Earth · warm slate",new Color(.24f,.21f,.18f));
   bark=Mat("Bark · walnut",new Color(.23f,.16f,.12f));leaves=Mat("Canopy · pine",new Color(.13f,.28f,.22f));rock=Mat("Stone · blue slate",new Color(.32f,.39f,.40f));
   steel=Mat("Sword · silver",new Color(.73f,.83f,.84f),.55f);grip=Mat("Sword · leather",new Color(.22f,.10f,.15f));shadow=Mat("Contact shadow · moss",new Color(.13f,.21f,.14f));
   var sun=new GameObject("Battle 3D · warm key");sun.transform.SetParent(root,false);sun.transform.rotation=Quaternion.Euler(42,-32,0);
   var light=sun.AddComponent<Light>();light.type=LightType.Directional;light.color=new Color(1,.89f,.73f);light.intensity=1.15f;light.shadows=LightShadows.Soft;light.cullingMask=1<<30;
   var fill=new GameObject("Battle 3D · cool fill");fill.transform.SetParent(root,false);fill.transform.rotation=Quaternion.Euler(35,150,0);var fl=fill.AddComponent<Light>();fl.type=LightType.Directional;fl.color=new Color(.58f,.75f,.84f);fl.intensity=.55f;fl.cullingMask=1<<30;
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
   camera.backgroundColor=new Color(.52f,.63f,.64f);camera.transform.rotation=Quaternion.Euler(9,0,0);camera.nearClipPlane=.1f;camera.farClipPlane=100;
  }
  void Floor(float a,float b,float y){
   Shape("Server room · earth",PrimitiveType.Cube,world,new Vector3((a+b)/2,y-.35f,.5f),new Vector3(b-a,.65f,3),edge);
   Shape("Server room · grass lip",PrimitiveType.Cube,world,new Vector3((a+b)/2,y-.025f,.5f),new Vector3(b-a,.05f,3),ground);
  }
  Actor Create(string id,bool hero){
   var prefab=hero?assets.hero:assets.slime;if(!prefab)return null;
   var root=new GameObject(hero?"Pink Glass · server hero":id+" · slime visual");root.transform.SetParent(world,false);
   var model=Instantiate(prefab,root.transform,false);model.name="Model";
   foreach(var t in model.GetComponentsInChildren<Transform>(true))t.gameObject.layer=30;root.layer=30;
   foreach(var animator in model.GetComponentsInChildren<Animator>())animator.enabled=false;
   var skin=model.GetComponentInChildren<SkinnedMeshRenderer>();
   var clip=hero?assets.idle:assets.slimeIdle;if(clip)clip.SampleAnimation(model,0);
   var mesh=new Mesh();skin.BakeMesh(mesh);var bound=mesh.bounds;owned.Add(mesh);
   float height=Mathf.Max(.001f,bound.size.y*Mathf.Abs(skin.transform.lossyScale.y));
   var a=new Actor{root=root,model=model,skin=skin,baked=mesh,scale=(hero?assets.heroHeight:assets.slimeHeight)/height};
   foreach(var renderer in model.GetComponentsInChildren<Renderer>()){
    renderer.sharedMaterial=hero?assets.heroMaterial:assets.slimeMaterial;
    renderer.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.On;renderer.receiveShadows=true;
   }
   skin.updateWhenOffscreen=true;
   foreach(var t in model.GetComponentsInChildren<Transform>()){
    if(t.name.EndsWith(":Hips"))a.pelvis=t;if(t.name.EndsWith(":LeftFoot"))a.leftFoot=t;if(t.name.EndsWith(":RightFoot"))a.rightFoot=t;
   }
   var low=skin.transform.TransformPoint(new Vector3(bound.center.x,bound.min.y,bound.center.z));
   a.baseFoot=root.transform.InverseTransformPoint(low).y;
   if(a.leftFoot&&a.rightFoot)a.soleOffset=Mathf.Min(root.transform.InverseTransformPoint(a.leftFoot.position).y,root.transform.InverseTransformPoint(a.rightFoot.position).y)-a.baseFoot;
   if(hero){
    Transform hand=null;foreach(var t in model.GetComponentsInChildren<Transform>())if(t.name.EndsWith(":RightHand")){hand=t;break;}
    if(hand){var sword=new GameObject("Presentation sword");sword.transform.SetParent(hand,false);sword.transform.localRotation=Quaternion.Euler(0,0,90);
     Shape("Leather grip",PrimitiveType.Cube,sword.transform,new Vector3(0,.02f,0),new Vector3(.055f,.18f,.055f),grip);
     Shape("Crossguard",PrimitiveType.Cube,sword.transform,new Vector3(0,.13f,0),new Vector3(.23f,.04f,.055f),steel);
     Shape("Blade",PrimitiveType.Cube,sword.transform,new Vector3(0,.43f,0),new Vector3(.075f,.60f,.025f),steel);
    }
   }
   Shape("Contact shadow",PrimitiveType.Cylinder,root.transform,new Vector3(0,.005f,0),new Vector3(hero?.48f:.6f,.004f,hero?.20f:.4f),shadow);
   actors[id]=a;return a;
  }
  public float Draw(string id,string action,float x,float elevation,float facing,string serial,float age,float duration,float hitAt,string kind,float advance,float visualTime){
   bool hero=id=="hero";Actor a;if(!actors.TryGetValue(id,out a))a=Create(id,hero);if(a==null)return 0;
   var clip=hero?assets.HeroClip(action):assets.slimeIdle;if(!clip)return 0;
   bool changed=a.clip!=clip||a.serial!=serial;if(changed){a.clip=clip;a.serial=serial;a.time=0;}
   bool loop=!hero||clip==assets.idle||clip==assets.run||clip==assets.jumpLoop||clip==assets.slide;
   a.time+=advance;
   float sample=loop?Mathf.Repeat(hero?a.time:visualTime,clip.length):Mathf.Min(a.time,clip.length);
   if(hero&&age>=0&&duration>0){
    if(kind=="attack"||kind=="skill")sample=NativeCombatPresentation.MotionTime(age,duration,hitAt,clip.length,clip.length*.45f);
    else if(kind=="rush"||kind=="dodge"||kind=="slide")sample=Mathf.Clamp01(age/duration)*clip.length;
   }
   clip.SampleAnimation(a.model,sample);
   a.root.transform.localScale=Vector3.one;
   a.model.transform.localScale=Vector3.one*a.scale;
   a.model.transform.localRotation=Quaternion.Euler(0,hero?assets.heroYaw*(facing<0?-1:1):0,0);
   a.model.transform.localPosition=Vector3.zero;
   float feet=a.baseFoot*a.scale;
   if(hero&&a.leftFoot&&a.rightFoot){
    // Remove source root travel/vertical drift; the server owns all displacement.
    var lp=a.root.transform.InverseTransformPoint(a.leftFoot.position);var rp=a.root.transform.InverseTransformPoint(a.rightFoot.position);
    feet=Mathf.Min(lp.y,rp.y)-a.soleOffset*a.scale;
    if(a.pelvis){var p=a.root.transform.InverseTransformPoint(a.pelvis.position);a.model.transform.localPosition=new Vector3(-p.x,0,-p.z);}
   }
   if(hero){
    // Ground the deformed body, including rolls/low attacks whose feet rise above the torso.
    a.skin.BakeMesh(a.baked);a.baked.GetVertices(a.vertices);
    var matrix=a.root.transform.worldToLocalMatrix*a.skin.transform.localToWorldMatrix;
    feet=float.PositiveInfinity;foreach(var vertex in a.vertices)feet=Mathf.Min(feet,matrix.MultiplyPoint3x4(vertex).y);
   }
   a.model.transform.localPosition+=Vector3.down*feet;
   a.root.transform.position=new Vector3(x/100,elevation/100,0);
   if(!hero){
    float bounce=action.Contains("attack")?.06f:0;a.model.transform.localPosition+=Vector3.up*(Mathf.Abs(Mathf.Sin(visualTime*5))*bounce);
    if(action.Contains("death")||action.Contains("die"))a.model.transform.localScale=new Vector3(a.scale*1.25f,a.scale*.3f,a.scale*1.25f);
   }
   if(hero){HeroClipName=clip.name;HeroSampleTime=sample;HeroGroundError=a.model.transform.localPosition.y+feet;}
   return sample;
  }
  static Transform Find(Transform root,string name){foreach(var t in root.GetComponentsInChildren<Transform>())if(t.name==name)return t;return null;}
  public void ShowOnly(HashSet<string> shown){foreach(var pair in actors)pair.Value.root.SetActive(shown.Contains(pair.Key));}
  public void Follow(Camera camera,float x,float elevation,float delta){
   var framing=camera.GetComponent<CameraHorizontalWidthLock>();
   var target=framing?framing.PositionForGround(new Vector3(x/100,elevation/100,0)):new Vector3(x/100,elevation/100+camera.orthographicSize*.70f+10*Mathf.Tan(9*Mathf.Deg2Rad),-10);
   camera.transform.position=Vector3.Lerp(camera.transform.position,target,1-Mathf.Exp(-delta*14));
  }
  void OnDestroy(){Clear();}
 }
}
