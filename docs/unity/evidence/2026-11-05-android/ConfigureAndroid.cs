using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
public static class ConfigureAndroid {
 public static object Main(){
  var platform=NamedBuildTarget.Android;
  var old=new {activeTarget=EditorUserBuildSettings.activeBuildTarget.ToString(),id=PlayerSettings.GetApplicationIdentifier(platform),version=PlayerSettings.bundleVersion,product=PlayerSettings.productName,orientation=PlayerSettings.defaultInterfaceOrientation.ToString(),backend=PlayerSettings.GetScriptingBackend(platform).ToString(),architecture=PlayerSettings.Android.targetArchitectures.ToString()};
  File.WriteAllText("C:/Users/SHK/island-android-review/settings-before.json",Newtonsoft.Json.JsonConvert.SerializeObject(old,Newtonsoft.Json.Formatting.Indented));
  PlayerSettings.SetApplicationIdentifier(platform,"com.mist2finer.islandgame.dev");
  PlayerSettings.productName="IslandGame Test";
  PlayerSettings.bundleVersion="0.1.0-test.20261105";
  PlayerSettings.Android.bundleVersionCode=2026110501;
  PlayerSettings.SetScriptingBackend(platform,ScriptingImplementation.IL2CPP);
  PlayerSettings.Android.targetArchitectures=AndroidArchitecture.ARM64;
  PlayerSettings.Android.useCustomKeystore=false;
  PlayerSettings.Android.forceInternetPermission=true;
  PlayerSettings.defaultInterfaceOrientation=UIOrientation.Portrait;
  PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android,false);
  PlayerSettings.SetGraphicsAPIs(BuildTarget.Android,new[]{GraphicsDeviceType.OpenGLES3});
  EditorUserBuildSettings.buildAppBundle=false;
  EditorUserBuildSettings.exportAsGoogleAndroidProject=false;
  AssetDatabase.SaveAssets();
  return new {supported=BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.Android,BuildTarget.Android),id=PlayerSettings.GetApplicationIdentifier(platform),backend=PlayerSettings.GetScriptingBackend(platform).ToString(),architecture=PlayerSettings.Android.targetArchitectures.ToString(),font=Resources.Load<Font>("Fonts/NotoSansCJKkr-Regular")!=null,server="https://holdem-coin-tavern.onrender.com",old};
 }
}
