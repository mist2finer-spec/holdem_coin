using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 // Display-only bounded prediction for the existing authoritative boss protocol.
 // Damage, motion starts, rewards and collision authority remain on the server.
 public sealed class BossMovementPresentation {
  bool ready;string session;int room;Vector2 position;
  public void Reset(){ready=false;}
  public void Apply(JObject hero,JObject state,JObject map,float move,float depth,float dt,double now,double received,double rttMs,bool paused){
   if(hero==null)return;var source=state["hero"] as JObject;string id=(string)state["id"];int nextRoom=(int)NativeCombatPresentation.N(state["room"]);
   Vector2 authoritative=new Vector2(NativeCombatPresentation.N(source?["x"]),NativeCombatPresentation.N(source?["y"]));
   if(paused||(bool?)state["paused"]==true||(string)state["status"]!="playing"||source?["motion"] is JObject){Reset();return;}
   bool planar=(int?)state["room"]==1;var input=Vector2.ClampMagnitude(new Vector2(move,planar?depth:0),1);float age=Mathf.Max(0,(float)(now-received));
   if(!ready||session!=id||room!=nextRoom||Vector2.Distance(position,authoritative)>180){position=authoritative;ready=true;}
   session=id;room=nextRoom;dt=Mathf.Clamp(dt,0,.05f);
   if(age>.65f){NativeCombatPresentation.SetNumber(hero,"x",position.x);NativeCombatPresentation.SetNumber(hero,"y",position.y);return;}
   var next=Walk(map,state,position,input*210*dt,planar);
   // Extrapolate the accepted held input only. It is ACKed by this sequence; new local input
   // drives the immediate step above and is reconciled smoothly once a response arrives.
   var ack=state["acceptedInput"] as JObject;
   Vector2 velocity=ack!=null?new Vector2(NativeCombatPresentation.N(ack["x"]),planar?NativeCombatPresentation.N(ack["y"]):0):new Vector2(NativeCombatPresentation.N(source?["direction"]?["x"]),planar?NativeCombatPresentation.N(source?["direction"]?["y"]):0);
   if(ack!=null&&(bool?)ack["auto"]==true&&velocity.sqrMagnitude<.01f)velocity=new Vector2(NativeCombatPresentation.N(source?["direction"]?["x"]),planar?NativeCombatPresentation.N(source?["direction"]?["y"]):0);
   if((ack==null||(bool?)ack["auto"]==true)&&(string)source?["action"]!="run1")velocity=Vector2.zero;
   float lead=Mathf.Min(.45f,age+Mathf.Clamp((float)rttMs*.0005f,0,.15f));
   Vector2 target=Walk(map,state,authoritative,Vector2.ClampMagnitude(velocity,1)*210*lead,planar);
   Vector2 correction=(target-next)*(1-Mathf.Exp(-dt*8));
   if(input.sqrMagnitude>.01f){float backward=Vector2.Dot(correction,input.normalized);if(backward<0)correction-=input.normalized*backward;}
   next=Walk(map,state,next,Vector2.ClampMagnitude(correction,210*dt*.7f),planar);
   // Bound prediction during loss; never let old snapshots drag a reversing stick backwards.
   if(Vector2.Distance(next,authoritative)<=126||input.sqrMagnitude<.01f)position=next;
   NativeCombatPresentation.SetNumber(hero,"x",position.x);NativeCombatPresentation.SetNumber(hero,"y",position.y);
  }
  static Vector2 Walk(JObject map,JObject state,Vector2 from,Vector2 delta,bool planar){
   var b=state["walkBounds"];int steps=Mathf.Max(1,Mathf.CeilToInt(delta.magnitude/6));
   for(int i=0;i<steps;i++){var p=from+delta/steps;p.x=Mathf.Clamp(p.x,NativeCombatPresentation.N(b?["minX"]),NativeCombatPresentation.N(b?["maxX"]));p.y=planar?Mathf.Clamp(p.y,NativeCombatPresentation.N(b?["minY"]),NativeCombatPresentation.N(b?["maxY"])):NativeCombatPresentation.N(map?["laneY"],192);bool blocked=false;
    if(map?["obstacles"] is JArray obstacles)foreach(var o in obstacles){float radius=NativeCombatPresentation.N(o["radius"])+18;if((p-new Vector2(NativeCombatPresentation.N(o["x"]),NativeCombatPresentation.N(o["y"]))).sqrMagnitude<radius*radius){blocked=true;break;}}
    var boss=BossContactProfile.Boss(state);if(boss!=null&&(int?)state["room"]==1&&NativeCombatPresentation.N(boss["hp"])>0){float body=NativeCombatPresentation.N(state["bodyRadius"],140)+NativeCombatPresentation.N(state["heroRadius"],22);if((p-new Vector2(NativeCombatPresentation.N(boss["x"]),NativeCombatPresentation.N(boss["y"]))).sqrMagnitude<body*body)blocked=true;}
    if(blocked)break;from=p;
   }return from;
  }
 }
}
