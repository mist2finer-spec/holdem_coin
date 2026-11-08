#if UNITY_EDITOR
using System;
using System.Linq;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
namespace MountSunday.Review {
 public sealed class ReviewLodVerification:MonoBehaviour {
  public string output;
  [Serializable] class Result {public string asset;public float relativeHeight,distance;public int expected,triangles,drawCalls;public int[] rendered;public bool pass;}
  [Serializable] class Report {public bool passed;public string scope="Actual main camera rendering; no ForceLOD; 20 rendered frames per distance";public Result[] results;}
  public static void Begin(string output){var go=new GameObject("LOD camera verification");go.AddComponent<ReviewLodVerification>().output=output;}
  IEnumerator Start(){
   var cam=Camera.main;var flight=FindFirstObjectByType<MountSundayFreeFlight>();flight.enabled=false;flight.GetComponent<CharacterController>().enabled=false;
   int oldMask=cam.cullingMask;float oldFar=cam.farClipPlane;var pos=cam.transform.position;var rot=cam.transform.rotation;cam.cullingMask=1<<29;cam.farClipPlane=1000000;
   var sceneCameras=UnityEditor.SceneView.sceneViews.Cast<UnityEditor.SceneView>().Select(v=>v.camera).ToArray();var masks=sceneCameras.Select(c=>c.cullingMask).ToArray();foreach(var c in sceneCameras)c.cullingMask&=~(1<<29);
   var results=new List<Result>();var groups=FindObjectsByType<LODGroup>(FindObjectsSortMode.None);
   foreach(string prefix in new[]{"Beech_","Rock_Boulder_","Groundcover_","GoldenHall_"}){
    var source=groups.Where(g=>g.name.StartsWith(prefix)).OrderByDescending(g=>g.size).FirstOrDefault();if(!source)throw new Exception("LOD fixture missing "+prefix);
    var clone=Instantiate(source.gameObject);clone.transform.position=new Vector3(0,3000,0);var group=clone.GetComponent<LODGroup>();var levels=group.GetLODs();
    foreach(var t in clone.GetComponentsInChildren<Transform>(true))t.gameObject.layer=29;
    
    var scale=clone.transform.lossyScale;float size=group.size*Mathf.Max(Mathf.Abs(scale.x),Mathf.Abs(scale.y),Mathf.Abs(scale.z));var center=clone.transform.TransformPoint(group.localReferencePoint);
    for(int i=0;i<=levels.Length;i++){
     float height=i==0?Mathf.Max(1.2f,levels[0].screenRelativeTransitionHeight*1.4f):i==levels.Length?levels[i-1].screenRelativeTransitionHeight*.4f:(levels[i-1].screenRelativeTransitionHeight+levels[i].screenRelativeTransitionHeight)*.5f;
     float distance=size/(2*Mathf.Tan(cam.fieldOfView*Mathf.Deg2Rad*.5f)*height);cam.transform.position=center-Vector3.forward*distance;cam.transform.rotation=Quaternion.identity;
     for(int frame=0;frame<10;frame++)yield return new WaitForEndOfFrame();ReviewLodProbe.Seen.Clear();
     for(int frame=0;frame<20;frame++)yield return new WaitForEndOfFrame();
     if(prefix=="Beech_")ScreenCapture.CaptureScreenshot(Path.Combine(Path.GetDirectoryName(output),"lod-tree-"+i+".png"));
     var seen=Enumerable.Range(0,levels.Length).Where(k=>levels[k].renderers.Any(r=>r.isVisible)).ToArray();int expected=i==levels.Length?-1:i;results.Add(new Result{asset=source.name,relativeHeight=height,distance=distance,expected=expected,triangles=UnityEditor.UnityStats.triangles,drawCalls=UnityEditor.UnityStats.drawCalls,rendered=seen,pass=expected<0?seen.Length==0:seen.Length==1&&seen[0]==expected});
    }
    Destroy(clone);yield return null;
   }
   for(int i=0;i<sceneCameras.Length;i++)sceneCameras[i].cullingMask=masks[i];
   cam.cullingMask=oldMask;cam.farClipPlane=oldFar;cam.transform.SetPositionAndRotation(pos,rot);
   File.WriteAllText(output,JsonUtility.ToJson(new Report{passed=results.All(r=>r.pass),results=results.ToArray()},true));Destroy(gameObject);
  }
 }
}

#endif
