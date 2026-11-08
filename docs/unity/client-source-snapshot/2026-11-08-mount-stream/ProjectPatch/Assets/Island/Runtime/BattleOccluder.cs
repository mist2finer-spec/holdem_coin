using UnityEngine;
namespace IslandGame {
 public sealed class BattleOccluder:MonoBehaviour {
  Renderer[] renderers;bool[] original;bool hidden;
  public Bounds Bounds{get{var b=renderers[0].bounds;for(int i=1;i<renderers.Length;i++)b.Encapsulate(renderers[i].bounds);return b;}}
  void OnEnable(){if(renderers==null){renderers=GetComponentsInChildren<Renderer>(true);original=new bool[renderers.Length];}if(renderers.Length>0)BattleForegroundOcclusion.Targets.Add(this);}
  public void SetHidden(bool value){if(hidden==value)return;hidden=value;for(int i=0;i<renderers.Length;i++){if(!renderers[i])continue;if(value){original[i]=renderers[i].forceRenderingOff;renderers[i].forceRenderingOff=true;}else renderers[i].forceRenderingOff=original[i];}}
  void OnDisable(){SetHidden(false);BattleForegroundOcclusion.Targets.Remove(this);}
 }
}
