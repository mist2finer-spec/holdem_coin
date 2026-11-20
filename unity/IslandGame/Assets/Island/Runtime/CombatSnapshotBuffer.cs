using System;using System.Collections.Generic;using Newtonsoft.Json.Linq;using UnityEngine;
namespace IslandGame {
 // Render confirmed combat 160 ms behind authority. Never invent damage while extrapolating.
 // O1: the result is one tree kept between frames and brought to the new content in place (JsonSync); only a branch whose
 // shape changed is copied again. Timing, lo/hi, the motion handover and the hp/state/until hold are the rules from before.
 // Readers must not write into the result (nothing does today): a written value would stay until that key changes.
 public sealed class CombatSnapshotBuffer {
  readonly List<JObject> frames=new List<JObject>();JObject latest;double received;string key;float rendered;public float Time{get;private set;}
  JObject result,heroOut;KeyPart idPart,stagePart,roomPart;
  static readonly JArray Empty=new JArray();
  static readonly string[] Blended={"x","y","elevation","airHeight"},Override={"motion","action","serial","direction","facing"},Gated={"hp","state","until"};
  public void Reset(){frames.Clear();latest=null;key=null;rendered=0;result=heroOut=null;idPart=stagePart=roomPart=default;}
  public JObject Sample(JObject raw,double now,bool playing,float interpolationDelay=.16f){
   // Room key id:routeStage:room. The string is only built when a part differs from the last frame (same text rule as before).
   JToken rid=raw["id"],rstage=raw["routeStage"],rroom=raw["room"];float at=N(raw["elapsed"]);
   if(key==null||!Same(ref idPart,rid)||!Same(ref stagePart,rstage)||!Same(ref roomPart,rroom)){
    string next=(string)rid+":"+(string)rstage+":"+(string)rroom;
    if(key!=next){Reset();key=next;rendered=at;}
    idPart=Part(rid);stagePart=Part(rstage);roomPart=Part(rroom);
   }
   if(!ReferenceEquals(raw,latest)){latest=raw;received=now;frames.Add(raw);if(frames.Count>12)frames.RemoveAt(0);}
   float desired=playing?Mathf.Min(at,at+(float)(now-received)-Mathf.Max(0,interpolationDelay)):at;float nextTime=Mathf.Clamp(Mathf.Max(rendered,desired),N(frames[0]["elapsed"]),at);
   // A render hitch must not jump over a confirmed contact pose. Show the earliest
   // crossed impact this frame, then continue forward; never rewind or invent a hit.
   if(playing){var lf=latest["fx"] as JArray??Empty;for(int i=0;i<lf.Count;i++){var fx=lf[i];if((string)fx["kind"]=="damage"&&fx["attackId"]!=null&&fx["contactAt"]!=null){float contact=N(fx["contactAt"]);if(contact>rendered&&contact<nextTime&&contact>=N(frames[0]["elapsed"]))nextTime=contact;}}}
   rendered=nextTime;Time=rendered;
   JObject lo=frames[0],hi=latest;for(int i=1;i<frames.Count;i++){if(N(frames[i]["elapsed"])>rendered){hi=frames[i];break;}lo=frames[i];}
   float loElapsed=N(lo["elapsed"]),span=N(hi["elapsed"])-loElapsed,t=span>.00001f?Mathf.Clamp01((rendered-loElapsed)/span):0;
   if(result==null)result=new JObject();
   // Top level from lo (map, progress, build, compiled are not shown; hero, mobs, fx below). Keys lo no longer has are removed.
   for(var p=lo.First as JProperty;p!=null;p=p.Next as JProperty){if(Skipped(p.Name))continue;var cur=result[p.Name];var r=JsonSync.Sync(cur,p.Value);if(!ReferenceEquals(r,cur))result[p.Name]=r;}
   for(JToken node=result.First;node!=null;){var after=node.Next;var p=(JProperty)node;string n=p.Name;if(n!="fx"&&n!="hero"&&n!="mobs"&&(Skipped(n)||lo.Property(n)==null))p.Remove();node=after;}
   {var src=latest["fx"];if(src==null)JsonSync.SetNull(result,"fx");else{var cur=result["fx"];var r=JsonSync.Sync(cur,src);if(!ReferenceEquals(r,cur))result["fx"]=r;}}
   // Hero: lo.hero, x/y/elevation/airHeight blended toward hi.hero; once hi's motion has started, motion/action/serial/direction/facing come from hi.hero.
   var a=lo["hero"] as JObject;var hh=hi["hero"];var b=hh as JObject;var upcoming=hh?["motion"] as JObject;bool over=upcoming!=null&&N(upcoming["start"])<=rendered;
   var baseHero=a??b;
   if(baseHero==null){heroOut=null;JsonSync.SetNull(result,"hero");}
   else if(heroOut==null||!ReferenceEquals(result["hero"],heroOut)||!SyncHero(a,b,baseHero,over,t)){
    heroOut=Blend(a,b,t);
    if(over){heroOut["motion"]=upcoming.DeepClone();heroOut["action"]=hh["action"]?.DeepClone();heroOut["serial"]=hh["serial"]?.DeepClone();heroOut["direction"]=hh["direction"]?.DeepClone();heroOut["facing"]=hh["facing"]?.DeepClone();}
    result["hero"]=heroOut;
   }
   // Mobs in lo order. Same slot with the same id is updated in place; otherwise that mob alone is copied again.
   var loMobs=lo["mobs"] as JArray??Empty;var hiMobs=hi["mobs"] as JArray??Empty;var outMobs=result["mobs"] as JArray;if(outMobs==null){outMobs=new JArray();result["mobs"]=outMobs;}
   while(outMobs.Count>loMobs.Count)outMobs.RemoveAt(outMobs.Count-1);
   for(int i=0;i<loMobs.Count;i++){
    var ma=(JObject)loMobs[i];var aid=ma["id"];JObject mb=null;for(int j=0;j<hiMobs.Count;j++){var candidate=(JObject)hiMobs[j];if(SameText(candidate["id"],aid)){mb=candidate;break;}}
    bool gate=false;
    if(mb!=null&&N(mb["hp"])!=N(ma["hp"])){
     float last=-1;bool boss=(bool?)ma["unityBoss"]==true;string other=boss||Simple(aid)?null:"mob"+(string)aid;
     var hf=hi["fx"] as JArray??Empty;for(int q=0;q<hf.Count;q++){var fx=hf[q];if(TargetIs((string)fx["target"],boss,aid,other)&&N(fx["contactAt"],-1)>=loElapsed)last=Mathf.Max(last,N(fx["contactAt"]));}
     gate=last>=0&&last<=rendered;
    }
    var m=i<outMobs.Count?outMobs[i] as JObject:null;
    if(m==null||!SameText(m["id"],aid)||!SyncMob(m,ma,mb,gate,t)){
     m=Blend(ma,mb,t);if(gate){m["hp"]=mb["hp"]?.DeepClone();m["state"]=mb["state"]?.DeepClone();m["until"]=mb["until"]?.DeepClone();}
     if(i<outMobs.Count)outMobs[i]=m;else outMobs.Add(m);
    }
   }
   return result;
  }
  static JObject Blend(JObject a,JObject b,float t){if(a==null)return b==null?null:(JObject)b.DeepClone();var r=(JObject)a.DeepClone();if(b!=null)for(int i=0;i<Blended.Length;i++){var k=Blended[i];r[k]=Mathf.Lerp(N(a[k]),N(b[k]),t);}return r;}
  // In place: same keys as Blend(a,b,t) plus the hi overrides, or false (caller copies again).
  bool SyncHero(JObject a,JObject b,JObject baseHero,bool over,float t){
   bool blend=a!=null&&b!=null;int expected=baseHero.Count;
   if(blend)for(int i=0;i<Blended.Length;i++)if(baseHero.Property(Blended[i])==null)expected++;
   if(over)for(int i=0;i<Override.Length;i++)if(baseHero.Property(Override[i])==null)expected++;
   if(heroOut.Count!=expected)return false;
   for(var p=baseHero.First as JProperty;p!=null;p=p.Next as JProperty){string n=p.Name;
    if(blend&&Index(Blended,n)>=0){if(!JsonSync.SetFloat(heroOut,n,Mathf.Lerp(N(a[n]),N(b[n]),t)))return false;}
    else if(over&&Index(Override,n)>=0){if(!JsonSync.SyncInto(heroOut,n,b[n]))return false;}
    else if(!JsonSync.SyncInto(heroOut,n,p.Value))return false;
   }
   if(blend)for(int i=0;i<Blended.Length;i++){var k=Blended[i];if(baseHero.Property(k)==null&&!JsonSync.SetFloat(heroOut,k,Mathf.Lerp(N(a[k]),N(b[k]),t)))return false;}
   if(over)for(int i=0;i<Override.Length;i++){var k=Override[i];if(baseHero.Property(k)==null&&!JsonSync.SyncInto(heroOut,k,b[k]))return false;}
   return true;
  }
  static bool SyncMob(JObject m,JObject ma,JObject mb,bool gate,float t){
   bool blend=mb!=null;int expected=ma.Count;
   if(blend)for(int i=0;i<Blended.Length;i++)if(ma.Property(Blended[i])==null)expected++;
   if(gate)for(int i=0;i<Gated.Length;i++)if(ma.Property(Gated[i])==null)expected++;
   if(m.Count!=expected)return false;
   for(var p=ma.First as JProperty;p!=null;p=p.Next as JProperty){string n=p.Name;
    if(blend&&Index(Blended,n)>=0){if(!JsonSync.SetFloat(m,n,Mathf.Lerp(N(ma[n]),N(mb[n]),t)))return false;}
    else if(gate&&Index(Gated,n)>=0){if(!JsonSync.SyncInto(m,n,mb[n]))return false;}
    else if(!JsonSync.SyncInto(m,n,p.Value))return false;
   }
   if(blend)for(int i=0;i<Blended.Length;i++){var k=Blended[i];if(ma.Property(k)==null&&!JsonSync.SetFloat(m,k,Mathf.Lerp(N(ma[k]),N(mb[k]),t)))return false;}
   if(gate)for(int i=0;i<Gated.Length;i++){var k=Gated[i];if(ma.Property(k)==null&&!JsonSync.SyncInto(m,k,mb[k]))return false;}
   return true;
  }
  static bool Skipped(string n)=>n=="map"||n=="progress"||n=="build"||n=="compiled"||n=="hero"||n=="mobs"||n=="fx";
  static int Index(string[] keys,string n){for(int i=0;i<keys.Length;i++)if(keys[i]==n)return i;return -1;}
  // (string)x==(string)y without building strings for the usual string/integer ids. Anything else falls back to the old text compare.
  static bool SameText(JToken x,JToken y){
   if(x is JValue vx&&y is JValue vy){
    bool xn=vx.Type==JTokenType.Null,yn=vy.Type==JTokenType.Null;if(xn||yn)return xn&&yn;
    if(vx.Type==JTokenType.String&&vy.Type==JTokenType.String)return (string)vx.Value==(string)vy.Value;
    if(TryLong(vx,out long lx)&&TryLong(vy,out long ly))return lx==ly;
   }
   return (string)x==(string)y;
  }
  static bool Simple(JToken id)=>id==null||id.Type==JTokenType.Null||id.Type==JTokenType.String||id is JValue v&&TryLong(v,out _);
  // target=="boss" for the boss, else target=="mob"+(string)id; `other` is that text, built only for ids that are not simple.
  static bool TargetIs(string target,bool boss,JToken id,string other){
   if(boss)return target=="boss";if(other!=null)return target==other;if(target==null)return false;
   if(id==null||id.Type==JTokenType.Null)return target=="mob";
   if(id.Type==JTokenType.String){var s=(string)((JValue)id).Value;return target.Length==3+s.Length&&string.CompareOrdinal(target,0,"mob",0,3)==0&&string.CompareOrdinal(target,3,s,0,s.Length)==0;}
   if(target.Length<4||string.CompareOrdinal(target,0,"mob",0,3)!=0)return false;
   TryLong((JValue)id,out long n);return Digits(target,3,n);
  }
  // s[start..] is exactly n.ToString(InvariantCulture).
  static bool Digits(string s,int start,long n){
   int i=s.Length-1;bool negative=n<0;ulong u=negative?(ulong)(-(n+1))+1:(ulong)n;
   if(u==0)return i==start&&s[i]=='0';
   while(u>0){if(i<start||s[i]!=(char)('0'+(int)(u%10)))return false;u/=10;i--;}
   if(negative){if(i<start||s[i]!='-')return false;i--;}
   return i==start-1;
  }
  static bool TryLong(JValue v,out long n){var o=v.Type==JTokenType.Integer?v.Value:null;if(o is long l){n=l;return true;}if(o is int k){n=k;return true;}n=0;return false;}
  struct KeyPart{public bool set;public JTokenType type;public string text;public long number;}
  static KeyPart Part(JToken t){
   if(t==null||t.Type==JTokenType.Null)return new KeyPart{set=true,type=JTokenType.Null};
   if(t.Type==JTokenType.String)return new KeyPart{set=true,type=JTokenType.String,text=(string)((JValue)t).Value};
   if(t is JValue v&&TryLong(v,out long n))return new KeyPart{set=true,type=JTokenType.Integer,number=n};
   return default;
  }
  static bool Same(ref KeyPart p,JToken t){
   if(!p.set)return false;
   if(t==null||t.Type==JTokenType.Null)return p.type==JTokenType.Null;
   if(t.Type!=p.type)return false;
   if(p.type==JTokenType.String)return string.Equals((string)((JValue)t).Value,p.text,StringComparison.Ordinal);
   return TryLong((JValue)t,out long n)&&n==p.number;
  }
  // Same numbers as NativeCombatPresentation.N (Value<float> = Convert.ToSingle) without boxing for the common double/long tokens.
  static float N(JToken t,float fallback=0){if(t==null||t.Type==JTokenType.Null)return fallback;if(t is JValue v){var o=v.Value;if(o is double d)return (float)d;if(o is long l)return l;if(o is float f)return f;if(o is int i)return i;}return NativeCombatPresentation.N(t,fallback);}
 }
 // Brings an existing JSON tree to the content of another in place. Shape change (type, array length, key set) = fresh copy of that branch.
 public static class JsonSync {
  // dst updated in place and returned, or a new copy of src when the shape differs. dst may be null (= copy).
  public static JToken Sync(JToken dst,JToken src){
   if(src==null)return null;
   if(dst is JValue dv&&src is JValue sv){if(dv.Type!=sv.Type)return sv.DeepClone();var value=sv.Value;if(!SameValue(dv.Value,value))dv.Value=value;return dv;}
   if(dst is JArray da&&src is JArray sa&&da.Count==sa.Count){for(int i=0;i<sa.Count;i++){var d=da[i];var r=Sync(d,sa[i]);if(!ReferenceEquals(r,d))da[i]=r;}return da;}
   if(dst is JObject dob&&src is JObject so&&dob.Count==so.Count){for(var p=so.First as JProperty;p!=null;p=p.Next as JProperty){var d=dob[p.Name];if(d==null)return so.DeepClone();var r=Sync(d,p.Value);if(!ReferenceEquals(r,d))dob[p.Name]=r;}return dob;}
   return src.DeepClone();
  }
  // o[name] must exist already (false = shape differs). src null = JSON null, as `x?.DeepClone()` stores it.
  public static bool SyncInto(JObject o,string name,JToken src){var cur=o[name];if(cur==null)return false;if(src==null){if(cur.Type!=JTokenType.Null)o[name]=null;return true;}var r=Sync(cur,src);if(!ReferenceEquals(r,cur))o[name]=r;return true;}
  // o[name]=v for an existing key; reuses a float value. False when the key is missing.
  public static bool SetFloat(JObject o,string name,float v){var cur=o[name];if(cur==null)return false;if(cur is JValue j&&j.Type==JTokenType.Float){if(!(j.Value is float f&&SameValue(f,v)))j.Value=v;}else o[name]=v;return true;}
  public static void SetNull(JObject o,string name){var cur=o[name];if(cur==null||cur.Type!=JTokenType.Null)o[name]=null;}
  // Exact for floating point (sign of zero, NaN), Equals for the rest. No boxing for the float overload.
  static bool SameValue(float a,float b)=>BitConverter.DoubleToInt64Bits(a)==BitConverter.DoubleToInt64Bits(b);
  public static bool SameValue(object a,object b){if(a is double x&&b is double y)return BitConverter.DoubleToInt64Bits(x)==BitConverter.DoubleToInt64Bits(y);if(a is float f&&b is float g)return SameValue(f,g);return Equals(a,b);}
 }
}
