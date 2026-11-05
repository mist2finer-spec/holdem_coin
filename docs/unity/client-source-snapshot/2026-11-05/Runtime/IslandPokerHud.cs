using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Newtonsoft.Json.Linq;
using TMPro;
using UnityEngine;
namespace IslandGame {
 // uGUI presentation of the server's public TABLE_STATE. No private-card lookup or local settlement.
 public sealed class IslandPokerHud:MonoBehaviour {
  sealed class Card {public RectTransform Root;public IslandPokerPanel Art;public TextMeshProUGUI Rank,Suit;public string Value;}
  sealed class ShowdownRow {public RectTransform Root;public TextMeshProUGUI Caption;public Card[] Cards;}
  sealed class Seat {public RectTransform Root,Wager;public UnityEngine.UI.Image Portrait;public IslandPokerPanel Frame;public TextMeshProUGUI Name,Stack,Badge,Status,Bet;public Card[] Cards;public bool Self;}
  IslandApp app;TMP_FontAsset font;GameObject root;RectTransform safeArea,safe,arena,actions,modal,potMenu;Canvas canvas;
  TextMeshProUGUI title,phase,pot,turn,notice,result,modalText,muteLabel,raiseLabel,customHint,tournamentInfo;RectTransform showdownRoot,showdownContent;readonly List<ShowdownRow> showdownRows=new List<ShowdownRow>();
  UnityEngine.UI.Button fold,call,raise,potButton,allin,customSubmit,rebuy,reserveFold,reserveCall;readonly List<UnityEngine.UI.Button> fractions=new List<UnityEngine.UI.Button>();
  TMP_InputField custom;readonly List<UnityEngine.UI.Button> raiseSteps=new List<UnityEngine.UI.Button>();
  readonly Seat[] seats=new Seat[8];readonly Card[] board=new Card[5];readonly Dictionary<string,Sprite> sprites=new Dictionary<string,Sprite>();Dictionary<int,string> profiles;
  JObject bound;string context,pendingContext;bool pending;int tenths=20;float oldWidth=-1,oldHeight=-1;Rect oldSafe;string historyMessage,lastNotice;float noticeUntil;
  long stack,currentBet,callAmount,minRaise,cap,highest,bigBlind;bool canRaise,canAct;long raiseTarget;int selectedTenths,maxTenths;
  public bool Visible=>root&&root.activeSelf;
  public bool ActionPending=>pending;
  public int ActionDispatches {get;private set;}
  public void Initialize(IslandApp owner,TMP_FontAsset sharedFont){
   app=owner;font=sharedFont;var manifest=Resources.Load<TextAsset>("WebAssets/poker/profiles/manifest");profiles=new Dictionary<int,string>();if(manifest)foreach(var p in JObject.Parse(manifest.text)["characters"])profiles[(int)p["portrait"]]=(string)p["id"];
   root=new GameObject("PokerCanvas",typeof(RectTransform),typeof(Canvas),typeof(UnityEngine.UI.CanvasScaler),typeof(UnityEngine.UI.GraphicRaycaster));root.transform.SetParent(transform,false);canvas=root.GetComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=30;
   var scale=root.GetComponent<UnityEngine.UI.CanvasScaler>();scale.uiScaleMode=UnityEngine.UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;scale.referenceResolution=new Vector2(390,844);scale.matchWidthOrHeight=0;
   var backdrop=Panel((RectTransform)root.transform,"PokerBackground",new Color(.055f,.09f,.11f));Stretch(backdrop);backdrop.GetComponent<IslandPokerPanel>().Border=0;backdrop.GetComponent<IslandPokerPanel>().Radius=0;safeArea=Rect("PokerSafeArea",root.transform);Stretch(safeArea);safe=Rect("PokerFrame",safeArea);safe.anchorMin=safe.anchorMax=safe.pivot=Vector2.one*.5f;
   var leave=Button(safe,"PokerLeave","← 로비",()=>app.PokerLeave());Box((RectTransform)leave.transform,8,8,62,32);
   title=Label(safe,"PokerMode","6 SEATS",12);Box(title.rectTransform,78,12,145,26);phase=Label(safe,"PokerPhase","PRE-FLOP",11);Box(phase.rectTransform,255,8,125,32);
   arena=Rect("PokerArena",safe);arena.anchorMin=new Vector2(0,0);arena.anchorMax=new Vector2(1,1);arena.offsetMin=new Vector2(15,180);arena.offsetMax=new Vector2(-15,-58);
   var table=Rect("SalonTable",arena);Stretch(table);var surface=table.gameObject.AddComponent<IslandPokerTableSurface>();surface.raycastTarget=false;
   pot=Label(arena,"PokerPot","POT 0",12);Anchor(pot.rectTransform,new Vector2(.5f,.43f),166,32);
   for(int i=0;i<5;i++)board[i]=MakeCard(arena,"BoardCard"+i);
   for(int i=0;i<8;i++){
    var s=new Seat();seats[i]=s;s.Root=Rect("PokerSeat"+i,arena);s.Frame=s.Root.gameObject.AddComponent<IslandPokerPanel>();s.Frame.Radius=12;s.Frame.Border=1;s.Frame.Top=s.Frame.Bottom=new Color(0,0,0,0);s.Frame.raycastTarget=false;
    var art=Rect("Portrait",s.Root);Stretch(art);s.Portrait=art.gameObject.AddComponent<UnityEngine.UI.Image>();s.Portrait.preserveAspect=true;s.Portrait.raycastTarget=false;var glow=art.gameObject.AddComponent<UnityEngine.UI.Outline>();glow.effectColor=new Color(.35f,1,.78f);glow.effectDistance=new Vector2(1.5f,-1.5f);glow.enabled=false;
    var info=Panel(s.Root,"ProfileInfo",new Color(.025f,.035f,.05f,.97f));info.anchorMin=new Vector2(0,0);info.anchorMax=new Vector2(1,.30f);info.offsetMin=info.offsetMax=Vector2.zero;
    s.Name=Label(info,"PlayerName","",8);s.Stack=Label(info,"PlayerStack","",10);s.Badge=Label(s.Root,"DealerBlind","",10);s.Status=Label(s.Root,"SeatStatus","",10);
    s.Cards=new[]{MakeCard(s.Root,"Hole0"),MakeCard(s.Root,"Hole1")};s.Wager=Panel(arena,"Wager"+i,new Color(.02f,.07f,.08f,.95f));s.Bet=Label(s.Wager,"WagerAmount","",9);Stretch(s.Bet.rectTransform);
   }
   BuildShowdown();
   result=Label(arena,"PokerResult","",12);result.textWrappingMode=TextWrappingModes.Normal;Anchor(result.rectTransform,new Vector2(.5f,.55f),210,110);
   actions=Rect("PokerActions",safe);actions.anchorMin=Vector2.zero;actions.anchorMax=Vector2.right;actions.pivot=new Vector2(.5f,0);actions.sizeDelta=new Vector2(0,174);actions.anchoredPosition=Vector2.zero;
   turn=Label(actions,"PokerTurn","서버에 연결 중…",12);Box(turn.rectTransform,8,0,374,23);
   fold=Button(actions,"PokerFold","FOLD",()=>Send("fold",0),true,new Color(.33f,.11f,.15f));call=Button(actions,"PokerCall","CHECK",()=>Send(callAmount>0?"call":"check",Math.Min(callAmount,stack)),true,new Color(.025f,.24f,.25f));
   raise=Button(actions,"PokerRaise","RAISE 2X",()=>Send(raiseTarget>=currentBet+stack?"allin":"raise",raiseTarget>=currentBet+stack?stack:raiseTarget),true,new Color(.15f,.09f,.24f));raiseLabel=raise.GetComponentInChildren<TextMeshProUGUI>();
   potButton=Button(actions,"PokerPotMenu","POT BET\nOR ALL-IN",()=>potMenu.gameObject.SetActive(!potMenu.gameObject.activeSelf),true,new Color(.15f,.09f,.24f));
   var main=new[]{fold,call,raise,potButton};for(int i=0;i<4;i++)Box((RectTransform)main[i].transform,8+i*95,48,89,58);
   int[] steps={10,2,-10,-2};for(int i=0;i<4;i++){int amount=steps[i];var b=Button(actions,"RaiseStep"+amount,(amount>0?"+":"−")+(Math.Abs(amount)/10f).ToString("0.#",CultureInfo.InvariantCulture),()=>{tenths=Mathf.Clamp(selectedTenths+amount,20,maxTenths);RefreshActions();},true);Box((RectTransform)b.transform,198+(i%2)*45,i<2?24:109,44,22);raiseSteps.Add(b);}
   reserveFold=Button(actions,"ReserveFold","폴드 예약",()=>app.PokerReserve("fold"));Box((RectTransform)reserveFold.transform,8,25,88,21);reserveCall=Button(actions,"ReserveCall","체크/콜 예약",()=>app.PokerReserve(callAmount>0?"call":"check"));Box((RectTransform)reserveCall.transform,102,25,88,21);
   var history=Button(actions,"PokerHistory","핸드 기록",()=>{ShowModal("핸드 기록을 불러오는 중…");app.PokerLoadHistory(value=>{if(Visible&&modal.gameObject.activeSelf)modalText.text=value;});});Box((RectTransform)history.transform,8,138,90,30);
   rebuy=Button(actions,"PokerRebuy","리바이",()=>{app.PokerRebuy();rebuy.interactable=false;});Box((RectTransform)rebuy.transform,105,138,70,30);
   var reconnect=Button(actions,"PokerReconnect","재연결",()=>app.PokerReconnect());Box((RectTransform)reconnect.transform,183,138,70,30);
   var mute=Button(actions,"PokerMute","소리 켬",()=>app.PokerAudio.ToggleMuted());Box((RectTransform)mute.transform,310,138,72,30);muteLabel=mute.GetComponentInChildren<TextMeshProUGUI>();
   notice=Label(safe,"PokerNotice","",11);notice.textWrappingMode=TextWrappingModes.Normal;notice.alignment=TextAlignmentOptions.Center;notice.color=new Color(1,.8f,.45f);Box(notice.rectTransform,14,42,362,34);
   tournamentInfo=Label(safe,"TournamentInfo","",10);Box(tournamentInfo.rectTransform,8,40,374,20);
   BuildPotMenu();modal=Panel(safe,"PokerModal",new Color(.025f,.04f,.06f,.99f));Anchor(modal,new Vector2(.5f,.5f),346,210);modalText=Label(modal,"Message","",13);Box(modalText.rectTransform,14,20,318,120);modalText.textWrappingMode=TextWrappingModes.Normal;var close=Button(modal,"ClosePokerModal","닫기",()=>modal.gameObject.SetActive(false));Box((RectTransform)close.transform,110,161,126,35);modal.gameObject.SetActive(false);root.SetActive(false);
  }
  void BuildShowdown(){
   showdownRoot=Panel(arena,"ShowdownResults",new Color(.025f,.05f,.065f,.98f));Anchor(showdownRoot,new Vector2(.5f,.55f),230,228);
   var viewport=Rect("Viewport",showdownRoot);Stretch(viewport);viewport.offsetMin=new Vector2(5,5);viewport.offsetMax=new Vector2(-5,-5);viewport.gameObject.AddComponent<UnityEngine.UI.RectMask2D>();
   var scroll=showdownRoot.gameObject.AddComponent<UnityEngine.UI.ScrollRect>();scroll.viewport=viewport;scroll.horizontal=false;scroll.movementType=UnityEngine.UI.ScrollRect.MovementType.Clamped;
   showdownContent=Rect("Content",viewport);showdownContent.anchorMin=new Vector2(0,1);showdownContent.anchorMax=Vector2.one;showdownContent.pivot=new Vector2(.5f,1);showdownContent.sizeDelta=new Vector2(0,544);scroll.content=showdownContent;
   for(int i=0;i<8;i++){var row=new ShowdownRow();row.Root=Rect("ShowdownPlayer"+i,showdownContent);Box(row.Root,0,i*68,220,66);row.Caption=Label(row.Root,"HandCategory","",10);Box(row.Caption.rectTransform,0,0,220,22);row.Cards=new Card[7];for(int k=0;k<7;k++){row.Cards[k]=MakeCard(row.Root,"ResultCard"+k);Box(row.Cards[k].Root,17+k*27,25,24,34);row.Cards[k].Rank.fontSize=9;row.Cards[k].Suit.fontSize=14;row.Cards[k].Root.gameObject.AddComponent<CanvasGroup>();}showdownRows.Add(row);}showdownRoot.gameObject.SetActive(false);
  }
  void ShowShowdown(JObject state){
   var hands=state["showdownHands"]as JArray??new JArray();showdownRoot.gameObject.SetActive(hands.Count>0);pot.gameObject.SetActive(hands.Count==0);foreach(var card in board)card.Root.gameObject.SetActive(false);
   var community=state["boardCards"]as JArray??new JArray();showdownContent.sizeDelta=new Vector2(0,Math.Max(1,hands.Count)*68);
   for(int i=0;i<showdownRows.Count;i++){var row=showdownRows[i];row.Root.gameObject.SetActive(i<hands.Count);if(i>=hands.Count)continue;var hand=hands[i];row.Caption.text=(B(hand,"isWinner")?"★ ":"")+(string)hand["name"]+" · "+(string)hand["handCategory"];var player=((JArray)state["seats"]).FirstOrDefault(s=>N(s,"seatId")==N(hand,"seatId"));var holes=player?["holeCards"]as JArray??new JArray();var raw=new JArray(holes.Concat(community));var selected=holes.Count==2&&community.Count==5?ShowdownSelection.BestFive(holes.Values<string>().ToArray(),community.Values<string>().ToArray()):new HashSet<int>();for(int k=0;k<7;k++){row.Cards[k].Root.gameObject.SetActive(k<raw.Count);if(k<raw.Count)BindCard(row.Cards[k],raw[k]);row.Cards[k].Root.GetComponent<CanvasGroup>().alpha=selected.Count==0||selected.Contains(k)?1:.3f;}}
  }
  void BuildPotMenu(){
   potMenu=Panel(safe,"PokerBetMenu",new Color(.025f,.04f,.06f,.99f));potMenu.anchorMin=new Vector2(1,0);potMenu.anchorMax=new Vector2(1,0);potMenu.pivot=new Vector2(1,0);potMenu.sizeDelta=new Vector2(230,285);potMenu.anchoredPosition=new Vector2(-8,174);
   var caption=Label(potMenu,"BetMenuTitle","금액을 눌러 베팅",12);Box(caption.rectTransform,8,7,170,24);var x=Button(potMenu,"CloseBetMenu","×",()=>potMenu.gameObject.SetActive(false));Box((RectTransform)x.transform,192,5,30,28);
   allin=Button(potMenu,"PokerAllIn","ALL-IN",()=>Send("allin",stack),true,new Color(.33f,.11f,.15f));Box((RectTransform)allin.transform,8,38,214,35);
   double[] parts={.75,.5,.25};string[] labels={"3/4 POT","1/2 POT","1/4 POT"};for(int i=0;i<3;i++){double f=parts[i];var b=Button(potMenu,"PotFraction"+i,labels[i],()=>{long amount=(long)Math.Floor(app.PokerState.Value<long>("totalPot")*f);long target=Math.Min(cap,amount);Send(target>=currentBet+stack?"allin":"raise",target>=currentBet+stack?stack:target);},true);Box((RectTransform)b.transform,8,79+i*39,214,35);fractions.Add(b);}
   customHint=Label(potMenu,"CustomHint","직접 금액 · 칩 단위",10);Box(customHint.rectTransform,8,198,214,20);
   var input=Panel(potMenu,"CustomRaise",new Color(.05f,.08f,.11f));Box(input,8,222,142,40);custom=input.gameObject.AddComponent<TMP_InputField>();var area=Rect("TextArea",input);Stretch(area);area.offsetMin=new Vector2(6,2);area.offsetMax=new Vector2(-6,-2);area.gameObject.AddComponent<UnityEngine.UI.RectMask2D>();var text=Label(area,"InputText","",13);Stretch(text.rectTransform);custom.textViewport=area;custom.textComponent=text;custom.contentType=TMP_InputField.ContentType.DecimalNumber;custom.keyboardType=TouchScreenKeyboardType.DecimalPad;custom.onValueChanged.AddListener(_=>RefreshActions());
   customSubmit=Button(potMenu,"SubmitCustomRaise","베팅",()=>{long target;if(CustomAmount(out target))Send("raise",target);},true);Box((RectTransform)customSubmit.transform,158,222,64,40);potMenu.gameObject.SetActive(false);
  }
  void Update(){
   bool show=app&&app.PokerVisible;if(root.activeSelf!=show){root.SetActive(show);bound=null;pending=false;potMenu.gameObject.SetActive(false);modal.gameObject.SetActive(false);}if(!show)return;
   Layout();var state=app.PokerState;if(state!=bound){bound=state;Bind();}RefreshActions();
  }
  void Layout(){
   if(oldWidth==Screen.width&&oldHeight==Screen.height&&oldSafe==Screen.safeArea)return;oldWidth=Screen.width;oldHeight=Screen.height;oldSafe=Screen.safeArea;
   safeArea.anchorMin=new Vector2(oldSafe.xMin/Screen.width,oldSafe.yMin/Screen.height);safeArea.anchorMax=new Vector2(oldSafe.xMax/Screen.width,oldSafe.yMax/Screen.height);safeArea.offsetMin=safeArea.offsetMax=Vector2.zero;Canvas.ForceUpdateCanvases();float scale=safeArea.rect.width/390;safe.localScale=Vector3.one*scale;safe.sizeDelta=new Vector2(390,safeArea.rect.height/scale);Canvas.ForceUpdateCanvases();PositionSeats();
  }
  void PositionSeats(){
   int count=app.PokerTournamentMode||((bound?["seats"]as JArray)?.Count??6)>6?8:6;float w=Mathf.Min(78,arena.rect.height*.13f);float h=w*286/256;
   var positions=count==6?new[]{new Vector2(.5f,.11f),new Vector2(.87f,.35f),new Vector2(.87f,.65f),new Vector2(.5f,.90f),new Vector2(.13f,.65f),new Vector2(.13f,.35f)}:new[]{new Vector2(.5f,.11f),new Vector2(.87f,.30f),new Vector2(.87f,.50f),new Vector2(.87f,.70f),new Vector2(.5f,.90f),new Vector2(.13f,.70f),new Vector2(.13f,.50f),new Vector2(.13f,.30f)};
   for(int i=0;i<8;i++){var s=seats[i];if(i>=count){s.Root.gameObject.SetActive(false);s.Wager.gameObject.SetActive(false);continue;}var p=positions[i];Anchor(s.Root,p,w,h);Box(s.Name.rectTransform,3,h*.77f,w-6,h*.10f);s.Name.fontSize=w*.115f;Box(s.Stack.rectTransform,2,h*.87f,w-4,h*.12f);s.Stack.fontSize=w*.14f;
    // Name and stack are children of the info strip, so their coordinates are local to it.
    Box(s.Name.rectTransform,3,0,w-6,h*.14f);s.Name.fontSize=w*.102f;Box(s.Stack.rectTransform,2,h*.14f,w-4,h*.156f);s.Stack.fontSize=w*.118f;
    Box(s.Badge.rectTransform,w-18,2,24,20);Box(s.Status.rectTransform,0,h*.45f,w,20);
    float cw=i==0?30:20,ch=cw*1.4f;Box(s.Cards[0].Root,w*.5f-cw-1,-ch+4,cw,ch);Box(s.Cards[1].Root,w*.5f+1,-ch+4,cw,ch);
    Anchor(s.Wager,new Vector2(p.x==.5f?.5f:p.x<.5f?.25f:.75f,i==0?.38f:p.y>.85f?.76f:p.y),64,23);
   }
   for(int i=0;i<5;i++)Anchor(board[i].Root,new Vector2(.5f,.59f),35,49,new Vector2((i-2)*38,0));
  }
  static long N(JToken o,string k)=>(o as JObject)?[k]?.Value<long?>()??0;
  static bool B(JToken o,string k)=>(o as JObject)?[k]?.Value<bool?>()??false;
  string Money(long n)=>PokerSizing.Money(n,bigBlind,app.PokerTournamentMode);
  JToken Me=>((bound?["seats"]as JArray)??new JArray()).FirstOrDefault(s=>B(s,"isMe")||N(s,"seatId")==N(bound,"mySeatId"));
  void Bind(){
   PositionSeats();foreach(var s in seats){s.Root.gameObject.SetActive(false);s.Wager.gameObject.SetActive(false);}foreach(var c in board)c.Root.gameObject.SetActive(false);
   showdownRoot.gameObject.SetActive(false);pot.gameObject.SetActive(true);
   if(bound==null){title.text="연결 중";phase.text="";pot.text="";result.text="";return;}
   bigBlind=Math.Max(1,N(bound["tournament"],"bigBlind"));if(bound["tournament"]==null||bound["tournament"].Type==JTokenType.Null)bigBlind=200;
   int count=((JArray)bound["seats"]).Count;int mine=Math.Max(0,(int)N(bound,"mySeatId"));if(count==0)return;
   title.text=(app.PokerTournamentMode?"TOURNAMENT":"6 SEATS")+" · HAND "+N(bound,"handNumber");phase.text=((string)bound["phase"]??"").Replace("PREFLOP","PRE-FLOP");pot.text="POT "+Money(N(bound,"totalPot"));
   var winner=bound["winnerInfo"] as JObject;result.text=winner==null?"":(string)winner["name"]+" 승리\n"+Money(N(winner,"amount"))+"\n"+(string)winner["hand"];
   var boardCards=bound["boardCards"] as JArray??new JArray();for(int i=0;i<Math.Min(5,boardCards.Count);i++){board[i].Root.gameObject.SetActive(true);Anchor(board[i].Root,new Vector2(.5f,.59f),35,49,new Vector2((i-(Math.Min(5,boardCards.Count)-1)*.5f)*38,0));BindCard(board[i],boardCards[i]);}
   foreach(var data in bound["seats"]){if(B(data,"eliminated"))continue;int index=((int)N(data,"seatId")-mine+count)%count;if(index<0||index>=8)continue;var s=seats[index];s.Root.gameObject.SetActive(true);s.Self=B(data,"isMe");string id;if(!profiles.TryGetValue((int)N(data,"portrait"),out id))id="hong";s.Portrait.sprite=Sprite("poker/profiles/"+id);s.Portrait.color=B(data,"folded")?new Color(.45f,.45f,.45f):Color.white;s.Name.text=(string)data["name"]+"  ★1";s.Stack.text=Money(N(data,"stack"));s.Status.text=B(data,"folded")?"FOLD":B(data,"allIn")?"ALL-IN":"";
    s.Frame.Edge=Color.clear;s.Frame.Border=0;s.Portrait.GetComponent<UnityEngine.UI.Outline>().enabled=N(data,"seatId")==N(bound,"activeSeatId");s.Frame.SetVerticesDirty();s.Badge.text=N(data,"seatId")==N(bound,"bigBlindSeat")?"BB":N(data,"seatId")==N(bound,"smallBlindSeat")?"SB":N(data,"seatId")==N(bound,"buttonSeat")?"D":"";
    var holes=data["holeCards"]as JArray??new JArray();for(int i=0;i<2;i++){s.Cards[i].Root.gameObject.SetActive(i<holes.Count&&(!B(data,"folded")||s.Self));if(i<holes.Count)BindCard(s.Cards[i],holes[i]);}
    long bet=N(data,"currentBet");s.Wager.gameObject.SetActive(bet>0);s.Bet.text="◉ "+Money(bet);
   }
   if((string)bound["phase"]=="SHOWDOWN"){
    ShowShowdown(bound);
    var hands=bound["showdownHands"]as JArray??new JArray();var labels=hands.Select(h=>(B(h,"isWinner")?"★ ":"")+(string)h["name"]+" · "+(string)h["handCategory"]);result.text=string.Join("\n",labels.Take(8));
    result.text="";var me=Me;var holes=me?["holeCards"]as JArray;if(holes?.Count==2&&boardCards.Count==5){var best=ShowdownSelection.BestFive(holes.Values<string>().ToArray(),boardCards.Values<string>().ToArray());for(int i=0;i<5;i++)if(best.Count>0)board[i].Art.Edge=best.Contains(i+2)?new Color(1,.8f,.25f):new Color(.35f,.30f,.23f);}
   }
  }
  void RefreshActions(){
   var me=Me;stack=N(me,"stack");currentBet=N(me,"currentBet");callAmount=N(bound,"callAmount");highest=currentBet+callAmount;minRaise=N(bound,"minRaise");cap=Math.Min(N(bound,"maxRaise"),currentBet+stack);
   string previousContext=context;context=N(bound,"handNumber")+":"+bound?["phase"]+":"+N(bound,"activeSeatId")+":"+N(bound,"totalPot")+":"+currentBet+":"+stack+":"+bound?["dealStage"];
   if(previousContext!=null&&previousContext!=context)potMenu.gameObject.SetActive(false);
   if(pending&&context!=pendingContext){pending=false;potMenu.gameObject.SetActive(false);}canAct=bound!=null&&app.PokerOnline&&B(bound,"isUserTurn")&&!pending&&(string)bound["phase"]!="SHOWDOWN"&&(string)bound["phase"]!="HAND_END"&&string.IsNullOrEmpty((string)bound["dealStage"]);
   long basis=Math.Max(1,highest>0?highest:bigBlind);canRaise=stack>callAmount&&cap>highest;maxTenths=(int)Math.Min(int.MaxValue,Math.Max(20,Math.Ceiling((double)Math.Max(0,cap)/basis*10)));selectedTenths=Mathf.Clamp(tenths,20,maxTenths);
   raiseTarget=Math.Min(cap,Math.Max(minRaise,(long)Math.Min(long.MaxValue,Math.Ceiling((decimal)basis*selectedTenths/10))));
   fold.interactable=call.interactable=canAct;call.GetComponentInChildren<TextMeshProUGUI>().text=callAmount>0?"CALL\n"+Money(Math.Min(callAmount,stack)):"CHECK";raise.interactable=canAct&&canRaise;raiseLabel.text="RAISE "+(selectedTenths/10f).ToString("0.#",CultureInfo.InvariantCulture)+"X\n"+(raiseTarget>=currentBet+stack?"ALL-IN":Money(raiseTarget));potButton.interactable=canAct&&stack>0;
   for(int i=0;i<raiseSteps.Count;i++)raiseSteps[i].interactable=canAct&&canRaise&&(i<2?selectedTenths<maxTenths:selectedTenths>20);
   double[] f={.75,.5,.25};for(int i=0;i<3;i++){long target=Math.Min(cap,(long)Math.Floor(N(bound,"totalPot")*f[i]));bool all=target>=currentBet+stack;fractions[i].interactable=canAct&&canRaise&&target>highest&&(target>=minRaise||all);fractions[i].GetComponentInChildren<TextMeshProUGUI>().text=new[]{"3/4 POT","1/2 POT","1/4 POT"}[i]+" · "+(all?"ALL-IN":Money(target));}
   allin.interactable=canAct&&stack>0&&(stack<=callAmount||canRaise);allin.GetComponentInChildren<TextMeshProUGUI>().text="ALL-IN · "+Money(stack);long customTarget;customSubmit.interactable=canAct&&canRaise&&CustomAmount(out customTarget);customHint.text=app.PokerTournamentMode?"직접 금액 · BB 단위":"직접 금액 · 칩 단위";
   reserveFold.gameObject.SetActive(bound!=null&&!B(bound,"isUserTurn"));reserveCall.gameObject.SetActive(bound!=null&&!B(bound,"isUserTurn"));reserveFold.interactable=reserveCall.interactable=app.PokerOnline&&me!=null;
   rebuy.gameObject.SetActive(!app.PokerTournamentMode&&B(bound,"playerBusted"));rebuy.interactable=app.PokerOnline&&!B(bound,"rebuyPending");muteLabel.text=app.PokerAudio.Muted?"소리 끔":"소리 켬";
   double seconds=Math.Max(0,(N(bound,"actionDeadline")-N(bound,"serverNow"))/1000d-(Time.unscaledTime-app.PokerReceivedAt));string deal=(string)bound?["dealStage"];
   turn.text=bound==null?"서버 테이블에 연결 중…":pending?"서버 응답 확인 중…":!app.PokerOnline?"연결이 끊겼습니다":deal=="shuffle"||deal=="cards"?"◆ 카드를 딜링하는 중…":B(bound,"handInProgress")?"현재 핸드 종료 후 참여합니다":B(bound,"isUserTurn")?"내 차례 · "+Math.Ceiling(seconds)+"초":"상대의 액션을 기다리는 중";
   var tournament=bound?["tournament"] as JObject;tournamentInfo.gameObject.SetActive(tournament!=null);if(tournament!=null){double left=Math.Max(0,(N(tournament,"nextLevelAt")-N(bound,"serverNow"))/1000d-(Time.unscaledTime-app.PokerReceivedAt));tournamentInfo.text="ROUND "+N(tournament,"level")+" · "+N(tournament,"remaining")+"명 · "+N(tournament,"smallBlind")+"/"+bigBlind+" · "+Math.Floor(left/60)+":"+((int)left%60).ToString("00");}
   var reserved=bound?["preAction"] as JObject;reserveFold.GetComponentInChildren<TextMeshProUGUI>().text=(string)reserved?["type"]=="fold"?"폴드 예약 취소":"폴드 예약";reserveCall.GetComponentInChildren<TextMeshProUGUI>().text=(string)reserved?["type"]=="call"||(string)reserved?["type"]=="check"?"예약 취소":"체크/콜 예약";
   string message=app.PokerNotice??"";if(message!=lastNotice){lastNotice=message;noticeUntil=Time.unscaledTime+4;}notice.text=System.Text.RegularExpressions.Regex.Replace(app.PokerOnline&&Time.unscaledTime>noticeUntil?"":message,@"[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2300-\u23FF]","");
  }
  bool CustomAmount(out long amount){amount=0;decimal n;if(custom==null||!decimal.TryParse(custom.text,NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture,out n)||n<=0)return false;if(app.PokerTournamentMode)n*=bigBlind;if(n!=decimal.Truncate(n)||n>long.MaxValue)return false;amount=(long)n;return amount>=minRaise&&amount<=cap&&amount>highest;}
  void Send(string action,long amount){if(!canAct||pending)return;pending=true;pendingContext=context;ActionDispatches++;potMenu.gameObject.SetActive(false);app.PokerAction(action,amount);RefreshActions();}
  public void RejectAction(){pending=false;noticeUntil=Time.unscaledTime+4;}
  void ShowModal(string value){modalText.text=value;modal.gameObject.SetActive(true);}
  Card MakeCard(Transform parent,string name){var r=Rect(name,parent);var art=r.gameObject.AddComponent<IslandPokerPanel>();art.Radius=4;art.raycastTarget=false;var rank=Label(r,"Rank","",12);Box(rank.rectTransform,3,1,29,19);rank.alignment=TextAlignmentOptions.TopLeft;var suit=Label(r,"Suit","",19);Stretch(suit.rectTransform);suit.alignment=TextAlignmentOptions.Center;return new Card{Root=r,Art=art,Rank=rank,Suit=suit};}
  void BindCard(Card c,JToken raw){string value=raw is JObject?(string)raw["rank"]+(string)raw["suit"]:raw?.Value<string>();c.Value=value;bool hidden=string.IsNullOrEmpty(value)||value=="??";c.Art.Top=hidden?new Color(.16f,.12f,.31f):new Color(1,.97f,.86f);c.Art.Bottom=hidden?new Color(.07f,.06f,.17f):new Color(.92f,.87f,.71f);c.Art.Edge=hidden?new Color(.60f,.43f,.22f):new Color(.32f,.25f,.17f);c.Art.SetVerticesDirty();string suit=hidden?"♠":value.Substring(value.Length-1);c.Rank.text=hidden?"":value.Substring(0,value.Length-1).Replace("T","10");c.Suit.text=suit;var color=hidden?new Color(.77f,.58f,.28f):suit=="♥"||suit=="♦"||suit=="h"||suit=="d"?new Color(.75f,.1f,.2f):new Color(.08f,.12f,.18f);c.Rank.color=c.Suit.color=color;}
  Sprite Sprite(string path){Sprite sprite;if(sprites.TryGetValue(path,out sprite))return sprite;var t=Resources.Load<Texture2D>("WebAssets/"+path);sprite=t?UnityEngine.Sprite.Create(t,new Rect(0,0,t.width,t.height),Vector2.one*.5f,100):null;sprites[path]=sprite;return sprite;}
  RectTransform Rect(string name,Transform parent){var r=new GameObject(name,typeof(RectTransform),typeof(CanvasRenderer)).GetComponent<RectTransform>();r.SetParent(parent,false);return r;}
  RectTransform Panel(Transform parent,string name,Color color){var r=Rect(name,parent);var g=r.gameObject.AddComponent<IslandPokerPanel>();g.Top=color;g.Bottom=color*.8f;g.Bottom=new Color(g.Bottom.r,g.Bottom.g,g.Bottom.b,color.a);g.raycastTarget=true;return r;}
  TextMeshProUGUI Label(Transform parent,string name,string value,float size){var r=Rect(name,parent);var t=r.gameObject.AddComponent<TextMeshProUGUI>();t.font=font;t.fontSize=size;t.text=value;t.color=new Color(.95f,.88f,.68f);t.alignment=TextAlignmentOptions.Center;t.raycastTarget=false;t.textWrappingMode=TextWrappingModes.NoWrap;t.overflowMode=TextOverflowModes.Ellipsis;return t;}
  UnityEngine.UI.Button Button(Transform parent,string name,string value,Action action,bool chipAction=false,Color? tint=null){var r=Panel(parent,name,tint??new Color(.06f,.11f,.14f));var b=r.gameObject.AddComponent<UnityEngine.UI.Button>();b.targetGraphic=r.GetComponent<IslandPokerPanel>();var colors=b.colors;colors.disabledColor=new Color(.35f,.35f,.35f,.55f);b.colors=colors;var text=Label(r,"Label",value,11);Stretch(text.rectTransform);b.onClick.AddListener(()=>{if(!chipAction)app.PokerAudio.Effect("button_press");action();});return b;}
  static void Stretch(RectTransform r){r.anchorMin=Vector2.zero;r.anchorMax=Vector2.one;r.offsetMin=r.offsetMax=Vector2.zero;}
  static void Box(RectTransform r,float x,float y,float w,float h){r.anchorMin=r.anchorMax=new Vector2(0,1);r.pivot=new Vector2(0,1);r.anchoredPosition=new Vector2(x,-y);r.sizeDelta=new Vector2(w,h);}
  static void Anchor(RectTransform r,Vector2 p,float w,float h,Vector2 offset=default){r.anchorMin=r.anchorMax=p;r.pivot=Vector2.one*.5f;r.anchoredPosition=offset;r.sizeDelta=new Vector2(w,h);}
  void OnDestroy(){foreach(var s in sprites.Values)if(s)Destroy(s);}
 }
}
