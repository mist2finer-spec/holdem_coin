using UnityEngine;
namespace IslandGame {
 // Aim the existing three swings down to small enemies without moving the actor,
 // scaling its hitbox, or editing the source clip. Export uses this same correction.
 public static class HeroMeleePose {
  public static float ActiveTo(string action)=>action=="attack3"?.78f:.58f;
  public static void Apply(string action,float phase,Transform shoulder,Transform weapon,float ground){
   if(!action.StartsWith("attack")||!shoulder||!weapon)return;
   float weight=Mathf.SmoothStep(0,1,Mathf.InverseLerp(.12f,.32f,phase))*(1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(ActiveTo(action),.95f,phase)));
   Vector3 arm=weapon.TransformPoint(new Vector3(0,.73f,0))-shoulder.position;float length=arm.magnitude;if(length<.01f)return;
   float dy=Mathf.Clamp(ground+.05f-shoulder.position.y,-length*.97f,length*.97f);Vector3 flat=new Vector3(arm.x,0,arm.z);if(flat.sqrMagnitude<.0001f)return;
   Vector3 aimed=flat.normalized*Mathf.Sqrt(length*length-dy*dy)+Vector3.up*dy;
   shoulder.rotation=Quaternion.Slerp(Quaternion.identity,Quaternion.FromToRotation(arm,aimed),weight)*shoulder.rotation;
  }
 }
}
