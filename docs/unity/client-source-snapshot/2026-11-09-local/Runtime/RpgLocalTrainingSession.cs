using System;
using System.Collections;
using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 public sealed partial class RpgSession {
  bool localTraining;
  int trainingServerSequence;
  Battle3DView trainingView;
  public bool UsesLocalTraining=>localTraining;
  void OpenLocalTraining(int generation){
   var source=Resources.Load<TextAsset>("TrainingCombatKernel.js");
   if(!source){Active=false;Failed?.Invoke("로컬 전투 데이터가 없습니다. 앱을 업데이트해 주세요.");return;}
   localSource=source.text;localMode=true;localTraining=true;trainingServerSequence=0;
   StartCoroutine(TrainingStart(generation));
  }
  IEnumerator TrainingStart(int generation){
   // Training has no permanent combat rewards. Keep account/loadout authority online,
   // then run the bundled rules without combat HTTP. Never fall back to server ticks.
   JObject response=null;
   yield return StageHttp(new JObject{{"action","start"},{"character","hong"}},generation,false,r=>response=r);
   if(response==null||generation!=epoch)yield break;
   if((bool?)response["training"]!=true||response["id"]==null){Active=false;Failed?.Invoke("로컬 훈련 입장 응답을 확인하지 못했습니다.");yield break;}
   runId=(string)response["id"];id=runId;trainingServerSequence=(int?)response["sequence"]??0;
   SetTrainingMetadata(response);
   var boot=new JObject{{"mode",mountSundayPreview?"mount":"boss"},{"seed",111},{"build",response["build"]?.DeepClone()}};
   localCombat=new StageCombatWorker(localSource,boot.ToString(Newtonsoft.Json.Formatting.None),20);
  }
  void SetTrainingMetadata(JObject response){
   localMetadata=new JObject();
   foreach(var key in new[]{"progress","development","growth","build","buildRevision","compiled"})if(response[key]!=null)localMetadata[key]=response[key].DeepClone();
   if(State!=null)foreach(var p in localMetadata.Properties())State[p.Name]=p.Value.DeepClone();
   if(response["loot"] is JArray loot)LastLoot=(JArray)loot.DeepClone();
  }
  void UpdateLocalTraining(){
   var error=localCombat.TakeError();if(error!=null){Active=false;localCombat.Dispose();Failed?.Invoke("로컬 전투 오류: "+error);return;}
   var json=localCombat.TakeSnapshot();
   if(!string.IsNullOrEmpty(json)){
    var next=JObject.Parse(json);if(next["map"] is JObject map){Map=map;next.Remove("map");}
    foreach(var key in new[]{"progress","development","growth","build","buildRevision","compiled"}){
     var value=State?[key];if(value!=null){State[key]=JValue.CreateNull();next[key]=value;}
     else if(localMetadata?[key]!=null)next[key]=localMetadata[key].DeepClone();
    }
    next["id"]=runId;State=next;
    if((string)next["status"]=="won"||(string)next["status"]=="dead"){Active=false;localCombat.Dispose();return;}
   }
   bool paused=Paused||systemPaused||stageRequestBusy;
   var input=new JObject{{"x",paused?0:Move},{"y",paused||!PlanarMovement?0:MoveY},{"auto",Auto&&!paused},{"paused",paused}};
   if(mountSundayPreview){
    input["readyZone"]=MountZoneStream.Current?MountZoneStream.Current.ReadyZone:-1;
    if((string)State?["routeStage"]=="boss"){
     if(!trainingView)trainingView=FindFirstObjectByType<Battle3DView>();
     input["readyBoss"]=trainingView&&trainingView.BossEnvironmentReady;
    }
   }
   localCombat.Submit(systemPaused?0:Time.unscaledDeltaTime,input.ToString(Newtonsoft.Json.Formatting.None));
  }
  void TrainingCommand(string action,JObject input){
   if(systemPaused||stageRequestBusy||localCombat==null)return;
   if(action=="tick"){if(Paused)return;localCombat.Command((input??new JObject()).ToString(Newtonsoft.Json.Formatting.None));return;}
   stageRequestBusy=true;StartCoroutine(TrainingProfileCommand(action,epoch));
  }
  IEnumerator TrainingProfileCommand(string action,int generation){
   JObject response=null;
   var body=new JObject{{"action",action},{"id",runId},{"sequence",trainingServerSequence+1},{"input",new JObject{{"x",0},{"y",0},{"auto",false},{"paused",true}}}};
   yield return StageHttp(body,generation,false,r=>response=r,true);if(generation!=epoch)yield break;
   stageRequestBusy=false;
   if(response==null)yield break;
   trainingServerSequence=(int)response["sequence"];SetTrainingMetadata(response);
   localCombat.Profile(response.ToString(Newtonsoft.Json.Formatting.None),false);
  }
 }
}
