using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 public sealed partial class RpgSession {
  public bool ReferencePreview {get;private set;}
  // Explicit, ephemeral training loadout. No account request, inventory write or reward.
  public void OpenReferenceTraining(int zone=3,bool quarter=false){
   if(!Debug.isDebugBuild&&!Application.isEditor)return;
   Close();ReferencePreview=true;mountSundayPreview=!quarter;unityBossPreview=true;Auto=true;Paused=false;Active=true;
   localTraining=localMode=true;localSource=Resources.Load<TextAsset>("TrainingCombatKernel.js").text;
   runId=id="reference-practice";var skills=new JArray();var items=new JArray();var equipped=new JObject();
   for(int i=0;i<6;i++){
    string gem=i==0?"cleave":i==1?"stormcall":"";string item="practice-"+i;
    skills.Add(new JObject{{"enabled",i<2},{"activeId",gem},{"trigger",null},{"index",i},{"name",i==0?"쪼개기":i==1?"폭풍 부름":""}});
    items.Add(new JObject{{"instanceId",item},{"slot",RpgContracts.Slots[i]},{"gems",new JArray(gem)},{"socketColors",new JArray("white")}});equipped[RpgContracts.Slots[i]]=item;
   }
   var build=new JObject{{"skills",skills}};
   localMetadata=new JObject{{"build",build},{"buildRevision","reference-practice-v1"},{"progress",new JObject{{"level",1},{"weaponType","sword"},{"skillEnabled",new JArray(1,1,0,0,0,0)},{"equipment",new JObject{{"items",items},{"equipped",equipped}}}}}};
   var boot=new JObject{{"mode",quarter?"boss":"mount"},{"previewArena",quarter},{"seed",111},{"referencePreview",true},{"previewZone",Mathf.Clamp(zone,0,9)},{"traversalProfile","source-run-v2"},{"build",build.DeepClone()}};
   localCombat=new StageCombatWorker(localSource,boot.ToString(Newtonsoft.Json.Formatting.None),20);
  }
 }
 public sealed partial class IslandApp {
  public void StartReferenceTraining(int zone=3,bool quarter=false){
   if(!Debug.isDebugBuild&&!Application.isEditor)return;
   socket.Close();notice="무보상 연습 · 1 쪼개기 / 2 폭풍 부름";campaign=false;page="rpg";rpgPanel="";battle.Clear();battle.enabled=true;rpg.OpenReferenceTraining(zone,quarter);
  }
 }
}
