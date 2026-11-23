using System;
using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 // Ports the reference web presentation, not the server combat simulation. Seconds / web world units.
 public sealed class NativeCombatClock {
  double snapshot,received,rendered;bool playing,initialized;
  public void Receive(double elapsed,double now,bool active){
   if(double.IsNaN(elapsed)||double.IsInfinity(elapsed)||double.IsNaN(now)||double.IsInfinity(now))return;
   if(!initialized||elapsed<snapshot){rendered=elapsed;initialized=true;}
   snapshot=elapsed;received=now;playing=active;if(!active)rendered=elapsed;
  }
  public double Sample(double now,double maxLead=.15){
   if(double.IsNaN(maxLead)||double.IsInfinity(maxLead))maxLead=.15;maxLead=Math.Max(0,Math.Min(.45,maxLead));
   double lead=playing?Math.Min(maxLead,double.IsNaN(now)||double.IsInfinity(now)?0:Math.Max(0,now-received)):0;
   rendered=Math.Max(rendered,snapshot+lead);return rendered;
  }
 }
 public static class NativeCombatPresentation {
  // O1: explicit cast instead of Value<float>() (Convert.ChangeType boxed every call). Same Convert.ToSingle, InvariantCulture.
  public static float N(JToken value,float fallback=0)=>value==null||value.Type==JTokenType.Null?fallback:(float)value;
  // Shared read-only empty array for `?? EmptyArray` (never add to it).
  public static readonly JArray EmptyArray=new JArray();
  public static string ClipName(string action)=>action=="damage1"?"defeat1":action=="skill6"?"skill5":action=="walk"?"run1":action;
  public static float MotionTime(float age,float duration,float hitAt,float clipDuration,float contact,bool snappy=true){
   if(!Finite(age)||!Finite(duration)||!Finite(hitAt)||!Finite(clipDuration)||!Finite(contact)||duration<=0||clipDuration<=0)return 0;
   float t=Mathf.Clamp(age,0,duration),hit=Mathf.Clamp(hitAt,0,duration);contact=Mathf.Clamp(contact,0,clipDuration);
   if(snappy&&hit>0&&hit<duration){
    float snap=Mathf.Min(.04f,hit),sourceSnap=Mathf.Min(.04f,contact),begin=hit-snap;
    if(t<begin)return begin>0?t/begin*(contact-sourceSnap):0;
    if(t<hit)return contact-sourceSnap+(t-begin)/snap*sourceSnap;
    float hold=Mathf.Min(.10f,(duration-hit)*.6f),sourceHold=Mathf.Min(.10f,(clipDuration-contact)*.6f);
    if(t<=hit+hold)return contact+(t-hit)/hold*sourceHold;
    return contact+sourceHold+(t-hit-hold)/(duration-hit-hold)*(clipDuration-contact-sourceHold);
   }
   if(t<hit)return hit>0?t/hit*contact:0;
   return duration==hit?clipDuration:contact+(t-hit)/(duration-hit)*(clipDuration-contact);
  }
  static bool Finite(float n)=>!float.IsNaN(n)&&!float.IsInfinity(n);
  // Kit attack tempo (K6, KERNEL_KIT_CONTRACT §3-0): motion.clipMap = [[kernelAge, clipTime], ...] from [0,0], both increasing.
  // Kernel age -> clip time by straight pieces; past the last point 1:1. No map (tempo stage 0, skills, other kinds) = 1:1.
  // Same rule as clipAt in src/lib/rpg-hero-kit-iai.ts. Effects that follow the blade bone use this one function too.
  public static float ClipAt(JArray map,float age){
   if(map==null||map.Count<2||age<=0)return age;
   for(int i=1;i<map.Count;i++){var p=map[i] as JArray;if(p==null||p.Count<2)return age;float a1=(float)p[0],c1=(float)p[1];
    if(age<=a1){var q=(JArray)map[i-1];float a0=(float)q[0],c0=(float)q[1];return a1>a0?c0+(c1-c0)*(age-a0)/(a1-a0):c1;}}
   var last=(JArray)map[map.Count-1];return (float)last[1]+(age-(float)last[0]);
  }
  // Reads a clipMap once (when the motion changes) into reusable arrays; grows them only if the map is longer. Returns the point count, 0 = no map.
  public static int ReadClipMap(JArray map,ref float[] ages,ref float[] clips){
   int n=map?.Count??0;if(n<2)return 0;
   if(ages==null||clips==null||ages.Length<n||clips.Length<n){ages=new float[Mathf.Max(8,n)];clips=new float[ages.Length];}
   for(int i=0;i<n;i++){var p=map[i] as JArray;if(p==null||p.Count<2)return 0;ages[i]=(float)p[0];clips[i]=(float)p[1];}
   return n;
  }
  // Per-frame form of ClipAt on the values ReadClipMap kept. No allocation.
  public static float ClipAt(float[] ages,float[] clips,int count,float age){
   if(count<2||ages==null||clips==null||age<=0)return age;
   for(int i=1;i<count;i++)if(age<=ages[i]){float a0=ages[i-1],a1=ages[i];return a1>a0?clips[i-1]+(clips[i]-clips[i-1])*(age-a0)/(a1-a0):clips[i];}
   return clips[count-1]+(age-ages[count-1]);
  }
  public static JObject ProjectHero(JObject state,JObject map,float visualTime,float move,bool auto,float moveY=0,JObject reusable=null){
   var source=state?["hero"] as JObject;if(source==null)return null;var hero=reusable??(JObject)source.DeepClone();
   if((string)state["status"]!="playing"||(bool?)state["bossIntroActive"]==true)return hero;
   var motion=hero["motion"] as JObject;
   if(motion!=null){
    float age=Mathf.Max(0,visualTime-N(motion["start"])),duration=N(motion["duration"]),t=duration>0?Mathf.Clamp01(age/duration):1;string kind=(string)motion["kind"];
    if(kind=="jump"&&motion["legs"] is JArray legs&&legs.Count>0){var p=SampleTraversal(legs,age);hero["x"]=p["x"];hero["y"]=p["y"];hero["elevation"]=p["elevation"];hero["airHeight"]=p["airHeight"];hero["action"]=(bool)p["holding"]?"jump5":JumpClip(N(p["progress"]));}
    else if((bool?)state["unityBossMode"]==true&&(kind=="jump"||kind=="dodge"||kind=="slide")){if(kind=="jump")hero["action"]=motion["jump"] is JObject j?(j["landedAt"]?.Type!=JTokenType.Null?"jump5":age<.06f?"jump1":N(j["velocityY"])>0?"jump2":"jump4"):JumpClip(t);return hero;}
    else if(kind=="jump"||kind=="dodge"||kind=="slide"){
     hero["x"]=Mathf.Lerp(N(motion["from"]?["x"]),N(motion["to"]?["x"]),t);hero["y"]=Mathf.Lerp(N(motion["from"]?["y"]),N(motion["to"]?["y"]),t);hero["airHeight"]=kind=="jump"?400*t*(1-t):0;
     if(kind=="jump")hero["action"]=JumpClip(t);if(kind=="slide")hero["action"]=t<.7f?"sliding1":"sliding2";
    }else if(kind=="knockback"){
     float flight=Mathf.Clamp01(age/.45f);hero["x"]=Mathf.Lerp(N(motion["from"]?["x"]),N(motion["to"]?["x"]),flight);hero["y"]=Mathf.Lerp(N(motion["from"]?["y"]),N(motion["to"]?["y"]),flight);hero["airHeight"]=age<.45f?4*210*flight*(1-flight):0;hero["action"]=age<.45f?"knockback":age<1.2f?"knockdown":"getup";
    }else if(kind=="rush"&&(bool?)state["mountSunday"]==true)return hero;
    else if(kind=="rush"){float desired=Mathf.Lerp(N(motion["from"]?["x"]),N(motion["to"]?["x"]),t);hero["x"]=PreviewWalk(map,state,N(hero["x"]),desired-N(hero["x"]));}
    return hero;
   }
   if((bool?)state["unityBossMode"]==true){
    bool planar=(string)state["movementMode"]=="plane"||(bool?)state["mountSunday"]!=true&&(int?)state["room"]==1;
    var input=Vector2.ClampMagnitude(new Vector2(move,planar?moveY:0),1);
    if(input.magnitude>.1f){
     // A-3 (quarter pad fix, 2026-11-23): boss-mode state comes from CombatSnapshotBuffer, whose hero x/y are already blended to
     // visualTime. The old input*speed*(visualTime-elapsed) lead was added on top of that and reset at every snapshot (a sawtooth with
     // backward frames, both views). Position is now the buffer's; the input only turns the hero and picks the run clip.
     if(Mathf.Abs(input.x)>.01f)hero["facing"]=Mathf.Sign(input.x);SetDirection(hero,input.normalized.x,input.normalized.y);hero["action"]="run1";
    }else if(!auto)hero["action"]="stay1";
    return hero;
   }
   if(Mathf.Abs(move)>.1f||!auto){
    float direction=Mathf.Clamp(move,-1,1),lead=Mathf.Clamp(visualTime-N(state["elapsed"]),0,.15f);
    if(Mathf.Abs(direction)>.1f){hero["x"]=PreviewWalk(map,state,N(hero["x"]),direction*210*lead);hero["facing"]=Mathf.Sign(direction);SetDirection(hero,Mathf.Sign(direction),0);hero["action"]="run1";}
    else if((string)hero["action"]=="run1")hero["action"]="stay1";
   }
   return hero;
  }
  public static void SetDirection(JObject hero,float x,float y){var direction=hero["direction"] as JObject;if(direction==null){direction=new JObject();hero["direction"]=direction;}SetNumber(direction,"x",x);SetNumber(direction,"y",y);}
  public static void SetNumber(JObject target,string key,float value){if(target[key] is JValue scalar)scalar.Value=value;else target[key]=value;}
  public static string JumpClip(float t)=>t<.12f?"jump1":t<.35f?"jump2":t<.65f?"jump3":t<.9f?"jump4":"jump5";
  public static JObject SampleTraversal(JArray legs,float age){
   float elapsed=Mathf.Max(0,age);
   for(int i=0;i<legs.Count;i++){var leg=legs[i];float duration=N(leg["duration"]),hold=N(leg["hold"]);
    if(elapsed<=duration+hold||i==legs.Count-1){
     float progress=duration>0?Mathf.Min(1,elapsed/duration):1,t=progress*duration*3;
     float elevation=Mathf.Lerp(N(leg["from"]?["elevation"]),N(leg["to"]?["elevation"]),progress);
     float ballistic=N(leg["from"]?["elevation"])+24*(N(leg["velocityY"])*t-.5f*9.8f*t*t);
     return new JObject{{"x",Mathf.Lerp(N(leg["from"]?["x"]),N(leg["to"]?["x"]),progress)},{"y",Mathf.Lerp(N(leg["from"]?["y"]),N(leg["to"]?["y"]),progress)},{"elevation",elevation},{"airHeight",N(leg["velocityY"])!=0&&progress<1?Mathf.Max(0,ballistic-elevation):0},{"progress",progress},{"holding",elapsed>=duration},{"index",i}};
    }elapsed-=duration+hold;
   }throw new ArgumentException("Traversal requires legs");
  }
  public static float PreviewWalk(JObject map,JObject state,float from,float dx){
   if(map==null||!(map["rooms"] is JArray rooms))return from;int room=(int)N(state["room"]);if(room<0||room>=rooms.Count)return from;
   int steps=Mathf.Max(1,Mathf.CeilToInt(Mathf.Abs(dx)/6));float x=from,y=N(state["hero"]?["y"]);
   for(int i=0;i<steps;i++){float next=x+dx/steps;if(!Walkable(map,next,y))next=x;next=Mathf.Clamp(next,N(state["walkBounds"]?["minX"],N(rooms[room]["x1"])*48+12),N(state["walkBounds"]?["maxX"],(N(rooms[room]["x2"])+1)*48-12));
    bool blocked=false;foreach(var mob in state["mobs"] as JArray??EmptyArray)if(N(mob["hp"])>0&&(int)N(mob["room"])==room&&Vector2.Distance(new Vector2(next,y),new Vector2(N(mob["x"]),N(mob["y"])))<12+N(mob["radius"])-1){blocked=true;break;}
    if(blocked)break;x=next;
   }return x;
  }
  public static float UnityGroundHeight(JObject map,float x,float z=0){
   var terrain=map?["terrain"] as JObject;float ground=0;
   if(terrain?["heights"] is JArray grid){int width=(int)N(terrain["width"]),height=(int)N(terrain["height"]);float gx=Mathf.Clamp((x/100-N(terrain["originX"]))/N(terrain["step"],1),0,width-1),gz=Mathf.Clamp((z-N(terrain["originZ"]))/N(terrain["step"],1),0,height-1);int ix=Mathf.Min((int)gx,width-2),iz=Mathf.Min((int)gz,height-2);ground=100*Mathf.Lerp(Mathf.Lerp(N(grid[iz*width+ix]),N(grid[iz*width+ix+1]),gx-ix),Mathf.Lerp(N(grid[(iz+1)*width+ix]),N(grid[(iz+1)*width+ix+1]),gx-ix),gz-iz);}
   return Mathf.Max(ground,BridgeHeight(map,x,z,ground));
  }
  static float BridgeHeight(JObject map,float x,float z,float fallback){var bridge=map?["bridge"] as JObject;var heights=bridge?["heightCore"] as JArray;if(heights==null||heights.Count<2||Mathf.Abs(z)>.65f)return fallback;float from=N(bridge["from"]),to=N(bridge["to"]);if(x<from||x>to||to<=from)return fallback;float index=Mathf.Clamp01((x-from)/(to-from))*(heights.Count-1);int a=Mathf.FloorToInt(index);return Mathf.Lerp(N(heights[a]),N(heights[Mathf.Min(a+1,heights.Count-1)]),index-a);}
  static bool Walkable(JObject map,float x,float y){
   if(!Finite(x)||!Finite(y))return false;int width=(int)N(map["width"]),height=(int)N(map["height"]);var tiles=map["tiles"] as JArray;if(tiles==null)return false;
   for(int ty=Mathf.FloorToInt((y-12)/48);ty<=Mathf.FloorToInt((y+12)/48);ty++)for(int tx=Mathf.FloorToInt((x-12)/48);tx<=Mathf.FloorToInt((x+12)/48);tx++){
    if(tx<0||ty<0||tx>=width||ty>=height)return false;if(N(tiles[ty*width+tx])!=0){float px=Mathf.Clamp(x,tx*48,(tx+1)*48),py=Mathf.Clamp(y,ty*48,(ty+1)*48);if(Vector2.Distance(new Vector2(x,y),new Vector2(px,py))<12-1e-6f)return false;}
   }return true;
  }
 }
}
