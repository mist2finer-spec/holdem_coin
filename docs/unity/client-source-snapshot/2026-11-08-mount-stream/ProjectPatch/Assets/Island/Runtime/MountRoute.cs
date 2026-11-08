using UnityEngine;using Newtonsoft.Json.Linq;
namespace IslandGame {
 public static class MountRoute {
  public static float CenterZ(JObject map,float coreX){var points=map?["path"] as JArray;if(points==null||points.Count==0)return 0;float x=coreX/100;for(int i=1;i<points.Count;i++)if(N(points[i]["x"])>=x){float t=Mathf.InverseLerp(N(points[i-1]["x"]),N(points[i]["x"]),x);return Mathf.Lerp(N(points[i-1]["z"]),N(points[i]["z"]),t);}return N(points[points.Count-1]["z"]);}
  public static Vector2 Clamp(JObject map,JObject state,Vector2 p,bool planar){var b=state["walkBounds"];p.x=Mathf.Clamp(p.x,N(b?["minX"]),N(b?["maxX"]));float center=N(map["laneY"],5000)+CenterZ(map,p.x)*100,half=N(map["halfWidth"],1)*100;p.y=planar?Mathf.Clamp(p.y,center-half,center+half):center;return p;}
  static float N(JToken v,float fallback=0)=>NativeCombatPresentation.N(v,fallback);
 }
}
