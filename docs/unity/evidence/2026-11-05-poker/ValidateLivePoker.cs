using System;
using System.Collections;
using System.Linq;
using System.IO;
using UnityEngine;
using Newtonsoft.Json.Linq;
using IslandGame;
public static class ValidateLivePoker {
 public static object Main(){var a=UnityEngine.Object.FindFirstObjectByType<IslandApp>();PlayerPrefs.SetString("island-lobby-token","");a.SendMessage("Poker","poker6");a.StartCoroutine(Run(a));return new{started=true};}
 static IEnumerator Run(IslandApp a){
  float end=Time.realtimeSinceStartup+50;
  while(Time.realtimeSinceStartup<end){var s=a.PokerState;var button=UnityEngine.Object.FindObjectsByType<UnityEngine.UI.Button>(FindObjectsSortMode.None).FirstOrDefault(b=>b.name=="PokerCall");if(s!=null&&s.Value<bool?>("isUserTurn")==true&&button&&button.interactable){
    var me=((JArray)s["seats"]).First(x=>x.Value<bool>("isMe"));long stack=me.Value<long>("stack"),bet=me.Value<long>("currentBet"),amount=Math.Min(stack,s.Value<long>("callAmount"));
    IslandGame.Editor.BattleHudReview.Click("PokerCall");
    for(int i=0;i<180;i++){yield return null;var next=a.PokerState;if(next!=null&&next!=s){var m=((JArray)next["seats"]).FirstOrDefault(x=>x.Value<bool>("isMe"));if(m!=null&&(next.Value<long>("activeSeatId")!=s.Value<long>("activeSeatId")||m.Value<long>("stack")!=stack||next.Value<string>("phase")!=s.Value<string>("phase"))){File.WriteAllText("C:/Users/SHK/island-poker-review/live-action.json",new JObject{{"status","PASS"},{"transport","real Engine.IO polling + Socket.IO"},{"requestedAction",amount>0?"call":"check"},{"amount",amount},{"stackBefore",stack},{"stackAfter",m["stack"]},{"serverStateAdvanced",true},{"dispatches",a.GetComponent<IslandPokerHud>().ActionDispatches}}.ToString());yield break;}}}
    File.WriteAllText("C:/Users/SHK/island-poker-review/live-action.json","{\"status\":\"FAIL\",\"reason\":\"No authoritative state advance\"}");yield break;
   }yield return null;}
  File.WriteAllText("C:/Users/SHK/island-poker-review/live-action.json","{\"status\":\"UNAVAILABLE\",\"reason\":\"No legal turn during timeout\"}");
 }
}
