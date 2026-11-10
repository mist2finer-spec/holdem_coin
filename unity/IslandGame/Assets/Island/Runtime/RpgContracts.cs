using System;
using System.Globalization;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace IslandGame {
 // Wire/presentation helpers. The Node service remains the authority for prices, builds and damage.
 public static class RpgContracts {
  public static readonly string[] Slots={"weapon","armor","gloves","boots","ring1","ring2"};
  public static JObject MergeSnapshot(JObject previous,JObject next){
   var result=(JObject)next.DeepClone();
   if(previous==null||(string)previous["id"]!=(string)next["id"])return result;
   bool sameBuild=previous["buildRevision"]!=null&&JToken.DeepEquals(previous["buildRevision"],next["buildRevision"]);
   if(sameBuild){
    Preserve(result,previous,"compiled");
    var build=result["build"] as JObject;var oldBuild=previous["build"] as JObject;
    if(build!=null&&oldBuild!=null)Preserve(build,oldBuild,"tree");
    var progress=result["progress"] as JObject;var oldProgress=previous["progress"] as JObject;
    if(progress!=null&&oldProgress!=null)foreach(var key in new[]{"equipment","gemCollection","gacha","legacyBuild"})Preserve(progress,oldProgress,key);
   }
   return result;
  }
  // Consumes both snapshots on the Unity main thread. Static tokens have one owner;
  // callers must not retain old State metadata or mutate metadata in presentation code.
  // The pure MergeSnapshot above stays available for callers requiring independent copies.
  public static JObject ConsumeSnapshot(JObject previous,JObject next){
   if(previous==null||(string)previous["id"]!=(string)next["id"])return next;
   bool sameBuild=previous["buildRevision"]!=null&&JToken.DeepEquals(previous["buildRevision"],next["buildRevision"])&&JToken.DeepEquals(previous["protocol"],next["protocol"]);
   if(sameBuild){
    TransferMissing(next,previous,"compiled");
    if(next["build"] is JObject build&&previous["build"] is JObject oldBuild)TransferMissing(build,oldBuild,"tree");
    if(next["progress"] is JObject progress&&previous["progress"] is JObject oldProgress)foreach(var key in StaticProgressKeys)TransferMissing(progress,oldProgress,key);
   }
   return next;
  }
  static readonly string[] StaticProgressKeys={"equipment","gemCollection","gacha","legacyBuild"};
  static void TransferMissing(JObject target,JObject source,string key){
   if(target[key]!=null)return;var property=source.Property(key);if(property==null)return;
   var value=property.Value;property.Value=JValue.CreateNull();target[key]=value;
  }
  static void Preserve(JObject target,JObject source,string key){if(target[key]==null&&source[key]!=null)target[key]=source[key].DeepClone();}
  public static JObject Skill(JObject state,int index){
   if(state==null||index<0||index>=6)return null;
   var skills=state["build"]?["skills"] as JArray??state["compiled"]?["skills"] as JArray;
   return skills!=null&&index<skills.Count?skills[index] as JObject:null;
  }
  public static bool SkillEnabled(JObject state,int index){
   var skill=Skill(state,index);if(skill==null||skill.Value<bool?>("enabled")!=true||string.IsNullOrEmpty(skill.Value<string>("activeId")))return false;
   var equipment=state?["progress"]?["equipment"] as JObject??state?["build"]?["state"]?["equipment"] as JObject;
   if(equipment!=null){var item=Equipped(equipment,index);if(item==null||string.IsNullOrEmpty((string)item["gems"]?.First))return false;}
   return true;
  }
  public static bool CanCast(JObject state,int index){
   if(!SkillEnabled(state,index))return false;var skill=Skill(state,index);
   if(skill["trigger"]!=null&&skill["trigger"].Type!=JTokenType.Null)return false;
   if((state["cooldowns"]?[index]?.Value<double>()??0)>0)return false;
   var enabled=state["progress"]?["skillEnabled"] as JArray;
   if(enabled!=null&&index<enabled.Count&&enabled[index].Value<int>()==0)return false;
   return state["dead"]?.Value<bool>()!=true&&((string)state["status"]==null||(string)state["status"]=="playing");
  }
  public static JObject Equipped(JObject equipment,int index){
   if(equipment==null||index<0||index>=6)return null;var id=(string)equipment["equipped"]?[Slots[index]];
   return (equipment["items"] as JArray)?.OfType<JObject>().FirstOrDefault(i=>(string)i["instanceId"]==id);
  }
  public static string GemAt(JObject item,int index){var list=item?["gems"] as JArray;return list!=null&&index>=0&&index<list.Count?(string)list[index]:null;}
  public static string SocketColor(JObject item,int index){return (string)item?["socketColors"]?[index]??"white";}
  public static bool SocketLinked(JObject item,int index){
   var gems=item?["gems"] as JArray;if(gems==null||index<0||index>=gems.Count)return false;
   var links=item["socketLinks"] as JArray;for(int i=0;i<index;i++)if(links!=null&&i<links.Count&&!links[i].Value<bool>())return false;return true;
  }
  public static int Reserved(JObject equipment,string id,bool active){int count=0;foreach(var item in equipment?["items"] as JArray??new JArray()){var gems=item["gems"] as JArray;if(gems==null)continue;for(int i=0;i<gems.Count;i++)if((i==0)==active&&(string)gems[i]==id)count++;}return count;}
  public static bool Supports(JObject active,JObject support,bool fireOnly=false){
   if(active==null||support==null)return false;var tags=(active["tags"] as JArray??new JArray()).Values<string>().ToList();
   if(fireOnly&&!tags.Contains("HEAL")){tags.RemoveAll(t=>new[]{"PHYSICAL","CHAOS","DARK","COLD","LIGHTNING","HOLY"}.Contains(t));tags.Add("FIRE");tags.Add("ELEMENTAL");}
   return (support["tags"] as JArray??new JArray()).Values<string>().Any(tags.Contains)
    &&(support["requireAll"] as JArray??new JArray()).Values<string>().All(tags.Contains)
    &&!(support["exclude"] as JArray??new JArray()).Values<string>().Any(tags.Contains)
    &&!(Present(support["trigger"])&&Present(active["trigger"]));
  }
  static bool Present(JToken value){return value!=null&&value.Type!=JTokenType.Null;}
  // Integer display only; no Int64 conversion of the server's large decimal strings.
  public static string Amount(JToken value){return Amount(value?.ToString());}
  public static string Amount(string value){
   if(string.IsNullOrEmpty(value))return "0";double n;
   if(double.TryParse(value,NumberStyles.Float,CultureInfo.InvariantCulture,out n)&&!double.IsInfinity(n)&&!double.IsNaN(n)&&Math.Abs(n)<1e15)return Math.Round(n,MidpointRounding.AwayFromZero).ToString("N0",CultureInfo.InvariantCulture);
   var match=System.Text.RegularExpressions.Regex.Match(value,@"^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$");if(!match.Success)return "—";
   long exponent=0;if(match.Groups[4].Success&&!long.TryParse(match.Groups[4].Value,out exponent))return "—";
   string whole=match.Groups[2].Value,all=(whole+match.Groups[3].Value).TrimStart('0');if(all.Length==0)return "0";
   int leading=(whole+match.Groups[3].Value).Length-all.Length;exponent+=whole.Length-leading-1;
   if(exponent<0)return "0";
   int digits=Math.Min(3,all.Length);long coefficient=long.Parse(all.Substring(0,digits));if(all.Length>digits&&all[digits]>='5')coefficient++;
   return match.Groups[1].Value+coefficient.ToString(CultureInfo.InvariantCulture)+"e"+(exponent-digits+1).ToString(CultureInfo.InvariantCulture);
  }
  public static double Ratio(JToken value,JToken maximum){double a,b;if(double.TryParse(value?.ToString(),NumberStyles.Float,CultureInfo.InvariantCulture,out a)&&double.TryParse(maximum?.ToString(),NumberStyles.Float,CultureInfo.InvariantCulture,out b)&&b>0&&!double.IsInfinity(b))return Math.Max(0,Math.Min(1,a/b));return 0;}
 }
}
