using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 // Reconciles display-only walking between 20 Hz snapshots. Motion/room transitions remain authoritative.
 public sealed class NativeHeroWalkFilter {
  bool initialized;int room;float x,sourceX;string session;
  public void Reset(){initialized=false;}
  public void Apply(JObject hero,JObject state,JObject map,float move,bool auto,float delta,bool paused){
   if(hero==null||paused||(string)state?["status"]!="playing"||hero["motion"] is JObject||(Mathf.Abs(move)<=.1f&&auto)){Reset();return;}
   float desired=NativeCombatPresentation.N(hero["x"]),source=NativeCombatPresentation.N(state["hero"]?["x"]);
   int nextRoom=(int)NativeCombatPresentation.N(state["room"]);string id=(string)state["id"];
   if(!initialized||nextRoom!=room||session!=id||Mathf.Abs(source-sourceX)>64){x=desired;initialized=true;}
   else {
    float dt=Mathf.Clamp(delta,0,.05f),step=Mathf.Clamp(move,-1,1)*210*dt;
    float next=NativeCombatPresentation.PreviewWalk(map,state,x,step);
    float correction=(desired-next)*(1-Mathf.Exp(-dt*8));
    // A delayed snapshot must not pull a walking character backwards after a stick reversal.
    if(Mathf.Abs(move)>.1f&&correction*move<0)correction=Mathf.Clamp(correction,-Mathf.Abs(step)*.25f,Mathf.Abs(step)*.25f);
    next=NativeCombatPresentation.PreviewWalk(map,state,next,correction);
    float bounded=Mathf.Clamp(next,source-31.5f,source+31.5f);
    // While the worker consumes an older opposite input, hold at the lead boundary
    // rather than following that boundary backwards. The next snapshot reconciles it.
    if(Mathf.Abs(move)>.1f&&(bounded-x)*move<0)bounded=x;
    x=NativeCombatPresentation.PreviewWalk(map,state,x,bounded-x);
   }
   room=nextRoom;session=id;sourceX=source;hero["x"]=x;
  }
 }
}
