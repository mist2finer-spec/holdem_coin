using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json.Linq;
using IslandGame;
public static class VerifyCombat {
 static readonly List<object> checks=new List<object>();
 static void Check(bool ok,string name){checks.Add(new{name,pass=ok});if(!ok)throw new Exception(name);}
 public static object Main(){
  checks.Clear();
  var clock=new NativeCombatClock();clock.Receive(10,1,true);Check(Math.Abs(clock.Sample(1.3,.35)-10.3)<.00001,"clock bridges a 300 ms response gap");Check(Math.Abs(clock.Sample(3,.35)-10.35)<.00001,"clock stops at bounded loss horizon");clock.Receive(11,3,false);Check(clock.Sample(4,.4)==11,"pause freezes presentation clock");
  var full=JObject.Parse("{\"id\":\"one\",\"protocol\":\"v1\",\"buildRevision\":1,\"compiled\":{\"a\":[1,2]},\"build\":{\"tree\":{\"nodes\":[1,2]}},\"progress\":{\"equipment\":{\"weapon\":1}}}");var original=(JObject)full.DeepClone();var tree=full["build"]["tree"];var compile=full["compiled"];
  var lean=JObject.Parse("{\"id\":\"one\",\"protocol\":\"v1\",\"buildRevision\":1,\"build\":{},\"progress\":{}}");var combined=RpgContracts.ConsumeSnapshot(full,lean);
  Check(object.ReferenceEquals(combined,lean)&&object.ReferenceEquals(combined["build"]["tree"],tree)&&object.ReferenceEquals(combined["compiled"],compile),"same revision transfers metadata without cloning");
  foreach(var change in new[]{"id","protocol","buildRevision"}){var next=JObject.Parse("{\"id\":\"one\",\"protocol\":\"v1\",\"buildRevision\":1,\"build\":{},\"progress\":{}}");next[change]=change=="buildRevision"?(JToken)2:(JToken)"different";Check(RpgContracts.ConsumeSnapshot((JObject)original.DeepClone(),next)["compiled"]==null,"cache invalidates "+change);}
  var state=JObject.Parse("{\"id\":\"combat\",\"unityBossMode\":true,\"status\":\"playing\",\"room\":1,\"cameraMode\":\"QuarterView\",\"elapsed\":10,\"hero\":{\"x\":3000,\"y\":5000,\"elevation\":12,\"airHeight\":0,\"action\":\"run1\",\"facing\":1,\"direction\":{\"x\":1,\"y\":0},\"motion\":null},\"walkBounds\":{\"minX\":2670,\"maxX\":8700,\"minY\":1200,\"maxY\":10300},\"acceptedInput\":{\"x\":1,\"y\":0,\"auto\":false}}");var map=JObject.Parse("{\"laneY\":192,\"obstacles\":[]}");var authority=state.ToString();var projector=new NativeHeroProjection();
  JObject previous=null;for(int i=0;i<30;i++){float t=10+i/60f;var expected=NativeCombatPresentation.ProjectHero(state,map,t,i<15?1:-1,false,.2f);var actual=projector.Project(state,map,t,i<15?1:-1,false,.2f);Check(JToken.DeepEquals(expected,actual),"display parity frame "+i);if(previous!=null)Check(object.ReferenceEquals(previous,actual),"display buffer reused "+i);previous=actual;}Check(state.ToString()==authority,"display never mutates authoritative hero");
  foreach(double rtt in new[]{50.0,150.0,300.0}){
   var model=new BossMovementPresentation();var s=(JObject)state.DeepClone();float x=3000,last=3000;double received=1;int stalled=0;
   for(int frame=0;frame<240;frame++){double now=1+frame/60.0;if(now-received>=rtt/1000+.02){x+=(float)((now-received)*210);s["hero"]["x"]=x;received=now;}
    var hero=(JObject)s["hero"].DeepClone();model.Apply(hero,s,map,1,0,1f/60f,now,received,rtt,false);float next=(float)hero["x"];Check(next>=last-.001f,"no backward movement RTT "+rtt+" frame "+frame);if(frame>5&&next-last<.01f)stalled++;last=next;}
   Check(stalled==0,"continuous movement across RTT "+rtt);
  }
  var blockedMap=JObject.Parse("{\"laneY\":192,\"obstacles\":[{\"x\":3050,\"y\":5000,\"radius\":15}]}");var predictor=new BossMovementPresentation();var h=(JObject)state["hero"].DeepClone();for(int i=0;i<20;i++)predictor.Apply(h,state,blockedMap,1,0,1f/60,1+i/60.0,1,300,false);Check((float)h["x"]<=3017,"prediction respects trunk collision");
  float before=(float)h["x"];predictor.Apply(h,state,blockedMap,1,0,1f/60,3,1,300,false);Check((float)h["x"]==before,"loss stops prediction after stale horizon");
  var report=new{passed=true,count=checks.Count,checks};File.WriteAllText("C:/Users/SHK/island-combat-stability-20261107/evidence/client-checks.json",Newtonsoft.Json.JsonConvert.SerializeObject(report,Newtonsoft.Json.Formatting.Indented));return new{passed=true,count=checks.Count};
 }
}
