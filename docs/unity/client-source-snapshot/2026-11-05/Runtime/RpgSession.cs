using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 public sealed partial class RpgSession : MonoBehaviour {
  public JObject State,Map;public JArray LastLoot;public bool Active,Auto=true,Paused;public float Move;public event Action<string> Failed;
  string endpoint,id,cookie;int sequence,epoch;readonly Queue<JObject> commands=new Queue<JObject>();UnityWebRequest request;
  public void Open(string origin,bool campaign){Close();endpoint=origin.TrimEnd('/')+(campaign?"/api/rpg/session":"/api/rpg/rogue");cookie=PlayerPrefs.GetString("island-rpg-cookie","");Auto=true;Paused=false;Active=true;requests=0;if(campaign)StartCoroutine(Pump(epoch,true));else OpenLocalStage(epoch);}
  public void Command(string action,JObject input=null){if(!Active){Failed?.Invoke("다시 입장한 후 명령을 실행하세요.");return;}if(localMode){LocalCommand(action,input);return;}if(commands.Count<8)commands.Enqueue(new JObject{{"action",action},{"input",input??new JObject()}});}
  public void ClearInput(){commands.Clear();Move=0;}
  void AcceptLegacy(JObject response){if(response["loot"] is JArray loot)LastLoot=(JArray)loot.DeepClone();State=RpgContracts.MergeSnapshot(State,response);id=State.Value<string>("id");sequence=State.Value<int>("sequence");if(State["map"]!=null)Map=(JObject)State["map"].DeepClone();}
  JObject NextLegacy(bool campaign){
   var cmd=commands.Count>0?commands.Dequeue():new JObject{{"action","tick"},{"input",new JObject()}};
   var input=campaign?new JObject{{"move",Paused?0:Move},{"attack",false},{"auto",Auto&&!Paused}}:new JObject{{"x",Paused?0:Move},{"y",0},{"auto",Auto&&!Paused},{"paused",Paused}};
   input.Merge(cmd["input"]);return new JObject{{"action",cmd["action"]},{"id",id},{"sequence",sequence+1},{"knownBuildRevision",State["buildRevision"]?.DeepClone()},{"input",input}};
  }
  IEnumerator Pump(int generation,bool campaign,JObject initial=null){
   JObject pending=new JObject{{"action","start"},{"character","hong"}};if(initial!=null){AcceptLegacy(initial);yield return new WaitForSecondsRealtime(.1f);pending=NextLegacy(campaign);}
   while(Active&&generation==epoch){
    string payload=pending.ToString(Newtonsoft.Json.Formatting.None);bool success=false;
    // Retry exactly the same session sequence after transport failure; server deduplicates it.
    for(int attempt=0;attempt<3&&!success;attempt++){
     using(var req=new UnityWebRequest(endpoint,"POST")){
      request=req;requests++;try{req.uploadHandler=new UploadHandlerRaw(Encoding.UTF8.GetBytes(payload));req.downloadHandler=new DownloadHandlerBuffer();req.SetRequestHeader("Content-Type","application/json");if(cookie!="")req.SetRequestHeader("Cookie",cookie);req.timeout=15;
      yield return req.SendWebRequest();if(generation!=epoch)yield break;
      if(req.result==UnityWebRequest.Result.ConnectionError||req.responseCode>=500){if((string)pending["action"]=="start")break;yield return new WaitForSecondsRealtime(.4f);continue;}
      if(req.result!=UnityWebRequest.Result.Success){
       string error=ReadError(req.downloadHandler.text);Failed?.Invoke(error);
       if((string)pending["action"]!="start"&&(string)pending["action"]!="tick"&&req.responseCode==400&&!error.Contains("세션")&&!error.Contains("다시 입장")&&!error.Contains("다른 창")){success=true;break;}
       Active=false;yield break;
      }
      var header=req.GetResponseHeader("Set-Cookie");if(!string.IsNullOrEmpty(header)){cookie=header.Split(';')[0];PlayerPrefs.SetString("island-rpg-cookie",cookie);PlayerPrefs.Save();}
      JObject response=null;try{response=JObject.Parse(req.downloadHandler.text);}catch(Exception e){Failed?.Invoke("서버 응답 오류: "+e.Message);}
      if(response==null||response["id"]==null||response["sequence"]==null){Active=false;yield break;}
      AcceptLegacy(response);success=true;
     }finally{request=null;}}
    }
    if(!success){Active=false;Failed?.Invoke("전투 연결 중단. 세션을 다시 시작해 주세요.");yield break;}
    if((string)State["status"]=="won"||(string)State["status"]=="dead"){Active=false;yield break;}
    yield return new WaitForSecondsRealtime(.1f);
    pending=NextLegacy(campaign);
   }
  }
  static string ReadError(string body){try{return JObject.Parse(body).Value<string>("error")??body;}catch{return "요청을 처리하지 못했습니다.";}}
  public void Close(){CloseLocalStage();epoch++;Active=false;request?.Abort();StopAllCoroutines();request=null;commands.Clear();State=null;Map=null;LastLoot=null;Move=0;Paused=false;}
  void OnDestroy(){Close();}
 }
}
