using UnityEngine;using UnityEditor;using UnityEditor.Build.Reporting;using System;using System.IO;using System.Linq;using Newtonsoft.Json;
namespace IslandGame.Editor {
 public static class SourceEnvironmentBuild {
  const string Task="G:/holdem_coin-workspace/island-genshin-localcombat-20261110/";
  public static void Queue(){if(EditorApplication.isPlaying||BuildPipeline.isBuildingPlayer)throw new Exception("Stop play or wait for build");EditorApplication.delayCall-=Build;EditorApplication.delayCall+=Build;}
  static void Build(){
   var version=PlayerSettings.bundleVersion;int code=PlayerSettings.Android.bundleVersionCode;
   try{PlayerSettings.bundleVersion="0.1.0-test.20261110.1";PlayerSettings.Android.bundleVersionCode=2026111001;var scenes=EditorBuildSettings.scenes.Where(s=>s.enabled).Select(s=>s.path).ToArray();if(scenes.Length!=11||scenes[0]!="Assets/Island/Scenes/Island.unity")throw new Exception("Expected original Island + 10 zones");if(PlayerSettings.GetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android)!="com.mist2finer.islandgame.dev")throw new Exception("Unexpected package");
    File.WriteAllText(Task+"evidence/build-start.json",JsonConvert.SerializeObject(new{utc=DateTime.UtcNow,scenes,version=PlayerSettings.bundleVersion}));var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=scenes,locationPathName=Task+"builds/IslandGame-GenshinEnvironment-20261110.apk",target=BuildTarget.Android,options=BuildOptions.Development|BuildOptions.DetailedBuildReport});var s=report.summary;File.WriteAllText(Task+"evidence/build-result.json",JsonConvert.SerializeObject(new{result=s.result.ToString(),s.totalErrors,s.totalWarnings,seconds=s.totalTime.TotalSeconds,output=s.outputPath,apkBytes=File.Exists(s.outputPath)?new FileInfo(s.outputPath).Length:0,messages=report.steps.SelectMany(v=>v.messages).Where(m=>m.type==LogType.Warning||m.type==LogType.Error).Select(m=>new{type=m.type.ToString(),m.content})},Formatting.Indented));
   }catch(Exception e){File.WriteAllText(Task+"evidence/build-error.txt",e.ToString());Debug.LogException(e);}finally{PlayerSettings.bundleVersion=version;PlayerSettings.Android.bundleVersionCode=code;AssetDatabase.SaveAssets();}
  }
 }
}
