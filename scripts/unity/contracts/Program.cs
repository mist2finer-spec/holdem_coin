using System;
using Newtonsoft.Json.Linq;
using IslandGame;
class Program {
 static int checks;static void Check(bool value,string name){if(!value)throw new Exception(name);checks++;}
 static void Main(){
  int kind;int? ack;JArray data;
  Check(SocketFrames.Decode("431[{\"token\":\"demo\"}]",out kind,out ack,out data)&&kind==3&&ack==1&&data[0].Value<string>("token")=="demo","lobby ack");
  string encoded=SocketFrames.Event("PLAYER_ACTION",new JObject{{"action","raise"},{"amount",600}});
  Check(SocketFrames.Decode(encoded,out kind,out ack,out data)&&ack==null&&data[1].Value<long>("amount")==600,"action");
  foreach(string s in new[]{"2","40{}","42bad","42x[]","43["})Check(!SocketFrames.Decode(s,out kind,out ack,out data),"malformed");
  Check(PokerSizing.Pot(.25,2461,400,5000)==615,"pot floor");Check(PokerSizing.Raise(2,200,400,5000)==400,"min raise");Check(PokerSizing.Raise(3,200,400,300)==300,"short allin cap");Check(PokerSizing.Money(250,200,true)=="1.3 BB","bb rounding");
  var used=ShowdownSelection.BestFive(new[]{"As","Kd"},new[]{"2c","3h","4s","5d","9h"});Check(used.Count==5&&used.Contains(0)&&!used.Contains(1),"wheel selection");
  Check(ShowdownSelection.BestFive(new[]{"??","??"},new[]{"2c","3h","4s","5d","9h"}).Count==0,"hidden cards");
  RpgChecks.Run(Check);
  DisplayNameChecks.Run(Check);
  Console.WriteLine("UNITY_CONTRACTS_PASSED checks="+checks);
 }
}
