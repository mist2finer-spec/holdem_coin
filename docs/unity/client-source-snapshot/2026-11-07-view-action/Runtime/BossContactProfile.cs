using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 public static class BossContactProfile {
  static JObject data;static Vector3[][] frames;public static float BodyRadius=1.4f,HeroRadius=.22f,HeroHeight=1.3f;public static readonly Vector3[] HandOffsets=new Vector3[2];public static readonly float[] HandRadii=new float[2];
  public static void Load(){if(data!=null)return;var text=Resources.Load<TextAsset>("BossContactProfile");if(!text)return;data=JObject.Parse(text.text);BodyRadius=(float)data["bodyRadius"]/100;HeroRadius=(float)data["heroRadius"]/100;HeroHeight=(float)data["heroHeight"]/100;
   for(int i=0;i<2;i++){var p=data["handOffsets"][i];HandOffsets[i]=new Vector3((float)p[0],(float)p[1],(float)p[2]);HandRadii[i]=(float)data["handRadii"][i]/100;}
   var f=(JArray)data["frames"];frames=new Vector3[f.Count][];for(int i=0;i<f.Count;i++){frames[i]=new Vector3[4];for(int j=0;j<4;j++)frames[i][j]=new Vector3((float)f[i][j*3],(float)f[i][j*3+1],(float)f[i][j*3+2])/100;}
  }
  public static bool Active(float phase,int hand){Load();if(data==null)return false;var w=data["windows"][hand];return phase>=(float)w["from"]&&phase<=(float)w["to"];}
  public static Vector3 Sample(float phase,int point){Load();if(frames==null)return Vector3.zero;float at=Mathf.Clamp01(phase)*(frames.Length-1);int n=Mathf.FloorToInt(at);return Vector3.Lerp(frames[n][point],frames[Mathf.Min(n+1,frames.Length-1)][point],at-n);}
  public static JObject Boss(JObject state){foreach(var m in state?["mobs"] as JArray??Empty)if((bool?)m["unityBoss"]==true)return (JObject)m;return null;}
  static readonly JArray Empty=new JArray();
  static bool Blocked(float x,float y,JObject state,JObject map,bool body=true){
   if(map?["obstacles"] is JArray obstacles)foreach(var o in obstacles){float r=NativeCombatPresentation.N(o["radius"])+18;if((new Vector2(x,y)-new Vector2(NativeCombatPresentation.N(o["x"]),NativeCombatPresentation.N(o["y"]))).sqrMagnitude<r*r)return true;}
   var boss=Boss(state);if(body&&boss!=null&&(int?)state["room"]==1&&NativeCombatPresentation.N(boss["hp"])>0){float r=NativeCombatPresentation.N(state["bodyRadius"],140)+NativeCombatPresentation.N(state["heroRadius"],22);if((new Vector2(x,y)-new Vector2(NativeCombatPresentation.N(boss["x"]),NativeCombatPresentation.N(boss["y"]))).sqrMagnitude<r*r)return true;}return false;
  }
  public static void ConstrainProjectedMotion(JObject hero,JObject state,JObject map){
   if(!(state?["hero"]?["motion"] is JObject)||hero==null)return;var source=state["hero"];float px=NativeCombatPresentation.N(source["x"]),py=NativeCombatPresentation.N(source["y"]);var b=state["walkBounds"];
   float x=Mathf.Clamp(NativeCombatPresentation.N(hero["x"]),NativeCombatPresentation.N(b?["minX"],px-1000),NativeCombatPresentation.N(b?["maxX"],px+1000)),y=(int?)state["room"]==1?Mathf.Clamp(NativeCombatPresentation.N(hero["y"]),NativeCombatPresentation.N(b?["minY"],py-1000),NativeCombatPresentation.N(b?["maxY"],py+1000)):NativeCombatPresentation.N(map?["laneY"],5000);
   float fromX=px,fromY=py;int steps=Mathf.Max(1,Mathf.CeilToInt(new Vector2(x-px,y-py).magnitude/6));
   for(int i=1;i<=steps;i++){float nx=Mathf.Lerp(fromX,x,(float)i/steps),ny=Mathf.Lerp(fromY,y,(float)i/steps);if(!Blocked(nx,ny,state,map)){px=nx;py=ny;}else if(Mathf.Abs(nx-px)>.001f&&!Blocked(nx,py,state,map))px=nx;else if(Mathf.Abs(ny-py)>.001f&&!Blocked(px,ny,state,map))py=ny;else break;}
   NativeCombatPresentation.SetNumber(hero,"x",px);NativeCombatPresentation.SetNumber(hero,"y",py);
  }
  public static void ClampBody(JObject hero,JObject state,JObject map=null){var boss=Boss(state);if(boss==null||(int?)state["room"]!=1||NativeCombatPresentation.N(boss["hp"])<=0)return;float r=NativeCombatPresentation.N(state["bodyRadius"],140)+NativeCombatPresentation.N(state["heroRadius"],22),x=NativeCombatPresentation.N(hero["x"]),y=NativeCombatPresentation.N(hero["y"]),bx=NativeCombatPresentation.N(boss["x"]),by=NativeCombatPresentation.N(boss["y"]);var d=new Vector2(x-bx,y-by);if(d.sqrMagnitude>=r*r)return;float angle=d.sqrMagnitude>.000001f?Mathf.Atan2(d.y,d.x):Mathf.Atan2(-NativeCombatPresentation.N(boss["direction"]?["y"]),-NativeCombatPresentation.N(boss["direction"]?["x"],1));var bounds=state["walkBounds"];
   for(int i=0;i<=64;i++){float offset=i==0?0:Mathf.Ceil(i/2f)*Mathf.PI/32*(i%2==1?1:-1),a=angle+offset;float nx=bx+Mathf.Cos(a)*(r+.01f),ny=by+Mathf.Sin(a)*(r+.01f);if(nx<NativeCombatPresentation.N(bounds?["minX"],float.NegativeInfinity)||nx>NativeCombatPresentation.N(bounds?["maxX"],float.PositiveInfinity)||ny<NativeCombatPresentation.N(bounds?["minY"],float.NegativeInfinity)||ny>NativeCombatPresentation.N(bounds?["maxY"],float.PositiveInfinity)||Blocked(nx,ny,state,map,false))continue;NativeCombatPresentation.SetNumber(hero,"x",nx);NativeCombatPresentation.SetNumber(hero,"y",ny);return;}
  }
 }
}
