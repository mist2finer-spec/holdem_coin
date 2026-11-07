using System;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 // Immutable, inexpensive placement metadata. No distant GameObjects or meshes are created here.
 public static class NatureStreamPlan {
  public const float ChunkWidth=6;
  public struct Placement {public NatureEnvironmentAssets.Prop prop;public Vector3 position;public float height,yaw;public bool shadow;}
  public sealed class Chunk {public int id,room;public float a,b,y;public readonly List<Placement> props=new List<Placement>();public bool trail;}
  public static float Noise(int n){unchecked{uint x=(uint)n;x^=x>>16;x*=0x7feb352d;x^=x>>15;x*=0x846ca68b;x^=x>>16;return (x&0xffffff)/16777216f;}}
  public static float Distance(Chunk c,float x)=>Mathf.Max(0,Mathf.Max(c.a-x,x-c.b));
  public static List<Chunk> Build(NatureEnvironmentAssets assets,JObject map){return new Planner(assets,map).Build();}
  sealed class Planner {
   readonly NatureEnvironmentAssets assets;readonly JObject map;readonly int seed;readonly List<Chunk> chunks=new List<Chunk>();
   public Planner(NatureEnvironmentAssets a,JObject m){assets=a;map=m;seed=unchecked((int)(m?.Value<long?>("seed")??111L));}
   float R(int n)=>Noise(unchecked(n+seed));
   NatureEnvironmentAssets.Prop Pick(NatureEnvironmentAssets.Prop[] items,int key)=>items!=null&&items.Length>0?items[Mathf.Min(items.Length-1,(int)(R(key)*items.Length))]:null;
   public List<Chunk> Build(){
    if(map?["rooms"] is JArray rooms){for(int i=0;i<rooms.Count;i++)Room(NativeCombatPresentation.N(rooms[i]["x1"])*.48f,(NativeCombatPresentation.N(rooms[i]["x2"])+1)*.48f,NativeCombatPresentation.N(rooms[i]["elevation"])/100,i);
     if(map["gates"] is JArray gates)foreach(var gate in gates)if(gate["ledges"] is JArray ledges)foreach(var ledge in ledges){float x=NativeCombatPresentation.N(ledge["x"])/100;chunks.Add(new Chunk{id=chunks.Count,room=-1,a=x-.2f,b=x+.2f,y=NativeCombatPresentation.N(ledge["elevation"])/100});}
    }else Room(-10,60,0,0);
    return chunks;
   }
   void Room(float a,float b,float y,int room){
    int first=chunks.Count;for(float start=a;start<b-.0001f;start+=ChunkWidth)chunks.Add(new Chunk{id=chunks.Count,room=room,a=start,b=Mathf.Min(b,start+ChunkWidth),y=y,trail=true});
    int count=chunks.Count-first;if(count==0)return;
    if((string)map?["rooms"]?[room]?["kind"]=="boss")return;
    Action<NatureEnvironmentAssets.Prop,float,float,float,int,bool> prop=(p,x,z,height,k,shadow)=>{if(p==null||(!p.prefab&&string.IsNullOrEmpty(p.resourcePath)))return;int index=Mathf.Clamp(Mathf.FloorToInt((x-a)/ChunkWidth),0,count-1);chunks[first+index].props.Add(new Placement{prop=p,position=new Vector3(x,y,z),height=height,yaw=R(k)*360,shadow=shadow});};
    int i=0;for(float x=a+.7f;x<b-.5f;x+=4.6f){int k=room*1000+i++*43;prop(Pick(assets.pines,k),x+(R(k+1)-.5f)*1.2f,8.5f+R(k+2)*2,6.8f+R(k+3)*2.3f,k+4,false);}
    i=0;for(float x=a+1.8f;x<b-.4f;x+=4.5f){int k=room*1200+i++*53+500;prop(Pick(assets.trees,k),x+(R(k+1)-.5f)*1.2f,4.8f+R(k+2),4.3f+R(k+3)*1.4f,k+4,true);}
    i=0;for(float x=a+.4f;x<b-.3f;x+=1.35f){int k=room*1400+i++*31+900;float jitter=(R(k)-.5f)*.55f;
     prop(Pick(assets.grass,k+1),x+jitter,-.95f-R(k+2)*.25f,.14f+R(k+3)*.14f,k+4,false);
     prop(Pick(assets.grass,k+5),x-jitter,1.05f+R(k+6)*.4f,.20f+R(k+7)*.21f,k+8,false);
     if(i%3==0)prop(Pick(assets.shrubs,k+9),x,2.4f+R(k+10)*.5f,.55f+R(k+11)*.35f,k+12,false);
     if(i%4==0)prop(Pick(assets.rocks,k+13),x+.45f,-1.25f,.22f+R(k+14)*.22f,k+15,false);
     if(i%5==0)prop(Pick(assets.flowers,k+16),x-.15f,1.18f,.30f+R(k+17)*.12f,k+18,false);
     if(i%7==0)prop(Pick(assets.mushrooms,k+19),x+.18f,-.9f,.12f+R(k+20)*.05f,k+21,false);
     if(i%9==0)prop(Pick(assets.logs,k+22),x,2.1f,.27f,k+23,false);
     if(i%10==0)prop(Pick(assets.fences,k+24),x+1.1f,2.2f,.65f,k+25,false);
    }
   }
  }
 }
}
