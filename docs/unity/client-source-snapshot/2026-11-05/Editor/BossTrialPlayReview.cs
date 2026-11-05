#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;
using IslandGame.BossTrials;
namespace IslandGame.Editor {
 // Editor-only input driver. It changes no actor HP, damage, cooldowns or boss definitions.
 public static class BossTrialPlayReview {
  static BossTrialController controller;
  static int boss,phase,lastStage;
  static bool idleRun;
  static double started,next;
  static JArray results,frames;
  static System.Collections.Generic.HashSet<string> patterns;
  public static string DirectoryPath=>File.ReadAllText("G:/new_project/IslandGame/.island-tools/boss-trials-backup-path.txt");
  public static TrialInput Policy(BossTrialSimulation s){
   var hero=s.Hero;var target=s.Actors.Where(a=>a.Alive).OrderBy(a=>Math.Abs(a.Z-hero.Z)).FirstOrDefault();
   var input=new TrialInput{Attack=true,Skill=true};if(target==null)return input;
   float distance=target.Z-hero.Z;input.Move=Math.Abs(distance)>2.9f?Math.Sign(distance):Math.Sign(distance)*.06f;
   foreach(var h in s.Hazards){
    if(h.Friendly||h.Consumed||h.Damage<=0)continue;
    var probe=new TrialHero{Z=hero.Z,Air=0};if(!TrialGeometry.HeroIntersects(h,probe))continue;
    float arrival=h.ActiveAt-s.Time;
    if(h.Shape==TrialShape.Projectile){float z=h.Telegraph(s.Time)?h.OriginZ:(h.Z0+h.Z1)*.5f;arrival=Math.Max(0,h.ActiveAt-s.Time)+Math.Abs(z-hero.Z)/Math.Max(1,Math.Abs(h.Speed));}
    if(h.Band=="low"||h.Y1<=.85f){if(arrival<.28f&&hero.Air<.02f)input.Jump=true;}
    else if(h.Band=="high"||h.Y0>=1.05f){if(arrival<.35f&&hero.Air<.02f)input.Slide=true;}
    else {
     float left=h.MinZ-hero.Radius-.22f,right=h.MaxZ+hero.Radius+.22f;
     bool canLeft=left>s.MinZ+.45f,canRight=right<s.MaxZ-.45f;
     float destination=canLeft&&(!canRight||Math.Abs(hero.Z-left)<Math.Abs(right-hero.Z))?left:right;
     input.Move=Math.Sign(destination-hero.Z);
     if(arrival<.17f)input.Dodge=input.Move<0?-1:1;
    }
   }
   return input;
  }
  public static string ModelPolicy(){
   var catalog=TrialCatalog.Parse(Resources.Load<TextAsset>("BossTrials/bosses").text);var rows=new JArray();
   foreach(var d in catalog.Bosses){var s=new BossTrialSimulation(d,"spear");for(int i=0;i<18000&&s.Result==TrialResult.Playing;i++)s.Advance(BossTrialSimulation.FixedStep,Policy(s));rows.Add(new JObject{{"boss",d.Id},{"result",s.Result.ToString()},{"hp",s.Hero.Hp},{"time",s.Time},{"bossHp",s.BossHp}});}
   File.WriteAllText(Path.Combine(DirectoryPath,"policy-model.json"),rows.ToString());return rows.ToString();
  }
  public static void Start(bool idle=false){
   if(!EditorApplication.isPlaying)throw new Exception("Play Mode required");
   controller=UnityEngine.Object.FindFirstObjectByType<BossTrialController>();if(!controller)throw new Exception("Open boss menu first");
   // Weapon selection is an ordinary menu choice; no account equipment is altered.
   typeof(BossTrialController).GetField("weapon",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).SetValue(controller,"spear");
   idleRun=idle;boss=0;results=new JArray();frames=new JArray();patterns=new System.Collections.Generic.HashSet<string>();Select();EditorApplication.update-=Tick;EditorApplication.update+=Tick;
  }
  static void Select(){controller.SelectBoss(boss);started=EditorApplication.timeSinceStartup;next=0;phase=0;lastStage=0;}
  static void Tick(){
   if(!EditorApplication.isPlaying||!controller){Stop("Play stopped");return;}
   var s=controller.Simulation;if(s==null)return;
   var view=controller.GetComponent<BossTrialRenderer>();if(!string.IsNullOrEmpty(view.Diagnostic)){Stop(view.Diagnostic);return;}
   if(s.Paused)s.Paused=false;
   controller.SubmitInput(idleRun?new TrialInput():Policy(s));
   foreach(var a in s.Actors)if(a.Cast!=null)patterns.Add(s.Definition.Id+"/"+a.Cast.Pattern.Id);
   if(s.Time>=next){frames.Add(new JObject{{"boss",s.Definition.Id},{"frame",Time.frameCount},{"time",s.Time},{"heroHp",s.Hero.Hp},{"bossHp",s.BossHp},{"phase",s.Phase},{"primaries",s.LivingPrimaries},{"hazards",s.Hazards.Count}});next=s.Time+.5;}
   if(s.Phase!=phase){phase=s.Phase;BattleHudReview.Capture(Path.Combine(DirectoryPath,s.Definition.Id+(idleRun?"-idle":"")+"-phase"+phase+".png"));}
   if(s.Result==TrialResult.Playing&&EditorApplication.timeSinceStartup-started<240)return;
   if(lastStage==0){lastStage=1;BattleHudReview.Capture(Path.Combine(DirectoryPath,s.Definition.Id+(idleRun?"-idle":"")+"-natural-result.png"));results.Add(new JObject{{"boss",s.Definition.Id},{"result",s.Result.ToString()},{"heroHp",s.Hero.Hp},{"bossHp",s.BossHp},{"time",s.Time},{"frame",Time.frameCount}});next=EditorApplication.timeSinceStartup+.6;return;}
   if(EditorApplication.timeSinceStartup<next)return;
   if(++boss<10){controller.ReturnToSelection();Select();}else Stop("completed");
  }
  public static void Stop(string reason="manual"){
   EditorApplication.update-=Tick;if(results==null)return;
   File.WriteAllText(Path.Combine(DirectoryPath,idleRun?"natural-defeats.json":"natural-play.json"),new JObject{{"reason",reason},{"results",results},{"observedPatterns",new JArray(patterns)},{"frames",frames}}.ToString());results=null;
  }
 }
}
#endif
