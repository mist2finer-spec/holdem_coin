using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 public sealed partial class IslandApp {
  BossTrials.BossTrialController bossTrials;
  string trialReturnPage,trialReturnPanel;
  bool trialReturnCampaign,trialReturnActive,trialReturnAuto;
  public bool BossTrialsVisible=>bossTrials&&bossTrials.Visible;
  public bool HudDungeonOpen=>HudPage&&rpgPanel=="dungeon";
  public void OpenBossTrials(){
   if(BossTrialsVisible)return;
   trialReturnPage=page;trialReturnPanel=rpgPanel;trialReturnCampaign=campaign;
   trialReturnActive=rpg!=null&&rpg.Active;trialReturnAuto=rpg!=null&&rpg.Auto;
   var snapshot=rpg?.State==null?null:(JObject)rpg.State.DeepClone();
   socket?.Close();online=false;rpg?.Close();battle?.Clear();page="bossTrials";notice="";
   if(battleHud)battleHud.HideForBossTrials();sound?.SuspendForTrial();
   if(!bossTrials){bossTrials=gameObject.AddComponent<BossTrials.BossTrialController>();bossTrials.Returned+=ReturnFromBossTrials;}
   bossTrials.OpenMenu(snapshot);
  }
  void ReturnFromBossTrials(){
   notice="";campaign=trialReturnCampaign;page=trialReturnPage??"lobby";
   rpgPanel=trialReturnPanel??"";sound?.ResumeAfterTrial();
   if(page=="rpg"||page=="growth"){
    if(trialReturnActive)rpg.Open(server,campaign);
    rpg.Auto=trialReturnAuto;rpg.Paused=page=="growth"||rpgPanel!="";rpg.Move=0;rpg.ClearInput();
    // The old network epoch is closed. A resumed hunt opens a fresh server session;
    // no local trial progress or rewards are copied into it.
   }else Lobby();
  }
 }
}
