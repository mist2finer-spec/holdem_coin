using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;
namespace IslandGame.Editor {
 public static class ActionCancelJumpBuild {
  static string Root=>Path.GetFullPath(Path.Combine(Application.dataPath,"../../../../../"));
  static string Task=>Path.Combine(Root,"maintenance/attack-cancel-jump-20261111");
  const string Pending="Island.ActionCancelJumpBuild.Pending";
  [InitializeOnLoadMethod]static void Resume(){if(SessionState.GetBool(Pending,false)){EditorApplication.update-=AwaitReady;EditorApplication.update+=AwaitReady;}}
  public static void Queue(){if(EditorApplication.isPlaying||BuildPipeline.isBuildingPlayer)throw new InvalidOperationException("Stop play before building");SessionState.SetBool(Pending,true);Resume();}
  static void AwaitReady(){if(EditorApplication.isCompiling||EditorApplication.isUpdating||EditorApplication.isPlayingOrWillChangePlaymode||BuildPipeline.isBuildingPlayer)return;EditorApplication.update-=AwaitReady;SessionState.SetBool(Pending,false);Build();}
  static void Build(){string version=PlayerSettings.bundleVersion;int code=PlayerSettings.Android.bundleVersionCode;
   try{Directory.CreateDirectory(Task);PlayerSettings.bundleVersion="0.1.0-test.20261111.6";PlayerSettings.Android.bundleVersionCode=2026111106;
    var scenes=EditorBuildSettings.scenes.Where(s=>s.enabled).Select(s=>s.path).ToArray();if(scenes.Length!=11||scenes[0]!="Assets/Island/Scenes/Island.unity")throw new Exception("Expected Island + 10 mount zones");
    if(PlayerSettings.GetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android)!="com.mist2finer.islandgame.dev")throw new Exception("Unexpected application identifier");
    File.WriteAllText(Path.Combine(Task,"build-start.json"),JsonConvert.SerializeObject(new{utc=DateTime.UtcNow,scenes,version=PlayerSettings.bundleVersion}));
    var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=scenes,locationPathName=Path.Combine(Root,"builds/IslandGame-ActionCancelJump-20261111.apk"),target=BuildTarget.Android,options=BuildOptions.Development|BuildOptions.DetailedBuildReport});var s=report.summary;
    File.WriteAllText(Path.Combine(Task,"build-result.json"),JsonConvert.SerializeObject(new{result=s.result.ToString(),s.totalErrors,s.totalWarnings,seconds=s.totalTime.TotalSeconds,output=s.outputPath,apkBytes=File.Exists(s.outputPath)?new FileInfo(s.outputPath).Length:0,messages=report.steps.SelectMany(v=>v.messages).Where(m=>m.type==LogType.Warning||m.type==LogType.Error).Select(m=>new{type=m.type.ToString(),m.content})},Formatting.Indented));
   }catch(Exception ex){File.WriteAllText(Path.Combine(Task,"build-error.txt"),ex.ToString());Debug.LogException(ex);}finally{PlayerSettings.bundleVersion=version;PlayerSettings.Android.bundleVersionCode=code;AssetDatabase.SaveAssets();}
  }
 }
}
