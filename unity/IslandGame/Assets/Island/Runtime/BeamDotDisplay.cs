using Newtonsoft.Json.Linq;
namespace IslandGame {
 // Boss beam damage while touching (2026-11-23, maintenance/boss-beam-dot-20261123). The kernel (rpg-unity-boss-engine stepBeams)
 // deals a tick every .1 s while the hero touches a beam; each tick fx carries dotId (fx id of the first tick of that touch) and
 // dotTotal (damage of the touch so far). The damage numbers show one number per touch: only the newest tick already reached on the
 // display clock (contactAt <= now) is drawn, with the running total. Other fx are drawn as before.
 public static class BeamDotDisplay {
  static float N(JToken t,float f=0)=>t==null||t.Type==JTokenType.Null?f:t.Value<float>();
  // true = a later tick of the same touch is already shown, so this one is not drawn.
  public static bool Hidden(JArray all,JToken fx,float now){
   var id=fx?["dotId"];if(id==null||id.Type==JTokenType.Null||all==null)return false;int dot=(int)id;bool after=false;
   foreach(var other in all){if(ReferenceEquals(other,fx)){after=true;continue;}if(!after)continue;
    var o=other["dotId"];if(o!=null&&o.Type!=JTokenType.Null&&(int)o==dot&&N(other["contactAt"]??other["born"])<=now)return true;}
   return false;
  }
  // The number to draw: the running total of a beam touch, else the fx value.
  public static JToken Amount(JToken fx){var t=fx?["dotTotal"];return t!=null&&t.Type!=JTokenType.Null?t:fx?["value"];}
 }
}
