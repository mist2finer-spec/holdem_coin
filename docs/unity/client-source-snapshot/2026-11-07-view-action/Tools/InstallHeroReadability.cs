using System;using UnityEngine;using UnityEditor;
public static class InstallHeroReadability {
 public static object Main(){const string p="Assets/Island/Resources/CombatPresentation/HeroOccluded.mat";AssetDatabase.Refresh();var shader=Shader.Find("Island/Combat Occluded Hero");if(!shader)throw new Exception("Occlusion shader missing");var m=AssetDatabase.LoadAssetAtPath<Material>(p);if(!m){m=new Material(shader);m.name="HeroOccluded";AssetDatabase.CreateAsset(m,p);}AssetDatabase.SaveAssets();return new{shader=shader.name,material=p};}
}
