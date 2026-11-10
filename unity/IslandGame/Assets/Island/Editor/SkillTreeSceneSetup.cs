#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace IslandGame.Editor {
 public static class SkillTreeSceneSetup {
  [MenuItem("Island/Configure SkillTree Layer")]
  public static void ConfigureLayer(){
   if(LayerMask.NameToLayer("SkillTree")>=0)return;
   var settings=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/TagManager.asset")[0]);var layers=settings.FindProperty("layers");
   for(int i=31;i>=8;i--){
    // Layer 30 is reserved by the existing battle renderer, even if unnamed.
    if(i==30||!string.IsNullOrEmpty(layers.GetArrayElementAtIndex(i).stringValue))continue;
    layers.GetArrayElementAtIndex(i).stringValue="SkillTree";settings.ApplyModifiedProperties();AssetDatabase.SaveAssets();Debug.Log("SkillTree configured on layer "+i);return;
   }
   throw new System.InvalidOperationException("No free user layer for SkillTree");
  }
 }
}
#endif
