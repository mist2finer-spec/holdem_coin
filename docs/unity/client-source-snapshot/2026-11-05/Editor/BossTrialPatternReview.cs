#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Collections;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;
using IslandGame.BossTrials;
namespace IslandGame.Editor {
 // Explicit Play Mode fixtures, separate from unmodified natural combat runs.
 public static class BossTrialPatternReview {
  static BossTrialController controller;static int boss,pattern,stage,waitFrame;static float hp;
  static JArray results;static TrialPattern attack;
  static string Dir=>BossTrialPlayReview.DirectoryPath;
  public static void Start(){controller=UnityEngine.Object.FindFirstObjectByType<BossTrialController>();if(!EditorApplication.isPlaying||!controller)throw new Exception("Open trial in Play Mode first");boss=pattern=stage=0;results=new JArray();controller.SelectBoss(0);EditorApplication.update-=Tick;EditorApplication.update+=Tick;}
  static void Check(bool value,string text){if(!value)throw new Exception(text);}
  static void Advance(BossTrialSimulation s,float seconds){s.Paused=false;for(int n=0;n<Math.Ceiling(seconds*60);n++)s.Advance(BossTrialSimulation.FixedStep,new TrialInput());s.Paused=true;}
  static void Tick(){
   if(!EditorApplication.isPlaying||!controller){End("interrupted");return;}
   var s=controller.Simulation;if(s==null)return;var view=controller.GetComponent<BossTrialRenderer>();
   try{
    Check(string.IsNullOrEmpty(view.Diagnostic),view.Diagnostic);
    if(stage==0){
     attack=s.Definition.Patterns[pattern];s.Paused=true;s.Hazards.Clear();foreach(var a in s.Actors){a.Cast=null;a.NextDecision=100000;}
     if(attack.Op=="form"){
      s.Actors[0].Hp=s.BossMaxHp*.74f;Advance(s,.05f);Check(s.Phase==2&&s.Actors[0].InvulnerableUntil-s.Time>2.9f,"form invulnerability");
      view.UpdateView();Capture("form");stage=4;waitFrame=Time.frameCount+2;return;
     }
     typeof(BossTrialSimulation).GetProperty("Phase").SetValue(s,attack.MinPhase);
     typeof(BossTrialSimulation).GetMethod("BeginCast",BindingFlags.NonPublic|BindingFlags.Instance).Invoke(s,new object[]{s.Actors[0],attack});
     var threatened=s.Hazards.FirstOrDefault(h=>h.Damage>0);if(threatened!=null)s.Hero.Z=TrialGeometry.Clamp(threatened.Shape==TrialShape.Ring?threatened.OriginZ+.2f:(threatened.MinZ+threatened.MaxZ)*.5f,s.MinZ+.5f,s.MaxZ-.5f);
     hp=s.Hero.Hp;Advance(s,.2f);Check(s.Hero.Hp==hp,"damage during telegraph: "+attack.Id);view.UpdateView();VerifyGeometry(s,view);Capture("warning");waitFrame=Time.frameCount+2;stage=1;return;
    }
    if(Time.frameCount<waitFrame)return;
    if(stage==1){CaptureRender(view,"warning");Advance(s,Math.Max(.016f,attack.Telegraph-.2f+.07f));view.UpdateView();VerifyGeometry(s,view);Capture("active");waitFrame=Time.frameCount+2;stage=2;return;}
    CaptureRender(view,attack.Op=="form"?"form":"active");
    results.Add(new JObject{{"boss",s.Definition.Id},{"pattern",attack.Id},{"kind",attack.Op=="form"?"phase fixture":"isolated pattern fixture"},{"phaseInjected",attack.MinPhase},{"warningNoDamage",attack.Op=="form"?JValue.CreateNull():new JValue(hp==360)},{"geometryChecked",attack.Op!="form"},{"frame",Time.frameCount}});
    controller.ReturnToSelection();pattern++;if(pattern>=s.Definition.Patterns.Count){pattern=0;boss++;}
    if(boss>=10){End("completed");return;}controller.SelectBoss(boss);stage=0;
   }catch(Exception ex){results.Add(new JObject{{"boss",s.Definition.Id},{"pattern",attack?.Id},{"error",ex.ToString()}});End("failed");}
  }
  static void Capture(string suffix){BattleHudReview.Capture(Path.Combine(Dir,"fixture-"+controller.Simulation.Definition.Id+"-"+attack.Id+"-"+suffix+".png"));}
  static void CaptureRender(BossTrialRenderer view,string suffix){
   var before=RenderTexture.active;var output=view.Output;var image=new Texture2D(output.width,output.height,TextureFormat.RGB24,false);
   try{RenderTexture.active=output;image.ReadPixels(new Rect(0,0,image.width,image.height),0,0);image.Apply();File.WriteAllBytes(Path.Combine(Dir,"fixture-"+controller.Simulation.Definition.Id+"-"+attack.Id+"-"+suffix+"-render.png"),image.EncodeToPNG());}
   finally{RenderTexture.active=before;UnityEngine.Object.Destroy(image);}
  }
  static void VerifyGeometry(BossTrialSimulation s,BossTrialRenderer view){
   var entries=(IDictionary)typeof(BossTrialRenderer).GetField("hazards",BindingFlags.NonPublic|BindingFlags.Instance).GetValue(view);
   foreach(var h in s.Hazards.Where(h=>!h.Consumed)){
    Check(entries.Contains(h.Id),"missing hazard visual "+h.Id);var item=entries[h.Id];var mesh=(Mesh)item.GetType().GetField("Mesh").GetValue(item);var vertices=mesh.vertices;bool warning=h.Telegraph(s.Time);
    Check(vertices.Length>=4,"empty hazard mesh");float min=h.MinZ,max=h.MaxZ;
    if(h.Shape==TrialShape.Ring){if(warning){float radius=Math.Abs(h.Speed)*(h.EndsAt-h.ActiveAt)+.32f;min=h.OriginZ-radius;max=h.OriginZ+radius;}else{float outer=Math.Max(h.PreviousRadius,h.Radius)+.32f;min=h.OriginZ-outer;max=h.OriginZ+outer;}}
    else if(h.Shape==TrialShape.Projectile&&!warning){min=Math.Min(min,h.PreviousZ-h.Radius);max=Math.Max(max,h.PreviousZ+h.Radius);}
    Check(Math.Abs(vertices.Min(p=>p.z)-min)<.001f&&Math.Abs(vertices.Max(p=>p.z)-max)<.001f,"render/collision horizontal bounds "+attack.Id);
    Check(Math.Abs(vertices.Min(p=>p.y)-(view.GroundY+h.Y0))<.001f&&Math.Abs(vertices.Max(p=>p.y)-(view.GroundY+h.Y1))<.001f,"render/collision vertical bounds "+attack.Id);
    Check(vertices.All(p=>Math.Abs(p.x-(view.DepthX+.12f))<.001f),"native depth lane");
   }
  }
  public static void End(string reason="manual"){EditorApplication.update-=Tick;if(results!=null)File.WriteAllText(Path.Combine(Dir,"pattern-play-fixtures.json"),new JObject{{"reason",reason},{"results",results},{"scope","Explicit phase/timeline fixtures; not natural player victories"}}.ToString());results=null;}
 }
}
#endif
