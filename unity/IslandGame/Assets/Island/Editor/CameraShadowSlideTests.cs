using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;

namespace IslandGame.Tests {
 // camera-shadow-slide brief (2026-11-23, user): (1) the quarter-view zoom stays at the "hero next to the boss" level whatever the
 // hero-boss gap; (2) the contact shadow stays on the ground under a jumping hero (it rode up with the actor root); (3) the kit hair mesh
 // carries three stray head-weighted chips ~15-20 cm below the hair that pop out behind the back in the slide pose; they are dropped
 // from the displayed mesh.
 public sealed class CameraShadowSlideTests {
  static (float dist,float fov,bool heroIn) Quarter(float bossGap,float fixedDistance,bool warning){
   var rigGo=new GameObject("rig fixed zoom test");var camGo=new GameObject("cam");camGo.transform.SetParent(rigGo.transform,false);var cam=camGo.AddComponent<Camera>();
   var q=Battle3DView.KitBossQuarter;var right=Quaternion.Euler(0,q.yaw,0)*Vector3.right;
   var bossGo=GameObject.CreatePrimitive(PrimitiveType.Cube);var bossRoot=new GameObject("boss root").transform;bossRoot.position=right*bossGap;bossGo.transform.position=bossRoot.position+Vector3.up*1.6f;bossGo.transform.localScale=new Vector3(2.4f,3.2f,2.4f);bossGo.transform.SetParent(bossRoot,true);
   try{
    cam.aspect=1080f/2340f;var rig=rigGo.AddComponent<BattleCameraController>();rig.Bind(cam);rig.externallyDriven=true;rig.maxBossDistance=40;rig.quarter=q;rig.heroCentricBoss=true;rig.fixedQuarterDistance=fixedDistance;
    rig.SetPose(Vector3.zero,1,0,0);rig.SetViewMode(ViewMode.QuarterView,bossRoot);rig.ResetPose();
    // a warning disc 6 m away from the hero (would push an auto-framed camera out)
    if(warning){rig.WarningActive=true;rig.WarningBounds=new Bounds(-right*6+Vector3.up*.05f,new Vector3(3f,.1f,3f));}
    for(int i=0;i<240;i++)rig.Tick(1/60f);
    bool In(Vector3 p){var v=cam.WorldToViewportPoint(p);return v.z>0&&v.x>=0&&v.x<=1&&v.y>=0&&v.y<=1;}
    return (rig.CurrentDistance,cam.fieldOfView,In(Vector3.zero)&&In(Vector3.up*1.2f));
   }finally{Object.DestroyImmediate(rigGo);Object.DestroyImmediate(bossRoot.gameObject);}
  }
  [Test] public void Fixed_quarter_zoom_keeps_the_close_distance_at_any_boss_gap(){
   float close=Quarter(1,0,false).dist;var lines=new List<string>{$"auto close {close:F2}"};
   foreach(float gap in new[]{1f,4f,7f,10f})foreach(bool warn in new[]{false,true}){
    var auto=Quarter(gap,0,warn);var fix=Quarter(gap,Battle3DView.KitBossQuarter.distance,warn);lines.Add($"gap {gap} warn {warn}: auto {auto.dist:F2} fixed {fix.dist:F2} fov {fix.fov:F2}/{auto.fov:F2}");
    Assert.AreEqual(Battle3DView.KitBossQuarter.distance,fix.dist,.02f,$"fixed zoom at gap {gap} warning {warn}");Assert.AreEqual(auto.fov,fix.fov,.001f,"same lens");Assert.IsTrue(fix.heroIn,"hero in view");
   }
   TestContext.WriteLine(string.Join("\n",lines));
   Assert.AreEqual(close,Battle3DView.KitBossQuarter.distance,.05f,"the fixed value is the auto distance with the hero next to the boss");
   Assert.Greater(Quarter(10,0,false).dist,close+2,"control: auto framing zooms out for a far boss (what the user saw)");
  }
  [Test] public void Fixed_quarter_zoom_does_not_touch_the_side_view(){
   float Side(float fixedDistance){var rigGo=new GameObject("rig side test");var camGo=new GameObject("cam");camGo.transform.SetParent(rigGo.transform,false);var cam=camGo.AddComponent<Camera>();
    try{cam.aspect=1080f/2340f;var rig=rigGo.AddComponent<BattleCameraController>();rig.Bind(cam);rig.externallyDriven=true;rig.quarter=Battle3DView.KitBossQuarter;rig.fixedQuarterDistance=fixedDistance;
     rig.SetPose(Vector3.zero,1,0,0);rig.SetViewMode(ViewMode.Side25D);rig.ResetPose();for(int i=0;i<120;i++){rig.SetPose(new Vector3(i*.05f,0,0),1,0,3);rig.Tick(1/60f);}return rig.CurrentDistance*1000+cam.transform.position.x;}
    finally{Object.DestroyImmediate(rigGo);}}
   Assert.AreEqual(Side(0),Side(Battle3DView.KitBossQuarter.distance),1e-4f);
  }
  [Test] public void Contact_shadow_stays_on_the_ground_and_shrinks_with_height(){
   var root=new GameObject("actor root");var shadow=new GameObject("Contact shadow").transform;shadow.SetParent(root.transform,false);var baseScale=new Vector3(.48f,.004f,.20f);
   try{
    foreach(float air in new[]{0f,.4f,1.03f}){
     root.transform.position=new Vector3(3,.25f+air,1); // ground .25 + jump height
     Battle3DView.PlaceContactShadow(shadow,baseScale,air);
     Assert.AreEqual(.25f+.005f,shadow.position.y,1e-4f,$"on the ground at air {air}");Assert.AreEqual(3f,shadow.position.x,1e-5f);Assert.AreEqual(1f,shadow.position.z,1e-5f);
     float k=shadow.localScale.x/baseScale.x;Assert.AreEqual(k,shadow.localScale.z/baseScale.z,1e-5f,"uniform in the ground plane");
     if(air==0)Assert.AreEqual(1f,k,1e-5f,"standing: unchanged");else Assert.Less(k,1f,"smaller in the air");
    }
   }finally{Object.DestroyImmediate(root);}
  }
  [Test] public void Kit_hair_stray_chips_are_dropped_and_nothing_else(){
   var kit=Battle3DAssets.LoadKit();Assert.IsNotNull(kit,"kit asset");var dropped=new List<string>();int hairTris=0;
   foreach(var s in kit.hero.GetComponentsInChildren<SkinnedMeshRenderer>(true)){
    var src=s.sharedMesh;var clean=Battle3DView.WithoutStrayIslands(src,out int removedVerts,out int removedTris);
    if(clean==null){Assert.AreEqual(0,removedTris);continue;}
    try{
     dropped.Add($"{s.name}: {removedVerts} verts {removedTris} tris");
     Assert.AreEqual(src.vertexCount,clean.vertexCount,"vertices and weights kept");Assert.AreEqual(src.subMeshCount,clean.subMeshCount);
     int before=0,after=0;for(int i=0;i<src.subMeshCount;i++){before+=src.GetTriangles(i).Length/3;after+=clean.GetTriangles(i).Length/3;}Assert.AreEqual(before-removedTris,after);
     if(s.name=="SM_Hair")hairTris=removedTris;
    }finally{Object.DestroyImmediate(clean);}
   }
   TestContext.WriteLine(string.Join("\n",dropped));
   Assert.AreEqual(1,dropped.Count,"only the hair has stray chips: "+string.Join("; ",dropped));
   StringAssert.StartsWith("SM_Hair: 14 verts",dropped[0],"the three nape chips (4 + 4 + 6 vertices)");Assert.Greater(hairTris,0);
  }
 }
}
