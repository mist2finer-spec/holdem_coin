using UnityEngine;using UnityEditor;using IslandGame;using System.IO;
public static class InstallViewProfiles {
 public static object Main(){const string dir="Assets/Island/Resources/CombatPresentation";Directory.CreateDirectory(dir);AssetDatabase.Refresh();int added=0;
  for(int i=0;i<2;i++){string path=dir+(i==0?"/SideAction.asset":"/QuarterAction.asset");var p=AssetDatabase.LoadAssetAtPath<CombatViewPresentationProfile>(path);if(p)continue;p=ScriptableObject.CreateInstance<CombatViewPresentationProfile>();p.name=i==0?"SideAction":"QuarterAction";p.limitedAttackPoses=i==0;p.poseEmphasis=i==0?1:0;p.silhouetteExaggeration=i==0?.035f:0;p.flashSeconds=i==0?.12f:.09f;p.flashStrength=i==0?.6f:.45f;p.soundVolume=i==0?.16f:.14f;p.shakeMeters=i==0?.035f:.018f;p.fovPunchDegrees=i==0?.45f:.18f;p.smearSeconds=i==0?.09f:.045f;p.smearWidth=i==0?.10f:.045f;p.smearOpacity=i==0?.32f:.20f;p.depthOfField=false;p.importantSkillBackgroundDimming=0;AssetDatabase.CreateAsset(p,path);added++;}
  AssetDatabase.SaveAssets();return new{added,presets=2,bakeMesh=false,globalTimeScale=false};
 }
}
