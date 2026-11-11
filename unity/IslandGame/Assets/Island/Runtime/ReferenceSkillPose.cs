using UnityEngine;
namespace IslandGame {
 public static class ReferenceSkillPose {
  // Additive accents over the existing heavy strike / spell animation, on the
  // imported rig. Translation and foot grounding remain with Battle3DView.
  public static void Apply(string action,float phase,Transform hips,Transform shoulder){
   float wind=Mathf.SmoothStep(0,1,Mathf.InverseLerp(.05f,.28f,phase))*(1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(.50f,.92f,phase)));
   if(action=="skill1"){
    if(hips)hips.localRotation*=Quaternion.Euler(-9*wind,0,0);
    if(shoulder)shoulder.localRotation*=Quaternion.Euler(0,0,-18*wind);
   }else if(shoulder)shoulder.localRotation*=Quaternion.Euler(-12*wind,0,22*wind);
  }
 }
}
