using System;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;

namespace IslandGame {
 // Manual, server-clock-driven Mecanim evaluation works in both Editor and IL2CPP Players.
 // Transform clips require an Animator at exactly the root their bindings are relative to.
 public sealed class RuntimeAnimationPlayer : IDisposable {
  public static int CreatedGraphs{get;private set;}public static int ActiveGraphs{get;private set;}
  PlayableGraph graph;
  AnimationMixerPlayable mixer;
  AnimationClipPlayable current, previous;
  AnimationClip clip;
  float blendAge;
  double previousTime;
  readonly float blendDuration;
  public RuntimeAnimationPlayer(GameObject model, float transitionSeconds=.12f) {
   blendDuration=transitionSeconds;
   foreach(var nested in model.GetComponentsInChildren<Animator>(true))nested.enabled=false;
   var animator=model.GetComponent<Animator>();if(!animator)animator=model.AddComponent<Animator>();
   animator.runtimeAnimatorController=null;animator.avatar=null;animator.applyRootMotion=false;
   animator.cullingMode=AnimatorCullingMode.AlwaysAnimate;animator.enabled=true;
   graph=PlayableGraph.Create("Island manual pose: "+model.name);CreatedGraphs++;ActiveGraphs++;
   graph.SetTimeUpdateMode(DirectorUpdateMode.Manual);
   mixer=AnimationMixerPlayable.Create(graph,2);
   AnimationPlayableOutput.Create(graph,"Pose",animator).SetSourcePlayable(mixer);
   graph.Play();
  }
  public void Sample(AnimationClip next,float time,float delta=0,CombatPoseBlend policy=CombatPoseBlend.Locomotion) {
   if(!next||!graph.IsValid())return;
   if(next!=clip){
    if(previous.IsValid()){graph.Disconnect(mixer,1);graph.DestroyPlayable(previous);}
    if(current.IsValid()){graph.Disconnect(mixer,0);previous=current;previousTime=previous.GetTime();graph.Connect(previous,0,mixer,1);}
    current=AnimationClipPlayable.Create(graph,next);current.SetApplyFootIK(false);current.SetApplyPlayableIK(false);current.SetSpeed(0);
    graph.Connect(current,0,mixer,0);clip=next;blendAge=0;
   }
   blendAge+=Mathf.Max(0,delta);
   float blend=policy==CombatPoseBlend.AttackContact?0:policy==CombatPoseBlend.AttackEntry?.045f:policy==CombatPoseBlend.DodgeCancel?.03f:policy==CombatPoseBlend.HitReaction?.04f:blendDuration;
   float weight=previous.IsValid()&&blend>0?Mathf.SmoothStep(0,1,blendAge/blend):1;
   mixer.SetInputWeight(0,weight);mixer.SetInputWeight(1,1-weight);
   current.SetTime(Mathf.Clamp(time,0,next.length));current.SetDone(false);
   if(previous.IsValid())previous.SetTime(previousTime);
   graph.Evaluate(0);
   if(weight>=1&&previous.IsValid()){graph.Disconnect(mixer,1);graph.DestroyPlayable(previous);}
  }
  public void Dispose(){if(graph.IsValid()){graph.Destroy();ActiveGraphs--;}}
 }
}
