#if UNITY_EDITOR
using System;
using System.IO;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
namespace MountSunday.Review {
 public sealed class ReviewVideo:MonoBehaviour {
  public string output;public float duration=26;readonly List<float> times=new List<float>();
  public static void Begin(string path){var r=new GameObject("Actual Unity review recording").AddComponent<ReviewVideo>();r.output=path;}
  IEnumerator Start(){
   Directory.CreateDirectory(output);var road=JsonUtility.FromJson<RoadPoints>(Resources.Load<TextAsset>("MountSundayWalkingRoad").text).points;
   var f=FindFirstObjectByType<MountSundayFreeFlight>();f.enabled=false;f.GetComponent<CharacterController>().enabled=false;var cam=Camera.main;cam.transform.localPosition=new Vector3(0,2,0);
   double begin=Time.realtimeSinceStartupAsDouble,next=begin;int frame=0;
   while(Time.realtimeSinceStartupAsDouble-begin<duration){
    float t=(float)(Time.realtimeSinceStartupAsDouble-begin);float index=Mathf.Clamp01(t/duration)*(road.Length-1);int i=Mathf.Min((int)index,road.Length-2);
    var p=Vector3.Lerp(road[i],road[i+1],index-i);f.transform.position=p+Vector3.up*2;var target=road[Mathf.Min(i+10,road.Length-1)]+Vector3.up*3;cam.transform.LookAt(target);
    yield return new WaitForEndOfFrame();if(Time.realtimeSinceStartupAsDouble<next)continue;
    var tex=ScreenCapture.CaptureScreenshotAsTexture();File.WriteAllBytes(Path.Combine(output,(frame++) .ToString("D5")+".jpg"),tex.EncodeToJPG(82));Destroy(tex);times.Add((float)(Time.realtimeSinceStartupAsDouble-begin));next+=1.0/15;
   }
   File.WriteAllText(Path.Combine(output,"timestamps.json"),"["+string.Join(",",times.ConvertAll(t=>t.ToString("F4",System.Globalization.CultureInfo.InvariantCulture)))+"]");Destroy(gameObject);
  }
 }
}

#endif
