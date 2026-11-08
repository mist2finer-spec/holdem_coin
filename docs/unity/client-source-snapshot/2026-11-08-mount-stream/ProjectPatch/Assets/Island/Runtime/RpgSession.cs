using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 public sealed partial class RpgSession : MonoBehaviour {
  public bool unityBossPreview=true;public bool mountSundayPreview;
  public JObject State,Map;public JArray LastLoot;public bool Active,Auto=true,Paused;public float Move,MoveY;public bool PlanarMovement=>(bool?)State?["unityBossMode"]==true&&((string)State?["movementMode"]=="plane"||(bool?)State?["mountSunday"]!=true&&(int?)State?["room"]==1);public event Action<string> Failed;
  bool cookieDirty;
  public double LastResponseAt {get;private set;}
  public double LastRttMilliseconds {get;private set;}
  public double LastResponseIntervalMilliseconds {get;private set;}
  public double LastParseMergeMilliseconds {get;private set;}
  public long LastResponseBytes {get;private set;}
  public int CookieSaveCount {get;private set;}
  void ReceiveCookie(string header){if(string.IsNullOrEmpty(header))return;int end=header.IndexOf(';');string value=end<0?header:header.Substring(0,end);if(value==cookie)return;cookie=value;PlayerPrefs.SetString("island-rpg-cookie",cookie);cookieDirty=true;}
  void FlushCookie(){if(!cookieDirty)return;PlayerPrefs.Save();cookieDirty=false;CookieSaveCount++;}
  string endpoint,id,cookie;int sequence,epoch;readonly Queue<JObject> commands=new Queue<JObject>();UnityWebRequest request;
  public void Open(string origin,bool campaign){Close();endpoint=origin.TrimEnd('/')+(campaign?"/api/rpg/session":mountSundayPreview?"/api/rpg/mount-sunday":unityBossPreview?"/api/rpg/unity-boss":"/api/rpg/rogue");cookie=PlayerPrefs.GetString("island-rpg-cookie","");Auto=true;Paused=false;Active=true;requests=0;LastResponseAt=0;LastRttMilliseconds=LastResponseIntervalMilliseconds=LastParseMergeMilliseconds=0;CookieSaveCount=0;if(campaign||unityBossPreview||mountSundayPreview)StartCoroutine(Pump(epoch,campaign));else OpenLocalStage(epoch);}
  public void Command(string action,JObject input=null){if(!Active){Failed?.Invoke("다시 입장한 후 명령을 실행하세요.");return;}if(localMode){LocalCommand(action,input);return;}if(commands.Count<8)commands.Enqueue(new JObject{{"action",action},{"input",input??new JObject()}});}
  public void ClearInput(){commands.Clear();Move=MoveY=0;}
  void AcceptLegacy(JObject response){if(response["loot"] is JArray loot)LastLoot=(JArray)loot.DeepClone();State=RpgContracts.ConsumeSnapshot(State,response);id=State.Value<string>("id");sequence=State.Value<int>("sequence");if(State["map"] is JObject map)Map=map;}
  JObject NextLegacy(bool campaign){
   var cmd=commands.Count>0?commands.Dequeue():new JObject{{"action","tick"},{"input",new JObject()}};
   var input=campaign?new JObject{{"move",Paused?0:Move},{"attack",false},{"auto",Auto&&!Paused}}:new JObject{{"x",Paused?0:Move},{"y",Paused||!PlanarMovement?0:MoveY},{"auto",Auto&&!Paused},{"paused",Paused}};
   if(mountSundayPreview&&MountZoneStream.Current)input["readyZone"]=MountZoneStream.Current.ReadyZone;input.Merge(cmd["input"]);return new JObject{{"action",cmd["action"]},{"id",id},{"sequence",sequence+1},{"knownBuildRevision",State["buildRevision"]?.DeepClone()},{"input",input}};
  }
  IEnumerator Pump(int generation,bool campaign,JObject initial=null){
   JObject pending=new JObject{{"action","start"},{"character","hong"}};if(initial!=null){AcceptLegacy(initial);yield return new WaitForSecondsRealtime(.1f);pending=NextLegacy(campaign);}
   while(Active&&generation==epoch){
    double cycleStart=Time.realtimeSinceStartupAsDouble;float sentMove=Move,sentDepth=MoveY;bool sentPaused=Paused,sentAuto=Auto;string payload=pending.ToString(Newtonsoft.Json.Formatting.None);bool success=false;
    // Retry exactly the same session sequence after transport failure; server deduplicates it.
    for(int attempt=0;attempt<3&&!success;attempt++){
     using(var req=new UnityWebRequest(endpoint,"POST")){
      request=req;requests++;try{req.uploadHandler=new UploadHandlerRaw(Encoding.UTF8.GetBytes(payload));req.downloadHandler=new DownloadHandlerBuffer();req.SetRequestHeader("Content-Type","application/json");if(cookie!="")req.SetRequestHeader("Cookie",cookie);req.timeout=15;
      double sentAt=Time.realtimeSinceStartupAsDouble;yield return req.SendWebRequest();if(generation!=epoch)yield break;LastRttMilliseconds=(Time.realtimeSinceStartupAsDouble-sentAt)*1000;
      if(req.result==UnityWebRequest.Result.ConnectionError||req.responseCode>=500){if((string)pending["action"]=="start")break;yield return new WaitForSecondsRealtime(.4f);continue;}
      if(req.result!=UnityWebRequest.Result.Success){
       string error=ReadError(req.downloadHandler.text);Failed?.Invoke(error);
       if((string)pending["action"]!="start"&&(string)pending["action"]!="tick"&&req.responseCode==400&&!error.Contains("세션")&&!error.Contains("다시 입장")&&!error.Contains("다른 창")){success=true;break;}
       Active=false;yield break;
      }
      ReceiveCookie(req.GetResponseHeader("Set-Cookie"));double parseStart=Time.realtimeSinceStartupAsDouble;LastResponseBytes=(long)req.downloadedBytes;
      JObject response=null;try{response=JObject.Parse(req.downloadHandler.text);}catch(Exception e){Failed?.Invoke("서버 응답 오류: "+e.Message);}
      if(response==null||response["id"]==null||response["sequence"]==null){Active=false;yield break;}
      AcceptLegacy(response);double acceptedAt=Time.realtimeSinceStartupAsDouble;LastParseMergeMilliseconds=(acceptedAt-parseStart)*1000;if(LastResponseAt>0)LastResponseIntervalMilliseconds=(acceptedAt-LastResponseAt)*1000;LastResponseAt=acceptedAt;if((string)pending["action"]=="start")FlushCookie();success=true;
     }finally{request=null;}}
    }
    if(!success){Active=false;Failed?.Invoke("전투 연결 중단. 세션을 다시 시작해 주세요.");yield break;}
    if((string)State["status"]=="won"||(string)State["status"]=="dead"){Active=false;yield break;}
    // Rate limit request starts, not response + an extra 100 ms. Still one in flight,
    // identical retry payloads and server sequence deduplication. Input edges wake the wait.
    while(Active&&generation==epoch&&Time.realtimeSinceStartupAsDouble-cycleStart<.1&&commands.Count==0&&Move==sentMove&&MoveY==sentDepth&&Paused==sentPaused&&Auto==sentAuto)yield return null;
    pending=NextLegacy(campaign);
   }
  }
  static string ReadError(string body){try{return JObject.Parse(body).Value<string>("error")??body;}catch{return "요청을 처리하지 못했습니다.";}}
  public void Close(){FlushCookie();CloseLocalStage();epoch++;Active=false;request?.Abort();StopAllCoroutines();request=null;commands.Clear();State=null;Map=null;LastLoot=null;Move=MoveY=0;Paused=false;}
  void OnDestroy(){Close();}
 }
}
