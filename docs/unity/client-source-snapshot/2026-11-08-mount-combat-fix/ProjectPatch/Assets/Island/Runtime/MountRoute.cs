using UnityEngine;using Newtonsoft.Json.Linq;
namespace IslandGame {
 public static class MountRoute {
  public static float CenterZ(JObject map,float coreX){var points=map?["path"] as JArray;if(points==null||points.Count==0)return 0;float x=coreX/100;for(int i=1;i<points.Count;i++)if(N(points[i]["x"])>=x){float t=Mathf.InverseLerp(N(points[i-1]["x"]),N(points[i]["x"]),x);return Mathf.Lerp(N(points[i-1]["z"]),N(points[i]["z"]),t);}return N(points[points.Count-1]["z"]);}
  public static Vector2 Clamp(JObject map,JObject state,Vector2 p,bool planar){var b=state["walkBounds"];p.x=Mathf.Clamp(p.x,N(b?["minX"]),N(b?["maxX"]));float center=N(map["laneY"],5000)+CenterZ(map,p.x)*100,half=N(map["halfWidth"],1)*100;p.y=planar?Mathf.Clamp(p.y,center-half,center+half):center;return p;}
  // Sweep from authority to the predicted pose, so fast input cannot cross a live body.
  public static Vector2 Constrain(JObject map,JObject state,Vector2 target,bool planar){
   var start=new Vector2(N(state["hero"]?["x"]),N(state["hero"]?["y"]));target=Clamp(map,state,target,planar);
   int steps=Mathf.Max(1,Mathf.CeilToInt(Vector2.Distance(start,target)/6));var accepted=start;
   for(int i=1;i<=steps;i++){var p=Clamp(map,state,Vector2.Lerp(start,target,(float)i/steps),planar);bool blocked=false;
    foreach(var mob in state["mobs"] as JArray??new JArray()){if(N(mob["hp"])<=0)continue;var center=new Vector2(N(mob["x"]),N(mob["y"]));float d=Vector2.Distance(p,center);if(d<20+N(mob["radius"],12.5f)&&d<Vector2.Distance(accepted,center)){blocked=true;break;}}
    if(blocked)break;accepted=p;
   }return accepted;
  }
  static float N(JToken v,float fallback=0)=>NativeCombatPresentation.N(v,fallback);
 }
}
