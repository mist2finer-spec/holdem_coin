using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 public static class SocketFrames {
  public static string Event(string name,JToken body=null,int? ack=null) {
   var array=new JArray(name);if(body!=null)array.Add(body.DeepClone());
   return "42"+(ack.HasValue?ack.Value.ToString():"")+array.ToString(Formatting.None);
  }
  public static bool Decode(string frame,out int kind,out int? ack,out JArray data) {
   kind=0;ack=null;data=null;
   if(frame==null||frame.Length<2||frame[0]!='4'||(frame[1]!='2'&&frame[1]!='3'))return false;
   kind=frame[1]-'0';int i=2,start=i;while(i<frame.Length&&char.IsDigit(frame[i]))i++;
   if(i>start){int n;if(!int.TryParse(frame.Substring(start,i-start),out n))return false;ack=n;}
   if(i>=frame.Length||frame[i]!='[')return false;
   try{data=JArray.Parse(frame.Substring(i));return true;}catch(JsonException){return false;}
  }
 }
 public static class PokerSizing {
  public static long Clamp(long amount,long min,long max){return Math.Min(max,Math.Max(min,amount));}
  public static long Raise(double multiplier,long highest,long min,long max){return Clamp((long)Math.Round(highest*multiplier,MidpointRounding.AwayFromZero),min,max);}
  public static long Pot(double fraction,long pot,long min,long max){return Clamp((long)Math.Floor(pot*fraction),min,max);}
  public static string Money(long chips,long bb,bool tournament){return tournament?(Math.Round((double)chips/Math.Max(1,bb),1,MidpointRounding.AwayFromZero).ToString("0.#",System.Globalization.CultureInfo.InvariantCulture)+" BB"):chips.ToString("N0");}
 }
}
