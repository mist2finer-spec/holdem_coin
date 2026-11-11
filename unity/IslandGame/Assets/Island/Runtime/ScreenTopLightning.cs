using UnityEngine;
namespace IslandGame {
 // Presentation only. Never moves the authoritative ground target or consumes Unity's gameplay RNG.
 public static class ScreenTopLightning {
  public const float Top=1.15f,FlashSeconds=2f/60f,ArcSeconds=6f/60f,Life=.32f;
  public static float Noise(int seed,int n){unchecked{uint x=(uint)(seed*374761393+n*668265263);x=(x^(x>>13))*1274126177;return (x^(x>>16))/(float)uint.MaxValue*2-1;}}
  public static int GroundArcs(int supports)=>supports<=0?0:supports==1?3:supports<4?6:9;
  public static float WorldHeight(Camera camera,float depth)=>Vector3.Distance(camera.ViewportToWorldPoint(new Vector3(.5f,0,depth)),camera.ViewportToWorldPoint(new Vector3(.5f,1,depth)));
  public static bool Build(Camera camera,Vector3 target,Vector3[] points,int seed,float age){
   if(!camera||points==null||points.Length<2)return false;
   Vector3 vp=camera.WorldToViewportPoint(target);if(vp.z<=camera.nearClipPlane||float.IsNaN(vp.z)||float.IsInfinity(vp.z))return false;
   Vector3 start=camera.ViewportToWorldPoint(new Vector3(vp.x+Noise(seed,1)*.04f,Top,vp.z));
   float amplitude=WorldHeight(camera,vp.z)*(age<FlashSeconds?.0015f:.016f);
   int step=age<ArcSeconds?Mathf.FloorToInt(age*60):6;
   for(int i=1;i<points.Length-1;i++){float t=(float)i/(points.Length-1),envelope=Mathf.Sin(t*Mathf.PI);points[i]=Vector3.Lerp(start,target,t)+amplitude*envelope*(camera.transform.right*Noise(seed,i*11+step*43)+camera.transform.up*Noise(seed,i*17+step*43)*.16f);}
   points[0]=start;points[points.Length-1]=target;return true;
  }
 }
}
