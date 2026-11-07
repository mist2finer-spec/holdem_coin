using System;
using System.IO;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.EventSystems;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class NetworkReview {
 public static object Main(){var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();app.StartCoroutine(Run(app));return new{started=true};}
 static IEnumerator Run(IslandApp app){
  var results=new JArray();foreach(var rtt in new[]{50,150,300}){
   using(var control=UnityWebRequest.Get("http://127.0.0.1:18093/control?rtt="+rtt+"&jitter=20&dropEvery=11")){yield return control.SendWebRequest();}
   app.server="http://127.0.0.1:18093";app.SendMessage("StartRpg",false);double begin=Time.realtimeSinceStartupAsDouble;int last=-1,accepted=0,regressed=0;bool ack=false;var faults=new List<string>();Action<string> failed=m=>faults.Add(m);app.HudSession.Failed+=failed;
   while(Time.realtimeSinceStartupAsDouble-begin<12){yield return null;var state=app.HudSession.State;if(state==null)continue;int seq=(int)state["sequence"];if(seq<last)regressed++;if(seq>last)accepted++;last=seq;ack=state["acceptedInput"] is JObject;}
   app.HudSession.Failed-=failed;using(var health=UnityWebRequest.Get("http://127.0.0.1:18093/health")){yield return health.SendWebRequest();var server=JObject.Parse(health.downloadHandler.text);results.Add(new JObject{{"rttMs",rtt},{"jitterMs",20},{"dropEveryAttempt",11},{"active",app.HudSession.Active},{"acceptedSnapshots",accepted},{"sequenceRegressions",regressed},{"movementAck",ack},{"cookieSaves",app.HudSession.CookieSaveCount},{"serverDroppedResponses",server["drops"]},{"errors",new JArray(faults)},{"passed",app.HudSession.Active&&accepted>10&&regressed==0&&ack&&faults.Count==0}});}
  }
  using(var reset=UnityWebRequest.Get("http://127.0.0.1:18093/control?rtt=150")){yield return reset.SendWebRequest();}
  File.WriteAllText("C:/Users/SHK/island-combat-stability-20261107/evidence/network-review.json",results.ToString());
 }
}
