using UnityEngine;

namespace IslandGame {
 [CreateAssetMenu(menuName="Island/Battle 3D Assets")]
 public sealed class Battle3DAssets : ScriptableObject {
  public GameObject hero, slime;
  public Material heroMaterial, slimeMaterial;
  public AnimationClip idle, run, jumpStart, jumpLoop, jumpLand, roll, slide, death, hit;
  public AnimationClip attack1, attack2, attack3, combo, heavy, dash, spell, slimeIdle;
  public float heroHeight=1.3f, slimeHeight=.62f;
  public float heroYaw=90;
  public AnimationClip HeroClip(string action) {
   if(string.IsNullOrEmpty(action))return idle;
   if(action.StartsWith("attack")) {
    if(action=="attack2")return attack2;
    if(action=="attack3")return attack3;
    if(action=="attack4")return heavy;
    if(action=="attack5")return combo;
    return attack1;
   }
   if(action.StartsWith("run")||action=="walk")return run;
   if(action.StartsWith("jump"))return action=="jump1"?jumpStart:action=="jump5"?jumpLand:jumpLoop;
   if(action.StartsWith("sliding"))return slide;
   if(action.StartsWith("avoid")||action.StartsWith("dodge"))return roll;
   if(action.StartsWith("skill"))return spell;
   if(action.StartsWith("death")||action.StartsWith("die"))return death;
   if(action.StartsWith("defeat")||action.StartsWith("damage"))return hit;
   return idle;
  }
 }
}
