using System;
using Newtonsoft.Json.Linq;
using IslandGame;

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
