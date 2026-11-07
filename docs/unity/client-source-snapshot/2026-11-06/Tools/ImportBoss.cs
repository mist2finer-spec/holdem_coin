using System;
using System.IO;
using UnityEditor;
public static class ImportBoss {
 public static object Main(){
  if(EditorApplication.isPlaying)throw new Exception("Stop Play before asset import");
  string folder="G:/new_project/IslandGame/Assets/Island/Art/Battle3D/UnityBoss";Directory.CreateDirectory(folder);
  foreach(string f in new[]{"boss1_rig.glb","boss_melee_hook_combo.glb","boss_overhand_throw.glb","boss_textured.glb"}){string target=folder+"/"+f;if(!File.Exists(target))File.Copy("G:/new_project/attack_motion_ref/boss1/"+f,target);}
  string knock=folder+"/hit_knockback_anim_only.glb";if(!File.Exists(knock))File.Copy("G:/new_project/attack_motion_ref/hit_knockback_anim_only.glb",knock);
  AssetDatabase.Refresh();return new{importing=folder};
 }
}
