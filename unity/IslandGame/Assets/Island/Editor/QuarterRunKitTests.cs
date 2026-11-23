using System.Linq;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace IslandGame.Tests {
 // quarter-run-v1 (2026-11-23): the QuarterView (planar) shows runQuarter instead of run; the side view keeps run. Kit clip shape.
 public sealed class QuarterRunKitTests {
  static AnimationClip Clip(string n)=>new AnimationClip{name=n};
  static AnimationClip Timed(string n,float len){var c=Clip(n);c.SetCurve("",typeof(Transform),"localPosition.x",AnimationCurve.Linear(0,0,len,0));return c;}

  [Test] public void Planar_view_swaps_only_the_run_clip(){
   var a=ScriptableObject.CreateInstance<Battle3DAssets>();
   try{
    a.idle=Clip("idle");a.run=Clip("run");a.walk=Clip("walk");a.runQuarter=Clip("runQ");
    Assert.AreSame(a.runQuarter,a.ViewClip(a.run,true),"quarter view: run -> runQuarter");
    Assert.AreSame(a.run,a.ViewClip(a.run,false),"side view keeps run");
    Assert.AreSame(a.idle,a.ViewClip(a.idle,true));Assert.AreSame(a.walk,a.ViewClip(a.walk,true));
    Assert.IsNull(a.ViewClip(null,true));
    Assert.IsTrue(a.Loops(a.runQuarter));Assert.IsTrue(a.IsRun(a.runQuarter));Assert.IsTrue(a.IsRun(a.run));Assert.IsFalse(a.IsRun(a.idle));
    a.runQuarter=null;
    Assert.AreSame(a.run,a.ViewClip(a.run,true),"no runQuarter: run in both views");
   }finally{Object.DestroyImmediate(a);}
  }

  [Test] public void Stride_per_clip_second_uses_the_clip_own_cycle(){
   var a=ScriptableObject.CreateInstance<Battle3DAssets>();
   try{
    a.run=Timed("run",.5f);a.runQuarter=Timed("runQ",.8f);
    Assert.AreEqual(3.8f,a.StridePerClipSecond(a.run),1e-5f,"original rule (no stride set)");
    a.runStrideMeters=2f;Assert.AreEqual(2f/.5f,a.StridePerClipSecond(a.run),1e-4f);
    a.runQuarterStrideMeters=1.6f;Assert.AreEqual(1.6f/.8f,a.StridePerClipSecond(a.runQuarter),1e-4f,"quarter: its own cycle");
    Assert.AreEqual(2f/.5f,a.StridePerClipSecond(a.run),1e-4f,"side run unchanged");
    a.runQuarterStrideMeters=0;Assert.AreEqual(2f/.8f,a.StridePerClipSecond(a.runQuarter),1e-4f,"no quarter stride: the run stride rule");
   }finally{Object.DestroyImmediate(a);}
  }

  [Test] public void Kit_quarter_run_is_a_seamless_56_frame_loop_on_the_run_tracks(){
   var kit=Battle3DAssets.LoadKit();if(!kit)Assert.Ignore("no kit asset");
   var q=kit.runQuarter;Assert.IsNotNull(q,"kit runQuarter");Assert.AreNotSame(kit.run,q);
   Assert.AreEqual(56/60f,q.length,1e-3f,"0.9333 s cycle");Assert.IsTrue(AnimationUtility.GetAnimationClipSettings(q).loopTime);
   Assert.Greater(kit.runQuarterStrideMeters,1f);Assert.Less(kit.runQuarterStrideMeters,3f);
   var bq=AnimationUtility.GetCurveBindings(q).Select(b=>b.path+"|"+b.propertyName).OrderBy(x=>x).ToArray();
   var br=AnimationUtility.GetCurveBindings(kit.run).Select(b=>b.path+"|"+b.propertyName).OrderBy(x=>x).ToArray();
   CollectionAssert.AreEqual(br,bq,"same tracks as the side run (blend without missing curves)");
   float E(string path,string prop,float t){var c=AnimationUtility.GetEditorCurve(q,EditorCurveBinding.FloatCurve(path,typeof(Transform),prop));return c==null?float.NaN:c.Evaluate(t);}
   foreach(var path in AnimationUtility.GetCurveBindings(q).Select(b=>b.path).Distinct()){
    Quaternion Rq(float t)=>new Quaternion(E(path,"m_LocalRotation.x",t),E(path,"m_LocalRotation.y",t),E(path,"m_LocalRotation.z",t),E(path,"m_LocalRotation.w",t));
    Assert.Less(Quaternion.Angle(Rq(0),Rq(q.length)),.05f,"rotation seam "+path);
    foreach(var ax in new[]{"x","y","z"}){float p0=E(path,"m_LocalPosition."+ax,0);if(!float.IsNaN(p0))Assert.AreEqual(p0,E(path,"m_LocalPosition."+ax,q.length),2e-4f,"position seam "+path);}
   }
  }
 }
}
