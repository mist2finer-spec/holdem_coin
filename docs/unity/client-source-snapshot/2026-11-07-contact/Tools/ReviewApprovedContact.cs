using System;
using System.IO;
using System.Collections;
using UnityEngine;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class ReviewApprovedContact {
 public static object Main(){var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();app.server="http://127.0.0.1:18103";app.SendMessage("StartRpg",false);app.StartCoroutine(Run(app));return new{started=true};}
 static IEnumerator Run(IslandApp app){double began=Time.realtimeSinceStartupAsDouble;float min=float.MaxValue;int bodyChecks=0,overlaps=0;bool bodyCapture=false,hookCapture=false;var errors=new JArray();Application.LogCallback log=(m,t,k)=>{if(k==LogType.Error||k==LogType.Exception)errors.Add(m);};Application.logMessageReceived+=log;
  while(Time.realtimeSinceStartupAsDouble-began<55){yield return null;var state=app.HudSession.State;if(state==null||(int?)state["room"]!=1)continue;var view=app.GetComponent<Battle3DView>();if(!view)view=app.HudBattle.GetComponent<Battle3DView>();if(view.ContactDebug!=null)view.ContactDebug.Visible=true;var b=BossContactProfile.Boss(state);var h=state["hero"];float dx=(float)b["x"]-(float)h["x"],dy=(float)b["y"]-(float)h["y"],distance=Mathf.Sqrt(dx*dx+dy*dy);min=Mathf.Min(min,distance);bodyChecks++;if(distance<161.9f)overlaps++;
   app.HudSession.Auto=false;var dir=new Vector2(dx,dy).normalized;app.HudSession.Move=dir.x;app.HudSession.MoveY=dir.y;
   if(!bodyCapture&&distance<164){IslandGame.Editor.BattleHudReview.Capture("C:/Users/SHK/island-contact-diorama-20261107/evidence/approved-debug-body.png");bodyCapture=true;}
   var m=b["motion"] as JObject;if(!hookCapture&&(string)m?["kind"]=="boss-combo"){float phase=(app.HudBattle.VisualTime-(float)m["start"])/(float)m["duration"];if(BossContactProfile.Active(phase,0)){IslandGame.Editor.BattleHudReview.Capture("C:/Users/SHK/island-contact-diorama-20261107/evidence/approved-debug-hook.png");hookCapture=true;}}
  }
  Application.logMessageReceived-=log;app.HudSession.Move=app.HudSession.MoveY=0;var report=new JObject{{"passed",bodyChecks>100&&overlaps==0&&bodyCapture&&hookCapture&&errors.Count==0},{"bodyChecks",bodyChecks},{"minimumSeparation",min},{"overlaps",overlaps},{"bodyCapture",bodyCapture},{"hookCapture",hookCapture},{"errors",errors}};File.WriteAllText("C:/Users/SHK/island-contact-diorama-20261107/evidence/approved-contact-play.json",report.ToString());
 }
}
