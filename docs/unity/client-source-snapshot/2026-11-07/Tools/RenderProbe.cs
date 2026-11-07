using System;
using System.IO;
using System.Linq;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class RenderProbe {
 public static object Main(){var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();app.StartCoroutine(Run(app));return new{started=true};}
 static IEnumerator Run(IslandApp app){
  var camera=app.HudBattle.BattleCamera;var rows=new List<object>();
  // Explicit camera rendering: the unfocused editor skips normal GPU rendering. This
  // diagnostic measures draw submission at the existing 1080x1170 battle viewport.
  var target=new RenderTexture(1080,1170,24);target.Create();var oldTarget=camera.targetTexture;var oldRect=camera.rect;float oldAspect=camera.aspect;
  for(int i=0;i<180;i++){yield return null;camera.targetTexture=target;camera.rect=new Rect(0,0,1,1);camera.aspect=1080f/1170;long start=System.Diagnostics.Stopwatch.GetTimestamp();camera.Render();double ms=(System.Diagnostics.Stopwatch.GetTimestamp()-start)*1000.0/System.Diagnostics.Stopwatch.Frequency;rows.Add(new{frame=Time.frameCount,renderSubmitMs=ms,drawCalls=UnityStats.drawCalls,batches=UnityStats.batches,setPass=UnityStats.setPassCalls,triangles=UnityStats.triangles});camera.targetTexture=oldTarget;camera.rect=oldRect;camera.aspect=oldAspect;}
  target.Release();UnityEngine.Object.Destroy(target);
  var renderers=UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None).Where(r=>r.gameObject.layer==30).ToArray();
  var materials=renderers.SelectMany(r=>r.sharedMaterials).Where(m=>m).GroupBy(m=>m).Select(g=>new{material=g.Key.name,shader=g.Key.shader.name,instancing=g.Key.enableInstancing,renderers=g.Count()}).OrderByDescending(x=>x.renderers).Take(12).ToArray();
  var report=new{mode="Explicit Camera.Render in Editor; submission time is not GPU time or normal frame FPS",width=1080,height=1170,renderers=renderers.Length,materials,rows};File.WriteAllText("C:/Users/SHK/island-combat-stability-20261107/evidence/render-probe.json",Newtonsoft.Json.JsonConvert.SerializeObject(report,Newtonsoft.Json.Formatting.Indented));
 }
}
