using UnityEngine;
namespace IslandGame {
 [CreateAssetMenu(menuName="Island/Combat view presentation profile")]
 public sealed class CombatViewPresentationProfile:ScriptableObject {
  public bool limitedAttackPoses;
  [Range(0,1)] public float poseEmphasis=1;
  [Range(0,.08f)] public float silhouetteExaggeration=.035f;
  [Range(0,.2f)] public float flashSeconds=.12f;
  [Range(0,1)] public float flashStrength=.6f,soundVolume=.16f;
  // Hit flash target colour (the hit body tints toward it by flashStrength). Above 1 = brighter than the base colour (HDR).
  [ColorUsage(false,true)] public Color flashColor=new Color(1,.85f,.7f,1);
  // Camera shake (offset + FOV punch) is off by default (user, 2026-11-22: only certain monster skills or the boss later).
  // It runs only when shakeEnabled is on AND the hit source is listed in shakeAllowSources (see CombatShakeGate for the keys).
  // shakeMeters / fovPunchDegrees keep the old amounts for the sources that are allowed.
  public bool shakeEnabled;
  public string[] shakeAllowSources=new string[0];
  [Range(0,.08f)] public float shakeMeters=.035f;
  [Range(0,1)] public float fovPunchDegrees=.45f;
  [Range(0,.2f)] public float smearSeconds=.09f;
  [Range(0,.2f)] public float smearWidth=.10f;
  [Range(0,1)] public float smearOpacity=.32f;
  [Range(0,.2f)] public float importantSkillBackgroundDimming;
  public bool depthOfField; // Both initial presets keep the combat field sharp.
 }
 // Hit source keys for the camera shake allow list (built from the kernel damage fx, CombatFeedbackRouter.ShakeSource):
 //   hero:<definitionId or damageKind>  the hero hit a mob or the boss   (e.g. hero:pink-iai-1, hero:skill)
 //   hero:lightning                       the lightning skill strike
 //   boss:<definitionId or kind>          the boss hit the hero           (boss:hook = hook arms, boss:blast = warning disc explosion)
 //   mob:<definitionId or damageKind>     a normal monster hit the hero   (a monster skill with a definitionId: mob:<that id>)
 // An entry matches exactly, or as a prefix when it ends with * ("boss:*"); "*" allows every source.
 public static class CombatShakeGate {
  public static bool Allows(bool enabled,string[] allow,string source){
   if(!enabled||allow==null||string.IsNullOrEmpty(source))return false;
   foreach(var a in allow){if(string.IsNullOrEmpty(a))continue;if(a=="*"||a==source)return true;if(a[a.Length-1]=='*'&&source.StartsWith(a.Substring(0,a.Length-1),System.StringComparison.Ordinal))return true;}
   return false;
  }
  public static bool Allows(CombatViewPresentationProfile profile,string source)=>profile&&Allows(profile.shakeEnabled,profile.shakeAllowSources,source);
 }
 public enum CombatPoseBlend { Locomotion,AttackEntry,AttackContact,AttackRecovery,DodgeCancel,HitReaction }
 public static class CombatPoseTiming {
  // Exact holds at authored phases, with continuous entry/catch-up. Active contact is never remapped.
  public static float Limited(float phase,float activeFrom,float activeTo,float strength){
   phase=Mathf.Clamp01(phase);float remap=phase;
   if(phase<activeFrom&&activeFrom>0){float a=activeFrom*.28f,b=activeFrom*.68f;remap=phase<a?phase:phase<b?a:Mathf.Lerp(a,activeFrom,(phase-b)/(activeFrom-b));}
   else if(phase>activeTo&&activeTo<1){float end=activeTo+(1-activeTo)*.28f;remap=phase<end?activeTo:Mathf.Lerp(activeTo,1,(phase-end)/(1-end));}
   return Mathf.Lerp(phase,remap,Mathf.Clamp01(strength));
  }
  public static float Envelope(float phase,float activeFrom,float activeTo){if(phase<activeFrom)return Mathf.Sin(Mathf.PI*Mathf.Clamp01(phase/Mathf.Max(.001f,activeFrom)));if(phase>activeTo)return Mathf.Sin(Mathf.PI*Mathf.Clamp01((phase-activeTo)/Mathf.Max(.001f,1-activeTo)));return 0;}
 }
}
