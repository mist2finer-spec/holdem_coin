using System;
using System.Collections;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
namespace IslandGame {
 // Development validation through the real HUD, AUTO and local session. No actor state edits.
 public sealed class ActionCancelJumpProbe:MonoBehaviour {
  IslandApp app;RpgSession session;Battle3DView view;NativeBattle battle;string output;int errors,frames;bool failed;readonly JArray cases=new JArray(),errorsLog=new JArray();
  public bool Finished{get;private set;}
  static float N(JToken t)=>NativeCombatPresentation.N(t);
  JObject State=>session?.State;JObject Motion=>State?["hero"]?["motion"] as JObject;
  [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]static void Boot(){
   #if UNITY_ANDROID && !UNITY_EDITOR
   if(!Debug.isDebugBuild)return;try{using(var c=new AndroidJavaClass("com.unity3d.player.UnityPlayer"))using(var a=c.GetStatic<AndroidJavaObject>("currentActivity"))using(var intent=a.Call<AndroidJavaObject>("getIntent")){if(intent.Call<string>("getStringExtra","action_probe")!="1")return;var go=new GameObject("Action cancel jump review");DontDestroyOnLoad(go);go.AddComponent<ActionCancelJumpProbe>().Begin();}}catch(Exception e){Debug.LogException(e);}
   #endif
  }
  public void Begin(){if(!Debug.isDebugBuild&&!Application.isEditor)return;output=Application.isEditor?Path.GetFullPath(Path.Combine(Application.dataPath,"../../../../../maintenance/attack-cancel-jump-20261111/evidence/editor")):Path.Combine(Application.persistentDataPath,"action-review");Directory.CreateDirectory(output);Application.logMessageReceived+=Log;StartCoroutine(Run());}
  void Log(string message,string stack,LogType type){if(type!=LogType.Error&&type!=LogType.Exception&&type!=LogType.Assert)return;errors++;if(errorsLog.Count<4)errorsLog.Add(message);}
  void Update(){if(!Finished)frames++;}
  IEnumerator Run(){
   while(!(app=FindFirstObjectByType<IslandApp>()))yield return null;
   foreach(int zone in new[]{0,9}){
    app.StartReferenceTraining(zone);session=app.HudSession;session.Auto=true;
    float timeout=Time.realtimeSinceStartup+30;while((State==null||(int?)State["routeZone"]!=zone||(string)State["phase"]=="boss-loading"||(bool?)State["bossIntroActive"]==true)&&Time.realtimeSinceStartup<timeout)yield return null;
    view=FindFirstObjectByType<Battle3DView>();battle=app.HudBattle;
    foreach(var pair in new[]{("Jump","jump"),("EvadeRight","dodge"),("Slide","slide"),("Skill3","skill")}){yield return Case(zone,pair.Item1,pair.Item2);if(failed)break;}
    if(failed)break;
   }
   Finished=true;Save(failed||errors>0?"FAIL":"PASS");Application.logMessageReceived-=Log;Debug.Log("ACTION_CANCEL_JUMP "+(failed||errors>0?"FAIL":"PASS"));
  }
  IEnumerator Case(int zone,string buttonName,string expected){
   var button=FindObjectsByType<Button>(FindObjectsSortMode.None).First(b=>b.name==buttonName&&b.gameObject.activeInHierarchy);
   float until=Time.realtimeSinceStartup+15;
   while(Time.realtimeSinceStartup<until){var m=Motion;if((string)m?["kind"]=="attack"&&N(State["elapsed"])-N(m["start"])<.12f&&button.interactable)break;yield return null;}
   if((string)Motion?["kind"]!="attack"||!button.interactable){failed=true;cases.Add(new JObject{{"zone",zone},{"action",expected},{"failure","No interruptible AUTO attack/button"}});yield break;}
   int oldId=(int)Motion["attackId"];float sent=N(State["elapsed"]),launch=N(State["hero"]["elevation"]);var hud=FindFirstObjectByType<IslandBattleHud>();int dispatch=hud.UiDispatches;
   ExecuteEvents.Execute<IPointerClickHandler>(button.gameObject,new PointerEventData(EventSystem.current){button=PointerEventData.InputButton.Left},ExecuteEvents.pointerClickHandler);
   bool idle=false,accepted=false,landed=false,rendered=false,riseShot=false,apexShot=false,fallShot=false;float peak=0,firstAction=-1,landAt=-1;var trace=new JArray();float previousTime=-1;until=Time.realtimeSinceStartup+3;
   while(Time.realtimeSinceStartup<until){
    var m=Motion;string kind=(string)m?["kind"],action=(string)State?["hero"]?["action"];float time=N(State?["elapsed"]);int serial=(int?)State?["hero"]?["serial"]??0;
    if(kind=="cancel"&&action=="stay1")idle=true;
    if(kind==expected){accepted=true;if(firstAction<0)firstAction=time;rendered|=expected=="jump"?battle.HeroAction?.StartsWith("jump")==true:expected=="slide"?battle.HeroAction?.StartsWith("sliding")==true:expected=="dodge"?battle.HeroAction=="avoid1":battle.HeroAction?.StartsWith("skill")==true;
     if(expected=="jump"){peak=Mathf.Max(peak,N(m?["jump"]?["worldY"])-launch);float velocity=N(m?["jump"]?["velocityY"]);if(velocity>250&&velocity<450&&!riseShot){riseShot=true;Shot("zone"+zone+"-rise");}if(Mathf.Abs(velocity)<80&&!apexShot){apexShot=true;Shot("zone"+zone+"-apex");}if(velocity< -350&&!fallShot){fallShot=true;Shot("zone"+zone+"-fall");}if(m?["jump"]?["landedAt"]?.Type==JTokenType.Float||m?["jump"]?["landedAt"]?.Type==JTokenType.Integer){landed=true;landAt=N(m["jump"]["landedAt"]);}}
    }
    if(time!=previousTime){trace.Add(new JObject{{"time",time},{"kind",kind},{"action",action},{"air",State["hero"]["airHeight"]?.DeepClone()},{"velocity",m?["jump"]?["velocityY"]?.DeepClone()},{"attackId",m?["attackId"]?.DeepClone()},{"presented",battle.HeroAction},{"groundError",view.HeroGroundError}});previousTime=time;}
    if(accepted&&rendered&&time-firstAction>.18f&&expected!="jump")break;
    if(accepted&&expected=="jump"&&landed&&kind!="jump")break;
    yield return null;
   }
   bool valid=idle&&accepted&&rendered&&hud.UiDispatches==dispatch+1&&firstAction-sent<.16f&&(expected!="jump"||landed&&peak>95&&peak<106&&landAt<1.1f);
   var row=new JObject{{"zone",zone},{"camera",battle.CameraRig.Mode.ToString()},{"action",expected},{"valid",valid},{"auto",session.Auto},{"cancelledAttackId",oldId},{"idleObserved",idle},{"rendered",rendered},{"latency",firstAction-sent},{"jumpPeakCm",peak},{"landingAge",landAt},{"trace",trace}};cases.Add(row);failed|=!valid;Save("RUNNING");
   Shot("zone"+zone+"-"+expected);
   yield return new WaitForSecondsRealtime(1.3f);
  }
  void Shot(string name){ScreenCapture.CaptureScreenshot(Application.platform==RuntimePlatform.Android?"action-review/"+name+".png":Path.Combine(output,name+".png"));}
  void Save(string result){File.WriteAllText(Path.Combine(output,"action-report.json"),new JObject{{"result",result},{"version",Application.version},{"platform",Application.platform.ToString()},{"frames",frames},{"errors",errors},{"errorSamples",errorsLog},{"audioEvents",RpgAudio.Current?RpgAudio.Current.SkillEvents:0},{"audioLastSkill",RpgAudio.Current?RpgAudio.Current.LastSkill:null},{"networkRequests",session?.NetworkRequestCount??0},{"samples",cases}}.ToString());}
  void OnDestroy(){Application.logMessageReceived-=Log;}
 }
}
