using UnityEngine;
namespace IslandGame {
 [CreateAssetMenu(menuName="Island/Combat view presentation profile")]
 public sealed class CombatViewPresentationProfile:ScriptableObject {
  public bool limitedAttackPoses;
  [Range(0,1)] public float poseEmphasis=1;
  [Range(0,.08f)] public float silhouetteExaggeration=.035f;
  [Range(0,.2f)] public float flashSeconds=.12f;
  [Range(0,1)] public float flashStrength=.6f,soundVolume=.16f;
  [Range(0,.08f)] public float shakeMeters=.035f;
  [Range(0,1)] public float fovPunchDegrees=.45f;
  [Range(0,.2f)] public float smearSeconds=.09f;
  [Range(0,.2f)] public float smearWidth=.10f;
  [Range(0,1)] public float smearOpacity=.32f;
  [Range(0,.2f)] public float importantSkillBackgroundDimming;
  public bool depthOfField; // Both initial presets keep the combat field sharp.
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
