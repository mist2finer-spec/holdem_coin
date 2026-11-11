using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;
namespace IslandGame.Editor {
 public static class ReferenceCombatReview {
  static string directory,scenario;static int zone,phase;static double deadline;static float hitTime,nextAttempt;static IslandApp app;
  public static void Begin(int startZone,string kind,string output){
   if(!EditorApplication.isPlaying)throw new InvalidOperationException("Enter Play mode first");
   directory=output;scenario=kind;zone=startZone;phase=0;nextAttempt=0;Directory.CreateDirectory(directory);deadline=EditorApplication.timeSinceStartup+90;
   BattleHudReview.SetSize(720,1280);app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();app.StartReferenceTraining(zone,kind.StartsWith("quarter"));
   EditorApplication.update-=Tick;EditorApplication.update+=Tick;
  }
  static void Tick(){try{
   if(!EditorApplication.isPlaying||!app){EditorApplication.update-=Tick;return;}
   var s=app.HudSession;var state=s.State;if(EditorApplication.timeSinceStartup>deadline)throw new TimeoutException("Reference review did not reach "+scenario);
   if(state==null||!s.Active)return;float elapsed=NativeCombatPresentation.N(state["elapsed"]);var m=state["hero"]?["motion"] as JObject;var v=UnityEngine.Object.FindFirstObjectByType<Battle3DView>();
   bool quarter=scenario.StartsWith("quarter");if(!v||!v.HeroTarget||quarter&&!v.BossEnvironmentReady||!quarter&&(!MountZoneStream.Current||!MountZoneStream.Current.IsReady))return;
   if(phase==0){
    if(scenario=="bridge"){if(NativeCombatPresentation.N(state["hero"]?["x"])<-450)return;Capture(s,v);return;}
    if(scenario=="pack"){if((state["mobs"] as JArray)?.Count(t=>NativeCombatPresentation.N(t["hp"])>0)<6)return;s.Auto=false;if(elapsed<4.5f)return;Capture(s,v);return;}
    if(scenario=="dash"){if((string)m?["kind"]!="rush"||elapsed-NativeCombatPresentation.N(m["start"])<.12f)return;Capture(s,v);return;}
    if(m!=null||elapsed<1)return;if(!quarter){var mobs=state["mobs"] as JArray;if(mobs?.Count(t=>NativeCombatPresentation.N(t["hp"])>0)<3)return;float hx=NativeCombatPresentation.N(state["hero"]?["x"]);if(!mobs.Any(t=>NativeCombatPresentation.N(t["hp"])>0&&Mathf.Abs(NativeCombatPresentation.N(t["x"])-hx)<380))return;}
    s.Auto=false;s.Command("tick",new JObject{{"skill",scenario.Contains("storm")?1:0}});phase=1;
   }else if(phase==1){if((string)m?["kind"]!="skill"){bool near=quarter||(state["mobs"] as JArray)?.Count(t=>NativeCombatPresentation.N(t["hp"])>0&&Mathf.Abs(NativeCombatPresentation.N(t["x"])-NativeCombatPresentation.N(state["hero"]?["x"]))<230)>=3;if(m==null&&near&&elapsed>=nextAttempt){s.Command("tick",new JObject{{"skill",scenario.Contains("storm")?1:0}});nextAttempt=elapsed+.2f;}return;}hitTime=NativeCombatPresentation.N(m["start"])+NativeCombatPresentation.N(m["hitAt"]);phase=2;}
   else if(phase==2&&elapsed>=hitTime+.08f)Capture(s,v);
  }catch(Exception ex){File.WriteAllText(Path.Combine(directory,scenario+"-error.txt"),ex.ToString());EditorApplication.update-=Tick;Debug.LogException(ex);}}
  static void Capture(RpgSession session,Battle3DView view){
   session.Paused=true;var report=new JObject{{"scenario",scenario},{"frame",Time.frameCount},{"clip",view.HeroClipName},{"groundError",view.HeroGroundError},{"effects",view.ActiveReferenceEffects},{"particles",view.ReferenceParticles},{"particleSystems",UnityEngine.Object.FindObjectsByType<ParticleSystem>(FindObjectsSortMode.None).Length},{"state",session.State.DeepClone()}};
   File.WriteAllText(Path.Combine(directory,scenario+".json"),report.ToString());ScreenCapture.CaptureScreenshot(Path.Combine(directory,scenario+".png"));EditorApplication.update-=Tick;
  }
 }
}
