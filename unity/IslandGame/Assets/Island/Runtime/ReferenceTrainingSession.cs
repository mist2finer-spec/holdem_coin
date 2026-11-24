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
   // Test loadout (user 2026-11-23, maintenance/evade-skillbar-20261123): only the strongest of each family. Slot 1 = lightning
   // variant 3 (spark "뇌우": centre + 4 strikes, 4 linked supports), slot 2 = water variant 3 (frostshot "회전 물방울": 16 drops).
   // Slots 5-6 are empty (no gem, not enabled): the HUD shows an empty cell, a press does nothing, AUTO picks from the four.
   // ertel-electric-20261123 (user: both trial skills): slot 3 = lightning ball (lightningball, projectile), slot 4 = arc discharge
   // (arcdischarge, thrown mine), kernel REFERENCE_SKILLS temporary values; no supports.
   // Before: 1-3 water icespear/icenova/frostshot, 4-6 lightning stormcall/arc/spark (0/0/0/0/2/4 supports); then slots 3-6 empty.
   var loadout=new[]{("spark","뇌우",new[]{"echo","elemental","reach","quick"}),("frostshot","회전 물방울",new string[0]),("lightningball","번개 구체",new string[0]),("arcdischarge","아크 방전",new string[0])};
   for(int i=0;i<6;i++){
    if(i>=loadout.Length){skills.Add(new JObject{{"supportIds",new JArray()},{"enabled",false},{"activeId",""},{"trigger",null},{"index",i},{"name",""}});continue;}
    string gem=loadout[i].Item1;string item="practice-"+i;
    var supports=new JArray();foreach(var support in loadout[i].Item3)supports.Add(support);
    skills.Add(new JObject{{"supportIds",supports},{"enabled",true},{"activeId",gem},{"trigger",null},{"index",i},{"name",loadout[i].Item2}});
    var gems=new JArray(gem);var colors=new JArray("white");var links=new JArray();foreach(var support in supports){gems.Add(support.DeepClone());colors.Add("white");links.Add(true);}
    items.Add(new JObject{{"instanceId",item},{"slot",RpgContracts.Slots[i]},{"gems",gems},{"socketColors",colors},{"socketLinks",links}});equipped[RpgContracts.Slots[i]]=item;
   }
   var build=new JObject{{"skills",skills}};
   localMetadata=new JObject{{"build",build},{"buildRevision","elemental-practice-v5"},{"progress",new JObject{{"level",1},{"weaponType","sword"},{"skillEnabled",new JArray(1,1,1,1,0,0)},{"equipment",new JObject{{"items",items},{"equipped",equipped}}}}}};
   localCombat=new StageCombatWorker(localSource,ReferenceBoot(zone,quarter,build).ToString(Newtonsoft.Json.Formatting.None),20);
  }
  // Server-free practice boot. The hero kit key is added only when the local kit asset is present (Battle3DAssets.WithHeroKit).
  public static JObject ReferenceBoot(int zone,bool quarter,JObject build)=>Battle3DAssets.WithRunOptions(Battle3DAssets.WithHeroKit(new JObject{{"mode",quarter?"boss":"mount"},{"previewArena",quarter},{"seed",111},{"referencePreview",true},{"previewZone",Mathf.Clamp(zone,0,9)},{"traversalProfile","source-run-v2"},{"build",build.DeepClone()}}));
 }
 public sealed partial class IslandApp {
  public void StartReferenceTraining(int zone=3,bool quarter=false){
   if(!Debug.isDebugBuild&&!Application.isEditor)return;
   socket.Close();notice="무보상 연습 · 1 번개 / 2 물방울 / 3 번개 구체 / 4 아크 방전 · 메뉴에서 전기 에르텔";campaign=false;page="rpg";rpgPanel="";battle.Clear();battle.enabled=true;rpg.OpenReferenceTraining(zone,quarter);
  }
 }
}
