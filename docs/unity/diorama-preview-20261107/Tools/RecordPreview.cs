using System;using System.IO;using System.Collections;using System.Collections.Generic;using UnityEngine;using UnityEditor;using IslandGame.Diorama;
public static class RecordPreview {
 const string Dir="C:/Users/SHK/island-contact-diorama-20261107/evidence/movement/";
 public static object Main(){Directory.CreateDirectory(Dir);IslandGame.Editor.BattleHudReview.SetSize(720,1280);EditorWindow.GetWindow(typeof(EditorWindow).Assembly.GetType("UnityEditor.GameView")).Focus();var stage=UnityEngine.Object.FindFirstObjectByType<DioramaPreviewStage>();stage.StartCoroutine(Run(stage));return new{started=true};}
 static IEnumerator Run(DioramaPreviewStage stage){stage.surface=DioramaSurface.UrpLit;stage.GetComponent<DioramaPreviewControls>().visible=false;stage.bloom=stage.depthOfField=stage.vignette=stage.outline=stage.rim=false;
  foreach(DioramaView shot in Enum.GetValues(typeof(DioramaView))){stage.shot=shot;stage.animate=false;stage.ResetSample();stage.RefreshLook();for(int i=0;i<60;i++)yield return null;stage.animate=true;stage.ResetSample();string folder=Dir+shot;Directory.CreateDirectory(folder);double start=Time.realtimeSinceStartupAsDouble;var times=new List<double>();int frame=0;
   while(Time.realtimeSinceStartupAsDouble-start<8){yield return new WaitForEndOfFrame();times.Add(Time.realtimeSinceStartupAsDouble-start);var image=ScreenCapture.CaptureScreenshotAsTexture();File.WriteAllBytes(folder+"/"+(frame++).ToString("D4")+".png",image.EncodeToPNG());UnityEngine.Object.Destroy(image);yield return new WaitForSecondsRealtime(.1f);}
   File.WriteAllText(folder+"/timestamps.json",Newtonsoft.Json.JsonConvert.SerializeObject(times));
  }
  stage.animate=false;stage.GetComponent<DioramaPreviewControls>().visible=true;File.WriteAllText(Dir+"complete.json","{\"captured\":true,\"secondsPerView\":8,\"postEffects\":false,\"performanceBenchmark\":false}");
 }
}
