using Newtonsoft.Json.Linq;
namespace IslandGame {
 // Owns a private display buffer. Authority snapshots and their motion data stay read-only.
 // O1: every frame the buffer is brought back to the source hero in place (all keys, motion included), then projected.
 // Same result as a fresh DeepClone + ProjectHero; only a shape change (key set, type, array length) copies again.
 public sealed class NativeHeroProjection {
  JObject buffer;
  public void Reset(){buffer=null;}
  public JObject Project(JObject state,JObject map,float time,float move,bool auto,float depth){
   var next=state?["hero"] as JObject;if(next==null)return null;
   buffer=(buffer==null?null:JsonSync.Sync(buffer,next) as JObject)??(JObject)next.DeepClone();
   return NativeCombatPresentation.ProjectHero(state,map,time,move,auto,depth,buffer);
  }
 }
}
