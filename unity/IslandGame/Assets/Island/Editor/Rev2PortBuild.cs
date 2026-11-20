using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
namespace IslandGame.Editor {
 // Rev2 Android port test build (Development only). Same shape as PixelArtBuild: Queue() -> wait for compile/play -> BuildPlayer.
 // The APK carries local-only material (LocalOnlyAssetGate allows it for Development builds only) and stays on this PC and its devices.
 public static class Rev2PortBuild {
  static string Root=>Path.GetFullPath(Path.Combine(Application.dataPath,"../../../../../"));
  // Variant (kept in SessionState so it survives the reload between Queue and Build). Defaults = the 4b build.
  const string VariantKey="Island.Rev2PortBuild.Variant";
  static string[] Variant=>(SessionState.GetString(VariantKey,"")+"||||").Split('|');
  static string Pick(int i,string fallback){var v=Variant[i];return string.IsNullOrEmpty(v)?fallback:v;}
  static string Task=>Path.Combine(Root,Pick(0,"maintenance/rev2-android-port-20261119/build"));
  static string Apk=>Path.Combine(Root,"builds/"+Pick(1,"IslandGame-Rev2Port-20261119.apk"));
  static string KernelSha=>Pick(2,"19eee6d25f674219a59f09cc6f50e7322e5685a7d4c45d96d361658857bf6d9b");
  static int VersionCode=>int.Parse(Pick(3,"2026111901"));
  static string VersionName=>Pick(4,"0.1.0-test.20261119.1");
  const string Pending="Island.Rev2PortBuild.Pending";
  const string AppId="com.mist2finer.islandgame.dev";
  const BuildOptions Options=BuildOptions.Development|BuildOptions.DetailedBuildReport;
  static readonly string[] Expected=new[]{"Assets/Island/Scenes/Island.unity"}.Concat(Enumerable.Range(1,10).Select(i=>$"Assets/Island/MountRuntime/Scenes/MountZone{i:00}.unity")).ToArray();
  [InitializeOnLoadMethod]static void Resume(){if(SessionState.GetBool(Pending,false)){EditorApplication.update-=AwaitReady;EditorApplication.update+=AwaitReady;}}
  public static string Queue(){if(EditorApplication.isPlaying||BuildPipeline.isBuildingPlayer)throw new InvalidOperationException("Stop play before building");SessionState.SetBool(Pending,true);Resume();return "Queued "+Apk+" code="+VersionCode;}
  // taskDir relative to the workspace root, apk file name under builds/, expected kernel sha256, version code, version name.
  public static string QueueVariant(string taskDir,string apkName,string kernelSha,int versionCode,string versionName){if(apkName.Contains("/")||apkName.Contains("\\")||!apkName.EndsWith(".apk"))throw new ArgumentException("apk name");SessionState.SetString(VariantKey,string.Join("|",taskDir,apkName,kernelSha,versionCode.ToString(),versionName));return Queue();}
  static void AwaitReady(){if(EditorApplication.isCompiling||EditorApplication.isUpdating||EditorApplication.isPlayingOrWillChangePlaymode||BuildPipeline.isBuildingPlayer)return;EditorApplication.update-=AwaitReady;SessionState.SetBool(Pending,false);Build();}
  static string Sha(string path){using var s=File.OpenRead(path);using var h=SHA256.Create();return string.Concat(h.ComputeHash(s).Select(b=>b.ToString("x2")));}
  static string Project(string rel)=>Path.Combine(Path.GetDirectoryName(Application.dataPath),rel);

  // Pre-build checks. Returns what was checked; throws on the first failure. Also callable alone (no build).
  public static string Preflight(){
   var scenes=EditorBuildSettings.scenes.Where(s=>s.enabled).Select(s=>s.path).ToArray();
   if(!scenes.SequenceEqual(Expected))throw new Exception("Expected Island + MountZone01..10, got: "+string.Join(",",scenes));
   if(PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android)!=AppId)throw new Exception("Unexpected application identifier");
   if((Options&BuildOptions.Development)==0)throw new Exception("Not a Development build");
   var kit=Battle3DAssets.LoadKit();if(!kit||kit.kit!="pink-iai")throw new Exception("Kit asset Resources/"+Battle3DAssets.KitResource+" missing or incomplete");
   var kernel=Sha(Project("Assets/Island/Resources/TrainingCombatKernel.js.txt"));if(kernel!=KernelSha)throw new Exception("Kernel bundle sha256 "+kernel);
   var pixelText=File.ReadAllText(Project("Assets/Island/Resources/PixelArtSettings.asset"));var pixel=Resources.Load<PixelArtSettings>("PixelArtSettings");
   if(!Regex.IsMatch(pixelText,@"^\s*enabled:\s*0\s*$",RegexOptions.Multiline)||!pixel||pixel.enabled)throw new Exception("PixelArtSettings.enabled is not 0");
   var gate=LocalOnlyAssetGate.Evaluate(scenes,true,PlayerSettings.GetScriptingDefineSymbols(NamedBuildTarget.Android).Split(';'),"preflight");if(gate.result!="PASS")throw new Exception("Gate: "+string.Join("; ",gate.reasons));
   return JsonConvert.SerializeObject(new{scenes=scenes.Length,appId=AppId,development=true,kit=kit.kit,kitClips=new[]{kit.idle,kit.run,kit.iai1,kit.iai2,kit.iai3,kit.iaiRecover,kit.skill}.Count(c=>c),kernelSha=kernel,pixelEnabled=pixel.enabled,gate=gate.result,gateLocalOnly=gate.localOnlyCount});
  }

  static void Build(){string version=PlayerSettings.bundleVersion;int code=PlayerSettings.Android.bundleVersionCode;
   string settings=Project("ProjectSettings/ProjectSettings.asset"),pipeline=Project("ProjectSettings/Packages/com.unity.pipeline/EditorPipelineConfig.json");
   string settingsBefore=Sha(settings),pipelineBefore=File.Exists(pipeline)?Sha(pipeline):null;
   try{Directory.CreateDirectory(Task);foreach(var f in new[]{"build-result.json","build-error.txt"})if(File.Exists(Path.Combine(Task,f)))File.Delete(Path.Combine(Task,f));
    if(File.Exists(Apk))throw new Exception("Output exists, not overwriting: "+Apk);
    var preflight=Preflight();
    PlayerSettings.bundleVersion=VersionName;PlayerSettings.Android.bundleVersionCode=VersionCode;
    var scenes=EditorBuildSettings.scenes.Where(s=>s.enabled).Select(s=>s.path).ToArray();
    LocalOnlyAssetGate.OutputPath=Path.Combine(Task,"local-only-assets.json");
    File.WriteAllText(Path.Combine(Task,"build-start.json"),JsonConvert.SerializeObject(new{utc=DateTime.UtcNow,scenes,version=PlayerSettings.bundleVersion,code=PlayerSettings.Android.bundleVersionCode,preflight,settingsBefore,pipelineBefore},Formatting.Indented));
    var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=scenes,locationPathName=Apk,target=BuildTarget.Android,options=Options});var s=report.summary;
    var packed=s.result==BuildResult.Succeeded?LocalOnlyAssetGate.RecordPacked(report,"final-report"):null;
    File.WriteAllText(Path.Combine(Task,"build-result.json"),JsonConvert.SerializeObject(new{result=s.result.ToString(),s.totalErrors,s.totalWarnings,seconds=s.totalTime.TotalSeconds,output=s.outputPath,apkBytes=File.Exists(s.outputPath)?new FileInfo(s.outputPath).Length:0,totalSize=(long)s.totalSize,
     localOnlyPackedBytes=packed?["localOnlyBytes"],localOnlyPackedObjects=packed?["localOnlyObjects"],packedBytesAll=packed?["packedBytesAll"],
     messages=report.steps.SelectMany(v=>v.messages).Where(m=>m.type==LogType.Warning||m.type==LogType.Error||m.type==LogType.Exception||m.type==LogType.Assert).Select(m=>new{type=m.type.ToString(),m.content})},Formatting.Indented));
   }catch(Exception ex){File.WriteAllText(Path.Combine(Task,"build-error.txt"),ex.ToString());Debug.LogException(ex);}
   finally{PlayerSettings.bundleVersion=version;PlayerSettings.Android.bundleVersionCode=code;AssetDatabase.SaveAssets();
    File.WriteAllText(Path.Combine(Task,"build-settings-hash.json"),JsonConvert.SerializeObject(new{settingsBefore,settingsAfter=Sha(settings),pipelineBefore,pipelineAfter=File.Exists(pipeline)?Sha(pipeline):null,restoredVersion=PlayerSettings.bundleVersion,restoredCode=PlayerSettings.Android.bundleVersionCode},Formatting.Indented));SessionState.EraseString(VariantKey);}
  }
 }
}
