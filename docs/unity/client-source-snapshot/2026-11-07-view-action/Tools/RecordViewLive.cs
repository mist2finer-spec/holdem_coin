using System;using System.IO;using System.Collections;using System.Collections.Generic;using UnityEngine;using UnityEditor;using IslandGame;using Newtonsoft.Json.Linq;
public static class RecordViewLive {
 const string Dir="C:/Users/SHK/island-view-action-20261107/evidence/videos/";
 public static object Main(){Directory.CreateDirectory(Dir);IslandGame.Editor.BattleHudReview.SetSize(540,1170);EditorWindow.GetWindow(typeof(EditorWindow).Assembly.GetType("UnityEditor.GameView")).Focus();var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();app.StartCoroutine(Run(app));return new{started=true};}
 static IEnumerator Run(IslandApp app){app.HudSession.Auto=true;double start=Time.realtimeSinceStartupAsDouble;while((int?)app.HudSession.State?["room"]!=1&&Time.realtimeSinceStartupAsDouble-start<70)yield return null;
  if((int?)app.HudSession.State?["room"]!=1){File.WriteAllText(Dir+"failed.json","{\"reason\":\"arena not reached\"}");yield break;}
  var view=app.HudBattle.GetComponent<Battle3DView>();var shots=new[]{"SideAction","QuarterAction","AttackTransitions","HitboxHurtbox"};
  foreach(var shot in shots){app.HudBattle.SetPresentationView(shot=="SideAction"?ViewMode.Side25D:ViewMode.QuarterView);view.ContactDebug.Visible=shot=="HitboxHurtbox";yield return new WaitForSecondsRealtime(1.4f);string folder=Dir+shot;Directory.CreateDirectory(folder);double begin=Time.realtimeSinceStartupAsDouble;int frame=0;var times=new List<double>();var trace=new JArray();var keys=new HashSet<string>();
   while(Time.realtimeSinceStartupAsDouble-begin<12){yield return new WaitForEndOfFrame();double wall=Time.realtimeSinceStartupAsDouble-begin;var state=app.HudSession.State;var hm=state?["hero"]?["motion"] as JObject;var bm=BossContactProfile.Boss(state)?["motion"] as JObject;
    if(shot=="AttackTransitions")foreach(var motion in new[]{hm,bm})if(motion!=null){float phase=(app.HudBattle.VisualTime-NativeCombatPresentation.N(motion["start"]))/Mathf.Max(.001f,NativeCombatPresentation.N(motion["duration"]));int band=phase<.18f?0:phase<.6f?1:2;string key=(string)motion["attackId"]+":"+band;if(phase>=0&&phase<=1&&keys.Add(key))app.HudBattle.SetPresentationView(app.HudBattle.CameraRig.Mode==ViewMode.Side25D?ViewMode.QuarterView:ViewMode.Side25D);}
    var image=ScreenCapture.CaptureScreenshotAsTexture();File.WriteAllBytes(folder+"/"+(frame++).ToString("D4")+".jpg",image.EncodeToJPG(88));UnityEngine.Object.Destroy(image);times.Add(wall);
    trace.Add(new JObject{{"wall",wall},{"visualTime",app.HudBattle.VisualTime},{"state",view.Presentation.State.ToString()},{"transition",view.Presentation.TransitionProgress},{"heroClip",view.HeroClipName},{"heroSample",view.HeroSampleTime},{"heroAttack",hm?["attackId"]?.DeepClone()},{"bossClip",view.BossClipName},{"bossAttack",bm?["attackId"]?.DeepClone()},{"contactAttack",view.ContactFeedback.LastAttackId},{"contactAt",view.ContactFeedback.LastContactAt}});
    yield return new WaitForSecondsRealtime(.02f);
   }
   File.WriteAllText(folder+"/timestamps.json",Newtonsoft.Json.JsonConvert.SerializeObject(times));File.WriteAllText(folder+"/trace.json",trace.ToString());
  }
  view.ContactDebug.Visible=false;app.HudBattle.SetPresentationView(null);File.WriteAllText(Dir+"complete.json","{\"source\":\"actual Unity play and isolated HTTP server\",\"shots\":4,\"secondsPerShot\":12,\"performanceBenchmark\":false,\"frameTiming\":\"variable, preserved by timestamps\"}");
 }
}
