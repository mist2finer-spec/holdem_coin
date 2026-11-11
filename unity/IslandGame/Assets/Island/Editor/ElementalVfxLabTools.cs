using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace IslandGame.Editor {
 public static class ElementalVfxLabTools {
  public const string ScenePath="Assets/Island/Scenes/ElementalVfxLab.unity";
  [MenuItem("Island/Elemental VFX/Open lab")]
  public static void Open(){
   if(EditorApplication.isPlaying)throw new InvalidOperationException("Exit Play before changing the preview scene.");
   var active=SceneManager.GetActiveScene();if(active.isDirty)throw new InvalidOperationException("The current scene has unsaved edits. They have been preserved.");
   if(!File.Exists(ScenePath)){var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);new GameObject("Elemental VFX Lab").AddComponent<ElementalVfxLab>();EditorSceneManager.SaveScene(scene,ScenePath);}
   else EditorSceneManager.OpenScene(ScenePath,OpenSceneMode.Single);
   BattleHudReview.SetSize(1600,900);
  }
  public static JObject Snapshot(){var lab=UnityEngine.Object.FindFirstObjectByType<ElementalVfxLab>();if(!lab||!lab.Ready)throw new InvalidOperationException("Lab is not ready");
   float[] V(Vector3 p)=>new[]{p.x,p.y,p.z};
   return new JObject{{"frame",Time.frameCount},{"clock",lab.Clock},{"kind",lab.Profile.Kind.ToString()},{"tier",lab.Profile.Tier},{"age",lab.CastAge},{"hits",lab.TotalHits},{"walls",lab.WallContacts},{"ground",lab.GroundContacts},{"particles",lab.ParticleCount},{"drops",lab.ActiveDropCount},{"poolSlots",lab.VisualPoolSlots},{"queries",lab.QueryCount},{"targets",JArray.FromObject(lab.Targets.Select(t=>new {name=t.Label,hits=t.Hits,damage=t.Damage,displacement=t.MaxDisplacement,position=V(t.Body.position)}))},{"hitLog",JArray.FromObject(lab.HitLog.Select(h=>new {h.cast,h.target,h.element,h.time,h.damage,point=V(h.point),impulse=V(h.velocity)}))}};
  }
  public static string Verify(string directory){
   var lab=UnityEngine.Object.FindFirstObjectByType<ElementalVfxLab>();if(!lab||!lab.Ready)throw new InvalidOperationException("Start the lab first");Directory.CreateDirectory(directory);
   var checks=new JArray();var cases=new JArray();bool pass=true;int baseline=UnityEngine.Object.FindObjectsByType<ParticleSystem>(FindObjectsSortMode.None).Length;
   lab.AutoCycle=false;lab.Paused=true;lab.Sound=false;lab.ResetOnCast=true;
   void Check(string name,bool condition){checks.Add(new JObject{{"name",name},{"pass",condition}});pass&=condition;}
   foreach(ElementalAttackKind kind in Enum.GetValues(typeof(ElementalAttackKind)))for(int tier=1;tier<=(kind==ElementalAttackKind.Sword?5:3);tier++){
    lab.Cast(kind,tier);lab.ReviewStep(lab.Profile.Duration+.2f);var result=Snapshot();cases.Add(result);
    Check(kind+" "+tier+" hits",lab.TotalHits>0);Check(kind+" "+tier+" compound colliders hit once",lab.Targets.All(t=>t.Hits<=1));Check(kind+" "+tier+" outside excluded",lab.Targets.Last().Hits==0);Check(kind+" "+tier+" impulses",lab.Targets.Any(t=>t.Hits>0&&t.MaxDisplacement>.04f));
    if(kind==ElementalAttackKind.Water){Check("Water "+tier+" wall hit",lab.WallContacts>0);Check("Water "+tier+" wall shields target",lab.Targets[5].Hits==0);}
   }
   lab.Cast(ElementalAttackKind.Sword,4);lab.ReviewStep(.5f);Check("Sword knockback points away from caster",lab.HitLog.All(h=>Vector3.Dot(new Vector3(h.velocity.x,0,h.velocity.z),lab.Targets.First(t=>t.Label==h.target).Home)>0));
   var cover=GameObject.CreatePrimitive(PrimitiveType.Cube);cover.name="Verification-only occluder";cover.layer=28;SceneManager.MoveGameObjectToScene(cover,lab.LabCamera.gameObject.scene);
   try {
    cover.transform.position=new Vector3(1.75f,2,0);cover.transform.localScale=new Vector3(5,.2f,5);Physics.SyncTransforms();
    lab.Cast(ElementalAttackKind.Lightning,1);lab.ReviewStep(1);Check("Roof blocks lightning before ground impact",lab.WallContacts>0&&lab.TotalHits==0);
    cover.transform.position=new Vector3(.7f,.8f,0);cover.transform.localScale=new Vector3(.12f,2,3);Physics.SyncTransforms();
    lab.Cast(ElementalAttackKind.Sword,4);lab.ReviewStep(1);Check("Wall blocks sword damage to targets behind it",lab.Targets.Take(3).All(t=>t.Hits==0));
   } finally {UnityEngine.Object.DestroyImmediate(cover);Physics.SyncTransforms();}
   lab.ProjectileSpeedOverride=80;lab.Cast(ElementalAttackKind.Water,1);lab.ReviewStep(1);Check("80m/s droplets do not tunnel through 12cm wall",lab.WallContacts>0&&lab.Targets[5].Hits==0);lab.ProjectileSpeedOverride=0;
   lab.Cast(ElementalAttackKind.Lightning,1);lab.Targets[1].Body.position+=Vector3.right*6;Physics.SyncTransforms();lab.ReviewStep(1.2f);Check("Lightning locks ground target; moving out can evade",lab.Targets[1].Hits==0);
   lab.Cast(ElementalAttackKind.Sword,1);lab.Paused=true;float before=lab.Clock;lab.Advance(.2f);Check("Pause freezes simulation",lab.Clock==before&&lab.TotalHits==0);
   lab.Paused=false;lab.PlaybackSpeed=1;lab.Cast(ElementalAttackKind.Water,2);for(int i=0;i<300;i++)lab.Advance(.01f);var fast=lab.Targets.Select(t=>t.Hits).ToArray();lab.Cast(ElementalAttackKind.Water,2);for(int i=0;i<90;i++)lab.Advance(1f/30);Check("30 / 100 FPS produces identical hit sets",fast.SequenceEqual(lab.Targets.Select(t=>t.Hits)));
   lab.Paused=true;lab.Cast(ElementalAttackKind.Lightning,1);lab.Targets[1].WetUntil=lab.Clock+4;lab.ReviewStep(1);Check("Wet target lightning multiplier",Mathf.Abs(lab.Targets[1].Damage-lab.Profile.Damage*1.25f)<.01f);
   for(int i=0;i<10;i++){lab.Cast((ElementalAttackKind)(i%3),1+i%3);lab.ReviewStep(.9f);}
   Check("Particle pool is bounded after repeated casts",UnityEngine.Object.FindObjectsByType<ParticleSystem>(FindObjectsSortMode.None).Length==baseline);
   lab.Cast(ElementalAttackKind.Water,3);lab.ReviewStep(4);Check("All droplets expire",lab.ActiveDropCount==0);
   var report=new JObject{{"pass",pass},{"checks",checks},{"cases",cases},{"particleSystems",baseline},{"scope","Local PhysicsScene; real colliders, compound targets, rigidbody impulses, sweep and occlusion queries. Not recovered Genshin engine coefficients."}};File.WriteAllText(Path.Combine(directory,"physics-validation.json"),report.ToString());
   lab.PlaybackSpeed=.65f;lab.Sound=true;lab.Cast(ElementalAttackKind.Sword,1);lab.Paused=false;lab.AutoCycle=true;
   Debug.Log("ELEMENTAL_LAB_VERIFY "+(pass?"PASS":"FAIL")+" "+checks.Count+" checks");return report.ToString();
  }
  public static void Capture(string directory,ElementalAttackKind kind,int tier,float age){
   var lab=UnityEngine.Object.FindFirstObjectByType<ElementalVfxLab>();lab.AutoCycle=false;lab.Paused=true;lab.Cast(kind,tier);lab.ReviewStep(age);Directory.CreateDirectory(directory);string stem=kind.ToString().ToLowerInvariant()+"-"+tier;
   File.WriteAllText(Path.Combine(directory,stem+".json"),Snapshot().ToString());ScreenCapture.CaptureScreenshot(Path.Combine(directory,stem+".png"));
  }
 }
}
