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
  public bool HudCanInput=>HudPage&&!HudPanelOpen&&rpg!=null&&rpg.State!=null&&rpg.Active&&!rpg.Paused&&!rpg.StageBoundaryWaiting&&(bool?)rpg.State["bossIntroActive"]!=true&&(string)rpg.State["phase"]!="boss-loading";
  void OnDestroy(){if(rpgSkin){rpgSkin.font=null;Destroy(rpgSkin);}IslandFonts.ReleaseGuiFont(rpgFont);}
  void InitializeBattleHud(){EnsureCatalog();battleHud=gameObject.AddComponent<IslandBattleHud>();battleHud.Initialize(this);growthView=gameObject.AddComponent<IslandGrowthPanel>();growthView.Initialize(this,battleHud.RuntimeFont);}
  public void HudSkill(int slot){if(HudCanInput)Cast(slot);}
  public void HudAttack(){if(HudCanInput)rpg.Command("tick",new JObject{{campaign?"basic":"attack",true}});}
  public void HudJump(){if(HudCanInput)Jump("upper");}
  public void HudLower(){if(HudCanInput)Jump("lower");}
  public void HudSlide(){if(HudCanInput)rpg.Command("tick",campaign?new JObject{{"dodge",1}}:new JObject{{"slide",true}});}
  // A-2 (quarter pad fix, 2026-11-23): a planar roll goes where the pad points (rpg.Move/MoveY, already turned to world by HudMove) or,
  // with the pad released, where the hero faces. The side view keeps the old +-1 roll.
  public void HudEvade(int direction){
   if(!HudCanInput)return;
   if(HudPlanarMovement&&!campaign){var hero=rpg.State?["hero"];var d=PlanarEvadeDirection(new Vector2(rpg.Move,rpg.MoveY),hero?["direction"],hero?["facing"]);rpg.Command("tick",new JObject{{"dodge",true},{"x",d.x},{"y",d.y}});return;}
   Evade(direction);
  }
  // Same 0.1 threshold as the kernel's input direction (rpg-unity-boss-engine inputDirection).
  public static Vector2 PlanarEvadeDirection(Vector2 worldPad,JToken heroDirection,JToken heroFacing){
   if(worldPad.magnitude>.1f)return worldPad.normalized;
   var o=heroDirection as JObject;var d=o==null?Vector2.zero:new Vector2(NativeCombatPresentation.N(o["x"]),NativeCombatPresentation.N(o["y"]));
   if(d.magnitude>.1f)return d.normalized;
   return new Vector2(heroFacing!=null&&heroFacing.Type!=JTokenType.Null&&NativeCombatPresentation.N(heroFacing,1)<0?-1:1,0);
  }
  public void HudDrink(string kind){if(HudCanInput)Drink(kind);}
  public bool HudPlanarMovement=>rpg!=null&&rpg.PlanarMovement;
  public void HudMove(float direction)=>HudMove(new Vector2(direction,0));
  public void HudMove(Vector2 direction){
   if(rpg==null)return;if(!HudCanInput)direction=Vector2.zero;
   direction=ResolveMove(direction,HudPlanarMovement,battle?battle.CameraRig:null);rpg.Move=direction.x;rpg.MoveY=direction.y;
  }
  // A-1 (quarter pad fix, 2026-11-23): in the quarter view the pad is read on the screen and turned into world X/Z with the quarter
  // preset's target yaw/pitch (not the live camera, so a held stick does not drift while the camera moves). Planar movement under a
  // side camera and the side view keep the old world X/Z input.
  public static Vector2 ResolveMove(Vector2 direction,bool planar,BattleCameraController rig){
   if(!planar)direction.y=0;
   else if(rig&&rig.Mode==ViewMode.QuarterView)direction=ScreenPadToWorld(direction,rig.quarter);
   return Vector2.ClampMagnitude(direction,1);
  }
  // Screen pad (x right, y up) -> world (x, z) = kernel (x, y). The preset's target framing (Euler(pitch, yaw, 0), looking at
  // hero + pivotOffset from `distance`) is a pinhole camera; the hero's ground point is seen through it, and the screen move of a small
  // ground step there is solved backwards (2x2), so pitch foreshortening and the hero sitting off the screen centre are both included.
  // Length (stick strength) is kept.
  public static Vector2 ScreenPadToWorld(Vector2 pad,BattleCameraController.Preset preset){
   float length=pad.magnitude;if(length<1e-5f)return Vector2.zero;
   var inverse=Quaternion.Inverse(Quaternion.Euler(preset.pitch,preset.yaw,0));
   Vector3 hero=inverse*(-preset.pivotOffset)+Vector3.forward*Mathf.Max(.5f,preset.distance);
   Vector3 ex=inverse*Vector3.right,ez=inverse*Vector3.forward;float zz=hero.z*hero.z;
   if(hero.z<.1f)return pad;
   Vector2 a=new Vector2((ex.x*hero.z-hero.x*ex.z)/zz,(ex.y*hero.z-hero.y*ex.z)/zz),b=new Vector2((ez.x*hero.z-hero.x*ez.z)/zz,(ez.y*hero.z-hero.y*ez.z)/zz);
   float det=a.x*b.y-b.x*a.y;if(Mathf.Abs(det)<1e-12f)return pad;
   var s=pad/length;var world=new Vector2((s.x*b.y-b.x*s.y)/det,(a.x*s.y-s.x*a.y)/det);
   return world.normalized*length;
  }
  public void HudCycleView(){if(battle)battle.SetPresentationView(null);}
  public void HudAuto(){if(HudCanInput)rpg.Auto=!rpg.Auto;}
  public void HudMenu(string panel){if(panel=="lobby"){Lobby();return;}if(panel=="tavern"){rpg.Close();battle.Clear();Poker("poker6");return;}if(rpg.ReferencePreview&&panel!=""){notice="연습용 에르텔 · 장비 관리는 일반 사냥에서 이용하세요.";return;}if(rpg.State==null&&panel!="")return;SetPanel(panel);}
  public void HudRetry(){bool preview=rpg.ReferencePreview;SetPanel("");notice="";if(preview)StartReferenceTraining(rpg.ReferenceStartZone);else rpg.Open(CurrentRpgOrigin,campaign);}
  public JObject HudGem(string id){EnsureCatalog();return Gem(id);}
 }
}
