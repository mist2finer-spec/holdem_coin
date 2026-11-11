using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace IslandGame {
 // A local preview world: it never starts RpgSession or changes its authority,
 // collision layers, fixed timestep, save data, equipment or scene list.
 public sealed partial class ElementalVfxLab : MonoBehaviour {
  public bool AutoCycle=true,Paused,ShowHitShapes=true,QuarterView=true,Sound=true,ResetOnCast=true;
  [Range(.1f,1.5f)] public float PlaybackSpeed=.65f;
  public ElementalAttackKind selectedKind=ElementalAttackKind.Sword;
  public int selectedTier=1;
  Scene labScene;PhysicsScene physicsScene;Transform world,heroModel;Camera labCamera;
  Battle3DAssets assets;BattleGroundingProfile.Model heroGround;RuntimeAnimationPlayer heroAnimation;
  readonly List<RuntimeAnimationPlayer> targetAnimations=new List<RuntimeAnimationPlayer>();
  readonly List<Material> ownedMaterials=new List<Material>();
  Transform pelvis,shoulder;float heroScale;bool ready,oldBackground;int oldTargetFrameRate;
  Font font;GUIStyle titleStyle,bodyStyle,smallStyle,buttonStyle,toggleStyle;Texture2D panelTexture;GUISkin localSkin;
  AudioSource audioSource;readonly AudioClip[] cues=new AudioClip[3];
  public bool Ready=>ready&&physicsScene.IsValid();
  public Camera LabCamera=>labCamera;

  void Start(){
   oldBackground=Application.runInBackground;Application.runInBackground=true;oldTargetFrameRate=Application.targetFrameRate;Application.targetFrameRate=60;
   labScene=SceneManager.CreateScene("Elemental lab physics · isolated",new CreateSceneParameters(LocalPhysicsMode.Physics3D));physicsScene=labScene.GetPhysicsScene();
   var root=new GameObject("Elemental VFX lab world");SceneManager.MoveGameObjectToScene(root,labScene);world=root.transform;
   assets=Resources.Load<Battle3DAssets>("Battle3DAssets");heroGround=BattleGroundingProfile.Load()?.Hero;
   BuildStage();BuildActors();BuildVisualPool();for(int i=0;i<drops.Length;i++)drops[i]=new Drop();
   font=IslandFonts.CreateGuiFont();BuildAudio();ready=true;Cast(selectedKind,selectedTier);
  }
  Material Surface(string name,Color color,float metallic=0){
   var m=new Material(Shader.Find("Universal Render Pipeline/Lit")){name=name};m.SetColor("_BaseColor",color);m.SetFloat("_Metallic",metallic);m.SetFloat("_Smoothness",.36f);ownedMaterials.Add(m);return m;
  }
  GameObject Shape(string name,PrimitiveType shape,Vector3 position,Vector3 scale,Material material,int layer,bool collider=true){
   var go=GameObject.CreatePrimitive(shape);go.name=name;go.transform.SetParent(world,false);go.transform.position=position;go.transform.localScale=scale;go.layer=layer;go.GetComponent<Renderer>().sharedMaterial=material;
   if(!collider)Destroy(go.GetComponent<Collider>());return go;
  }
  void BuildStage(){
   var floor=Surface("Lab · midnight slate",new Color(.055f,.10f,.16f));
   Shape("Ground",PrimitiveType.Cube,new Vector3(0,-.16f,0),new Vector3(26,.3f,22),floor,GroundLayer);
   var trim=Surface("Lab · brass inlay",new Color(.29f,.23f,.12f),.35f);
   for(int i=-6;i<=6;i++){Shape("Metre grid X",PrimitiveType.Cube,new Vector3(i,0,0),new Vector3(.012f,.008f,12),trim,0,false);Shape("Metre grid Z",PrimitiveType.Cube,new Vector3(0,0,i),new Vector3(12,.008f,.012f),trim,0,false);}
   var cover=Surface("Lab · collision cover",new Color(.20f,.27f,.32f),.2f);
   Shape("Projectile cover · 12 cm",PrimitiveType.Cube,new Vector3(-1.55f,.55f,-1.55f),new Vector3(1.4f,1.1f,.12f),cover,BlockerLayer);
   var glow=Surface("Lab · cover brass edge",new Color(.7f,.40f,.15f),.3f);Shape("Cover edge",PrimitiveType.Cube,new Vector3(-1.55f,1.11f,-1.55f),new Vector3(1.45f,.025f,.17f),glow,0,false);
   var cam=new GameObject("Elemental lab camera");cam.transform.SetParent(world);labCamera=cam.AddComponent<Camera>();cam.AddComponent<AudioListener>();labCamera.clearFlags=CameraClearFlags.SolidColor;labCamera.backgroundColor=new Color(.025f,.045f,.08f);labCamera.orthographic=true;labCamera.orthographicSize=4.6f;labCamera.rect=new Rect(.20f,0,.80f,1);labCamera.nearClipPlane=.1f;labCamera.farClipPlane=70;labCamera.depth=20;cam.AddComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>().requiresColorTexture=true;SetupPostProcessing();SetCamera();
   var light=new GameObject("Lab warm key");light.transform.SetParent(world);light.transform.rotation=Quaternion.Euler(48,-28,0);var key=light.AddComponent<Light>();key.type=LightType.Directional;key.color=new Color(1,.88f,.72f);key.intensity=1.35f;key.shadows=LightShadows.Soft;
   var fill=new GameObject("Lab blue rim");fill.transform.SetParent(world);fill.transform.position=new Vector3(-3,5,4);var rim=fill.AddComponent<Light>();rim.type=LightType.Point;rim.color=new Color(.24f,.58f,1);rim.intensity=4;rim.range=15;
  }
  public void SetCamera(){if(!labCamera)return;labCamera.transform.position=QuarterView?new Vector3(8,10,-12):new Vector3(1,5,-15);labCamera.transform.LookAt(new Vector3(.8f,.5f,0));}
  Material ActorMaterial(Material source,bool hero){
   var look=Resources.Load<BattleDioramaSettings>("BattleDioramaSettings");
   var m=new Material(hero?look.hero:look.lit){name=source.name+" · lab URP"};
   m.SetTexture("_BaseMap",source.mainTexture);m.SetColor("_BaseColor",source.HasProperty("_Color")?source.GetColor("_Color"):Color.white);
   if(m.HasProperty("_RimStrength"))m.SetFloat("_RimStrength",.13f);
   if(m.HasProperty("_OutlineWidth"))m.SetFloat("_OutlineWidth",.35f);
   ownedMaterials.Add(m);return m;
  }
  void BuildActors(){
   var heroRoot=new GameObject("Hero · attack presenter");heroRoot.transform.SetParent(world,false);
   heroModel=Instantiate(assets.hero,heroRoot.transform,false).transform;heroModel.name="Pink Glass · lab";heroAnimation=new RuntimeAnimationPlayer(heroModel.gameObject);
   heroAnimation.Sample(assets.idle,0);var heroMaterial=ActorMaterial(assets.heroMaterial,true);var slimeMaterial=ActorMaterial(assets.slimeMaterial,false);var skin=heroModel.GetComponentInChildren<SkinnedMeshRenderer>();heroScale=1.65f/(heroGround?.ReferenceHeight??skin.localBounds.size.y);
   foreach(var r in heroModel.GetComponentsInChildren<Renderer>()){r.sharedMaterial=heroMaterial;r.gameObject.layer=0;}
   heroModel.localScale=Vector3.one*heroScale;heroModel.localRotation=Quaternion.Euler(0,assets.heroYaw,0);
   Transform hand=null;foreach(var t in heroModel.GetComponentsInChildren<Transform>()){if(t.name.EndsWith(":Hips"))pelvis=t;if(t.name.EndsWith(":RightArm"))shoulder=t;if(t.name.EndsWith(":RightHand"))hand=t;}
   if(hand){var sword=new GameObject("Lab sword");sword.transform.SetParent(hand,false);sword.transform.localRotation=Quaternion.Euler(0,0,90);var steel=Surface("Lab · warm silver",new Color(.72f,.81f,.86f),.7f);
    var blade=Shape("Sword blade",PrimitiveType.Cube,Vector3.zero,new Vector3(.055f,.7f,.022f),steel,0,false);blade.transform.SetParent(sword.transform,false);blade.transform.localPosition=new Vector3(0,.42f,0);
    var guard=Shape("Sword guard",PrimitiveType.Cube,Vector3.zero,new Vector3(.25f,.04f,.06f),steel,0,false);guard.transform.SetParent(sword.transform,false);guard.transform.localPosition=new Vector3(0,.1f,0);
   }
   Vector3[] positions={new Vector3(1.25f,.46f,-.9f),new Vector3(1.75f,.46f,0),new Vector3(1.25f,.46f,.9f),new Vector3(-1.75f,.46f,.1f),new Vector3(0,.46f,2.3f),new Vector3(-2.6f,.46f,-2.6f),new Vector3(4.6f,.46f,3.6f)};
   string[] names={"FRONT A","FRONT B","FRONT C","LEFT","DEPTH","COVERED","OUTSIDE"};
   var ground=BattleGroundingProfile.Load()?.Slime;
   for(int i=0;i<positions.Length;i++){
    var go=new GameObject(names[i]);go.transform.SetParent(world,false);go.layer=TargetLayer;go.transform.position=positions[i];
    var target=go.AddComponent<ElementalLabTarget>();target.Home=positions[i];target.Label=names[i];target.Body=go.AddComponent<Rigidbody>();target.Body.mass=2;target.Body.linearDamping=2.2f;target.Body.angularDamping=5;target.Body.constraints=RigidbodyConstraints.FreezeRotation;target.Body.collisionDetectionMode=CollisionDetectionMode.ContinuousDynamic;
    var capsule=go.AddComponent<CapsuleCollider>();capsule.height=.9f;capsule.radius=.42f;
    var sensor=new GameObject("Compound hit shape");sensor.layer=TargetLayer;sensor.transform.SetParent(go.transform,false);var ball=sensor.AddComponent<SphereCollider>();ball.radius=.3f;ball.isTrigger=true;
    var model=Instantiate(assets.slime,go.transform,false);foreach(var r in model.GetComponentsInChildren<Renderer>()){r.sharedMaterial=slimeMaterial;r.gameObject.layer=0;}
    target.Skin=model.GetComponentInChildren<SkinnedMeshRenderer>();float scale=.50f/(ground?.ReferenceHeight??1);model.transform.localScale=Vector3.one*scale;model.transform.localPosition=Vector3.down*(.45f+(ground?.BaseFoot??0)*scale);
    var anim=new RuntimeAnimationPlayer(model);anim.Sample(assets.slimeIdle,0);targetAnimations.Add(anim);targets.Add(target);
   }
  }
  void Update(){if(!Ready)return;if(Input.GetKeyDown(KeyCode.Space))Cast(selectedKind,selectedTier);float wheel=Input.mouseScrollDelta.y;if(Mathf.Abs(wheel)>.01f)labCamera.orthographicSize=Mathf.Clamp(labCamera.orthographicSize-wheel*.25f,2.8f,6.5f);Advance(Time.unscaledDeltaTime);RenderVisuals();SampleActors();}
  void SampleActors(){
   AnimationClip clip=assets.idle;float t=Mathf.Repeat(clock,clip.length);
   if(casting){clip=profile.Kind==ElementalAttackKind.Sword?assets.HeroClip("attack"+profile.Tier):profile.Kind==ElementalAttackKind.Water?assets.spell:assets.heavy;
    float segment=profile.Kind==ElementalAttackKind.Lightning?Mathf.Min(1.25f,clip.length):clip.length;
    t=NativeCombatPresentation.MotionTime(CastAge,profile.Duration,profile.Windup+profile.Active*.5f,segment,segment*.45f);
   }
   heroAnimation.Sample(clip,t,Paused?0:Time.unscaledDeltaTime*PlaybackSpeed,casting?CombatPoseBlend.AttackContact:CombatPoseBlend.Locomotion);heroModel.localPosition=Vector3.zero;
   if(pelvis){var p=heroModel.parent.InverseTransformPoint(pelvis.position);heroModel.localPosition=new Vector3(-p.x,0,-p.z);}
   float height=heroGround?.BaseFoot??0;if(heroGround!=null)heroGround.TryHeight(clip,t,out height);heroModel.localPosition+=Vector3.down*(height*heroScale);
   if(casting&&profile.Kind!=ElementalAttackKind.Sword)ReferenceSkillPose.Apply(profile.Kind==ElementalAttackKind.Water?"skill2":"skill1",CastAge/profile.Duration,pelvis,shoulder);
   for(int i=0;i<targets.Count;i++){targetAnimations[i].Sample(assets.slimeIdle,Mathf.Repeat(clock+i*.19f,assets.slimeIdle.length));var target=targets[i];target.Properties.SetColor("_BaseColor",clock<target.FlashUntil?new Color(.55f,.8f,1):clock<target.WetUntil?new Color(.06f,.66f,.85f):new Color(.08f,.27f,.42f));target.Skin.SetPropertyBlock(target.Properties);}
  }
  void BuildAudio(){
   audioSource=gameObject.AddComponent<AudioSource>();audioSource.playOnAwake=false;audioSource.spatialBlend=0;audioSource.volume=.16f;
   for(int k=0;k<3;k++){int n=9600;var samples=new float[n];uint seed=42;for(int i=0;i<n;i++){seed=seed*1664525+1013904223;float u=i/(float)n,envelope=Mathf.Sin(Mathf.PI*u)*Mathf.Pow(1-u,2),noise=((seed>>8)%65536)/32768f-1;float freq=k==0?240-160*u:k==1?650-300*u:90+20*u;samples[i]=(noise*(k==2?.8f:.25f)+Mathf.Sin(i*freq*2*Mathf.PI/48000)*.25f)*envelope;}var cue=AudioClip.Create("Lab cue "+k,n,1,48000,false);cue.SetData(samples,0);cues[k]=cue;}
  }
  void PlayCue(ElementalAttackKind kind,bool impact){if(Sound&&audioSource)audioSource.PlayOneShot(cues[(int)kind],impact?1:.45f);}
  void EnsureGui(){if(localSkin)return;localSkin=Instantiate(GUI.skin);localSkin.font=font;panelTexture=new Texture2D(1,1);panelTexture.SetPixel(0,0,new Color(.025f,.055f,.095f,1));panelTexture.Apply();titleStyle=new GUIStyle(localSkin.label){fontSize=22,fontStyle=FontStyle.Bold};titleStyle.normal.textColor=new Color(.94f,.85f,.65f);bodyStyle=new GUIStyle(localSkin.label){fontSize=15,wordWrap=true};bodyStyle.normal.textColor=new Color(.75f,.87f,.94f);smallStyle=new GUIStyle(bodyStyle){fontSize=13};toggleStyle=new GUIStyle(localSkin.toggle){fontSize=15,fixedHeight=27};toggleStyle.normal.textColor=bodyStyle.normal.textColor;buttonStyle=new GUIStyle(localSkin.button){fontSize=15,fixedHeight=35};}
  void OnGUI(){
   if(!Ready)return;EnsureGui();var oldSkin=GUI.skin;var oldMatrix=GUI.matrix;GUI.skin=localSkin;float scale=Screen.height/900f;GUI.matrix=Matrix4x4.Scale(new Vector3(scale,scale,1));float width=Screen.width/scale;
   GUI.DrawTexture(new Rect(0,0,320,900),panelTexture);GUILayout.BeginArea(new Rect(33,30,264,835));
   GUILayout.Label("ELEMENTAL ATELIER",titleStyle);GUILayout.Label("원신 관찰 · VFX / 충돌 실험 · 휠 확대",smallStyle);GUILayout.Space(14);
   var kind=(ElementalAttackKind)GUILayout.Toolbar((int)selectedKind,new[]{"검기","물방울","번개"},buttonStyle);if(kind!=selectedKind){selectedKind=kind;selectedTier=1;Cast(selectedKind,selectedTier);}
   GUILayout.Space(8);int max=selectedKind==ElementalAttackKind.Sword?5:3;
   for(int i=1;i<=max;i++){int tier=i;var p=new ElementalAttackProfile(selectedKind,tier);if(GUILayout.Button((tier==selectedTier?"▶ ":"")+p.Label,buttonStyle))Cast(selectedKind,tier);}
   GUILayout.Space(12);if(GUILayout.Button("다시 재생   [SPACE]",buttonStyle))Cast(selectedKind,selectedTier);
   AutoCycle=GUILayout.Toggle(AutoCycle,"  전체 종류 자동 순환",toggleStyle);Paused=GUILayout.Toggle(Paused,"  일시정지",toggleStyle);ResetOnCast=GUILayout.Toggle(ResetOnCast,"  재생 시 표적 초기화",toggleStyle);ShowHitShapes=GUILayout.Toggle(ShowHitShapes,"  실제 판정 범위 표시",toggleStyle);bool quarter=GUILayout.Toggle(QuarterView,"  쿼터뷰 / 사이드뷰",toggleStyle);if(quarter!=QuarterView){QuarterView=quarter;SetCamera();}Sound=GUILayout.Toggle(Sound,"  효과음",toggleStyle);
   GUILayout.Space(8);GUILayout.Label("재생 속도  "+PlaybackSpeed.ToString("0.00")+"×",bodyStyle);PlaybackSpeed=GUILayout.HorizontalSlider(PlaybackSpeed,.1f,1.5f);
   GUILayout.Space(12);GUILayout.Label(profile.Label,titleStyle);GUILayout.Label(casting?(CastAge<profile.Windup?"준비 → 발사":CastAge<profile.Windup+profile.Active?"공격 / 충돌":"잔상 / 회복"):"대기",bodyStyle);
   GUILayout.Label("명중 "+TotalHits+"   벽 접촉 "+WallContacts+"\n활성 물방울 "+ActiveDropCount+"   입자 "+ParticleCount+"\n20ms 고정 물리 · 대상별 중복 타격 방지",smallStyle);
   GUILayout.Space(12);GUILayout.Label("금빛: 검격 / 청록: 물 / 보라: 번개\n회색 벽은 물방울을 반사합니다.\n젖음 4초 → 번개 피해 25% 증가\n실험 수치는 Island용 조정값입니다.",smallStyle);
   GUILayout.EndArea();
   GUI.DrawTexture(new Rect(332,18,width-350,54),panelTexture);GUI.Label(new Rect(348,27,width-380,40),"CAST "+castId.ToString("000")+"   /   "+profile.Label+"   /   "+(QuarterView?"QUARTER VIEW":"SIDE VIEW"),titleStyle);
   foreach(var t in targets){var p=labCamera.WorldToScreenPoint(t.Body.position+Vector3.up*.8f);if(p.z<0)continue;float x=p.x/scale,y=(Screen.height-p.y)/scale;GUI.Label(new Rect(x-55,y-25,140,50),t.Label+"\n"+(t.Hits>0?"−"+t.Damage.ToString("0")+" / "+t.Hits+" HIT":"READY"),smallStyle);}
   GUI.skin=oldSkin;GUI.matrix=oldMatrix;
  }
  void OnDestroy(){ready=false;Application.runInBackground=oldBackground;Application.targetFrameRate=oldTargetFrameRate;heroAnimation?.Dispose();foreach(var a in targetAnimations)a.Dispose();DisposeVisuals();if(postProfile){foreach(var c in postProfile.components)if(c)Destroy(c);Destroy(postProfile);}foreach(var m in ownedMaterials)if(m)Destroy(m);foreach(var c in cues)if(c)Destroy(c);if(localSkin)Destroy(localSkin);if(panelTexture)Destroy(panelTexture);if(font&&(font.hideFlags&HideFlags.DontSave)!=0)Destroy(font);if(labScene.IsValid()&&labScene.isLoaded)SceneManager.UnloadSceneAsync(labScene);}
 }
}
