#if UNITY_EDITOR
using UnityEngine;
using System.Collections.Generic;
namespace MountSunday.Review {
 public sealed class ReviewLodProbe:MonoBehaviour {
  public int level;public static readonly Dictionary<int,int> Seen=new Dictionary<int,int>();
  void OnWillRenderObject(){if(Camera.current==Camera.main)Seen[level]=Time.frameCount;}
 }
}
#endif
