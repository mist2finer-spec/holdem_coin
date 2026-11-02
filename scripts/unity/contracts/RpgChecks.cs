using System;
using System.IO;
using Newtonsoft.Json.Linq;
using IslandGame;
static class RpgChecks {
 public static void Run(Action<bool,string> check){
  var fixture=JObject.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"fixtures","rpg-current.json")));
  var full=(JObject)fixture["full"];var equipped=(JObject)fixture["equipped"];var removed=(JObject)fixture["removed"];
  for(int i=0;i<6;i++)check(!RpgContracts.SkillEnabled(full,i)&&!RpgContracts.CanCast(full,i),"real fresh service slot empty "+i);
  check(RpgContracts.SkillEnabled(equipped,5)&&RpgContracts.CanCast(equipped,5),"ring2 cast keeps slot5");
  check(!RpgContracts.SkillEnabled(equipped,0),"ring2 does not shift to slot0");
  check(!RpgContracts.SkillEnabled(removed,5)&&!RpgContracts.CanCast(removed,5),"removed active has no fallback");
  check((int)removed["progress"]["gemCollection"]["active"]["heal"]==1,"removal keeps owned copy");
  var lean=(JObject)equipped.DeepClone();lean.Remove("compiled");((JObject)lean["build"]).Remove("tree");foreach(var k in new[]{"equipment","gemCollection","gacha"})((JObject)lean["progress"]).Remove(k);
  var merged=RpgContracts.MergeSnapshot(equipped,lean);
  check(merged["build"]["tree"]!=null&&merged["progress"]["equipment"]!=null&&merged["compiled"]!=null,"lean same-revision merge");
  check(lean["compiled"]==null,"wire object not mutated");
  lean["buildRevision"]=999;check(RpgContracts.MergeSnapshot(equipped,lean)["compiled"]==null,"changed revision never inherits old compile");
  lean["buildRevision"]=equipped["buildRevision"].DeepClone();lean["id"]="new-session";check(RpgContracts.MergeSnapshot(equipped,lean)["compiled"]==null,"new session never inherits old compile");
  check(RpgContracts.MergeSnapshot(null,lean)["compiled"]==null,"closed session starts clean");
  var stale=(JObject)removed.DeepClone();stale["build"]["skills"][5]["enabled"]=true;stale["build"]["skills"][5]["activeId"]="heal";check(!RpgContracts.SkillEnabled(stale,5),"empty physical slot overrides stale compile");
  var trigger=(JObject)equipped.DeepClone();trigger["build"]["skills"][5]["trigger"]="timed";check(RpgContracts.SkillEnabled(trigger,5)&&!RpgContracts.CanCast(trigger,5),"automatic trigger cannot manual cast");
  var cooldown=(JObject)equipped.DeepClone();cooldown["cooldowns"][5]=2;check(!RpgContracts.CanCast(cooldown,5),"cooldown blocks manual cast");
  var zero=JObject.Parse("{\"gems\":[],\"socketColors\":[],\"socketLinks\":[]}");check(RpgContracts.GemAt(zero,0)==null&&!RpgContracts.SocketLinked(zero,0),"zero sockets safe");
  var item=JObject.Parse("{\"gems\":[\"rift\",\"power\",\"wide\",\"echo\"],\"socketLinks\":[true,false,true]}");
  check(RpgContracts.SocketColor(item,0)=="white","legacy white color");
  check(RpgContracts.SocketLinked(item,1)&&!RpgContracts.SocketLinked(item,2)&&!RpgContracts.SocketLinked(item,3),"only first connected group active");
  var inventory=new JObject{{"items",new JArray(item)}};check(RpgContracts.Reserved(inventory,"echo",false)==1,"disconnected support still reserves copy");
  var active=JObject.Parse("{\"tags\":[\"MELEE\",\"ATTACK\",\"PHYSICAL\"]}");var support=JObject.Parse("{\"tags\":[\"PHYSICAL\"],\"exclude\":[\"FIRE\",\"ELEMENTAL\"]}");
  check(RpgContracts.Supports(active,support)&&!RpgContracts.Supports(active,support,true),"fire conversion uses current support tags");
  check(RpgContracts.Amount("1200.6")=="1,201","integer labels round");
  check(RpgContracts.Amount("1e10000")=="1e10000","huge exponent does not overflow");
  check(!RpgContracts.Amount("1.2345e70").Contains("."),"scientific label has integer coefficient");
  check(RpgContracts.Amount("bad")=="—","invalid amount rejected");
 }
}
