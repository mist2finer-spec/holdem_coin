using System;
using UnityEngine;
using UnityEditor;
public static class ConfigureBuild {
 public static object Main(){
  if(EditorApplication.isPlaying)throw new Exception("Stop Play first");
  PlayerSettings.bundleVersion="0.1.0-test.20261107.1";PlayerSettings.Android.bundleVersionCode=2026110701;
  PlayerSettings.defaultInterfaceOrientation=UIOrientation.Portrait;AssetDatabase.SaveAssets();
  return new{version=PlayerSettings.bundleVersion,code=PlayerSettings.Android.bundleVersionCode,architecture=PlayerSettings.Android.targetArchitectures.ToString(),backend=PlayerSettings.GetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Android).ToString()};
 }
}
