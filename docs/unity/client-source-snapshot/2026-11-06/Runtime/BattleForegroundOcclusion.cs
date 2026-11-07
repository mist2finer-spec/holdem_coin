using System.Collections.Generic;
using UnityEngine;
namespace IslandGame {
 public sealed class BattleForegroundOcclusion:MonoBehaviour {
  internal static readonly HashSet<BattleOccluder> Targets=new HashSet<BattleOccluder>();
  public LayerMask occluderLayers=1<<30;public float foregroundSeparation=1;
  public void Apply(Camera camera,Vector3 player,float pitch){
   bool enabledView=pitch>=25;var ray=new Ray(camera.transform.position,(player+Vector3.up*.7f-camera.transform.position).normalized);float length=Vector3.Distance(camera.transform.position,player+Vector3.up*.7f);
   foreach(var target in Targets){if(!target)continue;bool hide=false;
    if(enabledView&&((1<<target.gameObject.layer)&occluderLayers.value)!=0){var bounds=target.Bounds;float distance;bounds.Expand(.3f);hide=bounds.center.z<player.z-foregroundSeparation&&bounds.IntersectRay(ray,out distance)&&distance<length-.4f;}
    target.SetHidden(hide);
   }
  }
  void OnDisable(){foreach(var target in Targets)if(target)target.SetHidden(false);}
 }
 public sealed class BattleOccluder:MonoBehaviour {
  Renderer[] renderers;bool[] original;bool hidden;
  public Bounds Bounds{get{var b=renderers[0].bounds;for(int i=1;i<renderers.Length;i++)b.Encapsulate(renderers[i].bounds);return b;}}
  void OnEnable(){if(renderers==null){renderers=GetComponentsInChildren<Renderer>(true);original=new bool[renderers.Length];}if(renderers.Length>0)BattleForegroundOcclusion.Targets.Add(this);}
  public void SetHidden(bool value){if(hidden==value)return;hidden=value;for(int i=0;i<renderers.Length;i++){if(!renderers[i])continue;if(value){original[i]=renderers[i].forceRenderingOff;renderers[i].forceRenderingOff=true;}else renderers[i].forceRenderingOff=original[i];}}
  void OnDisable(){SetHidden(false);BattleForegroundOcclusion.Targets.Remove(this);}
 }
}
