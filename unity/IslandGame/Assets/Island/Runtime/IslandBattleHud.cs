using System;
using System.Collections.Generic;
using TMPro;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.EventSystems;

namespace IslandGame {
 // Presentation only: every action uses IslandApp -> RpgSession -> the existing server.
 // Layout (2026-11-21, ref_4 ratio): the battle view fills the whole screen and the HUD overlays it. HUD rectangles follow the art-lead v1
 // manifest (maintenance/ui-ref4-20261121/art/v1/manifest.json, 1080x2340 top-left pixels). Manual controls stay shown and usable with AUTO on or off;
 // the six menus moved into the top-right menu popup. Sprites come from IslandHudSkin slots, procedural IslandHudArt while they are empty.
 [DefaultExecutionOrder(-200)]
 public sealed class IslandBattleHud:MonoBehaviour {
  const float RefHeight=2340;
  IslandFrameBudget budget;float nextRefresh;bool lastActive,lastEnded;
  void Awake(){budget=IslandFrameBudget.Ensure(gameObject);}
  RectTransform bossBar;UnityEngine.UI.Image bossFill;TextMeshProUGUI bossName;public bool BossBarVisible=>bossBar&&bossBar.gameObject.activeSelf;public float BossHealthFraction=>bossFill?bossFill.rectTransform.anchorMax.x:0;
  IslandApp app;RectTransform safe,frame,stage,hud,top,bottom,manualRoot,menuBlocker,menuPopup;CanvasGroup manual;
  GameObject root;Canvas canvas;[NonSerialized] TMP_FontAsset font;UnityEngine.UI.RawImage viewport;
  RectTransform dungeonPanel;GameObject escapePopup;
  readonly UnityEngine.UI.Button[] skillButtons=new UnityEngine.UI.Button[6];
  readonly UnityEngine.UI.Image[] icons=new UnityEngine.UI.Image[6],sweeps=new UnityEngine.UI.Image[6];
  readonly GameObject[] locks=new GameObject[6];
  readonly TextMeshProUGUI[] numbers=new TextMeshProUGUI[6],damage=new TextMeshProUGUI[24];
  readonly string[] iconIds=new string[6];
  readonly Dictionary<string,Sprite> sprites=new Dictionary<string,Sprite>();
  IslandHudArt hpOrb;Meter hpFill,hpDelay,mpFill,gauge;float hpDelayed=1;
  TextMeshProUGUI title,gold,chamber,objective,hpText,manaText,levelText,modeText,autoText,autoState,notice,overlayText,viewText;
  UnityEngine.UI.Button autoButton,attackButton,jump,slide,roll,hpPotion,manaPotion,retry,menuButton;
  GameObject menuIcon,closeIcon;
  TextMeshProUGUI hpPotionText,manaPotionText,directionText;IslandHudStick stick;RectTransform knob;
  GameObject overlay;UnityEngine.UI.Image stageTap;IslandHudArt autoArt;
  readonly Vector3[] viewportCorners=new Vector3[4];
  bool outputDirty=true;bool outputWas3D;NativeBattle outputBattle;Vector2 outputSize;
  float oldWidth=-1,oldHeight=-1;Rect oldSafe;bool ownsEventSystem;GameObject events;
  bool menuOpen,autoShown;int autoSkin=-1;
  public bool Visible=>root&&root.activeInHierarchy;
  public bool EscapePopupVisible=>escapePopup&&escapePopup.activeInHierarchy;
  public bool MenuOpen=>menuOpen;
  public bool ManualControlsVisible=>manual&&manual.blocksRaycasts&&manual.alpha>0;
  public TMP_FontAsset RuntimeFont=>font;
  public int UiDispatches{get;private set;}
  public string LastInput{get;private set;}
  // U0-4 development kit tempo buttons (K6 stage 0/1/2). The chosen stage is remembered for the next boot (Battle3DAssets.WithRunOptions).
  readonly UnityEngine.UI.Button[] tempoButtons=new UnityEngine.UI.Button[3];TextMeshProUGUI tempoLabel;int tempoChosen=-1,tempoShown=-2;bool tempoVisible=true;
  public int DevKitTempoChosen=>tempoChosen;
  // T1b development quality readout (IslandFrameBudget level 0-3) and (Q1) the rule switch A -> old -> 0-pin. Shown whenever DevControls is on
  // (any hero), under the tempo row. The pin is not saved: a new app starts on auto. Text changes only when the level or pin changes.
  TextMeshProUGUI qualityLabel,qualityPinText;UnityEngine.UI.Button qualityPin;int qualityShown=-2;int qualityRuleShown=-1;
  static readonly string[] QualityText={"품질 0","품질 1","품질 2","품질 3"},QualityRuleText={"자동 A","옛 규칙","0고정"};
  static readonly Color PanelBody=new Color(.055f,.085f,.115f,.86f),Gold=new Color(.79f,.65f,.38f),Ink=new Color(.95f,.91f,.78f);
  // A fill that is either a sprite slot (Image, horizontal fill) or the procedural bar.
  sealed class Meter{public UnityEngine.UI.Image image;public IslandHudArt art;
   public void Set(float v){v=Mathf.Clamp01(v);if(image){if(Mathf.Abs(image.fillAmount-v)>.001f)image.fillAmount=v;}else if(art)art.SetFill(v);}}
  public void Initialize(IslandApp owner){
   app=owner;font=IslandFonts.CreateSdfFont();
   root=new GameObject("RpgBattleCanvas",typeof(RectTransform),typeof(Canvas),typeof(UnityEngine.UI.CanvasScaler),typeof(UnityEngine.UI.GraphicRaycaster));
   root.transform.SetParent(transform,false);canvas=root.GetComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=20;
   var scaler=root.GetComponent<UnityEngine.UI.CanvasScaler>();scaler.uiScaleMode=UnityEngine.UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1080,2340);scaler.matchWidthOrHeight=0;
   if(!EventSystem.current){events=new GameObject("IslandEventSystem",typeof(EventSystem),typeof(StandaloneInputModule));events.transform.SetParent(transform,false);ownsEventSystem=true;}
   // 1) Battle view: the whole screen (also under notches), old design units (390 wide) so damage text keeps its size.
   stage=Rect("BattleViewport",root.transform);viewport=stage.gameObject.AddComponent<UnityEngine.UI.RawImage>();viewport.raycastTarget=false;
   stageTap=Fill(Rect("AttackSurface",stage),new Color(0,0,0,0));Stretch((RectTransform)stageTap.transform);
   var attack=stageTap.gameObject.AddComponent<UnityEngine.UI.Button>();stageTap.raycastTarget=true;attack.targetGraphic=stageTap;attack.onClick.AddListener(()=>Dispatch("attack",app.HudAttack));attack.navigation=new UnityEngine.UI.Navigation{mode=UnityEngine.UI.Navigation.Mode.None};
   for(int i=0;i<damage.Length;i++){damage[i]=Label(stage,"Damage"+i,"",15,TextAlignmentOptions.Center);damage[i].fontStyle=FontStyles.Bold;}
   overlay=Rect("ConnectionOrResult",stage).gameObject;Fill((RectTransform)overlay.transform,new Color(.035f,.08f,.10f,.94f));PanelFrame((RectTransform)overlay.transform,"ResultFrame");Stretch((RectTransform)overlay.transform);
   overlayText=Label(overlay.transform,"Message","전투와 장비를 불러오는 중…",16,TextAlignmentOptions.Center);retry=Button(overlay.transform,"Retry","다시 입장",()=>app.HudRetry(),new Color(.1f,.25f,.28f));
   // 2) HUD overlay in canvas units (1080 wide = manifest pixels). Bottom first so the top group (menu popup) draws over it.
   hud=Rect("Hud",root.transform);Stretch(hud);bottom=Rect("Bottom",hud);Stretch(bottom);top=Rect("Top",hud);Stretch(top);
   BuildBottom();BuildTop();
   // 3) Safe Area frame (old design units): escape popup over everything, dungeon panel.
   safe=Rect("SafeArea",root.transform);Stretch(safe);frame=Rect("PortraitFrame",safe);
   escapePopup=Rect("LabyrinthEscape",frame).gameObject;Stretch((RectTransform)escapePopup.transform);Fill((RectTransform)escapePopup.transform,new Color(.01f,.025f,.035f,.78f)).raycastTarget=true;
   var escapePanel=Rect("EscapePanel",escapePopup.transform);escapePanel.anchorMin=escapePanel.anchorMax=escapePanel.pivot=Vector2.one*.5f;escapePanel.sizeDelta=new Vector2(322,224);Fill(escapePanel,new Color(.035f,.08f,.10f,.98f));PanelFrame(escapePanel,"EscapeFrame");
   var escapeTitle=Label(escapePanel,"EscapeTitle","미궁 탈출",24,TextAlignmentOptions.Center);escapeTitle.color=new Color(1,.85f,.5f);Box((RectTransform)escapeTitle.transform,16,24,290,42);
   var escapeInfo=Label(escapePanel,"EscapeInfo","보스를 물리치고 마을에 도착했습니다.\n미궁 탐험을 완료했습니다.",14,TextAlignmentOptions.Center);Box((RectTransform)escapeInfo.transform,16,78,290,54);
   var leave=Button(escapePanel,"EscapeLobby","마을로 돌아가기",()=>app.HudMenu("lobby"),new Color(.1f,.25f,.28f));Box((RectTransform)leave.transform,20,158,165,44);
   var again=Button(escapePanel,"EscapeRetry","다시 도전",()=>app.HudRetry(),new Color(.1f,.18f,.22f));Box((RectTransform)again.transform,195,158,107,44);escapePopup.SetActive(false);
   dungeonPanel=Rect("DungeonPanel",safe);Fill(dungeonPanel,new Color(.035f,.07f,.09f));PanelFrame(dungeonPanel,"DungeonFrame");
   var dungeonTitle=Label(dungeonPanel,"DungeonTitle","던전",24,TextAlignmentOptions.Center);Box((RectTransform)dungeonTitle.transform,18,60,354,50);
   var dungeonInfo=Label(dungeonPanel,"DungeonInfo","촛불 미궁 / 독립 보스 시험\n보스 시험은 계정 성장·보상과 별개입니다.",13,TextAlignmentOptions.Center);Box((RectTransform)dungeonInfo.transform,18,130,354,75);
   Button(dungeonPanel,"BossTrialEntry","보스 시험장 · 10보스",()=>{stick.ResetInput();app.OpenBossTrials();},Color.white);
   Button(dungeonPanel,"DungeonContinue","회랑으로 돌아가기",()=>app.HudMenu(""),Color.white);
   Button(dungeonPanel,"DungeonLobby","로비로",()=>app.HudMenu("lobby"),Color.white);
   dungeonPanel.gameObject.SetActive(false);root.SetActive(false);
  }
  void BuildTop(){
   var zone=Place(Rect("ZonePlate",top),false,32,66,144,116);Slot(zone,"zone_counter_plate",IslandHudArt.Kind.Plate,PanelBody);
   chamber=Label(zone,"Chamber","",28,TextAlignmentOptions.Center);Stretch((RectTransform)chamber.transform);chamber.color=Ink;chamber.lineSpacing=-12;
   var bar=Place(Rect("StageBar",top),false,208,56,528,152);Slot(bar,"top_stage_bar",IslandHudArt.Kind.Plate,PanelBody);
   title=Label(bar,"Title","",30,TextAlignmentOptions.Center);Box((RectTransform)title.transform,20,12,488,54);title.color=Ink;title.fontStyle=FontStyles.Bold;
   var gaugeBack=Fill(Rect("GaugeBack",bar),new Color(0,0,0,.55f));Box(gaugeBack.rectTransform,28,76,472,18);
   gauge=MeterSlot(Rect("Gauge",bar),"stage_gauge_fill",new Color(.93f,.74f,.32f));Box(Holder(gauge),28,76,472,18);
   objective=Label(bar,"Objective","",22,TextAlignmentOptions.Center);Box((RectTransform)objective.transform,16,98,496,44);objective.enableAutoSizing=true;objective.fontSizeMin=16;objective.fontSizeMax=22;
   // Top-right row: lobby (in the manifest "pause" slot: the game has no pause) and the menu toggle.
   var lobby=RoundButton(top,"Lobby","btn_round_small",PanelBody,()=>{stick.ResetInput();SetMenu(false);app.GetComponent<RpgAudio>()?.Click();app.HudMenu("lobby");});Place((RectTransform)lobby.transform,false,780,64,120,120);
   Icon((RectTransform)lobby.transform,"icon_back",IslandHudArt.Kind.IconBack,64);
   gold=Label(top,"Gold","",28,TextAlignmentOptions.MidlineRight);Place((RectTransform)gold.transform,false,660,196,384,44);Pill(gold);
   viewText=Label(top,"ViewMode","",26,TextAlignmentOptions.MidlineRight);Place((RectTransform)viewText.transform,false,660,196,384,44);Pill(viewText);viewText.gameObject.SetActive(false);
   bossBar=Place(Rect("BossHealth",top),false,240,262,600,26);Fill(bossBar,new Color(.08f,.04f,.05f,.9f));bossFill=Fill(Rect("Fill",bossBar),new Color(.73f,.08f,.15f));Stretch(bossFill.rectTransform);bossFill.rectTransform.offsetMin=new Vector2(4,4);bossFill.rectTransform.offsetMax=new Vector2(-4,-4);
   bossName=Label(bossBar,"BossName","아스트로스",28,TextAlignmentOptions.Center);Box((RectTransform)bossName.transform,0,-46,600,44);Pill(bossName);bossBar.gameObject.SetActive(false);
   notice=Label(top,"Notice","",24,TextAlignmentOptions.Center);Place((RectTransform)notice.transform,false,60,304,960,40);notice.color=new Color(1,.65f,.5f);Pill(notice);
   // Editor and development builds only (same rule as the practice entry, IslandApp). Digits and Hangul only: device fonts do not draw symbol glyphs.
   if(Battle3DAssets.DevControls){tempoChosen=Battle3DAssets.DevKitTempo;tempoLabel=Label(top,"DevTempoLabel","템포",28,TextAlignmentOptions.MidlineRight);tempoLabel.color=Color.white;tempoLabel.fontStyle=FontStyles.Bold;Place((RectTransform)tempoLabel.transform,false,24,368,140,60);Pill(tempoLabel);
    for(int i=0;i<3;i++){int n=i;tempoButtons[i]=Button(top,"DevTempo"+i,i.ToString(),()=>Dispatch("tempo:"+n,()=>ChooseKitTempo(n)),new Color(.09f,.18f,.21f));Place((RectTransform)tempoButtons[i].transform,false,176+i*84,368,76,60);TextOf(tempoButtons[i]).fontSize=30;}
    qualityLabel=Label(top,"DevQualityLabel","품질",28,TextAlignmentOptions.MidlineRight);qualityLabel.color=Color.white;qualityLabel.fontStyle=FontStyles.Bold;Place((RectTransform)qualityLabel.transform,false,24,436,140,60);Pill(qualityLabel);
    qualityPin=Button(top,"DevQualityPin","자동 A",()=>Dispatch("quality-rule",CycleQualityRule),new Color(.09f,.18f,.21f));qualityPinText=TextOf(qualityPin);qualityPinText.fontSize=28;Place((RectTransform)qualityPin.transform,false,176,436,244,60);}
   // Menu popup (manifest MENU_OPEN): a screen blocker closes it, the toggle stays on top.
   menuBlocker=Rect("MenuBlocker",top);Stretch(menuBlocker);var shade=Fill(menuBlocker,new Color(0,0,0,.28f));shade.raycastTarget=true;
   var blockerButton=menuBlocker.gameObject.AddComponent<UnityEngine.UI.Button>();blockerButton.targetGraphic=shade;blockerButton.transition=UnityEngine.UI.Selectable.Transition.None;blockerButton.navigation=new UnityEngine.UI.Navigation{mode=UnityEngine.UI.Navigation.Mode.None};blockerButton.onClick.AddListener(()=>SetMenu(false));
   menuPopup=Place(Rect("MenuPopup",top),false,360,216,680,592);var popupArt=Slot(menuPopup,"menu_popup_panel",IslandHudArt.Kind.Plate,new Color(.05f,.075f,.1f,.95f));popupArt.raycastTarget=true;
   var menuTitle=Label(menuPopup,"MenuTitle","메뉴",30,TextAlignmentOptions.MidlineLeft);Box((RectTransform)menuTitle.transform,32,24,300,52);menuTitle.color=Ink;
   var panels=new[]{"growth","equipment","tavern","dungeon","summon","bag"};var names=new[]{"성장","소지품","주점","던전","소환","가방"};
   for(int i=0;i<6;i++){string panel=panels[i];var item=Rect("Menu"+panel,menuPopup);Box(item,28+(i%2)*324,100+(i/2)*148,292,128);var g=Slot(item,"menu_item_button",IslandHudArt.Kind.Plate,new Color(.09f,.13f,.17f,.96f));g.raycastTarget=true;
    var b=item.gameObject.AddComponent<UnityEngine.UI.Button>();b.targetGraphic=g;b.navigation=new UnityEngine.UI.Navigation{mode=UnityEngine.UI.Navigation.Mode.None};b.onClick.AddListener(()=>{app.GetComponent<RpgAudio>()?.Click();SetMenu(false);stick.ResetInput();app.HudMenu(panel);});
    var t=Label(item,"Menu"+panel+"Text",names[i],38,TextAlignmentOptions.Center);Stretch((RectTransform)t.transform);t.color=Ink;}
   menuButton=RoundButton(top,"MenuToggle","btn_round_small",PanelBody,()=>{app.GetComponent<RpgAudio>()?.Click();SetMenu(!menuOpen);});Place((RectTransform)menuButton.transform,false,924,64,120,120);
   menuIcon=Icon((RectTransform)menuButton.transform,"icon_menu",IslandHudArt.Kind.IconMenu,64);closeIcon=Icon((RectTransform)menuButton.transform,"icon_close",IslandHudArt.Kind.IconClose,64);
   SetMenu(false);
  }
  void BuildBottom(){
   // Portrait ring: the existing HP orb sits inside until a portrait sprite exists.
   var portrait=Place(Rect("Portrait",bottom),true,42,1842,164,164);Slot(portrait,"portrait_ring",IslandHudArt.Kind.Round,new Color(.05f,.07f,.09f,.92f));
   hpOrb=Art(Rect("Orb",portrait),IslandHudArt.Kind.Orb,new Color(.94f,.28f,.4f));Box((RectTransform)hpOrb.transform,17,17,130,130);
   var badge=Place(Rect("LevelBadge",bottom),true,216,1904,112,42);Slot(badge,"level_badge",IslandHudArt.Kind.Plate,PanelBody);
   levelText=Label(badge,"Level","Lv.1",24,TextAlignmentOptions.Center);Stretch((RectTransform)levelText.transform);levelText.color=Ink;
   modeText=Label(bottom,"Progress","",24,TextAlignmentOptions.MidlineLeft);Place((RectTransform)modeText.transform,true,340,1904,480,42);Pill(modeText);
   var hpFrame=Place(Rect("HealthFrame",bottom),true,232,1954,590,46);Slot(hpFrame,"bar_frame",IslandHudArt.Kind.Plate,new Color(.03f,.04f,.05f,.9f));
   hpDelay=MeterSlot(Rect("HealthDelayed",bottom),"bar_fill_delayed",new Color(.95f,.74f,.3f));Place(Holder(hpDelay),true,246,1965,562,24);
   hpFill=MeterSlot(Rect("HealthFill",bottom),"bar_fill_hp",new Color(.86f,.22f,.3f));Place(Holder(hpFill),true,246,1965,562,24);
   hpText=Label(bottom,"HealthValue","",20,TextAlignmentOptions.Center);Place((RectTransform)hpText.transform,true,246,1961,562,32);
   var mpFrame=Place(Rect("ManaFrame",bottom),true,232,2010,590,38);Slot(mpFrame,"bar_frame",IslandHudArt.Kind.Plate,new Color(.03f,.04f,.05f,.9f));
   mpFill=MeterSlot(Rect("ManaFill",bottom),"bar_fill_mp",new Color(.2f,.7f,.66f));Place(Holder(mpFill),true,246,2017,562,24);
   manaText=Label(bottom,"ManaValue","",20,TextAlignmentOptions.Center);Place((RectTransform)manaText.transform,true,246,2013,562,32);
   // Potions: health in the manifest potion slot, mana in round skill slot 1. Round skill slot 2 = the existing basic attack (screen tap).
   hpPotion=PotionButton("HealthPotion","btn_round_potion","health",new Color(.94f,.28f,.4f),30,2010,out hpPotionText);
   manaPotion=PotionButton("ManaPotion","btn_round_skill","mana",new Color(.25f,.65f,.95f),704,1800,out manaPotionText);
   attackButton=RoundButton(bottom,"Attack","btn_round_skill",PanelBody,()=>Dispatch("attack-button",app.HudAttack));Place((RectTransform)attackButton.transform,true,884,1846,144,144);
   Caption((RectTransform)attackButton.transform,"공격","",40);
   for(int i=0;i<6;i++){int slot=i;var r=Place(Rect("Skill"+i,bottom),true,24+138*i,2170,130,130);var bg=Slot(r,"skill_slot_square",IslandHudArt.Kind.Plate,new Color(.07f,.1f,.13f,.92f));bg.raycastTarget=true;
    var b=r.gameObject.AddComponent<UnityEngine.UI.Button>();b.targetGraphic=bg;b.navigation=new UnityEngine.UI.Navigation{mode=UnityEngine.UI.Navigation.Mode.None};b.onClick.AddListener(()=>Dispatch("skill:"+slot,()=>app.HudSkill(slot)));skillButtons[i]=b;
    icons[i]=Fill(Rect("Icon",r),Color.white);icons[i].preserveAspect=true;Box(icons[i].rectTransform,10,10,110,110);icons[i].gameObject.SetActive(false);
    sweeps[i]=Fill(Rect("Cooldown",r),new Color(0,0,0,.65f));sweeps[i].sprite=WhiteSprite();sweeps[i].type=UnityEngine.UI.Image.Type.Filled;sweeps[i].fillMethod=UnityEngine.UI.Image.FillMethod.Radial360;sweeps[i].fillOrigin=2;Box(sweeps[i].rectTransform,10,10,110,110);
    locks[i]=Icon(r,"skill_slot_lock",IslandHudArt.Kind.IconLock,64);var lockArt=locks[i].GetComponent<IslandHudArt>();if(lockArt)lockArt.liquid=new Color(.55f,.58f,.6f);
    numbers[i]=Label(r,"SlotNumber",(i+1).ToString(),26,TextAlignmentOptions.BottomRight);Box((RectTransform)numbers[i].transform,8,8,114,114);
   }
   autoButton=RoundButton(bottom,"Auto","btn_round_big",PanelBody,()=>Dispatch("auto",app.HudAuto));Place((RectTransform)autoButton.transform,true,858,2104,196,196);autoArt=autoButton.targetGraphic as IslandHudArt;
   autoText=Label(autoButton.transform,"AutoText","AUTO",42,TextAlignmentOptions.Center);Box((RectTransform)autoText.transform,0,42,196,66);autoText.color=Ink;autoText.fontStyle=FontStyles.Bold;
   autoState=Label(autoButton.transform,"AutoState","ON",28,TextAlignmentOptions.Center);Box((RectTransform)autoState.transform,0,104,196,48);
   // Manual controls (manifest AUTO_OFF layout), shown with AUTO on too (user 2026-11-23, maintenance/auto-manual-20261123): a held pad
   // wins over AUTO in the kernel (input >= 0.1) and AUTO carries on after release; a button runs when the kernel takes it (a skill AUTO
   // started still refuses it, like any running skill). The AUTO switch does not change.
   manualRoot=Rect("ManualControls",bottom);Stretch(manualRoot);manual=manualRoot.gameObject.AddComponent<CanvasGroup>();
   var stickRect=Place(Rect("MovementStick",manualRoot),true,44,1540,220,220);var stickArt=Slot(stickRect,"joystick_base",IslandHudArt.Kind.Round,new Color(.05f,.08f,.1f,.38f));stickArt.raycastTarget=true;
   if(stickArt is IslandHudArt sa)sa.edge=new Color(Gold.r,Gold.g,Gold.b,.75f);
   stick=stickRect.gameObject.AddComponent<IslandHudStick>();stick.app=app;knob=Rect("Knob",stickRect);knob.anchorMin=knob.anchorMax=knob.pivot=Vector2.one*.5f;knob.sizeDelta=Vector2.one*100;
   var knobArt=Slot(knob,"joystick_knob",IslandHudArt.Kind.Round,new Color(.12f,.16f,.2f,.85f));stick.knob=knob;
   directionText=Label(knob,"Direction","‹ ›",34,TextAlignmentOptions.Center);Stretch((RectTransform)directionText.transform);directionText.color=Ink;
   roll=ManualButton("Roll",584,1640,"↔","구르기",()=>app.HudEvade(RollDirection()));
   jump=ManualButton("Jump",748,1572,"↑","점프",()=>app.HudJump());
   slide=ManualButton("Slide",912,1640,"→","슬라이드",()=>app.HudSlide());
  }
  UnityEngine.UI.Button ManualButton(string id,float x,float y,string glyph,string caption,Action action){
   var b=RoundButton(manualRoot,id,"manual_control_button",new Color(.05f,.08f,.1f,.5f),()=>Dispatch(id,action));Place((RectTransform)b.transform,true,x,y,136,136);
   if(b.targetGraphic is IslandHudArt a)a.edge=new Color(Gold.r,Gold.g,Gold.b,.8f);Caption((RectTransform)b.transform,glyph,caption,46);return b;
  }
  UnityEngine.UI.Button PotionButton(string id,string key,string kind,Color color,float x,float y,out TextMeshProUGUI text){
   var b=RoundButton(bottom,id,key,PanelBody,()=>Dispatch("potion:"+kind,()=>app.HudDrink(kind)));Place((RectTransform)b.transform,true,x,y,144,144);
   var flask=Icon((RectTransform)b.transform,"icon_potion",IslandHudArt.Kind.Flask,76);var flaskArt=flask.GetComponent<IslandHudArt>();if(flaskArt)flaskArt.liquid=color;
   text=Label(b.transform,"Charges","3",28,TextAlignmentOptions.BottomRight);Box((RectTransform)text.transform,70,84,58,44);return b;
  }
  // Facing roll: the stick direction when it is held, otherwise the hero's facing (the old left/right pair became one manifest button).
  int RollDirection(){if(stick&&stick.IsPressed&&Mathf.Abs(stick.Vector.x)>.2f)return stick.Vector.x<0?-1:1;return Value(app.HudSession.State?["hero"]?["facing"],1)<0?-1:1;}
  void SetMenu(bool open){menuOpen=open;if(menuBlocker)menuBlocker.gameObject.SetActive(open);if(menuPopup)menuPopup.gameObject.SetActive(open);if(menuIcon)menuIcon.SetActive(!open);if(closeIcon)closeIcon.SetActive(open);if(open&&stick)stick.ResetInput();}
  void Dispatch(string id,Action action){if(!app.HudCanInput)return;app.GetComponent<RpgAudio>()?.Click();UiDispatches++;LastInput=id;action();}
  // The kernel applies the stage from the next row (the running row keeps its map). Kept for "다시 도전" and the next practice.
  void ChooseKitTempo(int n){Battle3DAssets.DevKitTempo=n;tempoChosen=n;app.HudSession.Command("tick",new JObject{{"kitTempo",n}});}
  void CycleQualityRule(){var b=IslandFrameBudget.Current;if(b)b.CycleRule();nextRefresh=0;}
  void Update(){
   if(!app||!root)return;bool dungeon=app.HudDungeonOpen;bool show=app.HudPage&&(!app.HudPanelOpen||dungeon)&&!app.BossTrialsVisible;
   if(root.activeSelf!=show){outputDirty=true;root.SetActive(show);if(!show){stick.ResetInput();SetMenu(false);}}
   frame.gameObject.SetActive(!dungeon);stage.gameObject.SetActive(!dungeon);hud.gameObject.SetActive(!dungeon);dungeonPanel.gameObject.SetActive(dungeon);
   if(!show||dungeon){app.HudBattle.RestoreTexturePresentation();outputDirty=true;if(menuOpen)SetMenu(false);}
   if(!app.HudPage)return;app.HudSession.Paused=app.HudPanelOpen;
   if(!show)return;
   if(dungeon){LayoutDungeon();return;}
   Layout();ConfigureBattleOutput();Refresh();
   var heroNow=app.HudCampaign?app.HudSession.State:app.HudSession.State?["hero"] as JObject;float hp=(float)RpgContracts.Ratio(heroNow?["hp"],heroNow?["maxHP"]);
   hpDelayed=hp>=hpDelayed?hp:Mathf.MoveTowards(hpDelayed,hp,Time.unscaledDeltaTime*.5f);hpDelay.Set(hpDelayed);
   if(directionText)directionText.text=app.HudPlanarMovement?"360°":"‹ ›";
   if(!app.HudCanInput){stick.ResetInput();return;}
   if(Input.GetKeyDown(KeyCode.V))Dispatch("keyboard:view",app.HudCycleView);
   if(Input.GetKeyDown(KeyCode.Space))Dispatch("keyboard:attack",app.HudAttack);
   if(Input.GetKeyDown(KeyCode.J)||!app.HudPlanarMovement&&(Input.GetKeyDown(KeyCode.W)||Input.GetKeyDown(KeyCode.UpArrow)))Dispatch("keyboard:jump",app.HudJump);
   if(!app.HudPlanarMovement&&(Input.GetKeyDown(KeyCode.S)||Input.GetKeyDown(KeyCode.DownArrow)))Dispatch("keyboard:lower",app.HudLower);
   if(Input.GetKeyDown(KeyCode.LeftShift))Dispatch("keyboard:slide",app.HudSlide);
   if(Input.GetKeyDown(KeyCode.Q))Dispatch("keyboard:evade-left",()=>app.HudEvade(-1));if(Input.GetKeyDown(KeyCode.E))Dispatch("keyboard:evade-right",()=>app.HudEvade(1));
   if(Input.GetKeyDown(KeyCode.Z)&&hpPotion.interactable)Dispatch("keyboard:health",()=>app.HudDrink("health"));if(Input.GetKeyDown(KeyCode.X)&&manaPotion.interactable)Dispatch("keyboard:mana",()=>app.HudDrink("mana"));
   for(int i=0;i<6;i++)if(Input.GetKeyDown((KeyCode)((int)KeyCode.Alpha1+i))&&skillButtons[i].interactable){int slot=i;Dispatch("keyboard:skill"+slot,()=>app.HudSkill(slot));}
   float keyboard=(Input.GetKey(KeyCode.A)||Input.GetKey(KeyCode.LeftArrow)?-1:0)+(Input.GetKey(KeyCode.D)||Input.GetKey(KeyCode.RightArrow)?1:0);float vertical=app.HudPlanarMovement?((Input.GetKey(KeyCode.W)||Input.GetKey(KeyCode.UpArrow)?1:0)-(Input.GetKey(KeyCode.S)||Input.GetKey(KeyCode.DownArrow)?1:0)):0;app.HudMove(stick.IsPressed?stick.Vector:Vector2.ClampMagnitude(new Vector2(keyboard,vertical),1));
  }
  void LayoutDungeon(){
   var screenSafe=Screen.safeArea;safe.anchorMin=new Vector2(screenSafe.x/Screen.width,screenSafe.y/Screen.height);safe.anchorMax=new Vector2(screenSafe.xMax/Screen.width,screenSafe.yMax/Screen.height);safe.offsetMin=safe.offsetMax=Vector2.zero;
   var c=(RectTransform)canvas.transform;float units=1080f/390f,h=c.rect.height*screenSafe.height/Screen.height/units,w=c.rect.width*screenSafe.width/Screen.width/units;dungeonPanel.localScale=Vector3.one*units;
   dungeonPanel.anchorMin=dungeonPanel.anchorMax=dungeonPanel.pivot=new Vector2(.5f,.5f);dungeonPanel.anchoredPosition=Vector2.zero;dungeonPanel.sizeDelta=new Vector2(w,h);
   Box((RectTransform)dungeonPanel.Find("DungeonTitle"),18,60,w-36,50);Box((RectTransform)dungeonPanel.Find("DungeonInfo"),18,130,w-36,75);
   Box((RectTransform)dungeonPanel.Find("BossTrialEntry"),24,230,w-48,64);Box((RectTransform)dungeonPanel.Find("DungeonContinue"),24,315,w-48,52);Box((RectTransform)dungeonPanel.Find("DungeonLobby"),24,385,w-48,48);
  }
  public void HideForBossTrials(){if(app)app.HudBattle.RestoreTexturePresentation();if(stick)stick.ResetInput();SetMenu(false);if(root)root.SetActive(false);}
  void Refresh(){
   var session=app.HudSession;var state=session.State;var hero=app.HudCampaign?state:state?["hero"] as JObject;var progress=state?["progress"] as JObject;var resources=state?["resources"] as JObject;bool active=app.HudCanInput;
   JToken boss=null;foreach(var mob in state?["mobs"] as JArray??new JArray())if((bool?)mob["unityBoss"]==true){boss=mob;break;}bossBar.gameObject.SetActive(boss!=null&&(bool?)state?["bossVisible"]==true);bossFill.gameObject.SetActive(boss!=null&&NativeCombatPresentation.N(boss["hp"])>0);if(boss!=null)bossFill.rectTransform.anchorMax=new Vector2(Mathf.Clamp01(NativeCombatPresentation.N(boss["hp"])/Mathf.Max(1,NativeCombatPresentation.N(boss["maxHP"]))),1);
   bool escaped=(bool?)state?["mountCampaign"]==true&&(int?)state?["routeZone"]==9&&(string)state?["status"]=="won";
   escapePopup.SetActive(escaped);
   // Interaction remains current every frame; only visual text/icon work is throttled.
   for(int i=0;i<6;i++)skillButtons[i].interactable=active&&RpgContracts.CanCast(state,i);
   autoButton.interactable=active;attackButton.interactable=active;
   jump.interactable=active&&(app.HudCampaign||(bool?)state?["jumpReady"]==true);slide.interactable=active&&(app.HudCampaign||(bool?)state?["slideReady"]==true);roll.interactable=active&&(app.HudCampaign||(bool?)state?["dodgeReady"]==true);
   PotionState(hpPotion,hpPotionText,"health",hero?["hp"],hero?["maxHP"]);PotionState(manaPotion,manaPotionText,"mana",resources?["mana"],resources?["maxMana"]);
   bool endedNow=state!=null&&(!session.Active||app.HudCampaign&&(bool?)state["dead"]==true);
   if(Time.unscaledTime<nextRefresh&&active==lastActive&&endedNow==lastEnded&&session.Auto==autoShown)return;
   nextRefresh=Time.unscaledTime+1f/(budget?budget.Policy.HudHz:20);lastActive=active;lastEnded=endedNow;
   viewport.texture=app.HudBattle.Output;viewport.enabled=!app.HudBattle.DirectPresentationActive;
   bool mount=(bool?)state?["mountSunday"]==true;
   title.text=(string)state?["roomKind"]=="boss"?"10구역 · 초원 수호자의 마당":mount?"마을길 · "+(string)state?["zoneName"]:app.HudCampaign?"성장 사냥":"촛불 미궁 · Lv."+Value(state?["dungeonLevel"],1);
   bool viewAvailable=(bool?)state?["unityBossMode"]==true;viewText.gameObject.SetActive(viewAvailable);gold.gameObject.SetActive(!viewAvailable);viewText.text=NativeBattle.EncounterView(state)==ViewMode.QuarterView?"쿼터뷰":"사이드뷰";
   gold.text=RpgContracts.Amount(progress?["gold"])+" G";chamber.text=(mount||(bool?)state?["mountCampaign"]==true?"ZONE\n":"CHAMBER\n")+(Value(state?["routeZone"],Value(state?["room"]))+1).ToString("00")+" / "+Value(state?["totalRooms"],10);
   objective.text=(string)state?["phase"]=="village-exit"?((bool?)state["villageExitOpen"]==true?"출구 개방 · 마을로 이동":"보스 처치 · 출구의 바위가 내려갑니다"):(bool?)state?["zoneTenArena"]==true?((bool?)state?["bossIntroActive"]==true?"진입로 끝 · 초원 전장에 진입 중":"바위 경계 안에서 초원 수호자 처치"):mount?((string)state?["phase"]=="exit"||(string)state?["phase"]=="waiting-next"?"마을 방향 출구로 이동":"이 구역 "+Value(state?["zoneKills"])+" / 30 처치"):(string)state?["phase"]=="exit-ready"?"출구 개방 · 점프 / 슬라이드로 이동":"전투 화면을 눌러 기본 공격";
   if((string)state?["phase"]=="boss-loading")objective.text="초원 전장으로 이동 중";
   else if((string)state?["bossIntroStage"]=="approach")objective.text="정원 안쪽으로 걸어갑니다";
   else if((string)state?["bossIntroStage"]=="reveal")objective.text="정원의 수호자가 깨어납니다";
   // Stage gauge: zone kills in a mount zone, the boss's lost health in the arena, the room count elsewhere.
   float progressFill=boss!=null?1-Mathf.Clamp01(NativeCombatPresentation.N(boss["hp"])/Mathf.Max(1,NativeCombatPresentation.N(boss["maxHP"]))):mount?Value(state?["zoneKills"])/Mathf.Max(1,Value(state?["totalPerZone"],30)):(Value(state?["room"])+1)/Mathf.Max(1,Value(state?["totalRooms"],10));
   gauge.Set(progressFill);
   float hpRatio=(float)RpgContracts.Ratio(hero?["hp"],hero?["maxHP"]),mpRatio=(float)RpgContracts.Ratio(resources?["mana"],resources?["maxMana"]);
   hpOrb.SetFill(hpRatio);hpFill.Set(hpRatio);mpFill.Set(resources==null?0:mpRatio);
   hpText.text=hero==null?"HP —":"HP "+RpgContracts.Amount(hero["hp"])+" / "+RpgContracts.Amount(hero["maxHP"]);manaText.text=resources==null?"MP —":"MP "+RpgContracts.Amount(resources["mana"])+" / "+RpgContracts.Amount(resources["maxMana"]);
   levelText.text="Lv."+Value(progress?["level"],1);
   for(int i=0;i<6;i++){bool equipped=RpgContracts.SkillEnabled(state,i);var skill=RpgContracts.Skill(state,i);string id=equipped?(string)skill?["activeId"]:null;
    if(id!=iconIds[i]){iconIds[i]=id;string icon=(string)app.HudGem(id)?["icon"];icons[i].sprite=string.IsNullOrEmpty(icon)?null:SpriteFor("SkillIcon_"+icon);}
    icons[i].gameObject.SetActive(equipped&&icons[i].sprite!=null);locks[i].SetActive(!equipped&&!session.ReferencePreview);skillButtons[i].interactable=active&&RpgContracts.CanCast(state,i);
    float cd=Value(state?["cooldowns"]?[i]),total=Value(state?["cooldownTotals"]?[i],cd);bool cooling=equipped&&cd>0;
    sweeps[i].gameObject.SetActive(cooling);sweeps[i].fillAmount=total>0?Mathf.Clamp01(cd/total):0;icons[i].color=cooling?new Color(.55f,.55f,.55f):Color.white;
    numbers[i].gameObject.SetActive(equipped);numbers[i].text=cooling?(cd<1?cd.ToString("0.0"):Mathf.CeilToInt(cd).ToString()):(i+1).ToString();numbers[i].alignment=cooling?TextAlignmentOptions.Center:TextAlignmentOptions.BottomRight;numbers[i].fontSize=cooling?44:26;
   }
   modeText.text=Value(state?["kills"])+" 처치";
   if(session.ReferencePreview)modeText.text="원소 연습 · "+Value(state?["kills"])+" 처치";
   autoShown=session.Auto;autoState.text=session.Auto?"ON":"OFF";autoButton.interactable=active;
   if(autoSkin!=(session.Auto?1:0)){autoSkin=session.Auto?1:0;autoState.color=session.Auto?new Color(1,.82f,.4f):new Color(.62f,.66f,.68f);
    if(autoArt)autoArt.SetColors(session.Auto?new Color(.24f,.14f,.36f,.94f):new Color(.06f,.09f,.12f,.9f),session.Auto?new Color(1,.8f,.4f):Gold);}
   if(tempoLabel){bool kitHero=state?["heroKit"]!=null;if(kitHero!=tempoVisible){tempoVisible=kitHero;tempoLabel.gameObject.SetActive(kitHero);foreach(var b in tempoButtons)b.gameObject.SetActive(kitHero);}
    foreach(var b in tempoButtons)b.interactable=active;
    if(tempoShown!=tempoChosen){tempoShown=tempoChosen;tempoLabel.text=tempoChosen<0?"템포 기본":"템포";for(int i=0;i<3;i++){var img=(UnityEngine.UI.Image)tempoButtons[i].targetGraphic;Skin(img,i==tempoChosen?"ui-buttons/btn-purple":"ui-buttons/btn-blue",32,4);if(i==tempoChosen)img.color=new Color(1,.78f,.3f);}}}
   if(qualityLabel){var fb=IslandFrameBudget.Current;int level=fb?fb.Policy.Level:-1,rule=fb?(int)fb.Rule:0;
    if(level!=qualityShown||rule!=qualityRuleShown){qualityShown=level;qualityRuleShown=rule;qualityLabel.text=level<0?"품질 -":QualityText[level];qualityPinText.text=QualityRuleText[rule];
     var img=(UnityEngine.UI.Image)qualityPin.targetGraphic;Skin(img,rule==0?"ui-buttons/btn-blue":"ui-buttons/btn-purple",32,4);if(rule==2)img.color=new Color(1,.78f,.3f);}}
   notice.text=app.HudNotice;
   bool ended=state!=null&&(!session.Active||app.HudCampaign&&(bool?)state["dead"]==true);
   overlay.SetActive(!escaped&&(state==null||ended));overlayText.text=state==null?(session.Active?"전투와 장비를 불러오는 중…":"연결 중단 · 다시 입장하세요"):(string)state["status"]=="won"?"미궁 탈출 성공":(string)state["status"]=="dead"?"전투 불능":"연결이 종료되었습니다";retry.gameObject.SetActive(!session.Active);
   FitPills();DrawDamage(state);
  }
  void PotionState(UnityEngine.UI.Button button,TextMeshProUGUI label,string kind,JToken value,JToken max){var r=app.HudSession.State?["resources"] as JObject;float cooldown=Value(r?["potionCooldowns"]?[kind]),count=Value(r?["potions"]?[kind]);button.interactable=app.HudCanInput&&r!=null&&count>0&&cooldown<=0&&RpgContracts.Ratio(value,max)<1;label.text=cooldown>0?Mathf.CeilToInt(cooldown)+"s":count.ToString("0");}
  void DrawDamage(JObject state){state=app.HudBattle.PresentationState??state;int used=0;float now=(bool?)state?["unityBossMode"]==true?app.HudBattle.VisualTime:Value(state?["elapsed"]);var fxList=state?["fx"] as JArray??new JArray();foreach(var fx in fxList){
    float age=now-Value(fx["contactAt"]??fx["born"]);string kind=(string)fx["kind"];if(used>=damage.Length||age<0||age>1||(kind!="damage"&&kind!="gold")||fx["value"]==null)continue;
    // Boss beam ticks (2026-11-23): one running total per touch (BeamDotDisplay).
    if(BeamDotDisplay.Hidden(fxList,fx,now))continue;int room=(int)Value(fx["room"],Value(state?["room"]));var rooms=app.HudSession.Map?["rooms"] as JArray;float elevation=rooms!=null&&room>=0&&room<rooms.Count?Value(rooms[room]["elevation"]):Value(state?["hero"]?["elevation"]);
    var contact=fx["point"];float cx=contact==null?Value(fx["x"]):Value(contact["x"]),cy=contact==null?elevation+55:Value(contact["y"]),cz=contact==null?Value(fx["z"]):Value(contact["z"])-Value(app.HudSession.Map?["laneY"],5000);
    Vector2 p=app.HudBattle.ViewPoint(cx,cy+age*25,cz);if(p.x<0||p.x>1||p.y<0||p.y>1)continue;
    var text=damage[used++];text.text=(kind=="gold"?"+":"")+RpgContracts.Amount(BeamDotDisplay.Amount(fx));text.color=kind=="gold"?new Color(1,.8f,.3f,1-age):new Color(1,.85f,.8f,1-age);Box((RectTransform)text.transform,p.x*stage.rect.width-55,p.y*stage.rect.height,110,24);
   }for(int i=used;i<damage.Length;i++)damage[i].text="";
  }
  // One root Canvas, width-matched scaling (1080 wide). The battle view spans the whole canvas; HUD groups move inward only when the
  // device Safe Area inset is larger than the margin already in the manifest (56 top, 40 bottom).
  void Layout(){
   var area=Screen.safeArea;var c=(RectTransform)canvas.transform;float width=c.rect.width,height=c.rect.height;
   if(Mathf.Abs(width-oldWidth)<.1f&&Mathf.Abs(height-oldHeight)<.1f&&area==oldSafe)return;oldWidth=width;oldHeight=height;oldSafe=area;outputDirty=true;
   safe.anchorMin=new Vector2(area.x/Screen.width,area.y/Screen.height);safe.anchorMax=new Vector2(area.xMax/Screen.width,area.yMax/Screen.height);safe.offsetMin=safe.offsetMax=Vector2.zero;
   // Preserve existing icon/font design units without an additional CanvasScaler.
   float units=1080f/390f,w=width*area.width/Screen.width/units,h=height*area.height/Screen.height/units;
   frame.anchorMin=frame.anchorMax=frame.pivot=Vector2.one*.5f;frame.anchoredPosition=Vector2.zero;frame.sizeDelta=new Vector2(w,h);frame.localScale=Vector3.one*units;
   stage.anchorMin=stage.anchorMax=stage.pivot=Vector2.one*.5f;stage.anchoredPosition=Vector2.zero;stage.sizeDelta=new Vector2(width/units,height/units);stage.localScale=Vector3.one*units;
   float k=height/Mathf.Max(1,Screen.height),insetTop=(Screen.height-area.yMax)*k,insetBottom=area.y*k;
   float down=Mathf.Max(0,insetTop+8-56),up=Mathf.Max(0,insetBottom+8-40);
   top.offsetMin=Vector2.zero;top.offsetMax=new Vector2(0,-down);bottom.offsetMin=new Vector2(0,up);bottom.offsetMax=Vector2.zero;
   menuBlocker.offsetMin=Vector2.zero;menuBlocker.offsetMax=new Vector2(0,down);
   float stageH=stage.sizeDelta.y,stageW=stage.sizeDelta.x;
   Box((RectTransform)overlayText.transform,20,stageH*.38f,stageW-40,70);Box((RectTransform)retry.transform,stageW*.5f-70,stageH*.5f,140,42);
  }
  void ConfigureBattleOutput(){
   var battle=app.HudBattle;var size=stage.rect.size;
   if(!outputDirty&&outputBattle==battle&&outputWas3D==battle.Uses3D&&outputSize==size&&(!battle.Uses3D||PixelArtSettings.Active||battle.DirectPresentationActive))return;
   outputDirty=false;outputBattle=battle;outputWas3D=battle.Uses3D;outputSize=size;
   stage.GetWorldCorners(viewportCorners);var min=RectTransformUtility.WorldToScreenPoint(null,viewportCorners[0]);var max=RectTransformUtility.WorldToScreenPoint(null,viewportCorners[2]);
   if(app.HudBattle.Uses3D&&!PixelArtSettings.Active)app.HudBattle.ConfigureScreenViewport(new Rect(min.x/Screen.width,min.y/Screen.height,(max.x-min.x)/Screen.width,(max.y-min.y)/Screen.height));
   else app.HudBattle.ConfigureViewport(stage.rect.width/stage.rect.height);
  }

  static float Value(JToken t,float fallback=0){return t==null||t.Type==JTokenType.Null?fallback:t.Value<float>();}
  RectTransform Rect(string name,Transform parent){var go=new GameObject(name,typeof(RectTransform));go.transform.SetParent(parent,false);return (RectTransform)go.transform;}
  static void Stretch(RectTransform r){r.anchorMin=Vector2.zero;r.anchorMax=Vector2.one;r.offsetMin=r.offsetMax=Vector2.zero;}
  static void Box(RectTransform r,float x,float y,float w,float h){r.anchorMin=r.anchorMax=new Vector2(0,1);r.pivot=new Vector2(0,1);r.anchoredPosition=new Vector2(x,-y);r.sizeDelta=new Vector2(w,h);}
  // Manifest rectangle (1080x2340 top-left pixels). Bottom-group rectangles keep their distance from the bottom edge, top-group ones from the top.
  static RectTransform Place(RectTransform r,bool fromBottom,float x,float y,float w,float h){
   if(!fromBottom){Box(r,x,y,w,h);return r;}
   r.anchorMin=r.anchorMax=Vector2.zero;r.pivot=Vector2.zero;r.anchoredPosition=new Vector2(x,RefHeight-y-h);r.sizeDelta=new Vector2(w,h);return r;
  }
  UnityEngine.UI.Image Fill(RectTransform r,Color color){var g=r.gameObject.AddComponent<UnityEngine.UI.Image>();g.color=color;g.raycastTarget=false;return g;}
  IslandHudArt Art(RectTransform r,IslandHudArt.Kind kind,Color color){var g=r.gameObject.AddComponent<IslandHudArt>();g.shape=kind;g.liquid=color;g.raycastTarget=false;return g;}
  // Sprite slot (art/v1 manifest key) or the procedural stand-in.
  UnityEngine.UI.Graphic Slot(RectTransform r,string key,IslandHudArt.Kind kind,Color body){
   var sprite=SkinSprite(key);
   if(sprite){var img=r.gameObject.AddComponent<UnityEngine.UI.Image>();img.sprite=sprite;img.type=IslandHudSkin.Border(key)!=Vector4.zero?UnityEngine.UI.Image.Type.Sliced:UnityEngine.UI.Image.Type.Simple;img.raycastTarget=false;return img;}
   var art=Art(r,kind,body);art.edge=Gold;return art;
  }
  Meter MeterSlot(RectTransform r,string key,Color color){
   var sprite=SkinSprite(key);
   if(sprite){var img=r.gameObject.AddComponent<UnityEngine.UI.Image>();img.sprite=sprite;img.type=UnityEngine.UI.Image.Type.Filled;img.fillMethod=UnityEngine.UI.Image.FillMethod.Horizontal;img.fillOrigin=0;img.raycastTarget=false;return new Meter{image=img};}
   return new Meter{art=Art(r,IslandHudArt.Kind.Bar,color)};
  }
  static RectTransform Holder(Meter m)=>m.image?m.image.rectTransform:m.art.rectTransform;
  // Centered icon layer inside a slot; not a touch target.
  GameObject Icon(RectTransform parent,string key,IslandHudArt.Kind kind,float size){
   var r=Rect(key,parent);r.anchorMin=r.anchorMax=r.pivot=Vector2.one*.5f;r.sizeDelta=Vector2.one*size;var sprite=SkinSprite(key);
   if(sprite){var img=r.gameObject.AddComponent<UnityEngine.UI.Image>();img.sprite=sprite;img.preserveAspect=true;img.raycastTarget=false;}else Art(r,kind,Ink);
   return r.gameObject;
  }
  UnityEngine.UI.Button RoundButton(RectTransform parent,string name,string key,Color body,Action action){
   var r=Rect(name,parent);var g=Slot(r,key,IslandHudArt.Kind.Round,body);g.raycastTarget=true;var b=r.gameObject.AddComponent<UnityEngine.UI.Button>();b.targetGraphic=g;b.navigation=new UnityEngine.UI.Navigation{mode=UnityEngine.UI.Navigation.Mode.None};b.onClick.AddListener(()=>action());return b;
  }
  void Caption(RectTransform button,string glyph,string caption,float glyphSize){
   float s=button.sizeDelta.x;var t=Label(button,button.name+"Label",glyph,glyphSize,TextAlignmentOptions.Center);Box((RectTransform)t.transform,0,s*.12f,s,s*.5f);t.color=Ink;
   if(string.IsNullOrEmpty(caption)){Box((RectTransform)t.transform,0,0,s,s);return;}
   var c=Label(button,button.name+"Caption",caption,22,TextAlignmentOptions.Center);Box((RectTransform)c.transform,0,s*.6f,s,s*.26f);c.color=Ink;
  }
  static TextMeshProUGUI TextOf(UnityEngine.UI.Button b)=>b.GetComponentInChildren<TextMeshProUGUI>();
  // Labels that float over the battle scene get a dark backing sized to their text (FitPills, after each text refresh).
  readonly Dictionary<TextMeshProUGUI,RectTransform> pills=new Dictionary<TextMeshProUGUI,RectTransform>();
  void Pill(TextMeshProUGUI t){var l=(RectTransform)t.transform;var p=Rect(t.name+"Back",l.parent);p.SetSiblingIndex(l.GetSiblingIndex());Fill(p,new Color(.02f,.03f,.04f,.55f));
   p.anchorMin=l.anchorMin;p.anchorMax=l.anchorMax;p.pivot=l.pivot;p.anchoredPosition=l.anchoredPosition;p.sizeDelta=l.sizeDelta;pills[t]=p;}
  void FitPills(){foreach(var kv in pills){var t=kv.Key;var p=kv.Value;var l=(RectTransform)t.transform;bool on=t.gameObject.activeInHierarchy&&!string.IsNullOrEmpty(t.text);if(p.gameObject.activeSelf!=on)p.gameObject.SetActive(on);if(!on)continue;
   float lw=l.sizeDelta.x,w=Mathf.Min(lw,t.preferredWidth+28),x=l.anchoredPosition.x;var a=t.alignment;
   if(a==TextAlignmentOptions.MidlineRight||a==TextAlignmentOptions.Right||a==TextAlignmentOptions.BottomRight||a==TextAlignmentOptions.TopRight)x+=lw-w;else if(a==TextAlignmentOptions.Center||a==TextAlignmentOptions.Midline||a==TextAlignmentOptions.Top||a==TextAlignmentOptions.Bottom)x+=(lw-w)*.5f;else x-=14;
   p.anchoredPosition=new Vector2(x,l.anchoredPosition.y);p.sizeDelta=new Vector2(w,l.sizeDelta.y);}}
  TextMeshProUGUI Label(Transform parent,string name,string text,float size,TextAlignmentOptions align){var r=Rect(name,parent);var t=r.gameObject.AddComponent<TextMeshProUGUI>();t.font=font;t.fontSize=size;t.text=text;t.alignment=align;t.color=new Color(.88f,.84f,.7f);t.raycastTarget=false;t.textWrappingMode=TextWrappingModes.NoWrap;t.overflowMode=TextOverflowModes.Ellipsis;return t;}
  UnityEngine.UI.Button Button(Transform parent,string name,string text,Action action,Color color){var r=Rect(name,parent);var image=Fill(r,color);Skin(image,name=="Retry"?"ui-buttons/btn-red":"ui-buttons/btn-blue",32,4);image.raycastTarget=true;var button=r.gameObject.AddComponent<UnityEngine.UI.Button>();button.targetGraphic=image;button.navigation=new UnityEngine.UI.Navigation{mode=UnityEngine.UI.Navigation.Mode.None};button.onClick.AddListener(()=>{app.GetComponent<RpgAudio>()?.Click();action();});var label=Label(r,name+"Text",text,12,TextAlignmentOptions.Center);Stretch((RectTransform)label.transform);return button;}
  // Original web PNGs, sliced at runtime: no TextureImporter/.meta changes.
  void Skin(UnityEngine.UI.Image image,string path,float border,float multiplier){var sprite=SharedSprite(path,border);if(!sprite)return;image.sprite=sprite;image.type=UnityEngine.UI.Image.Type.Sliced;image.pixelsPerUnitMultiplier=multiplier;image.color=Color.white;}
  Sprite SharedSprite(string path,float border=0){string key="shared:"+path;if(sprites.TryGetValue(key,out var sprite))return sprite;var texture=Resources.Load<Texture2D>("WebAssets/"+path);if(!texture)return null;sprite=Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f),100,0,SpriteMeshType.FullRect,new Vector4(border,border,border,border));sprites[key]=sprite;return sprite;}
  Sprite SkinSprite(string key){string k="skin:"+key;if(sprites.TryGetValue(k,out var sprite))return sprite;sprite=IslandHudSkin.Load(key);sprites[k]=sprite;return sprite;}
  void PanelFrame(RectTransform parent,string name){var r=Rect(name,parent);Stretch(r);var image=Fill(r,Color.white);Skin(image,"ui/leaderboard/Leaderboard_1_x4",48,3);image.fillCenter=false;}
  Sprite SpriteFor(string name){if(sprites.TryGetValue(name,out var sprite))return sprite;var texture=Resources.Load<Texture2D>("WebAssets/rpg/"+name);if(!texture)return null;sprite=Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f));sprites[name]=sprite;return sprite;}
  Sprite WhiteSprite(){if(!sprites.TryGetValue("_white",out var sprite)){sprite=Sprite.Create(Texture2D.whiteTexture,new Rect(0,0,1,1),new Vector2(.5f,.5f));sprites["_white"]=sprite;}return sprite;}
  void OnDisable(){if(app&&app.HudBattle)app.HudBattle.RestoreTexturePresentation();if(stick)stick.ResetInput();if(root)root.SetActive(false);}
  void OnDestroy(){foreach(var sprite in sprites.Values)if(sprite)Destroy(sprite);if(font){foreach(var atlas in font.atlasTextures)if(atlas)Destroy(atlas);if(font.material)Destroy(font.material);Destroy(font);}if(ownsEventSystem&&events)Destroy(events);}
 }
}
