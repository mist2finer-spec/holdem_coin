using System;
using System.IO;
using System.Linq;
using UnityEngine;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class TestCamera {
 static JArray checks=new JArray();static void Check(string n,bool p)=>checks.Add(new JObject{{"name",n},{"pass",p}});
 public static object Main(){
  checks=new JArray();var root=new GameObject("Camera requirement fixture");var cameraObject=new GameObject("Main Camera");cameraObject.transform.SetParent(root.transform,false);var camera=cameraObject.AddComponent<Camera>();camera.enabled=false;camera.rect=new Rect(0,.5f,1,.5f);camera.aspect=1080f/1170;
  var rig=root.AddComponent<BattleCameraController>();rig.externallyDriven=true;rig.Bind(camera);rig.maxBossDistance=64;
  var boss=new GameObject("Giant boss fixture");var mesh=IslandDisplayMeshes.Create(PrimitiveType.Cube);var child=new GameObject("Boss bounds",typeof(MeshFilter),typeof(MeshRenderer));child.transform.SetParent(boss.transform,false);child.GetComponent<MeshFilter>().sharedMesh=mesh;child.transform.localPosition=Vector3.up*6.5f;child.transform.localScale=new Vector3(5.6f,13,4);boss.transform.position=Vector3.right*12;
  GameObject blocker=null;
  try{
   rig.SetPose(Vector3.zero,1,0,0);rig.ResetPose();for(int i=0;i<180;i++)rig.Tick(1f/60);
   Check("perspective camera and pivot-child rig",!camera.orthographic&&camera.transform.parent==rig.transform);
   Check("side preset 18 degree FOV / pitch10 / distance28",rig.side.verticalFov==18&&rig.side.pitch==10&&rig.side.distance==28);
   Check("ground row solved to 18 percent",Mathf.Abs(rig.GroundViewportPosition-.18f)<.005f);
   float width=2*rig.CurrentDistance*Mathf.Tan(camera.fieldOfView*Mathf.Deg2Rad*.5f)*camera.aspect;
   camera.aspect=.75f;for(int i=0;i<90;i++)rig.Tick(1f/60);float narrow=2*rig.CurrentDistance*Mathf.Tan(camera.fieldOfView*Mathf.Deg2Rad*.5f)*camera.aspect;
   Check("narrow portrait keeps horizontal view width",Mathf.Abs(width-narrow)<.01f);Check("narrow portrait increases vertical FOV",camera.fieldOfView>18);
   for(int i=0;i<6;i++){rig.SetPose(Vector3.zero,-1,0,0);rig.Tick(1f/60);}Check("turn delay rejects brief facing change",rig.ConfirmedFacing==1);
   for(int i=0;i<4;i++)rig.Tick(1f/60);Check("confirmed facing switches after 120ms",rig.ConfirmedFacing==-1);
   for(int i=0;i<120;i++)rig.Tick(1f/60);Check("left look-ahead converges to -2.8",Mathf.Abs(rig.CurrentLookAhead+2.8f)<.02f);
   rig.SetPose(new Vector3(-.1f,0,0),1,0,0);rig.Tick(1f/60);rig.SetPose(new Vector3(.4f,0,0),1,0,0);rig.Tick(1f/60);Check("travel confirms turn before delay",rig.ConfirmedFacing==1);
   for(int i=0;i<120;i++){rig.SetPose(Vector3.zero,1,0,20);rig.Tick(1f/60);}Check("velocity boost remains bounded and leaves actor margin",rig.CurrentLookAhead<=4.8f&&camera.WorldToViewportPoint(Vector3.zero).x>.04f);
   float high=rig.CurrentLookAhead;for(int i=0;i<20;i++){rig.SetPose(Vector3.zero,1,0,0);rig.Tick(1f/60);}Check("deceleration smoothly removes velocity boost",rig.CurrentLookAhead<high&&rig.CurrentLookAhead>2.8f);
   for(int i=0;i<120;i++)rig.Tick(1f/60);float y=root.transform.position.y;
   for(int i=0;i<120;i++){rig.SetPose(Vector3.up,1,0,0);rig.Tick(1f/60);}Check("one meter jump stays inside vertical deadzone",Mathf.Abs(root.transform.position.y-y)<.005f);
   for(int i=0;i<120;i++){rig.SetPose(Vector3.up*2,1,2,0);rig.Tick(1f/60);}Check("floor elevation tracks independently of jump deadzone",Mathf.Abs(root.transform.position.y-y-2)<.02f);
   rig.SetChamberBounds(-1,1,true);for(int i=0;i<90;i++){rig.SetPose(Vector3.right*10,1,0,0);rig.Tick(1f/60);}Check("combat chamber clamps camera X",root.transform.position.x<=1.001f);
   rig.SetChamberBounds(-1,1,false);for(int i=0;i<90;i++)rig.Tick(1f/60);Check("crossing bridge releases chamber clamp",root.transform.position.x>1);
   rig.SetPose(Vector3.zero,1,0,0);rig.SetViewMode(ViewMode.QuarterView,boss.transform);for(int i=0;i<180;i++)rig.Tick(1f/60);
   Check("quarter preset rotation converges smoothly",Mathf.Abs(Mathf.DeltaAngle(root.transform.eulerAngles.x,42))<.1f&&Mathf.Abs(Mathf.DeltaAngle(root.transform.eulerAngles.y,12))<.1f);
   Check("quarter weighted midpoint uses 65/35",Mathf.Abs(root.transform.position.x-12*.35f)<.03f);
   var bounds=child.GetComponent<Renderer>().bounds;bool fits=true;for(int i=0;i<8;i++){var p=bounds.center+Vector3.Scale(bounds.extents,new Vector3((i&1)==0?-1:1,(i&2)==0?-1:1,(i&4)==0?-1:1));var v=camera.WorldToViewportPoint(p);fits&=v.x>=0&&v.x<=1&&v.y>=0&&v.y<=1&&v.z>0;}
   var hero=camera.WorldToViewportPoint(Vector3.up*.65f);Check("giant bounds and player fit in one perspective frame",fits&&hero.x>=0&&hero.x<=1&&hero.y>=0&&hero.y<=1);Check("boss zoom has a finite configured cap",rig.CurrentDistance>=20&&rig.CurrentDistance<=64);
   blocker=new GameObject("Foreground tree fixture",typeof(MeshFilter),typeof(MeshRenderer));blocker.layer=30;blocker.GetComponent<MeshFilter>().sharedMesh=mesh;blocker.transform.position=Vector3.Lerp(camera.transform.position,Vector3.up*.7f,.5f);blocker.transform.localScale=Vector3.one*3;blocker.AddComponent<BattleOccluder>().SendMessage("OnEnable");var occlusion=root.GetComponent<BattleForegroundOcclusion>();occlusion.Apply(camera,Vector3.zero,42);Check("foreground obstacle hides without colliders",blocker.GetComponent<Renderer>().forceRenderingOff);occlusion.Apply(camera,Vector3.zero,10);Check("foreground obstacle restores in side view",!blocker.GetComponent<Renderer>().forceRenderingOff);
   rig.SetViewMode(ViewMode.TopDown1945);for(int i=0;i<120;i++)rig.Tick(1f/60);Check("top-down state exists and transitions",rig.Mode==ViewMode.TopDown1945&&Mathf.Abs(root.transform.eulerAngles.x-82)<.1f);
   rig.SetViewMode(ViewMode.Side25D);for(int i=0;i<180;i++)rig.Tick(1f/60);Check("return to side view restores ground framing",rig.Mode==ViewMode.Side25D&&Mathf.Abs(rig.GroundViewportPosition-.18f)<.01f);
   var report=new JObject{{"passed",checks.All(c=>(bool)c["pass"])},{"checks",checks}};File.WriteAllText("C:/Users/SHK/island-boss-camera-review/camera-tests.json",report.ToString());return new{passed=(bool)report["passed"],checks=checks.Count,failures=checks.Where(c=>!(bool)c["pass"]).ToArray()};
  }finally{if(blocker)UnityEngine.Object.DestroyImmediate(blocker);UnityEngine.Object.DestroyImmediate(boss);UnityEngine.Object.DestroyImmediate(root);UnityEngine.Object.DestroyImmediate(mesh);}
 }
}
