using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 public sealed partial class IslandApp {
  IslandBattleHud battleHud;IslandGrowthPanel growthView;
  public bool HudGrowthOpen=>page=="rpg"&&rpgPanel=="growth"&&rpg!=null&&rpg.State!=null;
  public JObject GrowthCatalog {get{EnsureCatalog();return catalog;}}
  public string GrowthNodeName(JObject node)=>displayNames.NodeName(node);
  public void GrowthCommand(string action){if(HudGrowthOpen&&rpg.Active){notice="";rpg.Command(action);}}
  public RpgSession HudSession=>rpg;
  public NativeBattle HudBattle=>battle;
  public bool HudCampaign=>campaign;
  public bool HudPage=>page=="rpg"&&!campaign;
  public bool HudPanelOpen=>rpgPanel!="";
  public string HudNotice=>notice;
  public bool BattleHudEnabled=>battleHud&&battleHud.enabled;
  public bool HudCanInput=>HudPage&&!HudPanelOpen&&rpg!=null&&rpg.State!=null&&rpg.Active&&!rpg.Paused&&!rpg.StageBoundaryWaiting;
  void OnDestroy(){if(rpgSkin){rpgSkin.font=null;Destroy(rpgSkin);}IslandFonts.ReleaseGuiFont(rpgFont);}
  void InitializeBattleHud(){EnsureCatalog();battleHud=gameObject.AddComponent<IslandBattleHud>();battleHud.Initialize(this);growthView=gameObject.AddComponent<IslandGrowthPanel>();growthView.Initialize(this,battleHud.RuntimeFont);}
  public void HudSkill(int slot){if(HudCanInput)Cast(slot);}
  public void HudAttack(){if(HudCanInput)rpg.Command("tick",new JObject{{campaign?"basic":"attack",true}});}
  public void HudJump(){if(HudCanInput)Jump("upper");}
  public void HudLower(){if(HudCanInput)Jump("lower");}
  public void HudSlide(){if(HudCanInput)rpg.Command("tick",campaign?new JObject{{"dodge",1}}:new JObject{{"slide",true}});}
  public void HudEvade(int direction){if(HudCanInput)Evade(direction);}
  public void HudDrink(string kind){if(HudCanInput)Drink(kind);}
  public void HudMove(float direction){if(rpg!=null)rpg.Move=HudCanInput?direction:0;}
  public void HudAuto(){if(HudCanInput)rpg.Auto=!rpg.Auto;}
  public void HudMenu(string panel){if(panel=="lobby"){Lobby();return;}if(panel=="tavern"){rpg.Close();battle.Clear();Poker("poker6");return;}if(rpg.State==null&&panel!="")return;SetPanel(panel);}
  public void HudRetry(){SetPanel("");notice="";rpg.Open(server,campaign);}
  public JObject HudGem(string id){EnsureCatalog();return Gem(id);}
 }
}
