using System;
using System.Linq;
using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 public sealed partial class IslandApp {
  IslandPokerHud pokerHud;float pokerReceivedAt;
  public bool PokerVisible=>page.StartsWith("poker");
  public JObject PokerState=>table;
  public bool PokerOnline=>online;
  public bool PokerTournamentMode=>page=="pokerTournament";
  public string PokerNotice=>notice;
  public float PokerReceivedAt=>pokerReceivedAt;
  public IslandAudio PokerAudio=>sound;
  void InitializePokerHud(){pokerHud=gameObject.AddComponent<IslandPokerHud>();pokerHud.Initialize(this,battleHud.RuntimeFont);}
  public void PokerLeave(){sound.Effect("button_press");Lobby();}
  public void PokerReconnect(){notice="";Connect(page=="pokerSolo"?soloServer:server);}
  public void PokerAction(string action,long amount){if(PokerVisible&&online)Act(action,amount);}
  public void PokerReserve(string type){
   if(!PokerVisible||!online||table==null||B(table,"isUserTurn"))return;
   if((string)(table["preAction"] as JObject)?["type"]==type)socket.Emit("PRE_ACTION");else socket.Emit("PRE_ACTION",new JObject{{"type",type},{"amount",type=="call"?N(table,"callAmount"):0}});
  }
  public void PokerRebuy(){if(PokerVisible&&online&&!PokerTournamentMode&&B(table,"playerBusted"))socket.Emit("REBUY");}
  public void PokerLoadHistory(Action<string> completed){
   if(!PokerVisible||!online){completed("서버에 연결한 뒤 다시 시도하세요.");return;}
   socket.Emit("GET_HAND_HISTORY",null,reply=>{
    if(reply?["error"]!=null){completed((string)reply["error"]);return;}
    foreach(var hand in reply?["hands"] as JArray??new JArray())SaveHistory(hand);
    completed(PokerHistorySummary());
   });
  }
  public string PokerHistorySummary(){
   try{var dir=System.IO.Path.Combine(Application.persistentDataPath,"hands");if(!System.IO.Directory.Exists(dir))return "저장된 핸드가 없습니다.";
    var files=new System.IO.DirectoryInfo(dir).GetFiles("*.json").OrderByDescending(f=>f.LastWriteTimeUtc).ToArray();
    var lines=files.Take(4).Select(f=>{var h=JObject.Parse(System.IO.File.ReadAllText(f.FullName));return "#"+((string)h["handNumber"]??f.Name.Replace(".json",""))+" · "+((string)h["startedAt"]??"");});
    return "기기에 저장된 핸드 "+files.Length+"개\n"+string.Join("\n",lines);
   }catch{return "핸드 기록을 읽을 수 없습니다.";}
  }
 }
}
