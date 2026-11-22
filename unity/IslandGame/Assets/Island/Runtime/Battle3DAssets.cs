using UnityEngine;
using Newtonsoft.Json.Linq;

namespace IslandGame {
 [CreateAssetMenu(menuName="Island/Battle 3D Assets")]
 public sealed class Battle3DAssets : ScriptableObject {
  public GameObject hero, slime;
  public Material heroMaterial, slimeMaterial;
  public AnimationClip idle, run, walk, jumpStart, jumpLoop, jumpLand, roll, slide, death, hit;
  public AnimationClip attack1, attack2, attack3, combo, heavy, dash, spell, slimeIdle;
  public float heroHeight=1.3f, slimeHeight=.62f;
  public float heroYaw=90;
  [Header("Optional hero kit (empty = the original hero)")]
  // Kernel kit id sent in the boot JSON ("pink-iai"). Only a kit asset found under KitResource sets it.
  public string kit;
  // Keep the model's own materials (cel + outline slots) instead of heroMaterial.
  public bool keepModelMaterials;
  // Metres of one run-clip cycle. 0 = the original rule (3.8 m per clip second).
  public float runStrideMeters;
  // Blade bone of the model (tip/guard in its local space) used for the blade trail.
  public string bladeBone;public Vector3 bladeTipLocal, bladeGuardLocal;
  // Bone whose height (root space, idle pose) is the model height. Empty = skinned bounds.
  public string heightBone;
  public AnimationClip iai1, iai2, iai3, iaiRecover, iaiRecoverFrom1, iaiRecoverFrom2, skill, avoid, knockback;
  // Clips that keep their feet on the ground by the lowest bone (body clips, kernel owns height and travel).
  public AnimationClip[] groundedClips;
  public bool IsKit=>!string.IsNullOrEmpty(kit);
  public bool KitComplete=>IsKit&&hero&&slime&&slimeIdle&&idle&&run&&iai1&&iai2&&iai3&&iaiRecover&&skill;

  // Loading. Tracked code reaches the local-only kit by this resource path string only.
  public const string DefaultResource="Battle3DAssets",KitResource="IslandRev2Port/Battle3DAssets";
  public static string KitResourcePath=KitResource; // test hook: point at a missing name to see the fallback
  public static Battle3DAssets LoadKit(){var k=Resources.Load<Battle3DAssets>(KitResourcePath);return k&&k.KitComplete?k:null;}
  public static Battle3DAssets LoadDefault()=>Resources.Load<Battle3DAssets>(DefaultResource);
  public static Battle3DAssets LoadForBattle()=>LoadKit()??LoadDefault();
  // The one helper both boot builders use: the kit id when the kit asset is present, else null (no key).
  public static string HeroKitBootId(){var k=LoadKit();return k?k.kit:null;}
  // boss-kit-hero-20261121: the boss mode and the zone-10 boss take the kit hero too. The old hero of the boss fight is kept behind
  // one option (event maps later): BossHeroOverride="legacy" from code, or the dev pref island.dev.bossHero="legacy" (Editor /
  // development build). Then the boot carries bossHero:"legacy" and the boss mode carries no heroKit (kernel: the pre-kit boss).
  public const string DevBossHeroKey="island.dev.bossHero";
  public static string BossHeroOverride;
  public static bool BossHeroLegacy=>BossHeroOverride=="legacy"||BossHeroOverride==null&&DevControls&&PlayerPrefs.GetString(DevBossHeroKey,"")=="legacy";
  public static JObject WithHeroKit(JObject boot){if(boot==null)return boot;var mode=(string)boot["mode"];if(mode!="mount"&&mode!="boss")return boot;var id=HeroKitBootId();if(string.IsNullOrEmpty(id))return boot;
   if(BossHeroLegacy){boot["bossHero"]="legacy";if(mode=="boss")return boot;}boot["heroKit"]=id;return boot;}
  // Run options for both boot builders, called after WithHeroKit (U0). AUTO also casts the skill slots, left first (K1), in mount and boss modes.
  // A development build may carry the kit tempo stage chosen on the HUD (K6, 0/1/2); no choice = no key = the kernel default.
  // Forks stay off until U1 (same build as the MountZoneStream nextZone change).
  public const string DevKitTempoKey="island.dev.kitTempo";
  public static bool DevControls=>Debug.isDebugBuild||Application.isEditor;
  public static int DevKitTempo{
   get=>DevControls&&PlayerPrefs.HasKey(DevKitTempoKey)?PlayerPrefs.GetInt(DevKitTempoKey):-1;
   set{if(value<0)PlayerPrefs.DeleteKey(DevKitTempoKey);else PlayerPrefs.SetInt(DevKitTempoKey,value);PlayerPrefs.Save();}
  }
  public static JObject WithRunOptions(JObject boot){if(boot==null)return boot;boot["autoSkills"]=true;int tempo=DevKitTempo;if(tempo>=0&&boot["heroKit"]!=null)boot["kitTempo"]=tempo;return boot;}

  public bool Loops(AnimationClip c)=>c&&(c==idle||c==run||c==walk||c==jumpLoop||c==slide);
  public bool Grounded(AnimationClip c){if(!c||groundedClips==null)return false;foreach(var g in groundedClips)if(g==c)return true;return false;}
  public AnimationClip HeroClip(string action,string after=null) {
   if(IsKit)return KitClip(action,after);
   if(string.IsNullOrEmpty(action))return idle;
   if(action.StartsWith("attack")) {
    if(action=="attack2")return attack2;
    if(action=="attack3")return attack3;
    if(action=="attack4")return heavy;
    if(action=="attack5")return combo;
    return attack1;
   }
   if(action=="walk")return walk?walk:run;
   if(action.StartsWith("run"))return run;
   if(action.StartsWith("jump"))return action=="jump1"?jumpStart:action=="jump5"?jumpLand:jumpLoop;
   if(action.StartsWith("sliding"))return slide;
   if(action.StartsWith("avoid")||action.StartsWith("dodge"))return roll;
   if(action=="dash"||action=="rush")return dash?dash:run;
   if(action=="skill1")return heavy?heavy:attack3;
   if(action.StartsWith("skill"))return spell;
   if(action.StartsWith("death")||action.StartsWith("die"))return death;
   if(action.StartsWith("defeat")||action.StartsWith("damage"))return hit;
   return idle;
  }
  // Kernel kit action names (KERNEL_KIT_CONTRACT §2). Every clip is baked 1:1 with kernel time.
  AnimationClip KitClip(string action,string after){
   if(string.IsNullOrEmpty(action)||action.StartsWith("stay"))return idle;
   if(action=="iai1")return iai1;if(action=="iai2")return iai2;if(action=="iai3")return iai3;
   if(action=="iai_recover")return after=="iai1"&&iaiRecoverFrom1?iaiRecoverFrom1:after=="iai2"&&iaiRecoverFrom2?iaiRecoverFrom2:iaiRecover;
   if(action.StartsWith("run"))return run;
   if(action=="walk")return walk?walk:run;
   if(action=="dash"||action=="rush")return dash?dash:run;
   if(action.StartsWith("skill"))return skill;
   if(action.StartsWith("avoid")||action.StartsWith("dodge"))return avoid?avoid:run;
   if(action.StartsWith("jump"))return action=="jump1"?jumpStart:action=="jump5"?jumpLand:jumpLoop;
   if(action.StartsWith("sliding"))return slide;
   if(action=="knockback"||action=="knockdown"||action=="getup")return knockback?knockback:hit;
   if(action.StartsWith("death")||action.StartsWith("die"))return death;
   if(action.StartsWith("defeat")||action.StartsWith("damage"))return hit;
   if(action.StartsWith("attack"))return iai1;
   return idle;
  }
 }
}
