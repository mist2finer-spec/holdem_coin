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
  public static void ClampBody(JObject hero,JObject state){var boss=Boss(state);if(boss==null||(int?)state["room"]!=1||(float?)boss["hp"]<=0)return;float r=NativeCombatPresentation.N(state["bodyRadius"],140)+NativeCombatPresentation.N(state["heroRadius"],22),x=NativeCombatPresentation.N(hero["x"]),y=NativeCombatPresentation.N(hero["y"]),bx=NativeCombatPresentation.N(boss["x"]),by=NativeCombatPresentation.N(boss["y"]);var d=new Vector2(x-bx,y-by);if(d.sqrMagnitude>=r*r)return;if(d.sqrMagnitude<.0001f)d=new Vector2(-NativeCombatPresentation.N(boss["direction"]?["x"],1),-NativeCombatPresentation.N(boss["direction"]?["y"]));d=d.normalized*(r+.01f);NativeCombatPresentation.SetNumber(hero,"x",bx+d.x);NativeCombatPresentation.SetNumber(hero,"y",by+d.y);}
 }
}
