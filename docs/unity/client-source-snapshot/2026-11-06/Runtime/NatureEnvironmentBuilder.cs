using System;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 // Presentation only. Authoritative map bounds, gates, movement and combat never use these props.
 public static class NatureEnvironmentBuilder {
  sealed class Builder {
   readonly NatureEnvironmentAssets assets;readonly Transform root;readonly List<UnityEngine.Object> owned;
   readonly Dictionary<Material,Material> materials=new Dictionary<Material,Material>();readonly Mesh cube;readonly int seed;
   public Builder(NatureEnvironmentAssets a,Transform parent,List<UnityEngine.Object> cleanup,int mapSeed){assets=a;owned=cleanup;seed=mapSeed;var go=new GameObject("Nature Free · environment");go.transform.SetParent(parent,false);root=go.transform;cube=IslandDisplayMeshes.Create(PrimitiveType.Cube);owned.Add(cube);for(int i=0;i<a.sourceMaterials.Length&&i<a.displayMaterials.Length;i++)if(a.sourceMaterials[i]&&a.displayMaterials[i])materials[a.sourceMaterials[i]]=a.displayMaterials[i];}
   static float Noise(int n){unchecked{uint x=(uint)n;x^=x>>16;x*=0x7feb352d;x^=x>>15;x*=0x846ca68b;x^=x>>16;return (x&0xffffff)/16777216f;}}
   float R(int n)=>Noise(n+seed);
   NatureEnvironmentAssets.Prop Pick(NatureEnvironmentAssets.Prop[] items,int key)=>items!=null&&items.Length>0?items[Mathf.Min(items.Length-1,(int)(R(key)*items.Length))]:null;
   void Block(string name,Vector3 position,Vector3 size,Material material){var go=new GameObject(name,typeof(MeshFilter),typeof(MeshRenderer));go.layer=30;go.transform.SetParent(root,false);go.transform.localPosition=position;go.transform.localScale=size;go.GetComponent<MeshFilter>().sharedMesh=cube;go.GetComponent<MeshRenderer>().sharedMaterial=material;}
   void Prop(NatureEnvironmentAssets.Prop p,float x,float y,float z,float height,int key,bool castShadow){
    if(p==null||!p.prefab)return;var go=UnityEngine.Object.Instantiate(p.prefab,root,false);go.name="Nature · "+p.prefab.name;
    float scale=height/Mathf.Max(.001f,p.bounds.size.y);var rotation=Quaternion.Euler(0,R(key)*360,0);var center=rotation*(new Vector3(p.bounds.center.x,0,p.bounds.center.z)*scale);
    go.transform.localScale=Vector3.one*scale;go.transform.localRotation=rotation;go.transform.localPosition=new Vector3(x-center.x,y-p.bounds.min.y*scale,z-center.z);
    foreach(var t in go.GetComponentsInChildren<Transform>(true))t.gameObject.layer=30;
    foreach(var collider in go.GetComponentsInChildren<Collider>(true)){collider.enabled=false;if(Application.isPlaying)UnityEngine.Object.Destroy(collider);else UnityEngine.Object.DestroyImmediate(collider);}
    foreach(var renderer in go.GetComponentsInChildren<Renderer>(true)){
     var list=renderer.sharedMaterials;for(int i=0;i<list.Length;i++){Material replacement;if(list[i]&&materials.TryGetValue(list[i],out replacement))list[i]=replacement;}renderer.sharedMaterials=list;
     renderer.shadowCastingMode=castShadow?UnityEngine.Rendering.ShadowCastingMode.On:UnityEngine.Rendering.ShadowCastingMode.Off;renderer.receiveShadows=true;
    }
   }
   public void Room(float a,float b,float y,int room,bool decorate){
    Block("Server room · nature earth",new Vector3((a+b)*.5f,y-.34f,5),new Vector3(b-a,.65f,13),assets.earth);
    Block("Server room · nature grass",new Vector3((a+b)*.5f,y-.018f,5),new Vector3(b-a,.036f,13),assets.ground);
    Trail(a,b,y,room);
    if(!decorate)return;
    int index=0;
    for(float x=a+.7f;x<b-.5f;x+=4.6f){int k=room*1000+index++*43;Prop(Pick(assets.pines,k),x+(R(k+1)-.5f)*1.2f,y,8.5f+R(k+2)*2,6.8f+R(k+3)*2.3f,k+4,false);}
    index=0;
    for(float x=a+1.8f;x<b-.4f;x+=4.5f){int k=room*1200+index++*53+500;Prop(Pick(assets.trees,k),x+(R(k+1)-.5f)*1.2f,y,4.8f+R(k+2),4.3f+R(k+3)*1.4f,k+4,true);}
    index=0;
    for(float x=a+.4f;x<b-.3f;x+=1.35f){int k=room*1400+index++*31+900;float jitter=(R(k)-.5f)*.55f;
     Prop(Pick(assets.grass,k+1),x+jitter,y+.005f,-.95f-R(k+2)*.25f,.14f+R(k+3)*.14f,k+4,false);
     Prop(Pick(assets.grass,k+5),x-jitter,y+.005f,1.05f+R(k+6)*.4f,.20f+R(k+7)*.21f,k+8,false);
     if(index%3==0)Prop(Pick(assets.shrubs,k+9),x,y,2.4f+R(k+10)*.5f,.55f+R(k+11)*.35f,k+12,false);
     if(index%4==0)Prop(Pick(assets.rocks,k+13),x+.45f,y-.035f,-1.25f,.22f+R(k+14)*.22f,k+15,false);
     if(index%5==0)Prop(Pick(assets.flowers,k+16),x-.15f,y,1.18f,.30f+R(k+17)*.12f,k+18,false);
     if(index%7==0)Prop(Pick(assets.mushrooms,k+19),x+.18f,y,-.9f,.12f+R(k+20)*.05f,k+21,false);
     if(index%9==0)Prop(Pick(assets.logs,k+22),x,y,2.1f,.27f,k+23,false);
     if(index%10==0)Prop(Pick(assets.fences,k+24),x+1.1f,y,2.2f,.65f,k+25,false);
    }
   }
   void Trail(float a,float b,float y,int room){
    int count=Mathf.Max(1,Mathf.CeilToInt((b-a)/1.2f));var vertices=new Vector3[(count+1)*2];var uv=new Vector2[vertices.Length];var triangles=new int[count*6];
    for(int i=0;i<=count;i++){float x=Mathf.Lerp(a,b,i/(float)count);float half=.73f+.10f*R(room*2000+i*11);vertices[i*2]=new Vector3(x,y+.006f,-half);vertices[i*2+1]=new Vector3(x,y+.006f,half+.08f);uv[i*2]=new Vector2(x*.4f,0);uv[i*2+1]=new Vector2(x*.4f,.6f);if(i<count){int t=i*6,v=i*2;triangles[t]=v;triangles[t+1]=v+1;triangles[t+2]=v+2;triangles[t+3]=v+2;triangles[t+4]=v+1;triangles[t+5]=v+3;}}
    var mesh=new Mesh{name="Nature trail · room "+room};mesh.vertices=vertices;mesh.uv=uv;mesh.triangles=triangles;mesh.RecalculateNormals();mesh.RecalculateBounds();owned.Add(mesh);
    var go=new GameObject("Server room · forest trail",typeof(MeshFilter),typeof(MeshRenderer));go.layer=30;go.transform.SetParent(root,false);go.GetComponent<MeshFilter>().sharedMesh=mesh;go.GetComponent<MeshRenderer>().sharedMaterial=assets.trail;
   }
  }
  public static bool TryBuild(Transform root,JObject map,List<UnityEngine.Object> owned){
   var assets=Resources.Load<NatureEnvironmentAssets>("NatureEnvironmentAssets");if(!assets||assets.trees==null||assets.trees.Length==0)return false;
   var b=new Builder(assets,root,owned,unchecked((int)(map?.Value<long?>("seed")??111L)));
   if(map?["rooms"] is JArray rooms){int i=0;foreach(var room in rooms)b.Room(NativeCombatPresentation.N(room["x1"])*.48f,(NativeCombatPresentation.N(room["x2"])+1)*.48f,NativeCombatPresentation.N(room["elevation"])/100,i++,true);
    if(map["gates"] is JArray gates)foreach(var gate in gates)if(gate["ledges"] is JArray ledges)foreach(var ledge in ledges){float x=NativeCombatPresentation.N(ledge["x"])/100;b.Room(x-.2f,x+.2f,NativeCombatPresentation.N(ledge["elevation"])/100,-1,false);}
   }else b.Room(-10,60,0,0,true);
   return true;
  }
 }
}
