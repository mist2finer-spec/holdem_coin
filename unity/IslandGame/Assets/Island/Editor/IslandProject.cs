#if UNITY_EDITOR
using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
namespace IslandGame.Editor {
 public static class IslandProject {
  [InitializeOnLoadMethod] static void Bootstrap(){if(!Application.isBatchMode&&!File.Exists("Assets/Island/Scenes/Island.unity")&&File.Exists("Assets/Island/Resources/AssetIndex.json"))EditorApplication.delayCall+=()=>Debug.Log("Island client ready: select Island > Create integration scene. Current scenes are preserved.");}

  [MenuItem("Island/Create integration scene")]
  public static void Create(){TryCreateScene();}
  static bool TryCreateScene(){
   if(!File.Exists("Assets/Island/Resources/AssetIndex.json"))throw new Exception("Run python scripts/unity/prepare_assets.py from the repository root first.");
   if(!Application.isBatchMode&&!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return false;
   if(File.Exists("Assets/Island/Scenes/Island.unity")){EditorSceneManager.OpenScene("Assets/Island/Scenes/Island.unity");EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene("Assets/Island/Scenes/Island.unity",true)};return true;}
   var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);new GameObject("Island native client").AddComponent<IslandApp>();
   Directory.CreateDirectory("Assets/Island/Scenes");EditorSceneManager.SaveScene(scene,"Assets/Island/Scenes/Island.unity");EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene("Assets/Island/Scenes/Island.unity",true)};
   PlayerSettings.insecureHttpOption=InsecureHttpOption.DevelopmentOnly;PlayerSettings.companyName="Island";PlayerSettings.productName="Island Holdem RPG";PlayerSettings.defaultInterfaceOrientation=UIOrientation.Portrait;
   return true;
  }
  [MenuItem("Island/Build Windows")]
  public static void BuildWindows(){if(!TryCreateScene())return;var result=BuildPipeline.BuildPlayer(EditorBuildSettings.scenes,"Builds/Windows/Island.exe",BuildTarget.StandaloneWindows64,BuildOptions.None);if(result.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Windows build failed");}
  [MenuItem("Island/Build Android")]
  public static void BuildAndroid(){if(!TryCreateScene())return;PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android,"com.island.holdemrpg");var result=BuildPipeline.BuildPlayer(EditorBuildSettings.scenes,"Builds/Android/Island.apk",BuildTarget.Android,BuildOptions.Development);if(result.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Android build failed");}
 }
 public sealed class IslandTextures:AssetPostprocessor {
  void OnPreprocessTexture(){if(!assetPath.Contains("/Resources/WebAssets/"))return;var importer=(TextureImporter)assetImporter;importer.textureCompression=TextureImporterCompression.Uncompressed;importer.maxTextureSize=4096;importer.alphaIsTransparency=true;importer.wrapMode=TextureWrapMode.Repeat;importer.mipmapEnabled=false;}
 }
}
#endif
