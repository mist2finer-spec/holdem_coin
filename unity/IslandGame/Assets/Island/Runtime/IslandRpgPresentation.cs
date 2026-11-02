using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Newtonsoft.Json.Linq;

namespace IslandGame {
 public sealed partial class IslandApp {
  JObject catalog;string rpgPanel="",growthTab="arts",selectedEquipment="",selectedNode="",gemQuery="",gemFilter="all",summonPool="weapon";
  int selectedSlot,selectedSocket,itemPage;float panelHeight=1200,treeZoom=.65f;Vector2 panelScroll,treeScroll;Font rpgFont;
  readonly Dictionary<string,JObject> gems=new Dictionary<string,JObject>();
  readonly Dictionary<string,Vector2> treePositions=new Dictionary<string,Vector2>();
  static readonly string[] slotNames={"무기","갑옷","장갑","장화","반지 1","반지 2"};
  void EnsureCatalog(){if(catalog!=null)return;var asset=Resources.Load<TextAsset>("RpgCatalog");if(!asset)return;catalog=JObject.Parse(asset.text);
   foreach(var kind in new[]{"active","support"})foreach(var gem in catalog[kind] as JArray??new JArray()){var copy=(JObject)gem.DeepClone();copy["kind"]=kind;gems[(string)copy["id"]]=copy;}
   foreach(var node in catalog["tree"]?["nodes"] as JArray??new JArray())treePositions[(string)node["id"]]=new Vector2(node.Value<float>("displayX"),node.Value<float>("displayY"));
   rpgFont=Font.CreateDynamicFontFromOSFont(new[]{"Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR","Arial"},14);
  }
  JObject Gem(string id){JObject result;return id!=null&&gems.TryGetValue(id,out result)?result:null;}
  string GemName(string id){return (string)Gem(id)?["name"]??id??"비어 있음";}
  string ItemName(JObject item){if(item==null)return "장비 없음";var rarity=(string)item["rarity"];return ((string)catalog?["equipment"]?["labels"]?[rarity]??rarity)+" "+((string)item["weaponType"]??(string)catalog?["equipment"]?["slots"]?[(string)item["slot"]]??(string)item["slot"]);}
  void SetPanel(string panel){rpgPanel=panel;panelScroll=Vector2.zero;panelHeight=1200;rpg.Paused=panel!="";rpg.Move=0;rpg.ClearInput();}
  void UpdateRpgInput(){
   if(rpg==null)return;bool playing=page=="rpg"&&rpgPanel==""&&rpg.Active;rpg.Paused=page=="growth"||rpgPanel!="";
   if(!playing){rpg.Move=0;return;}
   if(Input.GetKeyDown(KeyCode.Space))rpg.Command("tick",new JObject{{campaign?"basic":"attack",true}});
   if(Input.GetKeyDown(KeyCode.J)||Input.GetKeyDown(KeyCode.W)||Input.GetKeyDown(KeyCode.UpArrow))Jump("upper");
   if(!campaign&&(Input.GetKeyDown(KeyCode.S)||Input.GetKeyDown(KeyCode.DownArrow)))Jump("lower");
   if(Input.GetKeyDown(KeyCode.LeftShift))rpg.Command("tick",campaign?new JObject{{"dodge",1}}:new JObject{{"slide",true}});
   if(Input.GetKeyDown(KeyCode.Q))Evade(-1);if(Input.GetKeyDown(KeyCode.E))Evade(1);
   if(!campaign&&Input.GetKeyDown(KeyCode.Z))Drink("health");if(!campaign&&Input.GetKeyDown(KeyCode.X))Drink("mana");
   for(int i=0;i<6;i++)if(Input.GetKeyDown((KeyCode)((int)KeyCode.Alpha1+i)))Cast(i);
  }
  void Cast(int index){if(rpgPanel==""&&rpg.Active&&RpgContracts.CanCast(rpg.State,index))rpg.Command("tick",new JObject{{"skill",index}});}
  void Jump(string branch){var input=new JObject{{"jump",true}};if(!campaign)input["branch"]=branch;rpg.Command("tick",input);}
  void Evade(int direction){rpg.Command("tick",campaign?new JObject{{"dodge",direction},{"move",direction}}:new JObject{{"dodge",true},{"x",direction}});}
  void Drink(string kind){rpg.Command("tick",new JObject{{"potion",kind}});}
  void Bar(Rect rect,double ratio,Color color){GUI.Box(rect,"");GUI.color=color;GUI.DrawTexture(new Rect(rect.x+2,rect.y+2,(rect.width-4)*(float)Math.Max(0,Math.Min(1,ratio)),rect.height-4),Texture2D.whiteTexture);GUI.color=Color.white;}
  void DrawCurrentRpg(){
   EnsureCatalog();if(rpgFont)GUI.skin.font=rpgFont;var state=rpg.State;
   Button("로비",10,35,65,30,Lobby);Button(rpg.Auto?"AUTO ON":"AUTO OFF",280,35,100,30,()=>rpg.Auto=!rpg.Auto,rpgPanel=="");
   if(state==null){Text(rpg.Active?"전투와 장비를 불러오는 중…":"연결 중단 · 다시 입장하세요",45,300,320,45);if(!rpg.Active)Button("재접속",135,360,120,40,()=>rpg.Open(server,campaign));return;}
   if(battle.Output)GUI.DrawTexture(new Rect(15,85,360,360),battle.Output,ScaleMode.StretchToFill,false);
   DrawDamageLabels(state);
   var hero=campaign?state:state["hero"] as JObject;var progress=state["progress"] as JObject;
   Bar(new Rect(15,448,360,15),RpgContracts.Ratio(hero?["hp"],hero?["maxHP"]),new Color(.8f,.16f,.2f));

   if(!campaign){Bar(new Rect(15,489,360,12),RpgContracts.Ratio(state["resources"]?["mana"],state["resources"]?["maxMana"]),new Color(.2f,.45f,.9f));Text("Lv."+N(progress,"level")+" · 미궁 "+N(state,"dungeonLevel")+" · "+(N(state,"room")+1)+"/10 구역",15,67,360);}
   else Text("Lv."+N(progress,"level")+" · 성장 사냥",90,38,180);
   Text("골드 "+RpgContracts.Amount(progress?["gold"])+" · 영혼석 "+RpgContracts.Amount(progress?["soulGem"]),15,505,360);
   for(int i=0;i<6;i++){
    int slot=i;float x=10+i*63,cd=state["cooldowns"]?[i]?.Value<float>()??0;bool equipped=RpgContracts.SkillEnabled(state,i);
    if(!equipped){GUI.Box(new Rect(x,535,59,57),"" );Text((i+1)+" · 빈 칸",x+2,555,58);continue;}
    var skill=RpgContracts.Skill(state,i);var gem=Gem((string)skill["activeId"]);bool trigger=skill["trigger"]!=null&&skill["trigger"].Type!=JTokenType.Null;
    Button("",x,535,59,57,()=>Cast(slot),rpg.Active&&rpgPanel==""&&RpgContracts.CanCast(state,i));
    string icon=(string)gem?["icon"];if(!string.IsNullOrEmpty(icon))Image("rpg/SkillIcon_"+icon,new Rect(x+9,537,40,35));
    Text(trigger?"자동 발동":cd>0?cd.ToString("0.0"):(i+1).ToString(),x+5,572,54);Text((string)skill["name"],x,595,62,32);
   }
   if(rpgPanel==""){
    bool left=GUI.RepeatButton(new Rect(18,645,65,60),"◀"),right=GUI.RepeatButton(new Rect(307,645,65,60),"▶");
    rpg.Move=left?-1:right?1:(Input.GetKey(KeyCode.A)||Input.GetKey(KeyCode.LeftArrow)?-1:Input.GetKey(KeyCode.D)||Input.GetKey(KeyCode.RightArrow)?1:0);
    Button("점프",92,640,95,35,()=>Jump("upper"),rpg.Active);Button("슬라이드",200,640,95,35,()=>rpg.Command("tick",campaign?new JObject{{"dodge",1}}:new JObject{{"slide",true}}),rpg.Active);
    Button("회피 ◀",92,682,95,35,()=>Evade(-1),rpg.Active);Button("회피 ▶",200,682,95,35,()=>Evade(1),rpg.Active);
    if(GUI.Button(new Rect(15,85,360,360),"",GUIStyle.none)&&rpg.Active)rpg.Command("tick",new JObject{{campaign?"basic":"attack",true}});
    if(!campaign){Button("체력 물약 "+N(state["resources"]?["potions"],"health"),15,720,170,30,()=>Drink("health"),N(state["resources"]?["potions"],"health")>0);Button("마나 물약 "+N(state["resources"]?["potions"],"mana"),200,720,175,30,()=>Drink("mana"),N(state["resources"]?["potions"],"mana")>0);}
   }
   if(campaign&&B(state,"dead"))Button("부활",145,350,100,45,()=>rpg.Command("revive"),B(state,"reviveReady"));
   if(!campaign&&((string)state["status"]!="playing"||!rpg.Active))Button((string)state["status"]=="won"?"다음 미궁":"다시 입장",135,350,120,45,()=>{SetPanel("");rpg.Open(server,false);});
   var panels=new[]{"growth","equipment","tavern","dungeon","summon","bag"};var labels=new[]{"성장","소지품","주점","던전","소환","가방"};
   for(int i=0;i<panels.Length;i++){string panel=panels[i];Button(labels[i],8+i*63,760,60,30,()=>{if(panel=="tavern"){rpg.Close();battle.Clear();Poker("poker6");}else SetPanel(panel);});}
   if(rpgPanel!="")DrawRpgPanel(state);
  }
  void DrawDamageLabels(JObject state){
   if(campaign||rpgPanel!="")return;float now=state.Value<float>("elapsed");
   foreach(var fx in state["fx"] as JArray??new JArray()){
    string kind=(string)fx["kind"];float age=now-fx.Value<float>("born");if(age<0||age>1||(kind!="damage"&&kind!="gold")||fx["value"]==null)continue;
    int room=fx.Value<int?>("room")??(int)N(state,"room");float elevation=rpg.Map?["rooms"]?[room]?.Value<float>("elevation")??0;
    Vector2 pos=battle.ViewPoint(fx.Value<float>("x"),elevation+55+age*25);if(pos.x<0||pos.x>1||pos.y<0||pos.y>1)continue;
    GUI.color=kind=="gold"?new Color(1,.8f,.3f,1-age):new Color(1,(string)fx["target"]=="hero"?.3f:1,.7f,1-age);
    Text((kind=="gold"?"+":"")+RpgContracts.Amount(fx["value"]),15+pos.x*360-45,85+pos.y*360,115);GUI.color=Color.white;
   }
  }
  void DrawCurrentGrowth(){page="rpg";SetPanel("growth");DrawCurrentRpg();}
  void DrawRpgPanel(JObject state){
   GUI.Box(new Rect(8,78,374,674),"");string title=rpgPanel=="equipment"?"소지품 · 에르텔 세공":rpgPanel=="growth"?"성장":rpgPanel=="summon"?"소환":rpgPanel=="bag"?"에르텔 가방":"던전";
   Text(title,20,88,300,30);Button("닫기",308,85,62,30,()=>SetPanel(""));
   if(catalog==null){Text("RpgCatalog가 없습니다. prepare.ps1을 실행하세요.",20,150,340,80);return;}
   var progress=state["progress"] as JObject;Text("골드 "+RpgContracts.Amount(progress?["gold"])+" / 영혼석 "+RpgContracts.Amount(progress?["soulGem"]),20,120,350);
   if(rpgPanel=="growth"){
    foreach(var pair in new[]{new[]{"arts","훈련"},new[]{"traits","특성"},new[]{"tree","공용 트리"}}){var tab=pair[0];int x=tab=="arts"?20:tab=="traits"?135:250;Button(pair[1],x,151,110,30,()=>{growthTab=tab;panelScroll=Vector2.zero;if(tab=="tree")FocusTree(state);});}
    if(growthTab=="tree"){DrawTree(state);return;}
   }
   float top=rpgPanel=="growth"?190:155;panelScroll=GUI.BeginScrollView(new Rect(16,top,360,740-top),panelScroll,new Rect(0,0,337,panelHeight));float y=5;
   if(rpgPanel=="equipment")DrawEquipment(progress,ref y);
   else if(rpgPanel=="summon")DrawSummon(progress,ref y);
   else if(rpgPanel=="bag")DrawWarehouse(progress,null,ref y);
   else if(rpgPanel=="growth")DrawTraining(state,progress,ref y);
   else{Text("촛불 미궁 · Lv."+N(progress?["hybrid"],"dungeonLevel"),5,y,325);y+=35;Text("현재 미궁을 이어서 진행합니다.\n추가 던전은 준비 중입니다.",5,y,320,75);y+=90;Button("회랑으로",5,y,320,38,()=>SetPanel(""));y+=50;}
   panelHeight=Math.Max(550,y+20);GUI.EndScrollView();
  }
  void DrawEquipment(JObject progress,ref float y){
   var equipment=progress?["equipment"] as JObject;if(equipment==null){Text("보유 장비를 불러오는 중입니다.",5,y,320);y+=40;return;}
   for(int i=0;i<6;i++){int index=i;Button(slotNames[i],(i%3)*111,y+(i/3)*36,106,32,()=>{selectedSlot=index;selectedEquipment="";selectedSocket=0;itemPage=0;});}y+=80;
   var all=equipment["items"] as JArray??new JArray();var items=all.OfType<JObject>().Where(i=>(string)i["slot"]==RpgContracts.Slots[selectedSlot]).ToList();
   var current=RpgContracts.Equipped(equipment,selectedSlot);var item=items.FirstOrDefault(i=>(string)i["instanceId"]==selectedEquipment)??current;
   if(item==null)return;string id=(string)item["instanceId"];selectedEquipment=id;
   Text(ItemName(item)+" · Lv."+N(item,"level"),5,y,325);y+=28;
   Button((string)current?["instanceId"]==id?"장착 중":"장착",5,y,150,34,()=>rpg.Command("idle-equip-"+id),(string)current?["instanceId"]!=id);
   long cost=UpgradeCost(item);Button(N(item,"level")>=50?"최대 강화":"강화 · "+cost,165,y,160,34,()=>rpg.Command("idle-upgrade-"+id),cost>0&&N(progress,"soulGem")>=cost);y+=42;
   if(item["builtInSupports"] is JArray built&&built.Count>0){Text("내장 보조: "+string.Join(", ",built.Values<string>().Select(GemName)),5,y,320,45);y+=45;}
   if(item["uniqueEffect"]?.Type==JTokenType.String){Text((string)item["uniqueEffect"]=="cluster-notables"?"군주얼 주요 노드마다 피해 +15%":"헌신마다 공격 속도 +0.1%",5,y,320,40);y+=42;}
   Text("첫 홈: 액티브 / 이후: 보조 · 연결된 보조만 발동",5,y,325,40);y+=42;
   DrawSockets(item,ref y);
   var costs=catalog["crafting"]["costs"];int col=0;foreach(var kind in new[]{"colors","links","sockets"}){string craft=kind;long price=costs[kind].Value<long>();Button((kind=="colors"?"색상":kind=="links"?"연결":"홈")+" · "+price,col++*110+5,y,105,34,()=>rpg.Command("idle-craft-"+craft+"-"+id),N(progress,"soulGem")>=price&&(kind=="sockets"||((JArray)item["gems"]).Count>0));}y+=44;
   Text("홈: 0~한도 균등 · 연결 35%\n적/녹/청 32%, 백 4% · 홈 세공 시 모두 반환",5,y,325,50);y+=55;
   DrawWarehouse(progress,item,ref y);
   Text("장비 창고 · "+items.Count+"개",5,y,325);y+=30;
   int pages=Math.Max(1,(items.Count+11)/12);itemPage=Math.Min(itemPage,pages-1);Button("이전",5,y,95,30,()=>itemPage=Math.Max(0,itemPage-1),itemPage>0);Text((itemPage+1)+" / "+pages,110,y,110);Button("다음",230,y,95,30,()=>itemPage=Math.Min(pages-1,itemPage+1),itemPage+1<pages);y+=38;
   foreach(var row in items.Skip(itemPage*12).Take(12)){var target=(string)row["instanceId"];Button(ItemName(row)+" Lv."+N(row,"level")+" · "+((JArray)row["gems"]).Count+"홈",5,y,320,36,()=>{selectedEquipment=target;selectedSocket=0;panelScroll=Vector2.zero;});y+=42;}
  }
  long UpgradeCost(JObject item){int level=(int)N(item,"level");if(level>=50)return 0;var c=catalog["equipment"][(string)item["slot"]=="armor"?"armorCurve":"weaponCurve"];double n=(float)(level-c.Value<double>("min"));double q=Math.Floor(Math.Floor(Math.Floor(c.Value<double>("rate")*n)*n)+Math.Floor(c.Value<double>("scaler")*.5));q=Math.Floor(q/c.Value<double>("scaler"));return (long)Math.Floor(Math.Floor(c.Value<double>("inc")*n)+Math.Floor(c.Value<double>("base")+q));}
  static Color SocketTint(string color){return color=="red"?new Color(.95f,.4f,.4f):color=="green"?new Color(.4f,.85f,.5f):color=="blue"?new Color(.4f,.65f,1f):Color.white;}
  void DrawSockets(JObject item,ref float y){var slots=item["gems"] as JArray??new JArray();selectedSocket=Math.Min(selectedSocket,Math.Max(0,slots.Count-1));if(slots.Count==0){Text("홈 없음 · 홈 세공을 먼저 진행하세요",5,y,320);y+=34;return;}
   for(int i=0;i<slots.Count;i++){int slot=i;float x=5+i*54;if(i>0){GUI.color=(item["socketLinks"]?[i-1]?.Value<bool>()??true)?new Color(1,.75f,.3f):Color.gray;Text("─",x-11,y+10,14);}
    GUI.color=SocketTint(RpgContracts.SocketColor(item,i));Button((i+1)+((string)slots[i]==null?" ○":i==0?" ◆":" ✦"),x,y,45,38,()=>selectedSocket=slot);GUI.color=Color.white;
   }y+=45;Text((selectedSocket+1)+"번 홈 · "+GemName((string)slots[selectedSocket])+(selectedSocket>0&&!RpgContracts.SocketLinked(item,selectedSocket)?" · 미연결":""),5,y,320,42);y+=44;
   string id=(string)item["instanceId"];Button("해제 · 창고로",5,y,320,32,()=>rpg.Command("idle-socket-"+id+"-"+selectedSocket+"-empty"),(string)slots[selectedSocket]!=null);y+=42;
  }
  void DrawWarehouse(JObject progress,JObject item,ref float y){
   var collection=progress?["gemCollection"] as JObject;var equipment=progress?["equipment"] as JObject;if(collection==null)return;
   Text("에르텔 창고 · 액티브 35 / 보조 30",5,y,325);y+=30;
   string[] filters={"all","active","support","red","green","blue"},labels={"전체","액티브","보조","적","녹","청"};for(int i=0;i<6;i++){string filter=filters[i];Button(labels[i],5+i*54,y,50,28,()=>gemFilter=filter);}y+=35;
   gemQuery=GUI.TextField(new Rect(5,y,320,30),gemQuery);y+=40;
   foreach(var gem in gems.Values){string id=(string)gem["id"],kind=(string)gem["kind"],color=(string)gem["color"],label=(string)gem["name"],description=(string)gem["description"]??(string)gem["text"]??"";long owned=N(collection[kind],id);
    if(owned<=0||(gemFilter!="all"&&gemFilter!=kind&&gemFilter!=color)||!(label+description).Contains(gemQuery))continue;
    int reserved=RpgContracts.Reserved(equipment,id,kind=="active");string current=RpgContracts.GemAt(item,selectedSocket);long free=owned-reserved+(current==id?1:0);string reason="";
    if(item!=null){var sockets=item["gems"] as JArray;var active=Gem((string)sockets?.First);
     if(sockets==null||sockets.Count==0)reason="홈 없음";else if((selectedSocket==0)!=(kind=="active"))reason="종류 불일치";
     else if(RpgContracts.SocketColor(item,selectedSocket)!="white"&&RpgContracts.SocketColor(item,selectedSocket)!=color)reason="색상 불일치";
     else if(kind=="support"&&!RpgContracts.Supports(active,gem,rpg.State?["build"]?["passive"]?["fireOnly"]?.Value<bool>()??false))reason="태그 불일치";
     else if(kind=="support"&&current!=id&&sockets.Skip(1).Values<string>().Contains(id))reason="이미 장착";
     else if(free<=0)reason="사용 중";else if(current==id)reason="장착 중";
    }
    GUI.color=SocketTint(color);Text(label+" · "+(kind=="active"?"액티브":"보조"),5,y,320);GUI.color=Color.white;y+=25;
    Text("보유 "+owned+" · 여유 "+Math.Max(0,free)+" · "+description,5,y,320,60);y+=62;
    if(item!=null){string target=(string)item["instanceId"];int socket=selectedSocket;Button(reason==""?"장착":reason,5,y,320,30,()=>rpg.Command("idle-socket-"+target+"-"+socket+"-"+id),reason=="");y+=38;}
   }
  }
  void DrawSummon(JObject progress,ref float y){
   Text("영혼석 소환 · 새 장비는 0~최대 6홈",5,y,325);y+=35;
   var pools=new[]{"weapon","armor","gloves","boots","ring"};for(int i=0;i<pools.Length;i++){string pool=pools[i];Button(new[]{"무기","갑옷","장갑","장화","반지"}[i],5+i*65,y,61,30,()=>summonPool=pool);}y+=40;
   var policy=catalog["gacha"];int level=Math.Min(10,1+(int)(N(progress?["gacha"],"equipmentPulls")/100));Text("장비 소환 Lv."+level+" · "+summonPool,5,y,320);y+=30;
   foreach(int count in new[]{1,10}){int n=count;long cost=N(policy,"equipmentCost")*count;Button("장비 "+count+"회 · "+cost,5,y,320,36,()=>rpg.Command("idle-draw-equipment-"+summonPool+"-"+n),N(progress,"soulGem")>=cost&&((progress?["equipment"]?["items"] as JArray)?.Count??2001)+count<=2000);y+=43;}
   var rarities=policy["weights"]?[level-1] as JArray;int row=0;foreach(var rarity in catalog["equipment"]["rarities"] as JArray){Text((string)catalog["equipment"]["labels"][(string)rarity]+" "+((rarities?[row++]?.Value<double>()??0)/100).ToString("0.00")+"%",5,y,320);y+=23;}y+=10;
   Text("에르텔 · 액티브 45% / 보조 55%\n추가 액티브 29종 · 보조 30종 · 중복은 보유",5,y,325,55);y+=60;
   foreach(int count in new[]{1,10}){int n=count;long cost=N(policy,"gemCost")*count;Button("에르텔 "+count+"회 · "+cost,5,y,320,36,()=>rpg.Command("idle-draw-gems-"+n),N(progress,"soulGem")>=cost);y+=43;}
   Text("무료 재화 테스트 정책 · 천장/할인 없음\n고대·신화 무기/갑옷 추가 옵션 확률 5%",5,y,325,60);y+=65;
   if(rpg.LastLoot is JArray loot){Text("최근 소환 결과",5,y,320);y+=30;foreach(var result in loot.OfType<JObject>()){Text(result["gemId"]!=null?GemName((string)result["gemId"]):ItemName(result),5,y,320);y+=28;}}
  }
  void DrawTraining(JObject state,JObject progress,ref float y){
   Button("방치 보상 받기",5,y,320,36,()=>rpg.Command("idle-claim"),progress?["idle"]!=null);y+=46;
   if(growthTab=="traits"){
    long points=N(state["development"],"traitPoints");Text("남은 특성 "+points+"P",5,y,320);y+=32;
    foreach(var ability in catalog["abilities"] as JArray){string id=ability["id"].ToString();long level=N(progress?["traits"],id);Text((string)ability["name"]+" · "+level+" / 10",5,y,320);y+=26;Button("+1",5,y,320,32,()=>rpg.Command("trait-"+id),points>0&&level<10);y+=40;}return;
   }
   foreach(var art in state["development"]?["arts"] as JArray??new JArray()){
    string id=art["id"].ToString();var ability=(catalog["abilities"] as JArray).FirstOrDefault(a=>JToken.DeepEquals(a["id"],art["ability"]));string label=(string)ability?["name"]??id;
    Text(label+" · Lv."+N(art,"level")+" / "+N(art,"max"),5,y,320);y+=25;Text("다음 비용 "+RpgContracts.Amount(art["nextCost"])+" · "+(string)art["lock"],5,y,320,40);y+=42;
    int column=0;foreach(int count in new[]{1,10,100}){int n=count;Button("+"+count,5+column++*110,y,105,32,()=>rpg.Command("art-"+id+"-"+n),N(art,"quantity")>0);}y+=42;
   }
  }
  void FocusTree(JObject state){
   string id=(string)state?["build"]?["start"]?["nodeId"]??"root";Vector2 p;if(!treePositions.TryGetValue(id,out p))return;
   selectedNode=id;treeScroll=new Vector2(Math.Max(0,p.x*treeZoom-180),Math.Max(0,p.y*treeZoom-175));
  }
  void ChangeTreeZoom(float delta){
   float previous=treeZoom;treeZoom=Mathf.Clamp(treeZoom+delta,catalog["tree"]["display"].Value<float>("minZoom"),catalog["tree"]["display"].Value<float>("maxZoom"));
   treeScroll=(treeScroll+new Vector2(180,175))*(treeZoom/previous)-new Vector2(180,175);treeScroll=new Vector2(Math.Max(0,treeScroll.x),Math.Max(0,treeScroll.y));
  }
  void DrawTree(JObject state){
   var build=state["build"] as JObject;var nodes=build?["tree"]?["nodes"] as JArray??catalog["tree"]["nodes"] as JArray;var edges=build?["tree"]?["edges"] as JArray??catalog["tree"]["edges"] as JArray;
   var allocated=new HashSet<string>((build?["state"]?["nodes"] as JArray??new JArray()).Values<string>());Text("남은 "+N(build,"remaining")+"P · "+nodes.Count+" 노드",20,187,200);Button("−",220,185,45,28,()=>ChangeTreeZoom(-.1f));Button("+",270,185,45,28,()=>ChangeTreeZoom(.1f));Button("시작",320,185,45,28,()=>FocusTree(state));
   float width=catalog["tree"].Value<float>("width")*treeZoom,height=catalog["tree"].Value<float>("height")*treeZoom;
   treeScroll=GUI.BeginScrollView(new Rect(16,220,360,350),treeScroll,new Rect(0,0,width,height));
   Func<JToken,Vector2> position=n=>{Vector2 p;return treePositions.TryGetValue((string)n["id"],out p)?p*treeZoom:new Vector2(n.Value<float>("x")*3+160,n.Value<float>("y")*3+160)*treeZoom;};
   var map=nodes.OfType<JObject>().ToDictionary(n=>(string)n["id"]);
   foreach(var edge in edges){string from=edge is JArray?(string)edge[0]:(string)edge["from"],to=edge is JArray?(string)edge[1]:(string)edge["to"];if(map.ContainsKey(from)&&map.ContainsKey(to))Line(position(map[from]),position(map[to]),allocated.Contains(from)&&allocated.Contains(to)?new Color(.85f,.65f,.25f):new Color(.28f,.32f,.32f));}
   foreach(var node in nodes){Vector2 p=position(node);if(p.x<treeScroll.x-40||p.y<treeScroll.y-40||p.x>treeScroll.x+390||p.y>treeScroll.y+380)continue;string id=(string)node["id"];float size=(string)node["kind"]=="small"?18:25;GUI.color=allocated.Contains(id)?new Color(1,.78f,.35f):Color.white;if(GUI.Button(new Rect(p.x-size/2,p.y-size/2,size,size),new GUIContent((string)node["kind"]=="socket"?"◇":"·",(string)node["name"])))selectedNode=id;GUI.color=Color.white;}
   GUI.EndScrollView();var selected=nodes.OfType<JObject>().FirstOrDefault(n=>(string)n["id"]==selectedNode);if(selected==null){Text("트리를 스크롤하고 노드를 선택하세요.\n표시 좌표만 3배 확장합니다. 판정은 서버가 처리합니다.",20,582,345,75);return;}
   Text((string)selected["name"],20,580,345,35);Text((string)selected["description"],20,615,345,65);bool taken=allocated.Contains(selectedNode),root=(string)build?["start"]?["nodeId"]==selectedNode;string selectedId=selectedNode;
   Button(taken?"환불":"할당",20,686,165,38,()=>rpg.Command("core-"+(taken?"refund-":"allocate-")+selectedId),!root&&(taken||N(build,"remaining")>0));Button("트리 초기화",200,686,165,38,()=>rpg.Command("core-reset"));
  }
  static void Line(Vector2 a,Vector2 b,Color color){var saved=GUI.matrix;GUI.color=color;GUIUtility.RotateAroundPivot(Mathf.Atan2(b.y-a.y,b.x-a.x)*Mathf.Rad2Deg,a);GUI.DrawTexture(new Rect(a.x,a.y,(b-a).magnitude,1.5f),Texture2D.whiteTexture);GUI.matrix=saved;GUI.color=Color.white;}
 }
}
