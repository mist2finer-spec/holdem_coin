using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace IslandGame.BossTrials {
 /// <summary>Additive host for the IMGUI prototype and an existing uGUI button's ShowMenu event.</summary>
 public sealed class BossTrialController : MonoBehaviour {
  public bool ShowOnStart;
  public bool Visible { get; private set; }
  public BossTrialSimulation Simulation { get; private set; }
  public event Action Returned;
  enum Page { Menu, Loading, Battle }
  Page page;
  TrialCatalog catalog;
  BossTrialRenderer view;
  JObject capturedSnapshot,mapContract;
  string weapon="axe",snapshotLabel="시험 장비",failure="";
  int selected;
  float loadAt,touchMove;
  bool touchAttack,pausedBeforeSource,leftHeld,rightHeld,attackHeld;
  TrialInput queued;
  Vector2 scroll;
  [NonSerialized] Font font;
  GUIStyle label,small,title;
  readonly Dictionary<string,string> weaponLabels=new Dictionary<string,string>{{"axe","도끼"},{"sword","검"},{"dual","쌍검"},{"spear","창"}};
  void Start() { if(ShowOnStart&&!Visible)ShowMenu(); }
  public void ShowMenu() {
   var host=UnityEngine.Object.FindFirstObjectByType<IslandApp>();
   if(host) {
    // Reflection keeps the additive launcher compilable before a user's locally edited
    // IslandApp has merged the staged hook. Never run over an active online host.
    var hook=host.GetType().GetMethod("OpenBossTrials",Type.EmptyTypes);
    if(hook!=null){hook.Invoke(host,null);return;}
    StopTrial();catalog=null;failure="기존 IslandApp 연결을 먼저 병합하세요.\nDungeon 버튼 → IslandApp.OpenBossTrials\n또는 Island > Boss Trial Test 독립 장면을 사용하세요.";Visible=true;page=Page.Menu;return;
   }
   OpenMenu(null);
  }
  public void OpenMenu(JObject serverSnapshot) {
   try {
    foreach(var session in UnityEngine.Object.FindObjectsByType<RpgSession>(FindObjectsInactive.Include,FindObjectsSortMode.None))if(session.Active)throw new InvalidOperationException("온라인 RPG 세션이 활성 상태입니다. IslandApp.OpenBossTrials 연결로 입장하세요.");
    var resource=Resources.Load<TextAsset>("BossTrials/bosses");if(!resource)throw new InvalidOperationException("BossTrials/bosses.json이 없습니다.");
    catalog=TrialCatalog.Parse(resource.text);var map=Resources.Load<TextAsset>("BossTrials/map-contract");mapContract=map?JObject.Parse(map.text):null;
    // Immutable capture: no retained reference into RpgSession.State and no write-back API.
    capturedSnapshot=serverSnapshot==null?null:(JObject)serverSnapshot.DeepClone();
    ReadAppearance();failure="";
   } catch(Exception ex) { failure=ex.Message;catalog=null; }
   if(!view)view=gameObject.AddComponent<BossTrialRenderer>();
   StopTrial();Visible=true;page=Page.Menu;scroll=Vector2.zero;
  }
  void ReadAppearance() {
   weapon="axe";snapshotLabel="시험 장비 · 도끼";
   if(capturedSnapshot==null)return;
   var progress=capturedSnapshot["progress"] as JObject;string selectedWeapon=(string)progress?["weaponType"]??(string)capturedSnapshot["weapon"];
   var equipment=progress?["equipment"] as JObject;string id=(string)(equipment?["equipped"] as JObject)?["weapon"];
   foreach(var item in equipment?["items"] as JArray??new JArray())if((string)item["instanceId"]==id)selectedWeapon=(string)item["weaponType"]??selectedWeapon;
   if(selectedWeapon!=null&&weaponLabels.ContainsKey(selectedWeapon))weapon=selectedWeapon;
   snapshotLabel="서버 스냅샷의 무기 외형 · "+weaponLabels[weapon];
  }
  public void Hide() { StopTrial();Visible=false;capturedSnapshot=null;Returned?.Invoke(); }
  public void SelectBoss(int index) { if(catalog==null||index<0||index>=catalog.Bosses.Count)return;selected=index;StartTrial(); }
  public void Retry() { if(catalog!=null)StartTrial(); }
  public void ReturnToSelection(){StopTrial();page=Page.Menu;scroll=Vector2.zero;}
  public void SubmitInput(TrialInput input){queued.Move=input.Move;queued.Attack|=input.Attack;queued.Jump|=input.Jump;queued.Slide|=input.Slide;queued.Skill|=input.Skill;if(input.Dodge!=0)queued.Dodge=input.Dodge;}
  public void TogglePause(){if(Simulation==null||view.SourceCamera||!string.IsNullOrEmpty(failure))return;Simulation.Paused=!Simulation.Paused;queued=new TrialInput();touchMove=0;touchAttack=false;leftHeld=rightHeld=attackHeld=false;}
  public void ToggleSourceCamera(){if(Simulation==null)return;if(!view.SourceCamera){pausedBeforeSource=Simulation.Paused;Simulation.Paused=true;view.SetSourceCamera(true);}else{view.SetSourceCamera(false);Simulation.Paused=pausedBeforeSource;}queued=new TrialInput();touchMove=0;touchAttack=false;leftHeld=rightHeld=attackHeld=false;}
  void StartTrial() {
   StopTrial();page=Page.Loading;loadAt=Time.unscaledTime+.25f;failure="";queued=new TrialInput();touchMove=0;touchAttack=false;leftHeld=rightHeld=attackHeld=false;
  }
  void StopTrial() { Simulation?.Abandon();Simulation=null;if(view)view.Clear();queued=new TrialInput();touchMove=0;touchAttack=false;leftHeld=rightHeld=attackHeld=false; }
  void EnterBattle() {
   try {
    JObject arena=null;string wanted=(string)mapContract?["defaultArena"]??"west";
    foreach(var candidate in mapContract?["arenas"] as JArray??new JArray())if((string)candidate["id"]==wanted)arena=candidate as JObject;
    Simulation=new BossTrialSimulation(catalog.Bosses[selected],weapon,8731,arena?.Value<float?>("minZ")??-61,arena?.Value<float?>("maxZ")??-37,arena?.Value<float?>("playerZ")??-56,arena?.Value<float?>("bossZ")??-42);
    view.Build(Simulation);page=Page.Battle;
    if(!string.IsNullOrEmpty(view.Diagnostic)){Simulation.Paused=true;failure=view.Diagnostic;}
   } catch(Exception ex) { StopTrial();page=Page.Menu;failure="시험 초기화 실패: "+ex.Message;Debug.LogException(ex); }
  }
  void Update() {
   if(!Visible)return;
   if(page==Page.Loading&&Time.unscaledTime>=loadAt){EnterBattle();return;}
   if(page!=Page.Battle||Simulation==null)return;
   if(Input.GetKeyDown(KeyCode.Escape)&&!view.SourceCamera&&string.IsNullOrEmpty(failure)){Simulation.Paused=!Simulation.Paused;queued=new TrialInput();}
   if(!Simulation.Paused&&Simulation.Result==TrialResult.Playing&&string.IsNullOrEmpty(failure)) {
    var input=queued;queued=new TrialInput();
    float keyboard=(Input.GetKey(KeyCode.A)||Input.GetKey(KeyCode.LeftArrow)?-1:0)+(Input.GetKey(KeyCode.D)||Input.GetKey(KeyCode.RightArrow)?1:0);
    input.Move=Math.Abs(touchMove)>.01f?touchMove:Math.Abs(input.Move)>.01f?input.Move:keyboard;
    input.Attack|=touchAttack||Input.GetKey(KeyCode.Space)||Input.GetKey(KeyCode.K);
    input.Jump|=Input.GetKeyDown(KeyCode.J)||Input.GetKeyDown(KeyCode.W)||Input.GetKeyDown(KeyCode.UpArrow);
    input.Slide|=Input.GetKeyDown(KeyCode.S)||Input.GetKeyDown(KeyCode.DownArrow)||Input.GetKeyDown(KeyCode.LeftShift);
    input.Skill|=Input.GetKeyDown(KeyCode.Alpha1);
    if(Input.GetKeyDown(KeyCode.Q))input.Dodge=-1;if(Input.GetKeyDown(KeyCode.E))input.Dodge=1;
    Simulation.Advance(Time.unscaledDeltaTime,input);
   }
   view.UpdateView();
  }
  void OnApplicationFocus(bool focus) { if(!focus){touchMove=0;touchAttack=leftHeld=rightHeld=attackHeld=false;queued=new TrialInput();if(Simulation!=null)Simulation.Paused=true;} }
  void OnDisable() { StopTrial();Visible=false; }
  void EnsureStyles() {
   if(label!=null)return;
   font=Font.CreateDynamicFontFromOSFont(new[]{"Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR","Arial"},14);
   font.hideFlags=HideFlags.DontSave;
   label=new GUIStyle(GUI.skin.label){font=font,fontSize=13,wordWrap=true};small=new GUIStyle(label){fontSize=11};title=new GUIStyle(label){fontSize=19,fontStyle=FontStyle.Bold};
  }
  void OnGUI() {
   if(!Visible)return;EnsureStyles();
   Matrix4x4 previous=GUI.matrix;Color color=GUI.color;int depth=GUI.depth;Font previousFont=GUI.skin.font;GUI.depth=-50;GUI.skin.font=font;
   GUI.matrix=Matrix4x4.identity;GUI.color=new Color(.025f,.03f,.045f);GUI.DrawTexture(new Rect(0,0,Screen.width,Screen.height),Texture2D.whiteTexture);GUI.color=Color.white;
   var safe=Screen.safeArea;float scale=Math.Min(safe.width/390f,safe.height/844f),left=safe.x+(safe.width-390*scale)*.5f,top=Screen.height-safe.yMax+(safe.height-844*scale)*.5f;
   GUI.matrix=Matrix4x4.TRS(new Vector3(left,top),Quaternion.identity,new Vector3(scale,scale,1));
   GUI.color=new Color(.055f,.065f,.085f);GUI.DrawTexture(new Rect(0,0,390,844),Texture2D.whiteTexture);GUI.color=Color.white;
   GUI.Label(new Rect(14,10,360,32),"보스 시험 · UNITY",title);GUI.Label(new Rect(14,43,365,37),"로컬 샌드박스 · 온라인 보상 / 계정 저장 없음",small);
   if(page==Page.Menu)DrawMenu();else if(page==Page.Loading)GUI.Label(new Rect(35,300,325,130),catalog.Bosses[selected].Name+"\n원본 회랑과 Spine 배우를 준비하는 중…",title);else DrawBattle();
   GUI.matrix=previous;GUI.color=color;GUI.depth=depth;GUI.skin.font=previousFont;
  }
  void DrawMenu() {
   if(GUI.Button(new Rect(300,10,76,28),"돌아가기"))Hide();
   GUI.Label(new Rect(14,79,360,38),"던전 > 10종 보스 선택",title);
   GUI.Label(new Rect(14,114,365,48),snapshotLabel+"\n고정 시험 수치: HP 360 · 기본 타격 62 / 3타 84",small);
   int column=0;foreach(var pair in weaponLabels){GUI.backgroundColor=weapon==pair.Key?new Color(.65f,.85f,1):Color.white;if(GUI.Button(new Rect(14+column++*92,164,86,31),pair.Value)){weapon=pair.Key;snapshotLabel="선택한 시험 무기 · "+pair.Value;}}GUI.backgroundColor=Color.white;
   GUI.Label(new Rect(14,201,364,45),"A/D 이동 · Space 공격 · J 점프 · S 슬라이드\nQ/E 회피 · 1 서리 파동(시험 기술) · 패리 없음",small);
   if(catalog==null){GUI.Label(new Rect(20,280,350,200),failure,label);return;}
   scroll=GUI.BeginScrollView(new Rect(10,250,370,500),scroll,new Rect(0,0,345,catalog.Bosses.Count*112));
   for(int i=0;i<catalog.Bosses.Count;i++) {
    var b=catalog.Bosses[i];float y=i*112;GUI.Box(new Rect(0,y,342,104),"");
    GUI.Label(new Rect(10,y+7,325,24),b.Id+"  "+b.Name,label);
    GUI.Label(new Rect(10,y+32,244,31),b.Theme+" · HP "+b.MaxHp+" · "+(b.PhaseThresholds.Length+1)+" 페이즈",small);
    GUI.Label(new Rect(10,y+62,244,34),"대체 외형: "+b.Substitute,small);
    if(GUI.Button(new Rect(264,y+37,67,52),"도전"))SelectBoss(i);
   }
   GUI.EndScrollView();
   GUI.Label(new Rect(14,759,365,70),string.IsNullOrEmpty(failure)?"원본 Map002_001 메시 / UV / 텍스처 사용.\n드래곤·메카 전용 그림 대신 명시된 원본 캐릭터를 사용합니다.":failure,small);
  }
  void DrawBattle() {
   var sim=Simulation;if(sim==null)return;
   var d=sim.Definition;GUI.Label(new Rect(14,78,362,26),d.Id+" "+d.Name,title);
   if(GUI.Button(new Rect(300,10,76,28),"보스 목록")){ReturnToSelection();return;}
   Bar(new Rect(14,111,362,17),sim.BossHp/sim.BossMaxHp,new Color(.88f,.24f,.3f));
   GUI.Label(new Rect(18,110,354,20),"HP "+Math.Ceiling(sim.BossHp)+" / "+sim.BossMaxHp+"    P"+sim.Phase+(d.Id=="B08"?" · 잔여 "+sim.LivingPrimaries+"/5":""),small);
   Rect viewport=new Rect(8,136,374,210.375f);
   if(view.Output)GUI.DrawTexture(viewport,view.Output,ScaleMode.StretchToFill,false);
   if(sim.DarknessUntil>sim.Time){GUI.color=new Color(.02f,.025f,.06f,.34f);GUI.DrawTexture(viewport,Texture2D.whiteTexture);GUI.color=Color.white;}
   DrawWorldLabels(viewport);
   GUI.Label(new Rect(14,352,365,38),"대체 외형: "+d.Substitute,small);
   Bar(new Rect(14,387,362,17),sim.Hero.Hp/sim.Hero.MaxHp,new Color(.3f,.75f,.48f));GUI.Label(new Rect(18,386,350,20),"홍 HP "+Math.Ceiling(sim.Hero.Hp)+" / "+sim.Hero.MaxHp,small);
   Bar(new Rect(14,408,362,11),sim.Hero.Stamina/100,new Color(.3f,.66f,.9f));
   GUI.Label(new Rect(14,426,365,42),sim.LastNotice,label);
   GUI.Label(new Rect(14,473,365,30),sim.OverloadAt>0?"과부하까지 "+Math.Max(0,Math.Ceiling(sim.OverloadAt-sim.Time))+"초 · 표식 반대편 안전":"경고=노랑 · 판정=빨강 · 낮음은 점프 / 상단은 슬라이드",small);
   bool enabled=sim.Result==TrialResult.Playing&&!sim.Paused&&string.IsNullOrEmpty(failure);GUI.enabled=enabled;
   HeldButton(new Rect(14,520,74,67),"◀\nA",ref leftHeld);HeldButton(new Rect(302,520,74,67),"▶\nD",ref rightHeld);touchMove=leftHeld?-1:rightHeld?1:0;
   HeldButton(new Rect(100,520,190,67),"공격 · 누르기 / Space",ref attackHeld);touchAttack=attackHeld;
   if(GUI.Button(new Rect(14,600,115,47),"점프 · J"))queued.Jump=true;
   if(GUI.Button(new Rect(137,600,115,47),"슬라이드 · S"))queued.Slide=true;
   if(GUI.Button(new Rect(260,600,116,47),sim.Hero.SkillCooldown>0?"서리 "+sim.Hero.SkillCooldown.ToString("0.0"):"서리 파동 · 1"))queued.Skill=true;
   if(GUI.Button(new Rect(14,658,175,44),"회피 ◀ · Q"))queued.Dodge=-1;
   if(GUI.Button(new Rect(201,658,175,44),"회피 ▶ · E"))queued.Dodge=1;
   GUI.enabled=true;
   GUI.Label(new Rect(14,712,365,42),"서리 파동은 고정 시험 기술입니다. 장비·에르텔 효과는\n기존 서버 전투에서 계산하며 이 시험에 복제하지 않습니다.",small);
   if(GUI.Button(new Rect(14,762,113,31),sim.Paused?"계속 / Esc":"일시정지"))TogglePause();
   if(GUI.Button(new Rect(135,762,113,31),"다시 도전"))Retry();
   if(GUI.Button(new Rect(256,762,120,31),view.SourceCamera?"전투 카메라":"원본 카메라")) {
    ToggleSourceCamera();
   }
   GUI.Label(new Rect(14,802,365,35),view.SourceCamera?"원본 카메라 좌표·렌즈 검사 · 전투 일시정지":"전투 프레이밍: 원본 회전/FOV · X+4m · Z 중앙 · 렌즈 이동 0",small);
   if(sim.Paused||sim.Result!=TrialResult.Playing) {
    GUI.color=new Color(.025f,.035f,.055f,.94f);GUI.DrawTexture(new Rect(49,201,292,115),Texture2D.whiteTexture);GUI.color=Color.white;
    string caption=sim.Result==TrialResult.Victory?"승리 · 시험 완료":sim.Result==TrialResult.Defeat?"패배 · 다시 도전":view.SourceCamera?"원본 카메라 검사":"일시정지";
    GUI.Label(new Rect(65,213,264,33),caption,title);
    GUI.Label(new Rect(65,253,260,55),string.IsNullOrEmpty(failure)?"기록은 이번 시험에서만 유지됩니다.\n아래 버튼으로 재도전 / 목록으로 돌아갑니다.":failure,small);
   }
  }
  void DrawWorldLabels(Rect rect) {
   foreach(var actor in Simulation.Actors)if(actor.Alive) {
    Vector2 p=view.Viewport(actor.Z,actor.Height+.55f);if(p.x<0||p.x>1||p.y<0||p.y>1)continue;
    float x=rect.x+p.x*rect.width,y=rect.y+p.y*rect.height;
    GUI.Label(new Rect(x-40,y-17,90,18),actor.Egg?"알 · "+Math.Max(0,Math.Ceiling(actor.HatchAt-Simulation.Time))+"초":actor.Clone?"분신":actor.Primary?Simulation.Definition.Id:"소환수",small);
    Bar(new Rect(x-25,y,50,4),actor.Hp/actor.MaxHp,actor.Clone?new Color(.55f,.7f,.9f):new Color(.95f,.35f,.35f));
   }
   foreach(var h in Simulation.Hazards) {
    if(h.Friendly||h.Consumed||!h.Telegraph(Simulation.Time))continue;
    var p=view.Viewport((h.Z0+h.Z1)*.5f,Math.Min(4,h.Y1)+.4f);if(p.x<0||p.x>1)continue;
    GUI.color=new Color(1,.88f,.35f);GUI.Label(new Rect(rect.x+p.x*rect.width-70,rect.y+p.y*rect.height,140,20),h.Effect=="half"?h.Hint:h.Band=="low"?"낮음 · 점프":h.Band=="high"?"상단 · 슬라이드":h.Shape==TrialShape.Column?"표식 밖으로":"경고",small);GUI.color=Color.white;
   }
   foreach(var text in Simulation.Texts) {
    var p=view.Viewport(text.Z,text.Y+(text.Until-Simulation.Time)*.15f);if(p.x<0||p.x>1||p.y<0||p.y>1)continue;
    GUI.color=text.Damage?new Color(1,.7f,.4f):new Color(.65f,.9f,1);GUI.Label(new Rect(rect.x+p.x*rect.width-45,rect.y+p.y*rect.height,140,28),text.Text,small);GUI.color=Color.white;
   }
  }
  static void Bar(Rect rect,float ratio,Color color) { GUI.color=new Color(.14f,.16f,.2f);GUI.DrawTexture(rect,Texture2D.whiteTexture);GUI.color=color;GUI.DrawTexture(new Rect(rect.x,rect.y,rect.width*Mathf.Clamp01(ratio),rect.height),Texture2D.whiteTexture);GUI.color=Color.white; }
  static void HeldButton(Rect rect,string text,ref bool held){
   // Layout/Repaint must not release a held control between player updates.
   var kind=Event.current.rawType;var point=Event.current.mousePosition;int button=Event.current.button;
   GUI.RepeatButton(rect,text);
   if(!GUI.enabled||kind==EventType.MouseUp)held=false;
   else if(kind==EventType.MouseDown&&button==0)held=rect.Contains(point);
  }
  void OnDestroy(){label=small=title=null;if(font)Destroy(font);font=null;}
 }
}
