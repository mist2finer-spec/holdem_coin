using System;
using System.Collections.Generic;
using System.Text;
using Jint;
using Jint.Native;
using NUnit.Framework;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.TestTools.Constraints; // AllocatingGCMemory() extension on Is.Not

namespace IslandGame.Tests {
 // O1 (frame allocations): the in-place CombatSnapshotBuffer / NativeHeroProjection must give the same content as before, every frame.
 // Snapshots come from the bundled kernel (Resources/TrainingCombatKernel.js) through Jint: mount path, kit, seed 111,
 // run/stand, an attack every 25 ticks, AUTO from a third of the run. The clock is 60 fps with a 45 ms hitch every 97 frames,
 // a stopped stretch (playing=false) and the run crosses into the next room (key reset).
 public sealed class O1FrameAllocTests {
  const int Ticks=9000;const float Delay=.04f; // local training interpolation delay (NativeBattle: UsesLocalTraining ? .04 : .16)
  sealed class Frame{public JObject raw;public double now;public bool playing;public float move;public bool auto;}
  static List<Frame> clock;static JObject map;static string runNote;

  static string Call(Engine e,JsValue f,string v)=>e.Invoke(f,JsValue.Undefined,new JsValue[]{v}).ToString();
  static JObject PracticeBuild(){
   var skills=new JArray();var gems=new[]{"icespear","icenova","frostshot","stormcall","arc","spark"};
   for(int i=0;i<6;i++)skills.Add(new JObject{{"supportIds",i<4?new JArray():i==4?new JArray("echo","elemental"):new JArray("echo","elemental","reach","quick")},{"enabled",true},{"activeId",gems[i]},{"trigger",null},{"index",i}});
   return new JObject{{"skills",skills}};
  }
  static List<Frame> Clock(){
   if(clock!=null)return clock;
   var source=Resources.Load<TextAsset>("TrainingCombatKernel.js");Assert.IsNotNull(source,"Resources/TrainingCombatKernel.js");
   var boot=RpgSession.ReferenceBoot(0,false,PracticeBuild());boot.Remove("kitTempo"); // the default tempo, whatever the dev pref says
   var e=new Engine();e.Execute(source.text);var init=e.GetValue("stageInitialize");var adv=e.GetValue("stageAdvance");
   var snaps=new List<JObject>();var inputs=new List<(float x,bool auto)>();
   var first=JObject.Parse(Call(e,init,boot.ToString(Formatting.None)));map=first["map"] as JObject;first.Remove("map");snaps.Add(first);inputs.Add((0,false));
   int readyZone=0;
   for(int t=0;t<Ticks;t++){
    float x=t%300<200?1:0;bool attack=t%25==5,auto=t>Ticks/3;
    var input=new JObject{{"x",x},{"y",0},{"auto",auto},{"paused",false},{"readyZone",readyZone}};var commands=new JArray();if(attack)commands.Add(new JObject{{"attack",true}});
    var s=Call(e,adv,new JObject{{"steps",1},{"input",input},{"commands",commands},{"snapshot",t%2==0||attack}}.ToString(Formatting.None));
    if(s.Length==0)continue;var snap=JObject.Parse(s);if(snap["map"] is JObject m){map=m;snap.Remove("map");}
    snaps.Add(snap);inputs.Add((x,auto));readyZone=((int?)snap["room"]??0)+1; // next zone loaded, as MountZoneStream reports once it streamed in
   }
   e.Dispose();
   var frames=new List<Frame>();double now=(double?)snaps[0]["elapsed"]??0,end=(double?)snaps[snaps.Count-1]["elapsed"]??0;int idx=0;
   for(int f=0;now<end;f++){
    now+=f%97==0?.045:1/60.0;while(idx+1<snaps.Count&&((double?)snaps[idx+1]["elapsed"]??0)<=now)idx++;
    frames.Add(new Frame{raw=snaps[idx],now=now,playing=!(f>=900&&f<1000),move=inputs[idx].x,auto=inputs[idx].auto});
   }
   var rooms=new HashSet<string>();foreach(var s in snaps)rooms.Add((string)s["routeStage"]+":"+(string)s["room"]);
   runNote="snapshots="+snaps.Count+" frames="+frames.Count+" rooms="+string.Join(",",rooms)+" heroKit="+(string)snaps[0]["heroKit"]+" lastKills="+(string)snaps[snaps.Count-1]["kills"]+" lastPhase="+(string)snaps[snaps.Count-1]["phase"];
   return clock=frames;
  }
  static string Key(JObject raw)=>(string)raw["id"]+":"+(string)raw["routeStage"]+":"+(string)raw["room"];
  static string Diff(JToken a,JToken b,string path){
   if(JToken.DeepEquals(a,b))return null;
   if(a is JObject oa&&b is JObject ob){foreach(var p in oa.Properties()){var d=Diff(p.Value,ob[p.Name],path+"."+p.Name);if(d!=null)return d;}foreach(var p in ob.Properties())if(oa.Property(p.Name)==null)return path+"."+p.Name+" only in new";}
   if(a is JArray xa&&b is JArray xb&&xa.Count==xb.Count){for(int i=0;i<xa.Count;i++){var d=Diff(xa[i],xb[i],path+"["+i+"]");if(d!=null)return d;}}
   string S(JToken t){var s=t?.ToString(Formatting.None)??"(missing)";return s.Length>200?s.Substring(0,200):s;}
   return path+": old="+S(a)+" new="+S(b);
  }
  static int Allocs(Action a){
   var r=UnityEngine.Profiling.Recorder.Get("GC.Alloc");r.enabled=false;r.FilterToCurrentThread();r.enabled=true;
   try{a();}finally{r.enabled=false;r.CollectFromAllThreads();}
   return r.sampleBlockCount;
  }

  [Test] public void Sample_in_place_matches_the_old_copy_every_frame(){
   var frames=Clock();var legacy=new LegacyCombatSnapshotBuffer();var now=new CombatSnapshotBuffer();
   int mismatch=0,maxMobs=0,crowded=0,stopped=0,resets=0;string first=null,key=null;long allocOld=0,allocNew=0;
   for(int f=0;f<frames.Count;f++){var fr=frames[f];
    var k=Key(fr.raw);if(key!=null&&k!=key)resets++;key=k;
    JObject a=null,b=null;
    allocOld+=Allocs(()=>a=legacy.Sample(fr.raw,fr.now,fr.playing,Delay));
    allocNew+=Allocs(()=>b=now.Sample(fr.raw,fr.now,fr.playing,Delay));
    if(!fr.playing)stopped++;int mobs=(b["mobs"] as JArray)?.Count??0;maxMobs=Math.Max(maxMobs,mobs);if(mobs>=10)crowded++;
    if(legacy.Time!=now.Time||!JToken.DeepEquals(a,b)){mismatch++;if(first==null)first="frame "+f+" time old="+legacy.Time+" new="+now.Time+" "+Diff(a,b,"$");}
   }
   string note=runNote+" maxMobs="+maxMobs+" framesWith10+Mobs="+crowded+" stoppedFrames="+stopped+" keyResets="+resets+
    " | GC.Alloc calls/frame old="+(allocOld/(double)frames.Count).ToString("0.0")+" new="+(allocNew/(double)frames.Count).ToString("0.0");
   Debug.Log("[O1] Sample equivalence: mismatches="+mismatch+"/"+frames.Count+" | "+note);
   Assert.AreEqual(0,mismatch,first+" | "+note);
   Assert.GreaterOrEqual(maxMobs,10,"needs a stretch with 10+ mobs | "+note);Assert.Greater(stopped,0,note);Assert.GreaterOrEqual(resets,1,"needs a room change (key reset) | "+note);
  }

  [Test] public void Hero_projection_matches_a_fresh_copy_every_frame(){
   var frames=Clock();var buffer=new CombatSnapshotBuffer();var projection=new NativeHeroProjection();int mismatch=0,checkedFrames=0;string first=null;long allocOld=0,allocNew=0;
   for(int f=0;f<frames.Count;f++){var fr=frames[f];
    var state=buffer.Sample(fr.raw,fr.now,fr.playing,Delay);float time=buffer.Time;
    JObject fresh=null,kept=null;
    allocOld+=Allocs(()=>fresh=NativeCombatPresentation.ProjectHero(state,map,time,fr.move,fr.auto,0)); // the old path: a new hero copy every frame
    allocNew+=Allocs(()=>kept=projection.Project(state,map,time,fr.move,fr.auto,0));
    if(fresh==null&&kept==null)continue;checkedFrames++;
    if(!JToken.DeepEquals(fresh,kept)){mismatch++;if(first==null)first="frame "+f+" "+Diff(fresh,kept,"$hero");}
    // Readers after the projection write into the buffer (MountRoute.Constrain, roll, walk filter). None of it may survive to the next frame.
    NativeCombatPresentation.SetNumber(kept,"x",NativeCombatPresentation.N(kept["x"])+7);
    if(f%5==0)kept["motion"]=new JObject{{"kind","dodge"},{"start",0}};
    if(f%7==0)kept["presentationOnly"]=1;
    if(f%11==0&&kept["motion"] is JObject motion)motion["start"]=-1;
   }
   string note="frames="+checkedFrames+" GC.Alloc calls/frame fresh copy="+(allocOld/(double)frames.Count).ToString("0.0")+" kept buffer="+(allocNew/(double)frames.Count).ToString("0.0");
   Debug.Log("[O1] Projection equivalence: mismatches="+mismatch+" | "+note);
   Assert.AreEqual(0,mismatch,first+" | "+note);Assert.Greater(checkedFrames,1000,note);
  }

  [Test] public void Sample_does_not_allocate_when_the_snapshot_and_time_repeat(){
   var frames=Clock();int pick=-1,best=-1;
   for(int f=200;f<frames.Count;f++){var fr=frames[f];int mobs=(fr.raw["mobs"] as JArray)?.Count??0;int fx=(fr.raw["fx"] as JArray)?.Count??0;if(fr.playing&&mobs*4+fx>best){best=mobs*4+fx;pick=f;}}
   var buffer=new CombatSnapshotBuffer();for(int f=pick-120;f<=pick;f++)buffer.Sample(frames[f].raw,frames[f].now,frames[f].playing,Delay);
   var at=frames[pick];JObject result=null;
   // Same snapshot, same time: stopped and playing. The second call must not allocate.
   buffer.Sample(at.raw,at.now,false,Delay);
   Assert.That(()=>{result=buffer.Sample(at.raw,at.now,false,Delay);},UnityEngine.TestTools.Constraints.Is.Not.AllocatingGCMemory(),"stopped, same snapshot and time");
   buffer.Sample(at.raw,at.now,true,Delay);
   Assert.That(()=>{result=buffer.Sample(at.raw,at.now,true,Delay);},UnityEngine.TestTools.Constraints.Is.Not.AllocatingGCMemory(),"playing, same snapshot and time");
   Assert.GreaterOrEqual((result["mobs"] as JArray).Count,1,"picked frame has mobs");
   var projection=new NativeHeroProjection();var state=buffer.Sample(at.raw,at.now,true,Delay);projection.Project(state,map,buffer.Time,0,false,0);
   Debug.Log("[O1] static frame "+pick+": mobs="+(result["mobs"] as JArray).Count+" fx="+((at.raw["fx"] as JArray)?.Count??0)+" Sample allocation-free when repeated");
  }

  // ---- stage 2: small allocations ----
  static JToken[] Samples()=>new JToken[]{new JValue(3),new JValue(3L),new JValue(-7L),new JValue(2.5),new JValue(2.5f),new JValue(-0.0),new JValue(1e40),new JValue(long.MaxValue),
   new JValue("1.25"),new JValue("7"),new JValue(" 3 "),new JValue("abc"),new JValue(""),new JValue(true),new JValue(false),JValue.CreateNull(),null,
   JToken.Parse("12"),JToken.Parse("0.1"),JToken.Parse("-3.75e2"),JToken.Parse("\"4.5\""),JToken.Parse("true")};
  static string Outcome<T>(Func<T> f){try{var v=f();return v==null?"null":v is float x?BitConverter.DoubleToInt64Bits(x).ToString():v.ToString();}catch(Exception){return "throws";}}

  [Test] public void N_cast_matches_the_old_Value_float(){
   foreach(var t in Samples()){
    string old=Outcome(()=>t==null||t.Type==JTokenType.Null?-1f:t.Value<float>()),now=Outcome(()=>NativeCombatPresentation.N(t,-1f));
    Assert.AreEqual(old,now,"N("+(t?.ToString(Formatting.None)??"missing")+")");
   }
   var obj=new JObject{{"a",1}};Assert.Throws<InvalidCastException>(()=>obj.Value<float>());Assert.Catch(()=>NativeCombatPresentation.N(obj),"a non-value token still throws");
  }

  [Test] public void Nullable_casts_match_the_old_Value_calls(){
   foreach(var t in Samples()){
    var o=new JObject();if(t!=null)o["k"]=t;string name=t?.ToString(Formatting.None)??"missing";
    Assert.AreEqual(Outcome(()=>o.Value<float?>("k")),Outcome(()=>(float?)o["k"]),"float? "+name);
    Assert.AreEqual(Outcome(()=>o.Value<int?>("k")),Outcome(()=>(int?)o["k"]),"int? "+name);
    Assert.AreEqual(Outcome(()=>o.Value<bool?>("k")),Outcome(()=>(bool?)o["k"]),"bool? "+name);
   }
  }

  [Test] public void Label_text_matches_the_old_expressions_and_is_reused(){
   var labels=new NativeBattleText();
   var heroes=new[]{new JObject{{"serial",1}},new JObject{{"serial",1}},new JObject{{"serial",2}},new JObject{{"actionSerial","a7"}},new JObject(),new JObject{{"serial",null}},new JObject{{"serial",2.5}},new JObject{{"serial",-0.0}},new JObject{{"serial",0.0}},new JObject{{"serial",2}}};
   foreach(var h in heroes)Assert.AreEqual((h["serial"]??h["actionSerial"]??0).ToString(),labels.HeroSerial(h),h.ToString(Formatting.None));
   var mobs=new[]{new JObject{{"id",12}},new JObject{{"id",12}},new JObject{{"id","b3"}},new JObject{{"slot",4}},new JObject(),new JObject{{"id",null}},new JObject{{"id",1.5}},new JObject{{"id",13L}}};
   foreach(var m in mobs)Assert.AreEqual("mob"+(m["id"]??m["slot"]??0),labels.MobId(m["id"]??m["slot"]),m.ToString(Formatting.None));
   foreach(var s in new[]{0,1101,1102,-1,1101})Assert.AreEqual(s.ToString(),labels.Species(s));
   var untils=new JToken[]{new JValue(1.25),new JValue(1.25),new JValue(1.5),null,JValue.CreateNull(),new JValue(-0.0),new JValue(0.0),new JValue(3L)};
   foreach(var mode in new[]{"idle","walk","windup"})foreach(var u in untils)
    Assert.AreEqual(mode+(mode=="windup"?u?.ToString():""),labels.Mode("mob12",mode,u),mode+" "+(u?.ToString(Formatting.None)??"missing"));
   // Repeats reuse the text: no allocation once the values stay the same.
   var hero=new JObject{{"serial",9}};var mob=new JValue(21L);var until=new JValue(4.75);labels.HeroSerial(hero);labels.MobId(mob);labels.Species(1101);labels.Mode("mob21","windup",until);
   NoAlloc(()=>{labels.HeroSerial(hero);labels.MobId(mob);labels.Species(1101);labels.Mode("mob21","windup",until);labels.Mode("mob21","idle",until);},"repeated labels");
  }
  // The first run of a new lambda interns its string literals on the Editor Mono (one GC.Alloc per literal), so run it once first.
  static void NoAlloc(TestDelegate d,string what){d();Assert.That(d,UnityEngine.TestTools.Constraints.Is.Not.AllocatingGCMemory(),what);}

  [Test] public void N_and_nullable_casts_do_not_allocate(){
   var f=new JValue(2.5);var l=new JValue(3L);var o=new JObject{{"facing",-1.0},{"species",1101L},{"boss",false}};float sink=0;
   NoAlloc(()=>{for(int i=0;i<1000;i++)sink+=NativeCombatPresentation.N(f)+NativeCombatPresentation.N(l);},"N on double/long tokens");
   NoAlloc(()=>{for(int i=0;i<1000;i++)sink+=((float?)o["facing"]??1)+((int?)o["species"]??0)+((bool?)o["boss"]==true?1:0);},"nullable casts");
   NoAlloc(()=>{for(int i=0;i<1000;i++)sink+=(o["mobs"] as JArray??NativeCombatPresentation.EmptyArray).Count;},"shared empty array");
   // The old form, for the record: Value<float?> goes through Convert.ChangeType and boxes.
   int old=0;TestDelegate before=()=>{for(int i=0;i<1000;i++)sink+=o.Value<float?>("facing")??1;};before();
   try{Assert.That(before,UnityEngine.TestTools.Constraints.Is.AllocatingGCMemory());old=1;}catch(AssertionException){}
   Debug.Log("[O1] Value<float?> allocates: "+(old==1));
   Assert.AreEqual(0,NativeCombatPresentation.EmptyArray.Count,"shared empty array stays empty ("+sink+")");
  }

  [Test] public void Snapshot_parse_without_line_info_gives_the_same_tree(){
   var frames=Clock();var settings=new JsonLoadSettings{LineInfoHandling=LineInfoHandling.Ignore};
   for(int f=0;f<frames.Count;f+=frames.Count/20){var text=frames[f].raw.ToString(Formatting.None);Assert.IsTrue(JToken.DeepEquals(JObject.Parse(text),JObject.Parse(text,settings)),"frame "+f);}
  }
 }
}
