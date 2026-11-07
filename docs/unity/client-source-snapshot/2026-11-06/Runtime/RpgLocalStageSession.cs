using System;
using System.IO;
using System.Text;
using System.Collections;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Networking;
namespace IslandGame {
 public sealed partial class RpgSession {
  const string StageProtocol="island-stage-v1";
  double rollAutoResumeAt;float lastRollStart=float.NegativeInfinity;
  public bool AutoRecoveryWaiting=>State!=null&&NativeCombatPresentation.N(State["elapsed"])<rollAutoResumeAt;
  public int LocalSnapshotIntervalMilliseconds=>localCombat?.SnapshotIntervalMilliseconds??50;
  StageCombatWorker localCombat;bool localMode,stageRequestBusy,systemPaused;string localSource,kernelHash,runId;JObject localMetadata;int requests;
  public bool UsesLocalStages=>localMode;
  public bool StageBoundaryWaiting {get;private set;}
  public int NetworkRequestCount=>requests;
  public long LocalSteps=>localCombat?.Steps??0;
  public double LocalDroppedSeconds=>localCombat?.DroppedSeconds??0;
  public double LocalMaxBatchMilliseconds=>localCombat?.MaxBatchMilliseconds??0;
  static string Hash(string text){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(text))).Replace("-","").ToLowerInvariant();}
  string OutboxPath=>Path.Combine(Application.persistentDataPath,"stage-result-"+Hash(endpoint+"|"+cookie).Substring(0,24)+".json");
  void OpenLocalStage(int generation){
   var source=Resources.Load<TextAsset>("RogueStageKernel.js");if(!source){Active=false;Failed?.Invoke("로컬 전투 데이터가 없습니다. 앱을 다시 설치해 주세요.");return;}
   localSource=source.text;kernelHash=Hash(localSource);localMode=true;requests=0;StageBoundaryWaiting=false;StartCoroutine(StageStart(generation));
  }
  IEnumerator StageStart(int generation){
   string journal=OutboxPath;
   if(File.Exists(journal)){
    JObject pending=null;try{pending=JObject.Parse(File.ReadAllText(journal));}catch(Exception ex){Active=false;Failed?.Invoke("저장 대기 결과를 읽지 못했습니다: "+ex.Message);yield break;}
    JObject recovered=null;yield return StageHttp(pending,generation,true,r=>recovered=r);
    if(recovered==null||generation!=epoch)yield break;if(recovered.Value<bool?>("accepted")!=true){Active=false;Failed?.Invoke("Saved stage receipt was not accepted.");yield break;}File.Delete(journal);
   }
   JObject response=null;var body=new JObject{{"clientProtocol",StageProtocol},{"action","start"},{"character","hong"},{"requestId",Guid.NewGuid().ToString("N")},{"kernel",kernelHash}};
   yield return StageHttp(body,generation,false,r=>response=r);if(response==null||generation!=epoch)yield break;
   if((string)response["protocol"]!=StageProtocol){
    // Old production servers remain usable, but this is explicitly a legacy compatibility path.
    localMode=false;Failed?.Invoke("이 서버는 아직 기존 사냥 동기화를 사용합니다.");StartCoroutine(Pump(generation,false,response));yield break;
   }
   if((string)response["kernel"]!=kernelHash){Active=false;Failed?.Invoke("전투 규칙이 바뀌었습니다. 앱을 업데이트해 주세요.");yield break;}
   runId=(string)response["stage"]?["runId"];id=runId;localMetadata=(JObject)response["metadata"];localCombat=new StageCombatWorker(localSource,response.ToString(Newtonsoft.Json.Formatting.None));
  }
  void Update(){
   if(!localMode||!Active||localCombat==null)return;
   var error=localCombat.TakeError();if(error!=null){Active=false;Failed?.Invoke("로컬 전투 오류: "+error);return;}
   var json=localCombat.TakeSnapshot();if(!string.IsNullOrEmpty(json)){
    var next=JObject.Parse(json);if(next["map"] is JObject map)Map=(JObject)map.DeepClone();
    // Move immutable metadata between snapshots. Never deep-copy the 780-node tree every 50 ms.
    foreach(var key in new[]{"progress","development","growth","build","buildRevision"}){
     JToken value=State?[key];if(value!=null){State[key]=JValue.CreateNull();next[key]=value;}else if(localMetadata?[key]!=null)next[key]=localMetadata[key].DeepClone();
    }
    next["id"]=runId;next["sequence"]=++sequence;State=next;
    if(next["stageBoundary"] is JObject claim&&!StageBoundaryWaiting){StageBoundaryWaiting=true;State["paused"]=true;StartCoroutine(SettleStage((JObject)claim.DeepClone(),epoch));}
   }
   if(StageBoundaryWaiting||stageRequestBusy){if(State!=null)State["paused"]=true;return;}
   // Let automatic hunting finish the longer roll recovery. Explicit queued commands stay immediate.
   var movement=State?["hero"]?["motion"] as JObject;
   if((string)movement?["kind"]=="dodge"){
    float began=NativeCombatPresentation.N(movement["start"]);if(began!=lastRollStart){lastRollStart=began;rollAutoResumeAt=began+NativeHeroRollPresentation.Duration;}
   }else if(movement!=null)rollAutoResumeAt=0;
   var input=new JObject{{"x",Paused||systemPaused?0:Move},{"y",0},{"auto",Auto&&!Paused&&!systemPaused&&!AutoRecoveryWaiting},{"paused",Paused||systemPaused}};
   localCombat.Submit(systemPaused?0:Time.unscaledDeltaTime,input.ToString(Newtonsoft.Json.Formatting.None));
  }
  void OnApplicationPause(bool paused){systemPaused=paused;}
  IEnumerator SettleStage(JObject claim,int generation){
   var body=new JObject{{"clientProtocol",StageProtocol},{"action","stage-settle"},{"claim",claim}};string journal=OutboxPath;
   try{Directory.CreateDirectory(Application.persistentDataPath);var temporary=journal+".tmp";File.WriteAllText(temporary,body.ToString(Newtonsoft.Json.Formatting.None));if(File.Exists(journal))File.Replace(temporary,journal,null);else File.Move(temporary,journal);}catch(Exception ex){Active=false;Failed?.Invoke("구역 결과를 보관하지 못했습니다: "+ex.Message);yield break;}
   Failed?.Invoke("구역 결과를 저장하는 중입니다. 연결이 복구되면 이어집니다.");JObject response=null;
   yield return StageHttp(body,generation,true,r=>response=r);if(response==null||generation!=epoch)yield break;
   if(response.Value<bool?>("accepted")!=true){Active=false;Failed?.Invoke("구역 결과를 확인하지 못했습니다.");yield break;}
   if(File.Exists(journal))File.Delete(journal);ApplyLocalMetadata(response);
   if((string)response["kernel"]!=kernelHash){Active=false;Failed?.Invoke("보상은 저장됐습니다. 앱 업데이트 후 다시 입장해 주세요.");yield break;}
   if(response["stage"] is JObject){localCombat.Profile(response.ToString(Newtonsoft.Json.Formatting.None),true);StageBoundaryWaiting=false;State["paused"]=Paused;Failed?.Invoke("");}
   else {Active=false;StageBoundaryWaiting=false;Failed?.Invoke("");}
  }
  void LocalCommand(string action,JObject input){
   if(action=="tick"){if(!StageBoundaryWaiting&&!stageRequestBusy)localCombat?.Command((input??new JObject()).ToString(Newtonsoft.Json.Formatting.None));return;}
   if(StageBoundaryWaiting||stageRequestBusy||localCombat==null){Failed?.Invoke("저장 중인 요청을 확인한 뒤 다시 시도해 주세요.");return;}
   stageRequestBusy=true;StartCoroutine(LocalProfileCommand(action,epoch));
  }
  IEnumerator LocalProfileCommand(string action,int generation){
   JObject response=null;var body=new JObject{{"clientProtocol",StageProtocol},{"action","stage-action"},{"requestId",Guid.NewGuid().ToString("N")},{"runId",runId},{"command",action}};
   yield return StageHttp(body,generation,false,r=>response=r);if(generation!=epoch)yield break;stageRequestBusy=false;
   if(response!=null){if((string)response["kernel"]!=kernelHash){Active=false;Failed?.Invoke("Combat rules changed. Update the app before entering again.");yield break;}ApplyLocalMetadata(response);localCombat.Profile(response.ToString(Newtonsoft.Json.Formatting.None),false);if(State!=null)State["paused"]=Paused;}
  }
  void ApplyLocalMetadata(JObject response){
   localMetadata=response["metadata"] as JObject;if(localMetadata==null)return;
   if(State!=null)foreach(var p in localMetadata.Properties())State[p.Name]=p.Value.DeepClone();if(localMetadata["loot"] is JArray loot)LastLoot=(JArray)loot.DeepClone();
  }
  IEnumerator StageHttp(JObject body,int generation,bool retryUntilConnected,Action<JObject> completed){
   string payload=body.ToString(Newtonsoft.Json.Formatting.None);int attempt=0;
   while(generation==epoch&&Active){
    using(var req=new UnityWebRequest(endpoint,"POST")){
     request=req;requests++;req.uploadHandler=new UploadHandlerRaw(Encoding.UTF8.GetBytes(payload));req.downloadHandler=new DownloadHandlerBuffer();req.SetRequestHeader("Content-Type","application/json");if(cookie!="")req.SetRequestHeader("Cookie",cookie);req.timeout=15;
     yield return req.SendWebRequest();if(generation!=epoch)yield break;request=null;
     if(req.result==UnityWebRequest.Result.Success){
      var header=req.GetResponseHeader("Set-Cookie");if(!string.IsNullOrEmpty(header)){cookie=header.Split(';')[0];PlayerPrefs.SetString("island-rpg-cookie",cookie);PlayerPrefs.Save();}
      JObject response=null;try{response=JObject.Parse(req.downloadHandler.text);}catch(Exception ex){Failed?.Invoke("서버 응답 오류: "+ex.Message);}
      if(response==null)Active=false;completed(response);yield break;
     }
     bool network=req.result==UnityWebRequest.Result.ConnectionError||req.responseCode>=500||req.responseCode==408||req.responseCode==429;
     if(!network){
      // Keep rejected receipts for diagnosis, but do not block every future entry on the same invalid result.
      if((string)body["action"]=="stage-settle"&&File.Exists(OutboxPath))File.Move(OutboxPath,OutboxPath+".rejected-"+DateTime.UtcNow.Ticks);
      if((string)body["action"]!="stage-action")Active=false;Failed?.Invoke(ReadError(req.downloadHandler.text));completed(null);yield break;
     }
    }
    attempt++;if(!retryUntilConnected&&attempt>=3){Active=false;Failed?.Invoke("서버에 연결하지 못했습니다. 다시 입장해 주세요.");completed(null);yield break;}
    yield return new WaitForSecondsRealtime(Mathf.Min(30,Mathf.Pow(2,Mathf.Min(5,attempt-1))));
   }
  }
  void CloseLocalStage(){rollAutoResumeAt=0;lastRollStart=float.NegativeInfinity;localCombat?.Dispose();localCombat=null;localMode=false;stageRequestBusy=false;StageBoundaryWaiting=false;localMetadata=null;localSource=null;}
 }
}
