using System;
using System.IO;
using System.Collections;
using UnityEngine;
using UnityEngine.Profiling;
using IslandGame;
public static class ProfileCapture {
 public static object Main(){var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();app.StartCoroutine(Run(app));return new{started=true};}
 static IEnumerator Run(IslandApp app){
  bool enabled=Profiler.enabled,binary=Profiler.enableBinaryLog;string oldFile=Profiler.logFile;string path="C:/Users/SHK/island-combat-stability-20261107/evidence/combat-editor.raw";
  Profiler.enabled=false;Profiler.logFile=path;Profiler.enableBinaryLog=true;Profiler.enabled=true;double until=Time.realtimeSinceStartupAsDouble+5;
  var camera=app.HudBattle.BattleCamera;var target=new RenderTexture(1080,1170,24);target.Create();
  while(Time.realtimeSinceStartupAsDouble<until){yield return null;var old=camera.targetTexture;var rect=camera.rect;float aspect=camera.aspect;camera.targetTexture=target;camera.rect=new Rect(0,0,1,1);camera.aspect=1080f/1170;camera.Render();camera.targetTexture=old;camera.rect=rect;camera.aspect=aspect;}
  Profiler.enabled=false;Profiler.enableBinaryLog=binary;Profiler.logFile=oldFile;Profiler.enabled=enabled;target.Release();UnityEngine.Object.Destroy(target);
  File.WriteAllText("C:/Users/SHK/island-combat-stability-20261107/evidence/profiler-capture.json","{\"seconds\":5,\"mode\":\"Editor with explicit battle camera render; capture overhead excluded from numeric comparison\",\"file\":\"combat-editor.raw\"}");
 }
}
