#if UNITY_EDITOR
using IslandGame;
using Newtonsoft.Json.Linq;
using System.IO;
using System;
namespace IslandGame.Editor.BossContracts {
public class BossTrialExistingContractChecks {
 static int checks;static void Check(bool value,string name){if(!value)throw new Exception(name);checks++;}
 public static int Run(){checks=0;
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
  Console.WriteLine("UNITY_CONTRACTS_PASSED checks="+checks);return checks;
 }
}
static class RpgChecks {
 public static void Run(Action<bool,string> check){
  var fixture=JObject.Parse(File.ReadAllText("G:/new_project/holdem_coin-boss-test/scripts/unity/contracts/fixtures/rpg-current.json"));
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

static class DisplayNameChecks {
 public static void Run(Action<bool,string> check) {
  var labels=JObject.Parse(@"{
   'schema':1,'active':{'rift':'창세 균열'},'support':{'efficient':'마나 절약'},
   'tree':{'attr_0_3':'삼손의 맹공','keystone_bloodless':'생명의 언약'},
   'jewels':{'gloriousvanity':'태초의 변환','axemancluster':'도끼의 길'},
   'jewelDescriptions':{'gloriousvanity':'가인 INT/STR→DEX · 노드당 생명력 -1'},
   'jewelVariants':{'gloriousvanity':{'Doryani':'가인'}},
   'jewelNotables':{'axemancluster':{'Karui Legion':'용사의 행진'}},
   'transformedNodes':{'Karui Fury':'용사의 맹공'},
   'transformedPrefixes':{'Doryani':'가인'},
   'runtimeJewelNames':{'Axeman Cluster':'도끼의 길'}
  }");
  var source=JObject.Parse(@"{
   'active':[{'id':'rift','name':'대지 균열','tags':['ATTACK'],'damage':1.25}],
   'support':[{'id':'efficient','name':'영감','mana':0.65,'text':'마나 ×0.65'}],
   'tree':{'nodes':[{'id':'attr_0_3','name':'Berserking','attackSpeed':0.15}], 'edges':[{'from':'root','to':'attr_0_3'}]},
   'jewels':[{'id':'gloriousvanity','name':'Glorious Vanity','description':'Doryani INT/STR→DEX · 노드당 생명력 -1','variants':['Doryani','Atziri','Xibaqua'],'price':2200},
    {'id':'axemancluster','name':'Axeman Cluster','smallStats':{'meleeDamage':0.04},'notables':[{'name':'Karui Legion','stats':{'attackSpeed':0.3,'life':0.15}}]}]
  }");
  var before=(JObject)source.DeepClone();
  var names=new UnityDisplayNames(labels);
  // Caller changes after construction cannot alter the active display dictionary.
  labels["active"]["rift"]="changed";
  var display=names.ApplyCatalog(source);
  check(JToken.DeepEquals(source,before),"display names preserve source object");
  check((string)display["active"][0]["name"]=="창세 균열","active display name");
  check((string)display["support"][0]["name"]=="마나 절약","support display name");
  check((string)display["tree"]["nodes"][0]["name"]=="삼손의 맹공","stable node display name");
  check((string)display["jewels"][1]["notables"][0]["name"]=="용사의 행진","cluster notable display name");
  check(JToken.DeepEquals(display["jewels"][0]["variants"],before["jewels"][0]["variants"]),"stored conquerors unchanged");
  check(names.VariantName("gloriousvanity","Doryani")=="가인","variant display lookup");
  check(names.VariantName("unknown","Doryani")=="Doryani","unknown variant fallback");
  check(names.Name("active","future","미래 스킬")=="미래 스킬","unknown id fallback");
  check(names.NodeName(JObject.Parse(@"{'id':'attr_0_3','name':'Karui Fury','transformedBy':'owned_1'}"))=="용사의 맹공","transformed node overrides base name");
  check(names.NodeName(JObject.Parse(@"{'id':'attr_0_3','name':'New Result','transformedBy':'owned_1'}"))=="New Result","unknown transformation keeps server name");
  check(names.NodeName(JObject.Parse(@"{'id':'attr_0_3','name':'Doryani · Berserking','transformedBy':'owned_1'}"))=="가인 · 삼손의 맹공","converted attribute node name");
  check(names.NodeName(JObject.Parse(@"{'id':'cluster_owned_2_0','name':'Karui Legion','clusterId':'owned_2'}"))=="용사의 행진","live cluster notable");
  check(names.NodeName(JObject.Parse(@"{'id':'cluster_owned_2_1','name':'Axeman Cluster 성장 2','clusterId':'owned_2'}"))=="도끼의 길 성장 2","live cluster small node");
  check(names.NodeName(JObject.Parse(@"{'id':'cluster_owned_2_8','name':'중형 군주얼 소켓','clusterId':'owned_2'}"))=="중형 군주얼 소켓","live cluster socket fallback");
  check(names.ApplyCatalog(null)==null,"null catalog fallback");
  check(JToken.DeepEquals(new UnityDisplayNames(null).ApplyCatalog(source),source),"missing labels fallback");
  // Remove only permitted presentation fields: all nested mechanics and identities must be equal.
  StripPresentation(before);StripPresentation(display);
  check(JToken.DeepEquals(display,before),"display overlay changes no mechanics, topology, ids or stored variants");
 }
 static void StripPresentation(JToken token) {
  if(token is JObject obj) {
   obj.Remove("name");obj.Remove("description");
   foreach(var property in obj.Properties())StripPresentation(property.Value);
  } else if(token is JArray array)foreach(var item in array)StripPresentation(item);
 }
}
}
#endif
