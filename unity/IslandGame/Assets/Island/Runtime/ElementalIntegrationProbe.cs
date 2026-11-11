using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 // Explicit development-build probe: drives only the public training/input API.
 // No HP, positions, hit results, equipment saves or simulation clocks are patched.
 public sealed class ElementalIntegrationProbe:MonoBehaviour {
  IslandApp app;RpgSession session;NativeBattle battle;Battle3DView view;
  string output;float deadline,nextAttempt,walkAt;int phase,slot,castId;bool captured;float castStart;
  readonly JArray samples=new JArray(),hits=new JArray();readonly System.Collections.Generic.HashSet<string> seen=new System.Collections.Generic.HashSet<string>();
  readonly System.Collections.Generic.HashSet<int> swordStages=new System.Collections.Generic.HashSet<int>();
  int errors,frames,walkSamples;bool escapeShown;readonly JArray errorSamples=new JArray();public bool Finished{get;private set;}
  public void Begin(string directory){if(!Debug.isDebugBuild&&!Application.isEditor)return;output=directory;Directory.CreateDirectory(output);app=FindFirstObjectByType<IslandApp>();session=app.HudSession;battle=FindFirstObjectByType<NativeBattle>();app.StartReferenceTraining(9);session.Auto=false;deadline=Time.realtimeSinceStartup+150;Application.logMessageReceived+=Log;}
  [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]static void AndroidBoot(){
   #if UNITY_ANDROID && !UNITY_EDITOR
   if(!Debug.isDebugBuild)return;
   try{using(var player=new AndroidJavaClass("com.unity3d.player.UnityPlayer"))using(var activity=player.GetStatic<AndroidJavaObject>("currentActivity"))using(var intent=activity.Call<AndroidJavaObject>("getIntent")){if(intent.Call<string>("getStringExtra","elemental_probe")!="1")return;var go=new GameObject("Elemental integration validation");DontDestroyOnLoad(go);go.AddComponent<ElementalIntegrationProbe>().StartCoroutine(Boot(go));}}catch(Exception e){Debug.LogException(e);}
   #endif
  }
  static System.Collections.IEnumerator Boot(GameObject go){while(!FindFirstObjectByType<IslandApp>())yield return null;go.GetComponent<ElementalIntegrationProbe>().Begin(Path.Combine(Application.persistentDataPath,"elemental-review"));}
  void Log(string text,string stack,LogType type){if(type==LogType.Error||type==LogType.Exception||type==LogType.Assert){errors++;if(errorSamples.Count<8)errorSamples.Add(new JObject{{"message",text},{"stack",stack}});}}
  static float N(JToken t,float fallback=0)=>NativeCombatPresentation.N(t,fallback);
  void Update(){if(Finished||output==null||!session)return;frames++;if(Time.realtimeSinceStartup>deadline){Finish("TIMEOUT");return;}var s=session.State;if(s==null)return;view=FindFirstObjectByType<Battle3DView>();if(!view||!view.HeroTarget)return;
   foreach(var f in s["fx"] as JArray??new JArray())if((string)f["kind"]=="damage"&&(string)f["damageKind"]=="skill"){
    string key=(phase<5?"boss":"side")+":"+f["attackId"]+":"+f["target"];if(seen.Add(key))hits.Add(new JObject{{"attackId",f["attackId"]?.DeepClone()},{"target",f["target"]?.DeepClone()},{"value",f["value"]?.DeepClone()},{"element",f["element"]?.DeepClone()}});
   }
   float time=N(s["elapsed"]);string intro=(string)s["bossIntroStage"];var m=s["hero"]?["motion"] as JObject;
   var drawn=battle.PresentationState?["hero"]?["motion"] as JObject;
   if(phase==4&&(string)drawn?["kind"]=="attack"&&view.HeroAttackActive&&view.ActiveReferenceEffects>0){int stage=(int)N(drawn["comboStep"],1);if(swordStages.Add(stage))Capture("boss-sword-"+stage);}
   if(phase==0&&intro=="approach"&&time>.55f){Capture("boss-approach");phase=1;}
   else if(phase==1&&intro=="reveal"&&time-N(s["bossRevealAt"])>.42f){Capture("boss-reveal");phase=2;walkAt=time;}
   else if(phase==2&&intro=="none"){
    var boss=(s["mobs"] as JArray)?.FirstOrDefault(t=>(bool?)t["unityBoss"]==true);
    if((string)boss?["action"]=="walk"&&view.BossClipName=="Boss_AdaptedWalk"&&time>=walkAt){Capture("boss-walk-"+walkSamples);walkAt=time+.17f;if(++walkSamples>=3){phase=3;slot=0;nextAttempt=time;}}
   }else if(phase==3||phase==5){
    if(!captured&&(string)m?["kind"]=="skill"&&(int?)m["slot"]==slot){castId=(int)N(m["attackId"]);castStart=N(m["start"]);if(battle.VisualTime>=castStart+N(m["hitAt"])+.08f){Capture((phase==3?"boss":"side")+"-skill-"+slot);captured=true;}}
    if(captured&&time>=castStart+1.3f){captured=false;if(phase==3){slot++;if(slot>=6){session.Auto=true;phase=4;}}else{if(slot==0){slot=3;}else{Finish("PASS");return;}}nextAttempt=time+.2f;}
    if(!captured&&m==null&&time>=nextAttempt){session.Command("tick",new JObject{{"skill",slot}});nextAttempt=time+.3f;}
   }else if(phase==4&&(string)s["status"]=="won"){
    var hud=FindFirstObjectByType<IslandBattleHud>();if(hud&&hud.EscapePopupVisible){escapeShown=true;Capture("boss-victory");phase=6;nextAttempt=Time.realtimeSinceStartup+.4f;}
   }else if(phase==6&&Time.realtimeSinceStartup>=nextAttempt){
    if((int?)s["routeZone"]!=9||(string)s["status"]!="won"){Finish("FAIL");return;}
    app.StartReferenceTraining(3);session.Auto=false;phase=5;slot=0;captured=false;nextAttempt=2.4f;
   }
  }
  void Capture(string label){
   var s=session.State;var boss=(s["mobs"] as JArray)?.FirstOrDefault(t=>(bool?)t["unityBoss"]==true);
   var item=new JObject{{"label",label},{"frame",Time.frameCount},{"time",N(s["elapsed"])},{"routeZone",s["routeZone"]?.DeepClone()},{"phase",s["phase"]?.DeepClone()},{"status",s["status"]?.DeepClone()},{"camera",battle.CameraRig.Mode.ToString()},{"quarterWeight",battle.CameraRig.QuarterWeight},{"heroX",N(s["hero"]?["x"])},{"heroAction",(string)s["hero"]?["action"]},{"heroClip",view.HeroClipName},{"heroSample",view.HeroSampleTime},{"bossX",N(boss?["x"])},{"bossHP",N(boss?["hp"])},{"bossAction",(string)boss?["action"]},{"bossClip",view.BossClipName},{"bossSample",view.BossSampleTime},{"effects",view.ActiveReferenceEffects},{"particles",view.ReferenceParticles},{"projectiles",(s["elementalProjectiles"] as JArray)?.Count??0},{"poolObjects",FindObjectsByType<ParticleSystem>(FindObjectsSortMode.None).Length},{"motion",s["hero"]?["motion"]?.DeepClone()}};
   samples.Add(item);File.WriteAllText(Path.Combine(output,label+".json"),item.ToString());ScreenCapture.CaptureScreenshot(Application.platform==RuntimePlatform.Android?"elemental-review/"+label+".png":Path.Combine(output,label+".png"));Save("RUNNING");
  }
  void Save(string status){File.WriteAllText(Path.Combine(output,"integration-report.json"),new JObject{{"result",status},{"version",Application.version},{"platform",Application.platform.ToString()},{"frames",frames},{"errors",errors},{"errorSamples",errorSamples.DeepClone()},{"escapePopup",escapeShown},{"swordStages",new JArray(swordStages.OrderBy(n=>n))},{"samples",samples.DeepClone()},{"skillHits",hits.DeepClone()},{"networkRequests",session.NetworkRequestCount}}.ToString());}
  void Finish(string status){if(status=="PASS"&&(!escapeShown||swordStages.Count!=5||walkSamples!=3||hits.Count(t=>(string)t["target"]=="boss")<6||frames<100))status="FAIL";if(errors>0)status="ERROR";Finished=true;Save(status);Application.logMessageReceived-=Log;Debug.Log("ELEMENTAL_INTEGRATION "+status+" / "+samples.Count+" samples / "+errors+" errors");}
  void OnDestroy(){Application.logMessageReceived-=Log;}
 }
}
