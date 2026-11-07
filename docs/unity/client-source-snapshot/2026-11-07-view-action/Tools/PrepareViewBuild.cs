using System;using UnityEngine;using UnityEditor;using UnityEngine.Rendering;using UnityEngine.Rendering.Universal;
public static class PrepareViewBuild {
 public static object Main(){if(EditorApplication.isPlaying)throw new Exception("Stop Play before build");if(!(GraphicsSettings.defaultRenderPipeline is UniversalRenderPipelineAsset))throw new Exception("Approved URP is not active");PlayerSettings.bundleVersion="0.1.0-test.20261107.4";PlayerSettings.Android.bundleVersionCode=2026110704;PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android,"com.mist2finer.islandgame.dev");PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Android,ScriptingImplementation.IL2CPP);PlayerSettings.Android.targetArchitectures=AndroidArchitecture.ARM64;AssetDatabase.SaveAssets();return new{version=PlayerSettings.bundleVersion,versionCode=PlayerSettings.Android.bundleVersionCode,pipeline=GraphicsSettings.defaultRenderPipeline.name};}
}

