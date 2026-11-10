using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 // Longer animation/recovery only. Authoritative 0.36s movement, damage and cooldowns are untouched.
 public sealed class NativeHeroRollPresentation {
  public const float Duration=.72f;
  JObject roll;string session;int room;float start=float.NegativeInfinity;
  public void Reset(){roll=null;start=float.NegativeInfinity;}
  public void Apply(JObject hero,JObject state,float time){
   string id=(string)state?["id"];int nextRoom=(int)NativeCombatPresentation.N(state?["room"]);
   if(session!=id||room!=nextRoom||(string)state?["status"]!="playing"){Reset();session=id;room=nextRoom;}
   var motion=hero?["motion"] as JObject;
   if(motion!=null){
    if((string)motion["kind"]!="dodge"){Reset();return;}
    float began=NativeCombatPresentation.N(motion["start"]);if(roll==null||began!=start){roll=(JObject)motion.DeepClone();start=began;roll["duration"]=Mathf.Max(Duration,NativeCombatPresentation.N(motion["duration"]));}
   }
   if(roll==null||hero==null)return;
   if(time-start>=NativeCombatPresentation.N(roll["duration"])){Reset();return;}
   // A new authoritative action above interrupts the recovery, without queuing or blocking input.
   hero["action"]="avoid1";hero["motion"]=(JObject)roll.DeepClone();
  }
 }
}
