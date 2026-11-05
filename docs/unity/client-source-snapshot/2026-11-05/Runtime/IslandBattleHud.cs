using System;
using System.Collections.Generic;
using TMPro;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.EventSystems;

namespace IslandGame {
 // Presentation only: every action uses IslandApp -> RpgSession -> the existing server.
 public sealed class IslandBattleHud:MonoBehaviour {
  IslandApp app;RectTransform safe,frame,header,stage,lower,footer,resource,skills,mode,controls;
  GameObject root;Canvas canvas;[NonSerialized] TMP_FontAsset font;UnityEngine.UI.RawImage viewport;
  RectTransform dungeonPanel;
  readonly UnityEngine.UI.Button[] skillButtons=new UnityEngine.UI.Button[6];
  readonly UnityEngine.UI.Image[] icons=new UnityEngine.UI.Image[6],sweeps=new UnityEngine.UI.Image[6];
  readonly TextMeshProUGUI[] numbers=new TextMeshProUGUI[6],damage=new TextMeshProUGUI[24];
  readonly RectTransform[] slotRects=new RectTransform[6];
  readonly string[] iconIds=new string[6];
  readonly Dictionary<string,Sprite> sprites=new Dictionary<string,Sprite>();
  IslandHudArt hpOrb,manaOrb;TextMeshProUGUI title,gold,chamber,objective,hpText,manaText,modeText,autoText,notice,overlayText;
  UnityEngine.UI.Button autoButton,jump,slide,evadeLeft,evadeRight,hpPotion,manaPotion,retry;
  TextMeshProUGUI hpPotionText,manaPotionText;IslandHudStick stick;RectTransform knob;
  RectTransform hpBox,manaBox,flasks;GameObject overlay;UnityEngine.UI.Image stageTap;
  readonly Vector3[] viewportCorners=new Vector3[4];
  float oldWidth=-1,oldHeight=-1;Rect oldSafe;bool ownsEventSystem;GameObject events;
  public bool Visible=>root&&root.activeInHierarchy;
  public TMP_FontAsset RuntimeFont=>font;
  public int UiDispatches{get;private set;}
  public string LastInput{get;private set;}
  public void Initialize(IslandApp owner){
   app=owner;font=IslandFonts.CreateSdfFont();
   root=new GameObject("RpgBattleCanvas",typeof(RectTransform),typeof(Canvas),typeof(UnityEngine.UI.CanvasScaler),typeof(UnityEngine.UI.GraphicRaycaster));
   root.transform.SetParent(transform,false);canvas=root.GetComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=20;
   var scaler=root.GetComponent<UnityEngine.UI.CanvasScaler>();scaler.uiScaleMode=UnityEngine.UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1080,2340);scaler.matchWidthOrHeight=0;
   if(!EventSystem.current){events=new GameObject("IslandEventSystem",typeof(EventSystem),typeof(StandaloneInputModule));events.transform.SetParent(transform,false);ownsEventSystem=true;}
   safe=Rect("SafeArea",root.transform);Stretch(safe);frame=Rect("PortraitFrame",safe);
   Fill(frame,Color.clear);
   header=Rect("Header",frame);Fill(header,new Color(.055f,.12f,.15f));
   Button(header,"Lobby","‹",()=>app.HudMenu("lobby"),new Color(.09f,.18f,.21f));title=Label(header,"Title","촛불 미궁",14,TextAlignmentOptions.MidlineLeft);
   gold=Label(header,"Gold","",11,TextAlignmentOptions.MidlineRight);
   Button(header,"Help","?",()=>{app.HudMenu("dungeon");},new Color(.09f,.18f,.21f));
   stage=Rect("BattleViewport",frame);viewport=stage.gameObject.AddComponent<UnityEngine.UI.RawImage>();viewport.raycastTarget=false;
   stageTap=Fill(Rect("AttackSurface",stage),new Color(0,0,0,0));Stretch((RectTransform)stageTap.transform);
   var attack=stageTap.gameObject.AddComponent<UnityEngine.UI.Button>();stageTap.raycastTarget=true;attack.targetGraphic=stageTap;attack.onClick.AddListener(()=>Dispatch("attack",app.HudAttack));attack.navigation=new UnityEngine.UI.Navigation{mode=UnityEngine.UI.Navigation.Mode.None};
   chamber=Label(stage,"Chamber","",12,TextAlignmentOptions.TopLeft);objective=Label(stage,"Objective","",10,TextAlignmentOptions.Center);
   for(int i=0;i<damage.Length;i++){damage[i]=Label(stage,"Damage"+i,"",15,TextAlignmentOptions.Center);damage[i].fontStyle=FontStyles.Bold;}
   resource=Rect("Resources",stage);hpBox=Rect("Health",resource);hpOrb=Art(Rect("Orb",hpBox),IslandHudArt.Kind.Orb,new Color(.94f,.28f,.4f));hpText=Label(hpBox,"HealthValue","",10,TextAlignmentOptions.Bottom);
   manaBox=Rect("Mana",resource);manaOrb=Art(Rect("Orb",manaBox),IslandHudArt.Kind.Orb,new Color(.25f,.65f,.95f));manaText=Label(manaBox,"ManaValue","",10,TextAlignmentOptions.Bottom);
   flasks=Rect("Potions",resource);
   hpPotion=Potion("HealthPotion",flasks,"health",new Color(.94f,.28f,.4f),out hpPotionText);
   manaPotion=Potion("ManaPotion",flasks,"mana",new Color(.25f,.65f,.95f),out manaPotionText);
   lower=Rect("CombatConsole",frame);Fill(lower,new Color(.063f,.133f,.169f));skills=Rect("SixSkills",lower);
   for(int i=0;i<6;i++){int slot=i;var r=Rect("Skill"+i,skills);slotRects[i]=r;var bg=Fill(r,new Color(.07f,.13f,.15f));bg.raycastTarget=true;var b=r.gameObject.AddComponent<UnityEngine.UI.Button>();b.targetGraphic=bg;b.navigation=new UnityEngine.UI.Navigation{mode=UnityEngine.UI.Navigation.Mode.None};b.onClick.AddListener(()=>Dispatch("skill:"+slot,()=>app.HudSkill(slot)));skillButtons[i]=b;
    var border=Fill(Rect("Frame",r),Color.white);Stretch((RectTransform)border.transform);border.sprite=SpriteFor("FrameCombatArtSkillFrame");border.raycastTarget=false;
    icons[i]=Fill(Rect("Icon",r),Color.white);icons[i].preserveAspect=true;icons[i].gameObject.SetActive(false);
    sweeps[i]=Fill(Rect("Cooldown",r),new Color(0,0,0,.65f));sweeps[i].sprite=WhiteSprite();sweeps[i].type=UnityEngine.UI.Image.Type.Filled;sweeps[i].fillMethod=UnityEngine.UI.Image.FillMethod.Radial360;sweeps[i].fillOrigin=2;sweeps[i].raycastTarget=false;
    numbers[i]=Label(r,"SlotNumber",(i+1).ToString(),11,TextAlignmentOptions.BottomRight);
   }
   mode=Rect("Mode",lower);modeText=Label(mode,"Progress","",10,TextAlignmentOptions.MidlineLeft);
   autoButton=Button(mode,"Auto","AUTO ON",()=>Dispatch("auto",app.HudAuto),new Color(.06f,.22f,.24f));autoText=autoButton.GetComponentInChildren<TextMeshProUGUI>();
   controls=Rect("ThumbControls",lower);
   jump=RoundButton("Jump","↑",()=>app.HudJump());slide=RoundButton("Slide","→",()=>app.HudSlide());
   evadeLeft=RoundButton("EvadeLeft","‹",()=>app.HudEvade(-1));evadeRight=RoundButton("EvadeRight","›",()=>app.HudEvade(1));
   var stickRect=Rect("MovementStick",controls);Art(stickRect,IslandHudArt.Kind.Circle,Color.white).raycastTarget=true;
   stick=stickRect.gameObject.AddComponent<IslandHudStick>();stick.app=app;knob=Rect("Knob",stickRect);Art(knob,IslandHudArt.Kind.Circle,Color.white);stick.knob=knob;
   var arrow=Label(stickRect,"Direction","‹   ›",20,TextAlignmentOptions.Center);Stretch((RectTransform)arrow.transform);
   footer=Rect("Footer",frame);Fill(footer,new Color(.055f,.125f,.16f));
   var panels=new[]{"growth","equipment","tavern","dungeon","summon","bag"};var names=new[]{"성장","소지품","주점","던전","소환","가방"};
   for(int i=0;i<6;i++){string panel=panels[i];Button(footer,"Menu"+panel,names[i],()=>{stick.ResetInput();app.HudMenu(panel);},new Color(.08f,.18f,.21f));}
   Trim(header,"HeaderTrim",false);Trim(footer,"FooterTrim",true);
   notice=Label(lower,"Notice","",10,TextAlignmentOptions.Center);notice.color=new Color(1,.65f,.5f);
   overlay=Rect("ConnectionOrResult",stage).gameObject;Fill((RectTransform)overlay.transform,new Color(.035f,.08f,.10f,.94f));PanelFrame((RectTransform)overlay.transform,"ResultFrame");Stretch((RectTransform)overlay.transform);
   overlayText=Label(overlay.transform,"Message","전투와 장비를 불러오는 중…",16,TextAlignmentOptions.Center);retry=Button(overlay.transform,"Retry","다시 입장",()=>app.HudRetry(),new Color(.1f,.25f,.28f));
   dungeonPanel=Rect("DungeonPanel",safe);Fill(dungeonPanel,new Color(.035f,.07f,.09f));PanelFrame(dungeonPanel,"DungeonFrame");
   var dungeonTitle=Label(dungeonPanel,"DungeonTitle","던전",24,TextAlignmentOptions.Center);Box((RectTransform)dungeonTitle.transform,18,60,354,50);
   var dungeonInfo=Label(dungeonPanel,"DungeonInfo","촛불 미궁 / 독립 보스 시험\n보스 시험은 계정 성장·보상과 별개입니다.",13,TextAlignmentOptions.Center);Box((RectTransform)dungeonInfo.transform,18,130,354,75);
   Button(dungeonPanel,"BossTrialEntry","보스 시험장 · 10보스",()=>{stick.ResetInput();app.OpenBossTrials();},Color.white);
   Button(dungeonPanel,"DungeonContinue","회랑으로 돌아가기",()=>app.HudMenu(""),Color.white);
   Button(dungeonPanel,"DungeonLobby","로비로",()=>app.HudMenu("lobby"),Color.white);
   dungeonPanel.gameObject.SetActive(false);root.SetActive(false);
  }
  void Dispatch(string id,Action action){if(!app.HudCanInput)return;UiDispatches++;LastInput=id;action();}
  UnityEngine.UI.Button RoundButton(string id,string text,Action action){var r=Rect(id,controls);var art=Art(r,IslandHudArt.Kind.Circle,Color.white);art.raycastTarget=true;var b=r.gameObject.AddComponent<UnityEngine.UI.Button>();b.targetGraphic=art;b.navigation=new UnityEngine.UI.Navigation{mode=UnityEngine.UI.Navigation.Mode.None};b.onClick.AddListener(()=>Dispatch(id,action));var t=Label(r,id+"Label",text,25,TextAlignmentOptions.Center);Stretch((RectTransform)t.transform);var caption=Label(r,id+"Caption",id=="Jump"?"점프":id=="Slide"?"슬라이드":"회피",9,TextAlignmentOptions.Center);Box((RectTransform)caption.transform,-5,43,50,16);return b;}
  UnityEngine.UI.Button Potion(string id,Transform parent,string kind,Color color,out TextMeshProUGUI text){var b=Button(parent,id,"",()=>Dispatch("potion:"+kind,()=>app.HudDrink(kind)),new Color(.07f,.14f,.19f));var art=Art(Rect("Flask",b.transform),IslandHudArt.Kind.Flask,color);Box((RectTransform)art.transform,2,3,26,36);text=Label(b.transform,"Charges","3",11,TextAlignmentOptions.BottomRight);Box((RectTransform)text.transform,26,3,17,36);return b;}
  void Update(){
   if(!app||!root)return;bool dungeon=app.HudDungeonOpen;bool show=app.HudPage&&(!app.HudPanelOpen||dungeon)&&!app.BossTrialsVisible;
   if(root.activeSelf!=show){root.SetActive(show);if(!show)stick.ResetInput();}
   frame.gameObject.SetActive(!dungeon);dungeonPanel.gameObject.SetActive(dungeon);
   if(!show||dungeon)app.HudBattle.RestoreTexturePresentation();
   if(!app.HudPage)return;app.HudSession.Paused=app.HudPanelOpen;
   if(!show)return;
   if(dungeon){LayoutDungeon();return;}
   Layout();ConfigureBattleOutput();Refresh();
   if(!app.HudCanInput){stick.ResetInput();return;}
   if(Input.GetKeyDown(KeyCode.Space))Dispatch("keyboard:attack",app.HudAttack);
   if(Input.GetKeyDown(KeyCode.W)||Input.GetKeyDown(KeyCode.J)||Input.GetKeyDown(KeyCode.UpArrow))Dispatch("keyboard:jump",app.HudJump);
   if(Input.GetKeyDown(KeyCode.S)||Input.GetKeyDown(KeyCode.DownArrow))Dispatch("keyboard:lower",app.HudLower);
   if(Input.GetKeyDown(KeyCode.LeftShift))Dispatch("keyboard:slide",app.HudSlide);
   if(Input.GetKeyDown(KeyCode.Q))Dispatch("keyboard:evade-left",()=>app.HudEvade(-1));if(Input.GetKeyDown(KeyCode.E))Dispatch("keyboard:evade-right",()=>app.HudEvade(1));
   if(Input.GetKeyDown(KeyCode.Z)&&hpPotion.interactable)Dispatch("keyboard:health",()=>app.HudDrink("health"));if(Input.GetKeyDown(KeyCode.X)&&manaPotion.interactable)Dispatch("keyboard:mana",()=>app.HudDrink("mana"));
   for(int i=0;i<6;i++)if(Input.GetKeyDown((KeyCode)((int)KeyCode.Alpha1+i))&&skillButtons[i].interactable){int slot=i;Dispatch("keyboard:skill"+slot,()=>app.HudSkill(slot));}
   float keyboard=(Input.GetKey(KeyCode.A)||Input.GetKey(KeyCode.LeftArrow)?-1:0)+(Input.GetKey(KeyCode.D)||Input.GetKey(KeyCode.RightArrow)?1:0);app.HudMove(Mathf.Abs(stick.Value)>.05f?stick.Value:keyboard);
  }
  void LayoutDungeon(){
   var screenSafe=Screen.safeArea;safe.anchorMin=new Vector2(screenSafe.x/Screen.width,screenSafe.y/Screen.height);safe.anchorMax=new Vector2(screenSafe.xMax/Screen.width,screenSafe.yMax/Screen.height);safe.offsetMin=safe.offsetMax=Vector2.zero;
   var c=(RectTransform)canvas.transform;float units=1080f/390f,h=c.rect.height*screenSafe.height/Screen.height/units,w=c.rect.width*screenSafe.width/Screen.width/units;dungeonPanel.localScale=Vector3.one*units;
   dungeonPanel.anchorMin=dungeonPanel.anchorMax=dungeonPanel.pivot=new Vector2(.5f,.5f);dungeonPanel.anchoredPosition=Vector2.zero;dungeonPanel.sizeDelta=new Vector2(w,h);
   Box((RectTransform)dungeonPanel.Find("DungeonTitle"),18,60,w-36,50);Box((RectTransform)dungeonPanel.Find("DungeonInfo"),18,130,w-36,75);
   Box((RectTransform)dungeonPanel.Find("BossTrialEntry"),24,230,w-48,64);Box((RectTransform)dungeonPanel.Find("DungeonContinue"),24,315,w-48,52);Box((RectTransform)dungeonPanel.Find("DungeonLobby"),24,385,w-48,48);
  }
  public void HideForBossTrials(){if(app)app.HudBattle.RestoreTexturePresentation();if(stick)stick.ResetInput();if(root)root.SetActive(false);}
  void Refresh(){
   var session=app.HudSession;var state=session.State;var hero=app.HudCampaign?state:state?["hero"] as JObject;var progress=state?["progress"] as JObject;var resources=state?["resources"] as JObject;bool active=app.HudCanInput;
   viewport.texture=app.HudBattle.Output;viewport.enabled=!app.HudBattle.DirectPresentationActive;
   title.text=app.HudCampaign?"성장 사냥":"촛불 미궁 · Lv."+Value(state?["dungeonLevel"],1);
   gold.text=RpgContracts.Amount(progress?["gold"])+" G";chamber.text="CHAMBER\n"+(Value(state?["room"])+1).ToString("00")+" / 10";
   objective.text=(string)state?["phase"]=="exit-ready"?"출구 개방 · 점프 / 슬라이드로 이동":"전투 화면을 눌러 기본 공격";
   hpOrb.SetFill((float)RpgContracts.Ratio(hero?["hp"],hero?["maxHP"]));manaOrb.SetFill((float)RpgContracts.Ratio(resources?["mana"],resources?["maxMana"]));
   hpText.text="체력 "+Math.Round(hpOrb.fill*100)+"%";manaText.text=resources==null?"마나 —":"마나 "+Math.Round(manaOrb.fill*100)+"%";
   for(int i=0;i<6;i++){bool equipped=RpgContracts.SkillEnabled(state,i);var skill=RpgContracts.Skill(state,i);string id=equipped?(string)skill?["activeId"]:null;
    if(id!=iconIds[i]){iconIds[i]=id;string icon=(string)app.HudGem(id)?["icon"];icons[i].sprite=string.IsNullOrEmpty(icon)?null:SpriteFor("SkillIcon_"+icon);}
    icons[i].gameObject.SetActive(equipped&&icons[i].sprite!=null);skillButtons[i].interactable=active&&RpgContracts.CanCast(state,i);
    float cd=Value(state?["cooldowns"]?[i]),total=Value(state?["cooldownTotals"]?[i],cd);bool cooling=equipped&&cd>0;
    sweeps[i].gameObject.SetActive(cooling);sweeps[i].fillAmount=total>0?Mathf.Clamp01(cd/total):0;icons[i].color=cooling?new Color(.55f,.55f,.55f):Color.white;
    numbers[i].text=cooling?(cd<1?cd.ToString("0.0"):Mathf.CeilToInt(cd).ToString()):(i+1).ToString();numbers[i].color=equipped?Color.white:new Color(.43f,.49f,.46f);numbers[i].alignment=cooling?TextAlignmentOptions.Center:TextAlignmentOptions.BottomRight;numbers[i].fontSize=cooling?18:11;
   }
   modeText.text="캐릭터 Lv."+Value(progress?["level"],1)+" · "+Value(state?["kills"])+" 처치\n액티브 젬은 소지품에서 장착";
   autoText.text="AUTO "+(session.Auto?"ON":"OFF");autoButton.interactable=active;Skin((UnityEngine.UI.Image)autoButton.targetGraphic,session.Auto?"ui-buttons/btn-purple":"ui-buttons/btn-blue",32,4);
   jump.interactable=active&&(app.HudCampaign||(bool?)state?["jumpReady"]==true);slide.interactable=active&&(app.HudCampaign||(bool?)state?["slideReady"]==true);evadeLeft.interactable=evadeRight.interactable=active&&(app.HudCampaign||(bool?)state?["dodgeReady"]==true);
   PotionState(hpPotion,hpPotionText,"health",hero?["hp"],hero?["maxHP"]);PotionState(manaPotion,manaPotionText,"mana",resources?["mana"],resources?["maxMana"]);
   notice.text=app.HudNotice;
   bool ended=state!=null&&(!session.Active||app.HudCampaign&&(bool?)state["dead"]==true);
   overlay.SetActive(state==null||ended);overlayText.text=state==null?(session.Active?"전투와 장비를 불러오는 중…":"연결 중단 · 다시 입장하세요"):(string)state["status"]=="won"?"미궁 탈출 성공":(string)state["status"]=="dead"?"전투 불능":"연결이 종료되었습니다";retry.gameObject.SetActive(!session.Active);
   DrawDamage(state);
  }
  void PotionState(UnityEngine.UI.Button button,TextMeshProUGUI label,string kind,JToken value,JToken max){var r=app.HudSession.State?["resources"] as JObject;float cooldown=Value(r?["potionCooldowns"]?[kind]),count=Value(r?["potions"]?[kind]);button.interactable=app.HudCanInput&&r!=null&&count>0&&cooldown<=0&&RpgContracts.Ratio(value,max)<1;label.text=cooldown>0?Mathf.CeilToInt(cooldown)+"s":count.ToString("0");}
  void DrawDamage(JObject state){int used=0;float now=Value(state?["elapsed"]);foreach(var fx in state?["fx"] as JArray??new JArray()){
    float age=now-Value(fx["born"]);string kind=(string)fx["kind"];if(used>=damage.Length||age<0||age>1||(kind!="damage"&&kind!="gold")||fx["value"]==null)continue;int room=(int)Value(fx["room"],Value(state?["room"]));float elevation=Value(app.HudSession.Map?["rooms"]?[room]?["elevation"]);
    Vector2 p=app.HudBattle.ViewPoint(Value(fx["x"]),elevation+55+age*25);if(p.x<0||p.x>1||p.y<0||p.y>1)continue;
    var text=damage[used++];text.text=(kind=="gold"?"+":"")+RpgContracts.Amount(fx["value"]);text.color=kind=="gold"?new Color(1,.8f,.3f,1-age):new Color(1,.85f,.8f,1-age);Box((RectTransform)text.transform,p.x*stage.rect.width-55,p.y*stage.rect.height,110,24);
   }for(int i=used;i<damage.Length;i++)damage[i].text="";
  }
  // One root Canvas, width-matched scaling and normalized Safe Area regions.
  void Layout(){
   var area=Screen.safeArea;var c=(RectTransform)canvas.transform;float width=c.rect.width,height=c.rect.height;
   if(Mathf.Abs(width-oldWidth)<.1f&&Mathf.Abs(height-oldHeight)<.1f&&area==oldSafe)return;oldWidth=width;oldHeight=height;oldSafe=area;
   safe.anchorMin=new Vector2(area.x/Screen.width,area.y/Screen.height);safe.anchorMax=new Vector2(area.xMax/Screen.width,area.yMax/Screen.height);safe.offsetMin=safe.offsetMax=Vector2.zero;
   // Preserve existing icon/font design units without an additional CanvasScaler.
   float units=1080f/390f,w=width*area.width/Screen.width/units,h=height*area.height/Screen.height/units;
   frame.anchorMin=frame.anchorMax=frame.pivot=Vector2.one*.5f;frame.anchoredPosition=Vector2.zero;frame.sizeDelta=new Vector2(w,h);frame.localScale=Vector3.one*units;
   Band(stage,.50f,1);Band(header,.94f,1);Band(lower,.08f,.50f);Band(footer,0,.08f);header.SetAsLastSibling();
   float stageH=h*.50f,headerH=h*.06f,lowerH=h*.42f;
   Box((RectTransform)header.Find("Lobby"),6,3,36,headerH-6);Box((RectTransform)title.transform,50,3,w-178,headerH-6);Box((RectTransform)gold.transform,w-124,3,82,headerH-6);Box((RectTransform)header.Find("Help"),w-36,3,30,headerH-6);
   Box((RectTransform)chamber.transform,12,headerH+8,180,40);Box((RectTransform)objective.transform,10,stageH-78,w-20,20);
   float orb=48;resource.anchorMin=new Vector2(0,0);resource.anchorMax=new Vector2(1,0);resource.pivot=new Vector2(.5f,0);resource.anchoredPosition=new Vector2(0,5);resource.sizeDelta=new Vector2(-18,orb);
   Box(hpBox,0,0,orb,orb);Box(manaBox,w-18-orb,0,orb,orb);Stretch((RectTransform)hpOrb.transform);Stretch((RectTransform)manaOrb.transform);Stretch((RectTransform)hpText.transform);Stretch((RectTransform)manaText.transform);
   Box(flasks,(w-18-105)*.5f,orb-46,105,46);Box((RectTransform)hpPotion.transform,0,0,48,46);Box((RectTransform)manaPotion.transform,57,0,48,46);
   Band(skills,.78f,1);skills.offsetMin=new Vector2(12,0);skills.offsetMax=new Vector2(-12,-8);
   var row=skills.GetComponent<UnityEngine.UI.HorizontalLayoutGroup>();if(!row){row=skills.gameObject.AddComponent<UnityEngine.UI.HorizontalLayoutGroup>();row.spacing=6;row.childAlignment=TextAnchor.MiddleCenter;row.childControlWidth=row.childControlHeight=true;row.childForceExpandWidth=false;row.childForceExpandHeight=false;}
   float skillSize=Mathf.Min(48,(w-54)/6);row.spacing=Mathf.Max(4,(w-24-6*skillSize)/5);
   for(int i=0;i<6;i++){
    var e=slotRects[i].GetComponent<UnityEngine.UI.LayoutElement>()??slotRects[i].gameObject.AddComponent<UnityEngine.UI.LayoutElement>();e.minWidth=e.preferredWidth=skillSize;e.flexibleWidth=0;e.minHeight=e.preferredHeight=skillSize;
    Box((RectTransform)icons[i].transform,4,4,skillSize-8,skillSize-8);Box((RectTransform)sweeps[i].transform,2,2,skillSize-4,skillSize-4);Box((RectTransform)numbers[i].transform,3,3,skillSize-6,skillSize-6);
   }
   Band(mode,.27f/.42f,.78f);mode.offsetMin=new Vector2(12,0);mode.offsetMax=new Vector2(-12,0);
   float modeH=lowerH*(.78f-.27f/.42f);Box((RectTransform)modeText.transform,0,0,w-130,modeH);Box((RectTransform)autoButton.transform,w-118,Mathf.Max(0,(modeH-30)*.5f),90,30);
   Band(controls,0,.27f/.42f);controls.offsetMin=new Vector2(12,10);controls.offsetMax=new Vector2(-12,-4);
   float ch=h*.27f-14,cw=w-24;
   Box((RectTransform)stick.transform,18,Mathf.Max(8,(ch-92)*.5f),92,92);knob.anchorMin=knob.anchorMax=knob.pivot=Vector2.one*.5f;knob.sizeDelta=new Vector2(35,35);
   float right=cw-124,first=Mathf.Max(8,ch*.22f-24),second=Mathf.Min(ch-54,ch*.68f-20);
   Box((RectTransform)jump.transform,right,first,48,44);Box((RectTransform)slide.transform,right+66,first,48,44);Box((RectTransform)evadeLeft.transform,right,second,48,44);Box((RectTransform)evadeRight.transform,right+66,second,48,44);
   foreach(var b in new[]{jump,slide,evadeLeft,evadeRight}){var caption=b.transform.Find(b.name+"Caption") as RectTransform;if(caption)Box(caption,-2,36,52,16);}
   Box((RectTransform)notice.transform,118,lowerH-24,w-250,20);
   for(int i=0;i<6;i++){var tab=(RectTransform)footer.GetChild(i);tab.anchorMin=new Vector2(i/6f,0);tab.anchorMax=new Vector2((i+1)/6f,1);tab.offsetMin=new Vector2(3,6);tab.offsetMax=new Vector2(-3,-6);}
   Box((RectTransform)overlayText.transform,20,stageH*.28f,w-40,70);Box((RectTransform)retry.transform,w*.5f-70,stageH*.55f,140,42);
  }
  static void Band(RectTransform r,float a,float b){r.anchorMin=new Vector2(0,a);r.anchorMax=new Vector2(1,b);r.pivot=Vector2.one*.5f;r.offsetMin=r.offsetMax=Vector2.zero;}
  void ConfigureBattleOutput(){
   stage.GetWorldCorners(viewportCorners);var min=RectTransformUtility.WorldToScreenPoint(null,viewportCorners[0]);var max=RectTransformUtility.WorldToScreenPoint(null,viewportCorners[2]);
   if(app.HudBattle.Uses3D)app.HudBattle.ConfigureScreenViewport(new Rect(min.x/Screen.width,min.y/Screen.height,(max.x-min.x)/Screen.width,(max.y-min.y)/Screen.height));
   else app.HudBattle.ConfigureViewport(stage.rect.width/stage.rect.height);
  }

  static float Value(JToken t,float fallback=0){return t==null||t.Type==JTokenType.Null?fallback:t.Value<float>();}
  RectTransform Rect(string name,Transform parent){var go=new GameObject(name,typeof(RectTransform));go.transform.SetParent(parent,false);return (RectTransform)go.transform;}
  static void Stretch(RectTransform r){r.anchorMin=Vector2.zero;r.anchorMax=Vector2.one;r.offsetMin=r.offsetMax=Vector2.zero;}
  static void Box(RectTransform r,float x,float y,float w,float h){r.anchorMin=r.anchorMax=new Vector2(0,1);r.pivot=new Vector2(0,1);r.anchoredPosition=new Vector2(x,-y);r.sizeDelta=new Vector2(w,h);}
  UnityEngine.UI.Image Fill(RectTransform r,Color color){var g=r.gameObject.AddComponent<UnityEngine.UI.Image>();g.color=color;g.raycastTarget=false;return g;}
  IslandHudArt Art(RectTransform r,IslandHudArt.Kind kind,Color color){var g=r.gameObject.AddComponent<IslandHudArt>();g.shape=kind;g.liquid=color;g.raycastTarget=false;return g;}
  TextMeshProUGUI Label(Transform parent,string name,string text,float size,TextAlignmentOptions align){var r=Rect(name,parent);var t=r.gameObject.AddComponent<TextMeshProUGUI>();t.font=font;t.fontSize=size;t.text=text;t.alignment=align;t.color=new Color(.88f,.84f,.7f);t.raycastTarget=false;t.textWrappingMode=TextWrappingModes.NoWrap;t.overflowMode=TextOverflowModes.Ellipsis;return t;}
  UnityEngine.UI.Button Button(Transform parent,string name,string text,Action action,Color color){var r=Rect(name,parent);var image=Fill(r,color);Skin(image,name=="Retry"?"ui-buttons/btn-red":"ui-buttons/btn-blue",32,4);image.raycastTarget=true;var button=r.gameObject.AddComponent<UnityEngine.UI.Button>();button.targetGraphic=image;button.navigation=new UnityEngine.UI.Navigation{mode=UnityEngine.UI.Navigation.Mode.None};button.onClick.AddListener(()=>action());var label=Label(r,name+"Text",text,12,TextAlignmentOptions.Center);Stretch((RectTransform)label.transform);return button;}
  // Original web PNGs, sliced at runtime: no TextureImporter/.meta changes.
  void Skin(UnityEngine.UI.Image image,string path,float border,float multiplier){var sprite=SharedSprite(path,border);if(!sprite)return;image.sprite=sprite;image.type=UnityEngine.UI.Image.Type.Sliced;image.pixelsPerUnitMultiplier=multiplier;image.color=Color.white;}
  Sprite SharedSprite(string path,float border=0){string key="shared:"+path;if(sprites.TryGetValue(key,out var sprite))return sprite;var texture=Resources.Load<Texture2D>("WebAssets/"+path);if(!texture)return null;sprite=Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f),100,0,SpriteMeshType.FullRect,new Vector4(border,border,border,border));sprites[key]=sprite;return sprite;}
  void PanelFrame(RectTransform parent,string name){var r=Rect(name,parent);Stretch(r);var image=Fill(r,Color.white);Skin(image,"ui/leaderboard/Leaderboard_1_x4",48,3);image.fillCenter=false;}
  void Trim(RectTransform parent,string name,bool top){var r=Rect(name,parent);var image=Fill(r,Color.white);image.sprite=SharedSprite("ui/leaderboard/gold_trim_horizontal");r.anchorMin=new Vector2(0,top?1:0);r.anchorMax=new Vector2(1,top?1:0);r.pivot=new Vector2(.5f,top?1:0);r.sizeDelta=new Vector2(0,4);r.anchoredPosition=Vector2.zero;}
  Sprite SpriteFor(string name){if(sprites.TryGetValue(name,out var sprite))return sprite;var texture=Resources.Load<Texture2D>("WebAssets/rpg/"+name);if(!texture)return null;sprite=Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f));sprites[name]=sprite;return sprite;}
  Sprite WhiteSprite(){if(!sprites.TryGetValue("_white",out var sprite)){sprite=Sprite.Create(Texture2D.whiteTexture,new Rect(0,0,1,1),new Vector2(.5f,.5f));sprites["_white"]=sprite;}return sprite;}
  void OnDisable(){if(app&&app.HudBattle)app.HudBattle.RestoreTexturePresentation();if(stick)stick.ResetInput();if(root)root.SetActive(false);}
  void OnDestroy(){foreach(var sprite in sprites.Values)if(sprite)Destroy(sprite);if(font){foreach(var atlas in font.atlasTextures)if(atlas)Destroy(atlas);if(font.material)Destroy(font.material);Destroy(font);}if(ownsEventSystem&&events)Destroy(events);}
 }
}
