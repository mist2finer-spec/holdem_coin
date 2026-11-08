using System.Collections.Generic;
using UnityEngine;
namespace IslandGame {
 public sealed class BattleForegroundOcclusion:MonoBehaviour {
  internal static readonly HashSet<BattleOccluder> Targets=new HashSet<BattleOccluder>();
  public bool protectSideView;public Transform additionalTarget;
  public bool protectAttack;public Vector3 rightHand,leftHand;public Transform warningTarget;
  public LayerMask occluderLayers=1<<30;public float foregroundSeparation=1;
  public void Apply(Camera camera,Vector3 player,float pitch){
   bool enabledView=pitch>=25||protectSideView;var ray=new Ray(camera.transform.position,(player+Vector3.up*.7f-camera.transform.position).normalized);float length=Vector3.Distance(camera.transform.position,player+Vector3.up*.7f);
   foreach(var target in Targets){if(!target)continue;bool hide=false;
    if(enabledView&&((1<<target.gameObject.layer)&occluderLayers.value)!=0){var bounds=target.Bounds;float distance;bounds.Expand(.3f);hide=bounds.center.z<player.z-foregroundSeparation&&bounds.IntersectRay(ray,out distance)&&distance<length-.4f;}
    if(!hide&&enabledView&&additionalTarget){var endpoint=additionalTarget.position+Vector3.up*3;var secondRay=new Ray(camera.transform.position,(endpoint-camera.transform.position).normalized);var bounds=target.Bounds;bounds.Expand(.5f);float distance;hide=bounds.IntersectRay(secondRay,out distance)&&distance<Vector3.Distance(camera.transform.position,endpoint)-1;}
    if(!hide&&enabledView&&protectAttack)hide=Blocks(target.Bounds,camera.transform.position,rightHand,.6f)||Blocks(target.Bounds,camera.transform.position,leftHand,.6f);
    if(!hide&&enabledView&&warningTarget&&warningTarget.gameObject.activeInHierarchy)hide=Blocks(target.Bounds,camera.transform.position,warningTarget.position,.9f);
    target.SetHidden(hide);
   }
  }
  static bool Blocks(Bounds bounds,Vector3 from,Vector3 endpoint,float padding){bounds.Expand(padding*2);var delta=endpoint-from;return bounds.IntersectRay(new Ray(from,delta.normalized),out float distance)&&distance<delta.magnitude-.3f;}
  void OnDisable(){foreach(var target in Targets)if(target)target.SetHidden(false);}
 }
}
