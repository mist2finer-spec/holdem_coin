using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 // Native Unity presentation. Authoritative rules, AI, settlement and growth stay on the existing backend.
 public sealed partial class IslandApp : MonoBehaviour {
  public string server="https://holdem-coin-tavern.onrender.com",soloServer="http://127.0.0.1:8081";
  PollingSocket socket;RpgSession rpg;NativeBattle battle;JObject table,account,tournament;string page="lobby",notice="",playerName="Player",custom="",growthAction="train-attack";IslandAudio sound;string lastDeal="";bool online,campaign;double multiplier=2;float nextStatus;
  readonly Dictionary<string,Texture2D> textures=new Dictionary<string,Texture2D>();
  static readonly Vector2[] six={new Vector2(.5f,.83f),new Vector2(.88f,.61f),new Vector2(.88f,.36f),new Vector2(.5f,.12f),new Vector2(.12f,.36f),new Vector2(.12f,.61f)};
  static readonly Vector2[] eight={new Vector2(.5f,.84f),new Vector2(.89f,.66f),new Vector2(.89f,.46f),new Vector2(.89f,.28f),new Vector2(.5f,.1f),new Vector2(.11f,.28f),new Vector2(.11f,.46f),new Vector2(.11f,.66f)};
  void Awake(){InitializePrototype();server=PlayerPrefs.GetString("island-server",server);soloServer=PlayerPrefs.GetString("island-solo-server",soloServer);sound=gameObject.AddComponent<IslandAudio>();sound.Music("lobby_jazz");Application.targetFrameRate=60;Screen.orientation=ScreenOrientation.Portrait;playerName=PlayerPrefs.GetString("island-name","Player");socket=gameObject.AddComponent<PollingSocket>();rpg=gameObject.AddComponent<RpgSession>();battle=gameObject.AddComponent<NativeBattle>();battle.session=rpg;
   socket.Ready+=()=>{online=true;socket.Emit("LOBBY_HELLO",new JObject{{"token",PlayerPrefs.GetString("island-lobby-token","")}},a=>{if(a?["error"]!=null){notice=(string)a["error"];return;}account=a as JObject;if(a?["token"]!=null){PlayerPrefs.SetString("island-lobby-token",(string)a["token"]);PlayerPrefs.Save();}if(page.StartsWith("poker"))Join();});};
   socket.Message+=(eventName,data)=>{if(eventName=="TABLE_STATE"){table=data as JObject;pokerReceivedAt=Time.unscaledTime;sound.DealStage((string)table?["dealStage"],N(table,"handNumber").ToString());}else if(eventName=="PLAYER_ACTION"){sound.PlayerAction(data?.Value<string>("action"));}else if(eventName=="ROOM_EXIT"||eventName=="ROOM_DENIED"){notice=(string)data?["message"];Lobby();}else if(eventName=="ACTION_REJECTED"){notice=(string)data?["message"];pokerHud?.RejectAction();}else if(eventName=="SYSTEM_NOTICE")notice=string.Join("\n",data?["messages"]?.ToObject<string[]>()??new string[0]);else if(eventName=="HAND_HISTORY")SaveHistory(data);};
   socket.Failed+=message=>{online=false;notice=message;};rpg.Failed+=message=>notice=message;Connect(server);InitializeBattleHud();InitializePokerHud();
  }
  void SaveHistory(JToken hand){try{var dir=Path.Combine(Application.persistentDataPath,"hands");Directory.CreateDirectory(dir);var id=hand.Value<string>("id")??Guid.NewGuid().ToString("N");File.WriteAllText(Path.Combine(dir,Uri.EscapeDataString(id)+".json"),hand.ToString());var files=new DirectoryInfo(dir).GetFiles("*.json");Array.Sort(files,(a,b)=>a.LastWriteTimeUtc.CompareTo(b.LastWriteTimeUtc));for(int i=0;i<files.Length-1000;i++)files[i].Delete();}catch(Exception e){notice="History save: "+e.Message;}}
  void Connect(string url){online=false;socket.Open(url);}
  void Join(){socket.Emit("JOIN_ROOM",new JObject{{"name",playerName},{"tableSize",page=="poker6"?6:8},{"tournament",page=="pokerTournament"}});}
  void Lobby(){sound.EndTable();page="lobby";rpg.Close();battle.Clear();table=null;Connect(server);}
  void Poker(string mode){sound.BeginTable();page=mode;table=null;Connect(mode=="pokerSolo"?soloServer:server);}
  void Update(){UpdateRpgInput();if(page=="lobby"&&online&&Time.unscaledTime>=nextStatus){nextStatus=Time.unscaledTime+2;socket.Emit("LOBBY_STATUS",null,a=>account=a as JObject);socket.Emit("GET_TOURNAMENT_STATUS",null,a=>tournament=a as JObject);}}
  Texture2D Texture(string path){Texture2D t;if(!textures.TryGetValue(path,out t)){t=Resources.Load<Texture2D>("WebAssets/"+path);textures[path]=t;}return t;}
  void Image(string path,Rect rect){var t=Texture(path);if(t)GUI.DrawTexture(rect,t,ScaleMode.ScaleToFit,true);}
  bool Button(string text,float x,float y,float w,float h,Action action,bool enabled=true){GUI.enabled=enabled;bool pressed=GUI.Button(new Rect(x,y,w,h),text);GUI.enabled=true;if(pressed){sound?.Effect("button_press");action();}return pressed;}
  static long N(JToken t,string key){return (t as JObject)?[key]?.Value<long?>()??0;}static bool B(JToken t,string key){return (t as JObject)?[key]?.Value<bool?>()??false;}
  void Text(string text,float x,float y,float w,float h=25){GUI.Label(new Rect(x,y,w,h),text);}
  public int LegacyGuiRenderPasses{get;private set;}
  void OnGUI(){
   if(BossTrialsVisible)return;
   if(PokerVisible&&pokerHud)return;
   if(HudGrowthOpen&&growthView)return;
   if(battleHud&&battleHud.Visible)return;
   if(BattleHudEnabled&&HudPage&&!HudPanelOpen)return;
   LegacyGuiRenderPasses++;
   var skin=GUI.skin;var originalFont=skin.font;var originalMatrix=GUI.matrix;
   int labelSize=skin.label.fontSize,buttonSize=skin.button.fontSize,fieldSize=skin.textField.fontSize;
   if(!rpgSkin){rpgSkin=Instantiate(skin);rpgSkin.hideFlags=HideFlags.DontSave;}GUI.skin=rpgSkin;
   try {EnsureCatalog();if(rpgFont)GUI.skin.font=rpgFont;float scale=Math.Min(Screen.width/390f,Screen.height/844f),left=(Screen.width-390*scale)/2;GUI.matrix=Matrix4x4.TRS(new Vector3(left,0),Quaternion.identity,new Vector3(scale,scale,1));GUI.skin.label.fontSize=13;GUI.skin.button.fontSize=12;GUI.skin.textField.fontSize=14;
   GUI.Box(new Rect(0,0,390,844),"");Text("ISLAND · UNITY",12,8,220);Text(online?"ONLINE":"CONNECTING",270,8,115);
   if(page=="lobby")DrawLobby();else if(page.StartsWith("poker"))DrawPoker();else if(page=="settings")DrawSettings();else if(page=="growth")DrawCurrentGrowth();else DrawRpg();
   Text(notice,12,790,365,48);
     }finally{GUI.skin=skin;skin.font=originalFont;GUI.matrix=originalMatrix;skin.label.fontSize=labelSize;skin.button.fontSize=buttonSize;skin.textField.fontSize=fieldSize;}
  }
  void DrawLobby(){
   GUI.Box(new Rect(12,45,366,165),"");Image("poker/hong-table/front",new Rect(20,55,100,145));
   Text("ISLAND TAVERN",135,64,235,32);Text("사냥과 성장, 그리고 홀덤",135,98,235,30);
   Text("플레이어 이름",135,132,225);playerName=GUI.TextField(new Rect(135,158,145,32),playerName,16);
   Button("저장",288,158,75,32,()=>{PlayerPrefs.SetString("island-name",playerName);PlayerPrefs.Save();if(online)socket.Emit("LOBBY_RENAME",new JObject{{"name",playerName}},a=>account=a as JObject);});
   Text("01  사냥을 시작하세요",20,230,350,30);
   Button("미궁 사냥 입장",20,267,350,58,()=>StartRpg(false));
   Button("성장 사냥 / 장비 관리",20,337,350,48,()=>StartRpg(true));
   Text("기본 액티브 6칸은 비어 있습니다.\n장비에 액티브 젬을 장착하면 스킬을 쓸 수 있습니다.",22,397,346,48);
   Text("이동 A/D · 공격 Space · 점프 W/J · 스킬 1~6",22,452,346,28);
   Text("02  홀덤 테이블",20,499,350,30);
   Button("온라인 홀덤 · 6인",20,535,350,48,()=>Poker("poker6"));
   Button("토너먼트 · 8인",20,595,350,42,()=>Poker("pokerTournament"));
   Text(TournamentText(tournament),22,645,346,34);
   Text("보유 칩  "+N(account,"multi").ToString("N0"),22,686,346,25);
   Button("칩 충전",20,727,102,36,()=>socket.Emit("LOBBY_RECHARGE",null,a=>account=a as JObject),online);
   Button("서버 설정",134,727,112,36,()=>page="settings");
   Button("재접속",258,727,112,36,()=>{notice="";Connect(server);});
  }
  string TournamentText(JObject t){if(t==null)return "";long now=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();long until=N(t,"nextTournamentAt");if(until==0)until=N(t,"startsAt");return (string)t["status"]+" · Round "+N(t,"level")+" · "+N(t,"remaining")+" players"+(until>now?" · "+Math.Ceiling((until-now)/1000d)+"s":"");}
  void DrawPoker(){Button("Lobby",8,34,70,32,Lobby);if(table==null){Text("Waiting for table. Solo requires the dedicated local backend.",20,180,350,100);Button("Reconnect",110,310,160,50,()=>Connect(page=="pokerSolo"?soloServer:server));return;}
   var t=table["tournament"] as JObject;bool tour=t!=null;long bb=tour?N(t,"bigBlind"):200;Func<long,string> money=n=>PokerSizing.Money(n,bb,tour);Text((string)table["phase"],280,40,110);Text(TournamentText(t),80,70,300,45);
   GUI.color=new Color(.06f,.35f,.25f);GUI.Box(new Rect(45,150,300,405),"");GUI.color=Color.white;var seats=table["seats"] as JArray;var positions=seats?.Count==6?six:eight;int mine=(int)N(table,"mySeatId"),count=seats?.Count??0;
   foreach(var seat in seats??new JArray()){
    if(B(seat,"eliminated"))continue;int index=((int)N(seat,"seatId")-Math.Max(0,mine)+count)%count;var p=positions[index];float x=p.x*390,y=135+p.y*450;
    string character=N(seat,"portrait")==8?"pink-glasses":N(seat,"portrait")==6?"teal-twins":"hong",pose=index==0?"back":index==count/2?"front":p.x<.5?"right":"left";
    Image("poker/"+character+"-table/"+pose,new Rect(x-38,y-65,76,90));GUI.Box(new Rect(x-43,y+24,86,45),(string)seat["name"]+"\n"+money(N(seat,"stack")));
    if(B(seat,"folded"))Text("FOLD",x-25,y-35,60);if((int)N(table,"activeSeatId")==N(seat,"seatId"))Text("▶",x-48,y-35,25);
    string badge=N(table,"bigBlindSeat")==N(seat,"seatId")?"BB":N(table,"smallBlindSeat")==N(seat,"seatId")?"SB":N(table,"buttonSeat")==N(seat,"seatId")?"D":"";Text(badge,x+25,y,30);
    Text(money(N(seat,"currentBet")),x<195?x+40:x-90,y,65);
    var cards=seat["holeCards"] as JArray;if(cards!=null)Cards(cards,x-35,y-95,32,null);
   }
   Text("POT "+money(N(table,"totalPot")),130,300,160);Cards(table["boardCards"] as JArray,90,335,40,null);
   if(t?["winner"] is JObject champion){GUI.Box(new Rect(45,235,300,180),"CHAMPION\n"+(string)champion["name"]+"\nCongratulations!");}
   if((string)table["phase"]=="SHOWDOWN")Showdown(565);
   bool turn=B(table,"isUserTurn");long deadline=N(table,"actionDeadline"),serverNow=N(table,"serverNow");Text(turn?"YOUR TURN · "+Math.Max(0,Math.Ceiling((deadline-serverNow)/1000d))+"s":"Waiting",20,645,350);
   var me=seats==null?null:System.Linq.Enumerable.FirstOrDefault(seats,s=>B(s,"isMe"));long stack=N(me,"stack"),bet=N(me,"currentBet"),call=N(table,"callAmount"),min=N(table,"minRaise"),max=N(table,"maxRaise"),highest=bet+call;
   Button("FOLD",10,675,85,45,()=>Act("fold",0),turn);Button(call>0?"CALL "+money(Math.Min(call,stack)):"CHECK",100,675,95,45,()=>Act(call>0?"call":"check",Math.Min(call,stack)),turn);
   Button("RAISE "+multiplier.ToString("0.#")+"x",200,675,90,45,()=>Act("raise",PokerSizing.Raise(multiplier,Math.Max(bb,highest),min,max)),turn&&max>highest);Button("ALL IN",295,675,85,45,()=>Act("allin",stack),turn&&stack>0);
   Button("−1",200,630,42,30,()=>multiplier=Math.Max(2,multiplier-1));Button("+1",247,630,42,30,()=>multiplier+=1);Button("−.2",295,630,40,30,()=>multiplier=Math.Max(2,multiplier-.2));Button("+.2",340,630,40,30,()=>multiplier+=.2);
   for(int i=1;i<=3;i++){double fraction=i/4d;Button(i+"/4 POT",10+(i-1)*94,725,90,38,()=>Act("raise",PokerSizing.Pot(fraction,N(table,"totalPot"),min,max)),turn&&max>highest&&N(table,"totalPot")*fraction>=min);}
   Button("Rebuy",295,725,85,38,()=>socket.Emit("REBUY"),B(table,"playerBusted")&&!tour);
   custom=GUI.TextField(new Rect(10,770,180,30),custom);long entered;bool valid=long.TryParse(custom,out entered);long target=tour?entered*bb:entered;
   Button("Custom",200,770,85,30,()=>Act("raise",target),turn&&valid&&target>=min&&target<=max&&target>highest);
   if(!turn){Button("Reserve fold",85,105,100,30,()=>socket.Emit("PRE_ACTION",new JObject{{"type","fold"},{"amount",0}}));Button("Reserve call",195,105,100,30,()=>socket.Emit("PRE_ACTION",new JObject{{"type",call>0?"call":"check"},{"amount",call}}));}
  }
  void Act(string action,long amount){if(!B(table,"isUserTurn"))return;socket.Emit("PLAYER_ACTION",new JObject{{"action",action},{"amount",amount}});}
  void Cards(JArray cards,float x,float y,float width,HashSet<int> selected){if(cards==null)return;for(int i=0;i<cards.Count;i++){GUI.color=selected!=null&&!selected.Contains(i)?new Color(1,1,1,.3f):Color.white;GUI.Box(new Rect(x+i*(width+2),y,width,43),CardText(cards[i]));}GUI.color=Color.white;}
  string CardText(JToken card){if(card is JObject)return (string)card["rank"]+(string)card["suit"];return card?.ToString()??"??";}
  void Showdown(float y){var all=table["showdownHands"] as JArray;var board=table["boardCards"] as JArray;if(all==null||board==null)return;int row=0;foreach(var p in all){if(row>=2)break;
   JToken seat=null;foreach(var candidate in table["seats"] as JArray??new JArray())if(N(candidate,"seatId")==N(p,"seatId")){seat=candidate;break;}
   var holes=seat?["holeCards"] as JArray;if(holes==null)continue;var selected=ShowdownSelection.BestFive(holes.ToObject<string[]>(),board.ToObject<string[]>());var h=new HashSet<int>();var c=new HashSet<int>();foreach(int k in selected){if(k<2)h.Add(k);else c.Add(k-2);}
   Text((string)p["name"]+" · "+(string)p["handCategory"],10,y+row*38,165);Cards(holes,155,y+row*38,25,h);Cards(board,212,y+row*38,25,c);row++;
  }}

  void StartRpg(bool growth){socket.Close();notice="";campaign=growth;page="rpg";rpgPanel="";battle.enabled=true;rpg.Open(server,growth);}
  void DrawRpg(){DrawCurrentRpg();}
  void DrawSettings(){Text("Online HTTPS origin",20,100,350);server=GUI.TextField(new Rect(20,135,350,40),server);Text("Dedicated solo backend origin",20,200,350);soloServer=GUI.TextField(new Rect(20,235,350,40),soloServer);
   Button("Save / reconnect",60,320,270,55,()=>{Uri url;Uri solo;if(!Uri.TryCreate(server,UriKind.Absolute,out url)||!Uri.TryCreate(soloServer,UriKind.Absolute,out solo)||!(url.Scheme=="http"||url.Scheme=="https")||!(solo.Scheme=="http"||solo.Scheme=="https")){notice="Invalid HTTP(S) origin";return;}PlayerPrefs.SetString("island-server",server);PlayerPrefs.SetString("island-solo-server",soloServer);PlayerPrefs.Save();Lobby();});
  }
  Vector2 growthScroll;
  void DrawGrowth(){Button("Back to hunt",10,40,160,40,()=>page="rpg");var state=rpg.State;if(state==null)return;
   GUI.Box(new Rect(10,95,370,660),"");growthScroll=GUI.BeginScrollView(new Rect(15,100,360,650),growthScroll,new Rect(0,0,335,1800));
   float y=0;Text("Growth / equipment · server prices",5,y,320);y+=35;
   foreach(var weapon in new[]{"unarmed","sword","axe","dual","spear"}){var type=weapon;
    Text(type+" · Lv "+N(state["progress"]?["weaponLevels"],type),5,y,320);y+=25;
    Button("Equip",5,y,120,35,()=>rpg.Command("equip-"+type));Button("Upgrade "+N(state["weaponCosts"],type),135,y,185,35,()=>rpg.Command("upgrade-"+type));y+=45;
   }
   foreach(var action in new[]{"armor","train-attack","train-health","buy-potion","potion","quest","mastery","will"}){var command=action;Button(command,5,y,315,35,()=>rpg.Command(command));y+=42;}
   for(int i=0;i<6;i++){int skill=i;Button("Skill "+(i+1)+" upgrade",5,y,180,35,()=>rpg.Command("skill-train-"+skill));Button("Toggle",195,y,125,35,()=>rpg.Command("skill-toggle-"+skill));y+=42;}
   growthAction=GUI.TextField(new Rect(5,y,210,35),growthAction);Button("Apply",220,y,100,35,()=>rpg.Command(growthAction));y+=45;
   Text(state["development"]?.ToString(Newtonsoft.Json.Formatting.Indented)??"",5,y,320,500);GUI.EndScrollView();
  }
  void OnDisable(){socket?.Close();rpg?.Close();}
 }
}
