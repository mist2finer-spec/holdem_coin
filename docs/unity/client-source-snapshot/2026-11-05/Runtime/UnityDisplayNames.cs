using System;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace IslandGame {
 /// <summary>Unity presentation labels. Stored IDs, variants and mechanics stay in the source catalog.</summary>
 public sealed class UnityDisplayNames {
  readonly JObject labels;

  public UnityDisplayNames(JObject values) {
   labels=values?.Value<int?>("schema")==1?(JObject)values.DeepClone():new JObject();
  }

  static string Read(JToken value,string fallback) {
   return value?.Type==JTokenType.String&&!string.IsNullOrWhiteSpace((string)value)?(string)value:fallback;
  }
  string Label(string group,string key,string fallback) {
   return key==null?fallback:Read((labels[group] as JObject)?[key],fallback);
  }
  public string Name(string scope,string id,string fallback=null) {
   return Label(scope,id,fallback??id??"");
  }
  public string VariantName(string jewelId,string storedKey) {
   return Read(jewelId==null||storedKey==null?null:(labels["jewelVariants"]?[jewelId] as JObject)?[storedKey],storedKey??"");
  }
  public string JewelNotableName(string jewelId,string originalName) {
   return Read(jewelId==null||originalName==null?null:(labels["jewelNotables"]?[jewelId] as JObject)?[originalName],originalName??"");
  }

  /// <summary>Live tree responses may reuse a base ID after changing its effects.</summary>
  public string NodeName(JToken node) {
   if(!(node is JObject value))return "";
   string id=(string)value["id"],original=Read(value["name"],id??"");
   if(!string.IsNullOrEmpty((string)value["transformedBy"])) {
    string transformed=Label("transformedNodes",original,null);
    if(transformed!=null)return transformed;
    foreach(var prefix in (labels["transformedPrefixes"] as JObject)?.Properties()??Enumerable.Empty<JProperty>()) {
     string start=prefix.Name+" · ";
     if(original.StartsWith(start,StringComparison.Ordinal))
      return Read(prefix.Value,prefix.Name)+" · "+Name("tree",id,original.Substring(start.Length));
    }
    // A new transformation must keep its server name, not inherit a stale base-node label.
    return original;
   }
   if(!string.IsNullOrEmpty((string)value["clusterId"])) {
    foreach(var group in (labels["jewelNotables"] as JObject)?.Properties()??Enumerable.Empty<JProperty>()) {
     string name=Read((group.Value as JObject)?[original],null);
     if(name!=null)return name;
    }
    foreach(var jewel in (labels["runtimeJewelNames"] as JObject)?.Properties()??Enumerable.Empty<JProperty>()) {
     if(original==jewel.Name||original.StartsWith(jewel.Name+" 성장 ",StringComparison.Ordinal))
      return Read(jewel.Value,jewel.Name)+original.Substring(jewel.Name.Length);
    }
    return original;
   }
   return Name("tree",id,original);
  }

  /// <summary>Returns a display copy. Callers keep sending the unchanged source IDs/variant keys.</summary>
  public JObject ApplyCatalog(JObject source) {
   if(source==null)return null;
   var result=(JObject)source.DeepClone();
   foreach(string scope in new[]{"active","support"})
    foreach(var entry in (result[scope] as JArray??new JArray()).OfType<JObject>())
     entry["name"]=Name(scope,(string)entry["id"],(string)entry["name"]);
   foreach(var node in (result["tree"]?["nodes"] as JArray??new JArray()).OfType<JObject>())node["name"]=NodeName(node);
   foreach(var jewel in (result["jewels"] as JArray??new JArray()).OfType<JObject>()) {
    string id=(string)jewel["id"];
    jewel["name"]=Name("jewels",id,(string)jewel["name"]);
    string description=Label("jewelDescriptions",id,null);
    if(description!=null)jewel["description"]=description;
    foreach(var notable in (jewel["notables"] as JArray??new JArray()).OfType<JObject>())
     notable["name"]=JewelNotableName(id,(string)notable["name"]);
   }
   return result;
  }
 }
}
