using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;
public static class BuildBossAndroid {
 public static object Main(){if(EditorApplication.isPlaying)throw new Exception("Stop Play first");PlayerSettings.bundleVersion="0.1.0-test.20261106";PlayerSettings.Android.bundleVersionCode=2026110601;AssetDatabase.SaveAssets();return new{configured=true};}
 static void Build(){
  string path="G:/new_project/IslandGame/Builds/Android/IslandGame-Test-Boss-Camera-20261106.apk";
  try{Directory.CreateDirectory(Path.GetDirectoryName(path));PlayerSettings.bundleVersion="0.1.0-test.20261106";PlayerSettings.Android.bundleVersionCode=2026110601;
   var scenes=EditorBuildSettings.scenes.Where(s=>s.enabled).Select(s=>s.path).ToArray();
   var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=scenes,locationPathName=path,target=BuildTarget.Android,options=BuildOptions.Development});
   File.WriteAllText("C:/Users/SHK/island-boss-camera-review/android-build.json",Newtonsoft.Json.JsonConvert.SerializeObject(new{result=report.summary.result.ToString(),path,bytes=report.summary.totalSize,seconds=report.summary.totalTime.TotalSeconds,errors=report.summary.totalErrors,warnings=report.summary.totalWarnings,scenes},Newtonsoft.Json.Formatting.Indented));
  }catch(Exception e){File.WriteAllText("C:/Users/SHK/island-boss-camera-review/android-build.json",Newtonsoft.Json.JsonConvert.SerializeObject(new{result="Exception",error=e.ToString()}));throw;}
 }
}
