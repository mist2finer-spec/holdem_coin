using System;
using System.IO;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class ProductionReviewFinal {
 public static object Endpoint(){PlayerPrefs.SetString("island-server","https://holdem-coin-tavern.onrender.com");return new{configured=true};}
 public static object Main(){var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();app.server="https://holdem-coin-tavern.onrender.com";app.SendMessage("StartRpg",false);app.StartCoroutine(Run(app));return new{started=true};}
 static IEnumerator Run(IslandApp app){
  double begin=Time.realtimeSinceStartupAsDouble;int previous=-1,accepted=0,regressed=0;bool ack=false;var errors=new List<string>();Action<string> failed=m=>errors.Add(m);app.HudSession.Failed+=failed;
  while(Time.realtimeSinceStartupAsDouble-begin<18){yield return null;var state=app.HudSession.State;if(state==null)continue;int seq=(int)state["sequence"];if(seq<previous)regressed++;if(seq>previous)accepted++;previous=seq;ack=state["acceptedInput"] is JObject;}
  app.HudSession.Failed-=failed;string revision=(string)app.HudSession.State?["contactRevision"];var view=app.HudBattle.GetComponent<Battle3DView>();bool look=view&&view.Diorama&&view.Diorama.Active;var result=new JObject{{"passed",app.HudSession.Active&&accepted>15&&regressed==0&&ack&&errors.Count==0&&revision=="boss-contact-v1"&&look},{"server","https://holdem-coin-tavern.onrender.com"},{"seconds",18},{"active",app.HudSession.Active},{"acceptedSnapshots",accepted},{"movementAck",ack},{"sequenceRegressions",regressed},{"contactRevision",revision},{"approvedNiloActive",look},{"cookieSavesIncludingNewGuestEntry",app.HudSession.CookieSaveCount},{"errors",new JArray(errors)}};
  File.WriteAllText("C:/Users/SHK/island-contact-diorama-20261107/evidence/production-editor.json",result.ToString());
 }
}
