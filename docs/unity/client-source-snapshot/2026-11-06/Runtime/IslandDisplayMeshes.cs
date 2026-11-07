using System;
using System.Collections.Generic;
using UnityEngine;
namespace IslandGame {
 // Visual-only equivalents of Unity's unit primitives. No physics components are created.
 public static class IslandDisplayMeshes {
  public static Mesh Create(PrimitiveType type){
   var v=new List<Vector3>();var n=new List<Vector3>();var uv=new List<Vector2>();var t=new List<int>();
   Action<Vector3,Vector3,Vector3,Vector3,Vector3> quad=(a,b,c,d,normal)=>{int s=v.Count;v.AddRange(new[]{a,b,c,d});n.AddRange(new[]{normal,normal,normal,normal});uv.AddRange(new[]{Vector2.zero,Vector2.up,Vector2.one,Vector2.right});t.AddRange(new[]{s,s+1,s+2,s,s+2,s+3});};
   if(type==PrimitiveType.Cube){
    foreach(var normal in new[]{Vector3.right,Vector3.left,Vector3.up,Vector3.down,Vector3.forward,Vector3.back}){
     var u=Vector3.Cross(normal,Mathf.Abs(normal.y)>.5f?Vector3.forward:Vector3.up)*.5f;var w=Vector3.Cross(normal,u);var center=normal*.5f;
     quad(center-u-w,center+u-w,center+u+w,center-u+w,normal);
    }
   }else if(type==PrimitiveType.Quad){
    quad(new Vector3(-.5f,-.5f,0),new Vector3(-.5f,.5f,0),new Vector3(.5f,.5f,0),new Vector3(.5f,-.5f,0),Vector3.back);
   }else if(type==PrimitiveType.Cylinder){
    const int segments=24;
    for(int i=0;i<segments;i++){
     float a=2*Mathf.PI*i/segments,b=2*Mathf.PI*(i+1)/segments;var p=new Vector3(Mathf.Cos(a)*.5f,0,Mathf.Sin(a)*.5f);var q=new Vector3(Mathf.Cos(b)*.5f,0,Mathf.Sin(b)*.5f);
     int s=v.Count;v.AddRange(new[]{p-Vector3.up,p+Vector3.up,q+Vector3.up,q-Vector3.up});n.AddRange(new[]{p.normalized,p.normalized,q.normalized,q.normalized});uv.AddRange(new[]{new Vector2((float)i/segments,0),new Vector2((float)i/segments,1),new Vector2((float)(i+1)/segments,1),new Vector2((float)(i+1)/segments,0)});t.AddRange(new[]{s,s+1,s+2,s,s+2,s+3});
     foreach(int sign in new[]{-1,1}){s=v.Count;var normal=Vector3.up*sign;v.Add(normal);v.Add((sign>0?q:p)+normal);v.Add((sign>0?p:q)+normal);for(int k=0;k<3;k++){n.Add(normal);uv.Add(new Vector2(v[s+k].x+.5f,v[s+k].z+.5f));}t.AddRange(new[]{s,s+1,s+2});}
    }
   }else if(type==PrimitiveType.Sphere){
    const int rings=12,segments=24;
    for(int y=0;y<=rings;y++)for(int x=0;x<=segments;x++){float a=2*Mathf.PI*x/segments,b=Mathf.PI*((float)y/rings-.5f);var normal=new Vector3(Mathf.Cos(b)*Mathf.Cos(a),Mathf.Sin(b),Mathf.Cos(b)*Mathf.Sin(a));v.Add(normal*.5f);n.Add(normal);uv.Add(new Vector2((float)x/segments,(float)y/rings));}
    for(int y=0;y<rings;y++)for(int x=0;x<segments;x++){int a=y*(segments+1)+x,b=a+segments+1;t.AddRange(new[]{a,b,b+1,a,b+1,a+1});}
   }else throw new ArgumentOutOfRangeException(nameof(type),type,"Unsupported display mesh");
   var mesh=new Mesh{name="Display only · "+type};mesh.SetVertices(v);mesh.SetNormals(n);mesh.SetUVs(0,uv);mesh.SetTriangles(t,0);mesh.RecalculateBounds();return mesh;
  }
 }
}
