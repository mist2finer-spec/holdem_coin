using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 public sealed partial class RpgSession {
  public bool ReferencePreview {get;private set;}
  public int ReferenceStartZone {get;private set;}=3;
  // Explicit, ephemeral training loadout. No account request, inventory write or reward.
  public void OpenReferenceTraining(int zone=3,bool quarter=false){
   if(!Debug.isDebugBuild&&!Application.isEditor)return;
   Close();ReferencePreview=true;ReferenceStartZone=zone;mountSundayPreview=!quarter;unityBossPreview=true;Auto=true;Paused=false;Active=true;
   localTraining=localMode=true;localSource=Resources.Load<TextAsset>("TrainingCombatKernel.js").text;
   runId=id="reference-practice";var skills=new JArray();var items=new JArray();var equipped=new JObject();
   for(int i=0;i<6;i++){
    string gem=new[]{"icespear","icenova","frostshot","stormcall","arc","spark"}[i];string item="practice-"+i;
    var supports=i<4?new JArray():i==4?new JArray("echo","elemental"):new JArray("echo","elemental","reach","quick");
    skills.Add(new JObject{{"supportIds",supports},{"enabled",true},{"activeId",gem},{"trigger",null},{"index",i},{"name",new[]{"원형 물방울","이중 물결","회전 물방울","낙뢰","연쇄 번개","뇌우"}[i]}});
    var gems=new JArray(gem);var colors=new JArray("white");var links=new JArray();foreach(var support in supports){gems.Add(support.DeepClone());colors.Add("white");links.Add(true);}
    items.Add(new JObject{{"instanceId",item},{"slot",RpgContracts.Slots[i]},{"gems",gems},{"socketColors",colors},{"socketLinks",links}});equipped[RpgContracts.Slots[i]]=item;
   }
   var build=new JObject{{"skills",skills}};
   localMetadata=new JObject{{"build",build},{"buildRevision","elemental-practice-v3"},{"progress",new JObject{{"level",1},{"weaponType","sword"},{"skillEnabled",new JArray(1,1,1,1,1,1)},{"equipment",new JObject{{"items",items},{"equipped",equipped}}}}}};
   var boot=new JObject{{"mode",quarter?"boss":"mount"},{"previewArena",quarter},{"seed",111},{"referencePreview",true},{"previewZone",Mathf.Clamp(zone,0,9)},{"traversalProfile","source-run-v2"},{"build",build.DeepClone()}};
   localCombat=new StageCombatWorker(localSource,boot.ToString(Newtonsoft.Json.Formatting.None),20);
  }
 }
 public sealed partial class IslandApp {
  public void StartReferenceTraining(int zone=3,bool quarter=false){
   if(!Debug.isDebugBuild&&!Application.isEditor)return;
   socket.Close();notice="무보상 연습 · 1~3 물방울 / 4~6 번개";campaign=false;page="rpg";rpgPanel="";battle.Clear();battle.enabled=true;rpg.OpenReferenceTraining(zone,quarter);
  }
 }
}
