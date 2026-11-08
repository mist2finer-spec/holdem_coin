using System;using System.IO;using System.Linq;using UnityEngine;using UnityEditor;using UnityEditor.Build.Reporting;using Newtonsoft.Json;
public static class BuildMountAndroid {
 const string Dir="G:/new_project/IslandGame/Builds/Android";
 const string Report="C:/Users/SHK/mount-sunday-playtest-20261108/evidence/android-build.json";
 public static string Start(){if(EditorApplication.isPlaying)throw new Exception("Stop Play before build");
 PlayerSettings.bundleVersion="0.1.0-test.20261108.2";PlayerSettings.Android.bundleVersionCode=2026110802;
 PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android,"com.mist2finer.islandgame.dev");
 PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Android,ScriptingImplementation.IL2CPP);PlayerSettings.Android.targetArchitectures=AndroidArchitecture.ARM64;
 AssetDatabase.SaveAssets();Directory.CreateDirectory(Dir);File.WriteAllText(Report,"{\"status\":\"building\"}");EditorApplication.delayCall+=Build;return "Android build queued";}
 static void Build(){try{var scenes=EditorBuildSettings.scenes.Where(s=>s.enabled).Select(s=>s.path).ToArray();if(scenes.Length!=11||scenes[0]!="Assets/Island/Scenes/Island.unity")throw new Exception("Expected main + ten streamed scenes only");
 var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=scenes,locationPathName=Dir+"/IslandGame-MountSunday-20261108.apk",target=BuildTarget.Android,options=BuildOptions.Development});
 File.WriteAllText(Report,JsonConvert.SerializeObject(new{status=report.summary.result.ToString(),report.summary.totalErrors,report.summary.totalWarnings,seconds=report.summary.totalTime.TotalSeconds,bytes=report.summary.totalSize,output=report.summary.outputPath,scenes},Formatting.Indented));}
 catch(Exception e){File.WriteAllText(Report,JsonConvert.SerializeObject(new{status="Failed",error=e.ToString()},Formatting.Indented));Debug.LogException(e);}}
}
