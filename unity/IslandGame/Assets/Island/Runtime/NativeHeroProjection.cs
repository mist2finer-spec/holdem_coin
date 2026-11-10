using Newtonsoft.Json.Linq;
namespace IslandGame {
 // Owns a private display buffer. Authority snapshots and their motion data stay read-only.
 public sealed class NativeHeroProjection {
  JObject source,buffer;JToken motion;
  static readonly string[] Fields={"x","y","elevation","airHeight","facing","action"};
  public void Reset(){source=buffer=null;motion=null;}
  public JObject Project(JObject state,JObject map,float time,float move,bool auto,float depth){
   var next=state?["hero"] as JObject;if(next==null)return null;
   if(!object.ReferenceEquals(source,next)){source=next;buffer=(JObject)next.DeepClone();motion=buffer["motion"];}
   else {foreach(var key in Fields){if(source[key] is JValue s&&buffer[key] is JValue d)d.Value=s.Value;}
    if(!object.ReferenceEquals(buffer["motion"],motion))buffer["motion"]=motion;
    if(source["direction"] is JObject dir)NativeCombatPresentation.SetDirection(buffer,NativeCombatPresentation.N(dir["x"]),NativeCombatPresentation.N(dir["y"]));
   }
   return NativeCombatPresentation.ProjectHero(state,map,time,move,auto,depth,buffer);
  }
 }
}
