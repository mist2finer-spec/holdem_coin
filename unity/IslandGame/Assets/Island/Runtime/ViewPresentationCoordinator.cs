using UnityEngine;
namespace IslandGame {
 public enum CombatViewState {Side,TransitionToQuarter,Quarter,TransitionToSide}
 // Reads the camera's one transition clock. It never owns a second transition timer or gameplay state.
 public sealed class ViewPresentationCoordinator {
  public readonly CombatViewPresentationProfile Side,Quarter;
  public CombatViewState State{get;private set;}
  public float QuarterWeight{get;private set;}public float TransitionProgress{get;private set;}=1;
  public bool Transitioning=>State==CombatViewState.TransitionToQuarter||State==CombatViewState.TransitionToSide;
  public float SidePoseWeight{get;private set;}
  int serial=-1;float fromSide;
  public float ImpactWeight=>Transitioning?1-.85f*Mathf.Sin(Mathf.PI*TransitionProgress):1;
  public ViewPresentationCoordinator(){Side=Resources.Load<CombatViewPresentationProfile>("CombatPresentation/SideAction");Quarter=Resources.Load<CombatViewPresentationProfile>("CombatPresentation/QuarterAction");}
  public void Sync(BattleCameraController camera){
   if(serial!=camera.TransitionSerial){fromSide=SidePoseWeight;serial=camera.TransitionSerial;}
   QuarterWeight=camera.QuarterWeight;TransitionProgress=camera.TransitionProgress;
   State=camera.IsTransitioning?(camera.Mode==ViewMode.Side25D?CombatViewState.TransitionToSide:CombatViewState.TransitionToQuarter):(camera.Mode==ViewMode.Side25D?CombatViewState.Side:CombatViewState.Quarter);
   // Side exaggeration fades early on the same camera progress; contact windows use strength zero.
   float target=camera.Mode==ViewMode.Side25D&&Side&&Side.limitedAttackPoses?Side.poseEmphasis:0;
   SidePoseWeight=!Transitioning?target:TransitionProgress<.25f?Mathf.Lerp(fromSide,0,Mathf.SmoothStep(0,1,TransitionProgress*4)):Mathf.Lerp(0,target,Mathf.SmoothStep(0,1,Mathf.Clamp01((TransitionProgress-.75f)*4)));
  }
  public float Blend(float side,float quarter)=>Mathf.Lerp(side,quarter,QuarterWeight);
  public float FlashSeconds=>Blend(Side?Side.flashSeconds:.12f,Quarter?Quarter.flashSeconds:.09f);
  public float FlashStrength=>Blend(Side?Side.flashStrength:.6f,Quarter?Quarter.flashStrength:.45f);
  public float SoundVolume=>Blend(Side?Side.soundVolume:.16f,Quarter?Quarter.soundVolume:.14f);
  public float Shake=>Blend(Side?Side.shakeMeters:.035f,Quarter?Quarter.shakeMeters:.018f)*ImpactWeight;
  public float FovPunch=>Blend(Side?Side.fovPunchDegrees:.45f,Quarter?Quarter.fovPunchDegrees:.18f)*ImpactWeight;
  public float SmearLife=>Blend(Side?Side.smearSeconds:.09f,Quarter?Quarter.smearSeconds:.045f)*ImpactWeight;
  public float SmearWidth=>Blend(Side?Side.smearWidth:.1f,Quarter?Quarter.smearWidth:.045f);
  public float SmearOpacity=>Blend(Side?Side.smearOpacity:.32f,Quarter?Quarter.smearOpacity:.2f)*ImpactWeight;
  public Vector3 Scale(float phase,float from,float to){float e=CombatPoseTiming.Envelope(phase,from,to)*SidePoseWeight*(Side?Side.silhouetteExaggeration:0);return new Vector3(1+e,1-e*.4f,1+e*.25f);}
 }
}
