using System;
using System.IO;
using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 // Development-only traversal with ordinary session inputs. No HP, location, or camera overrides.
 public sealed class ZoneTenArenaProbe:MonoBehaviour {
  IslandApp app;RpgSession session;string output;int frames,errors,stage;float deadline,at,nextSkill;bool approach,reveal,fight,lightning,exit,complete;readonly JArray samples=new JArray(),errorSamples=new JArray();Vector3 moveStart;
  bool descentStart,descentMiddle,running,outside;readonly JArray gateMotion=new JArray();float nextGateSample;
  public bool Finished{get;private set;}
  public void Begin(string directory,int startZone=8){if(!Debug.isDebugBuild&&!Application.isEditor)return;output=directory;Directory.CreateDirectory(output);app=FindFirstObjectByType<IslandApp>();session=app.HudSession;app.StartReferenceTraining(startZone);session.Auto=true;deadline=Time.realtimeSinceStartup+180;Application.logMessageReceived+=Log;}
  [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]static void AndroidBoot(){
   #if UNITY_ANDROID && !UNITY_EDITOR
   if(!Debug.isDebugBuild)return;try{using(var p=new AndroidJavaClass("com.unity3d.player.UnityPlayer"))using(var a=p.GetStatic<AndroidJavaObject>("currentActivity"))using(var intent=a.Call<AndroidJavaObject>("getIntent")){if(intent.Call<string>("getStringExtra","arena_probe")!="1")return;var go=new GameObject("Zone ten arena validation");DontDestroyOnLoad(go);go.AddComponent<ZoneTenArenaProbe>().StartCoroutine(Boot(go));}}catch(Exception e){Debug.LogException(e);}
   #endif
  }
  static System.Collections.IEnumerator Boot(GameObject go){while(!FindFirstObjectByType<IslandApp>())yield return null;go.GetComponent<ZoneTenArenaProbe>().Begin(Path.Combine(Application.persistentDataPath,"arena-review"));}
  void Log(string message,string stack,LogType type){if(type!=LogType.Error&&type!=LogType.Exception&&type!=LogType.Assert)return;errors++;if(errorSamples.Count<5)errorSamples.Add(new JObject{{"message",message},{"stack",stack}});}
  void LateUpdate(){if(Finished||output==null)return;frames++;if(Time.realtimeSinceStartup>deadline){Finish("TIMEOUT");return;}var s=session.State;if(s==null)return;var view=FindFirstObjectByType<Battle3DView>();if(!view||!view.HeroTarget)return;float time=NativeCombatPresentation.N(s["elapsed"]);if((int?)s["routeZone"]!=9)return;
   string intro=(string)s["bossIntroStage"],phase=(string)s["phase"];
   if(intro=="approach"&&phase!="boss-loading"&&time>.35f&&!approach){approach=true;Capture("side-entry");}
   if(intro=="reveal"&&app.HudBattle.CameraRig.Mode==ViewMode.QuarterView&&!reveal){reveal=true;Capture("boss-reveal");}
   if(intro=="none"&&phase=="boss"&&!fight){fight=true;session.Auto=false;SetStick(Vector2.up);at=time;moveStart=view.HeroTarget.position;stage=1;Capture("quarter-arena");}
   if(stage==1&&time-at>.65f){SetStick(Vector2.zero);Capture("quarter-movement",Vector3.Distance(moveStart,view.HeroTarget.position)>1);stage=2;session.Auto=true;nextSkill=time;}
   if(stage==2&&phase=="boss"&&time>=nextSkill){int slot=(int)(time*10)%3==0?0:3;session.Command("tick",new JObject{{"skill",slot}});nextSkill=time+1.2f;}
   if(stage>=2&&!lightning&&view.Lightning!=null&&view.Lightning.ActiveCount>0&&view.Lightning.LatestAge>=.04f){lightning=true;Capture("lightning-in-grass");}
   if(phase=="village-exit"){
    var arena=FindFirstObjectByType<ZoneTenArenaScene>();float progress=NativeCombatPresentation.N(s["villageExitProgress"]);
    if(time>=nextGateSample&&!exit){gateMotion.Add(new JObject{{"elapsed",time},{"progress",progress},{"drop",arena.ExitDrop},{"active",arena.exitSeal.activeSelf},{"passable",(bool?)s["villageExitOpen"]==true}});nextGateSample=time+.05f;}
    if(progress>.15f&&progress<1&&!descentStart){descentStart=true;Capture("exit-lowering-start",arena.exitSeal.activeSelf&&arena.ExitDrop>0&&(bool?)s["villageExitOpen"]==false);}
    if(progress>.5f&&progress<1&&!descentMiddle){descentMiddle=true;Capture("exit-lowering-middle",arena.exitSeal.activeSelf&&arena.ExitDrop>.5f&&arena.ExitDrop<2.6f);}
    if((bool?)s["villageExitOpen"]==true&&!arena.exitSeal.activeSelf&&!exit){exit=true;stage=3;session.Auto=false;at=time;Capture("boss-down-exit-open",!FindFirstObjectByType<IslandBattleHud>().EscapePopupVisible&&arena.ExitDrop>=2.59f);}
   }
   if(stage==3&&time-at>1){session.Auto=true;stage=4;}
   if(stage==4&&!running&&(string)s["hero"]?["action"]=="run1"&&app.HudBattle.HeroAction=="run1"){running=true;Capture("run-to-village");}
   if(stage==4&&!outside){var a=session.Map["arena"];float dx=NativeCombatPresentation.N(s["hero"]?["x"])-NativeCombatPresentation.N(a["center"]?["x"]),dy=NativeCombatPresentation.N(s["hero"]?["y"])-NativeCombatPresentation.N(a["center"]?["y"]);if(Mathf.Sqrt(dx*dx+dy*dy)>NativeCombatPresentation.N(a["radius"])+50){outside=true;Capture("outside-arena",(bool?)s["villageExitOpen"]==true);}}
   if((string)s["status"]=="won"&&!complete){complete=true;stage=5;at=Time.realtimeSinceStartup;}
   if(stage==5&&Time.realtimeSinceStartup-at>.35f){Capture("village-arrived",FindFirstObjectByType<IslandBattleHud>().EscapePopupVisible&&(bool?)s["villageEntered"]==true);Finish(approach&&reveal&&fight&&lightning&&exit&&descentStart&&descentMiddle&&running&&outside?"PASS":"MISSING_STAGE");}
  }
  void SetStick(Vector2 input){var stick=FindFirstObjectByType<IslandHudStick>();stick.ResetInput();if(input.sqrMagnitude<.01f)return;var rect=(RectTransform)stick.transform;var local=rect.rect.center+input*Mathf.Min(rect.rect.width,rect.rect.height)*.45f;stick.OnPointerDown(new UnityEngine.EventSystems.PointerEventData(UnityEngine.EventSystems.EventSystem.current){pointerId=200,position=RectTransformUtility.WorldToScreenPoint(null,rect.TransformPoint(local))});}
  void Capture(string label,bool valid=true){var s=session.State;var view=FindFirstObjectByType<Battle3DView>();var stream=MountZoneStream.Current;var arena=FindFirstObjectByType<ZoneTenArenaScene>();var boss=(s["mobs"] as JArray)?.First;var p=view.HeroTarget.position;float ground=NativeCombatPresentation.UnityGroundHeight(session.Map,p.x*100,p.z)/100;int nature=FindObjectsByType<NatureAuthoredEnvironment>(FindObjectsInactive.Include,FindObjectsSortMode.None).Length;
   valid&=nature==0&&stream&&stream.ActiveZone==9&&stream.LoadedCount==1&&arena&&Mathf.Abs(p.y-ground)<.06f&&(int?)boss?["maxHP"]==2000;
   samples.Add(new JObject{{"label",label},{"valid",valid},{"frame",Time.frameCount},{"phase",(string)s["phase"]},{"camera",app.HudBattle.CameraRig.Mode.ToString()},{"bossHP",boss?["hp"]?.DeepClone()},{"maxHP",boss?["maxHP"]?.DeepClone()},{"hero",s["hero"]?.DeepClone()},{"natureMaps",nature},{"mountScenes",stream?stream.LoadedCount:0},{"groundError",Mathf.Abs(p.y-ground)},{"entranceClosed",arena&&arena.entranceSeal.activeSelf},{"exitClosed",arena&&arena.exitSeal.activeSelf},{"exitDrop",arena?arena.ExitDrop:0},{"exitProgress",s["villageExitProgress"]?.DeepClone()},{"exitPassable",s["villageExitOpen"]?.DeepClone()},{"escapePopup",FindFirstObjectByType<IslandBattleHud>().EscapePopupVisible}});
   string file=label+".png";ScreenCapture.CaptureScreenshot(Application.platform==RuntimePlatform.Android?"arena-review/"+file:Path.Combine(output,file));Save("RUNNING");
  }
  void Save(string result){File.WriteAllText(Path.Combine(output,"arena-report.json"),new JObject{{"result",result},{"version",Application.version},{"platform",Application.platform.ToString()},{"frames",frames},{"errors",errors},{"errorSamples",errorSamples},{"networkRequests",session.NetworkRequestCount},{"gateMotion",gateMotion},{"samples",samples}}.ToString());}
  void Finish(string result){foreach(var s in samples)if(!(bool)s["valid"])result="FAIL";if(errors>0)result="ERROR";Finished=true;Save(result);Application.logMessageReceived-=Log;Debug.Log("ZONE_TEN_REVIEW "+result);}
  void OnDestroy(){Application.logMessageReceived-=Log;}
 }
}
