using System;
using System.IO;
using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 // Opt-in development validation: real skill input, no modified HP/positions/camera for captures.
 public sealed class LightningIntegrationProbe:MonoBehaviour {
  IslandApp app;RpgSession session;Battle3DView view;string output;int phase,errors,frames,phaseFrames;float deadline,nextCast;bool cast,flash,arc,ground;int initialLines;readonly JArray samples=new JArray(),errorSamples=new JArray();
  public bool Finished{get;private set;}
  public void Begin(string directory){if(!Debug.isDebugBuild&&!Application.isEditor)return;output=directory;Directory.CreateDirectory(output);app=FindFirstObjectByType<IslandApp>();session=app.HudSession;app.StartReferenceTraining(3);session.Auto=false;deadline=Time.realtimeSinceStartup+130;Application.logMessageReceived+=Log;}
  [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]static void AndroidBoot(){
   #if UNITY_ANDROID && !UNITY_EDITOR
   if(!Debug.isDebugBuild)return;try{using(var player=new AndroidJavaClass("com.unity3d.player.UnityPlayer"))using(var activity=player.GetStatic<AndroidJavaObject>("currentActivity"))using(var intent=activity.Call<AndroidJavaObject>("getIntent")){if(intent.Call<string>("getStringExtra","lightning_probe")!="1")return;var go=new GameObject("Lightning validation");DontDestroyOnLoad(go);go.AddComponent<LightningIntegrationProbe>().StartCoroutine(Boot(go));}}catch(Exception e){Debug.LogException(e);}
   #endif
  }
  static System.Collections.IEnumerator Boot(GameObject go){while(!FindFirstObjectByType<IslandApp>())yield return null;go.GetComponent<LightningIntegrationProbe>().Begin(Path.Combine(Application.persistentDataPath,"lightning-review"));}
  void Log(string message,string stack,LogType type){if(type!=LogType.Error&&type!=LogType.Exception&&type!=LogType.Assert)return;errors++;if(errorSamples.Count<5)errorSamples.Add(new JObject{{"message",message},{"stack",stack}});}
  void LateUpdate(){if(Finished||output==null)return;frames++;if(Time.realtimeSinceStartup>deadline){Finish("TIMEOUT");return;}var s=session.State;if(s==null)return;view=FindFirstObjectByType<Battle3DView>();if(!view||view.Lightning==null)return;
   var motion=s["hero"]?["motion"] as JObject;float time=NativeCombatPresentation.N(s["elapsed"]);int slot=3+phase%3,expected=slot==3?0:slot==4?2:4;
   if(!cast&&time>(phase<3?2.5f:3.6f)&&time>=nextCast&&motion==null){session.Command("tick",new JObject{{"skill",slot}});nextCast=time+.5f;}
   if(!cast&&(string)motion?["kind"]=="skill"&&(int?)motion?["slot"]==slot){cast=true;phaseFrames=frames;}
   var lightning=view.Lightning;
   if(cast&&lightning.ActiveCount>0&&lightning.LatestSupports==expected){float age=lightning.LatestAge;
    if(!flash&&age<ScreenTopLightning.FlashSeconds){Capture("flash");flash=true;}
    if(!arc&&age>=ScreenTopLightning.FlashSeconds&&age<.13f){Capture("arc");arc=true;}
    if(!ground&&age>=.13f&&age<.26f){Capture("ground");ground=true;}
   }
   if(cast&&frames-phaseFrames>15&&motion==null&&lightning.ActiveCount==0){
    if(!arc||!ground){Finish("MISSED_CAPTURE");return;}phase++;if(phase==6){Finish("PASS");return;}
    cast=flash=arc=ground=false;if(phase==3){app.StartReferenceTraining(9);session.Auto=false;nextCast=0;initialLines=0;}else nextCast=time+.25f;
   }
  }
  void Capture(string stage){
   var battle=app.HudBattle;var lightning=view.Lightning;var label=(phase<3?"side":"quarter")+"-skill-"+(phase%3+4)+"-"+stage;var metrics=lightning.Inspect(battle.BattleCamera,session.Map);
   bool valid=true;foreach(var token in metrics){if(Mathf.Abs((float)token["startY"]-1.15f)>.002f||(float)token["depthError"]>.002f||(float)token["endError"]>.001f||(float)token["groundError"]>.015f||(float)token["extent"]>(float)token["damageRadius"]+.02f)valid=false;}
   int lines=FindObjectsByType<LineRenderer>(FindObjectsInactive.Include,FindObjectsSortMode.None).Length;if(initialLines==0)initialLines=lines;if(lines!=initialLines)valid=false;
   samples.Add(new JObject{{"label",label},{"valid",valid},{"frame",Time.frameCount},{"camera",battle.CameraRig.Mode.ToString()},{"age",lightning.LatestAge},{"supports",lightning.LatestSupports},{"active",lightning.ActiveCount},{"groundArcs",lightning.ActiveGroundArcs},{"particles",lightning.ParticleCount},{"lineRenderers",lines},{"strikes",metrics}});
   string file=label+".png";ScreenCapture.CaptureScreenshot(Application.platform==RuntimePlatform.Android?"lightning-review/"+file:Path.Combine(output,file));Save("RUNNING");
  }
  void Save(string result){File.WriteAllText(Path.Combine(output,"lightning-report.json"),new JObject{{"result",result},{"version",Application.version},{"platform",Application.platform.ToString()},{"frames",frames},{"errors",errors},{"errorSamples",errorSamples},{"networkRequests",session.NetworkRequestCount},{"samples",samples}}.ToString());}
  void Finish(string result){foreach(var s in samples)if(!(bool)s["valid"])result="FAIL";if(errors>0)result="ERROR";Finished=true;Save(result);Application.logMessageReceived-=Log;Debug.Log("LIGHTNING_REVIEW "+result);}
  void OnDestroy(){Application.logMessageReceived-=Log;}
 }
}
