using System;
using System.Collections.Generic;
using UnityEngine;
namespace IslandGame {
 // Only the resident chunks contribute geometry. Three shared-material draws replace per-chunk floors.
 public sealed class NatureTerrainBatch:IDisposable {
  sealed class Surface {
   public Mesh mesh;public readonly List<Vector3> vertices=new List<Vector3>(),normals=new List<Vector3>();public readonly List<Vector2> uv=new List<Vector2>();public readonly List<int> triangles=new List<int>();
   public void Clear(){vertices.Clear();normals.Clear();uv.Clear();triangles.Clear();}
   public void Upload(){mesh.Clear();mesh.SetVertices(vertices);mesh.SetNormals(normals);mesh.SetUVs(0,uv);mesh.SetTriangles(triangles,0);mesh.RecalculateBounds();}
  }
  float front=4,back=24,skirt=12;
  public bool Configure(float frontDepth,float backDepth,float skirtDepth){if(Mathf.Approximately(front,frontDepth)&&Mathf.Approximately(back,backDepth)&&Mathf.Approximately(skirt,skirtDepth))return false;front=Mathf.Max(1,frontDepth);back=Mathf.Max(4,backDepth);skirt=Mathf.Max(2,skirtDepth);return true;}
  readonly Surface earth,grass,trail;readonly Vector3[] cubeVertices,cubeNormals;readonly Vector2[] cubeUv;readonly int[] cubeTriangles;readonly GameObject root;readonly int seed;
  public NatureTerrainBatch(Transform parent,NatureEnvironmentAssets assets,int mapSeed){
   seed=mapSeed;root=new GameObject("Resident terrain · three material batches");root.transform.SetParent(parent,false);var cube=IslandDisplayMeshes.Create(PrimitiveType.Cube);cubeVertices=cube.vertices;cubeNormals=cube.normals;cubeUv=cube.uv;cubeTriangles=cube.triangles;Destroy(cube);
   earth=Create("Stream terrain earth",assets.earth);grass=Create("Stream terrain grass",assets.ground);trail=Create("Stream terrain trail",assets.trail);
  }
  Surface Create(string name,Material material){var s=new Surface{mesh=new Mesh{name=name}};s.mesh.MarkDynamic();var go=new GameObject(name,typeof(MeshFilter),typeof(MeshRenderer));go.layer=30;go.transform.SetParent(root.transform,false);go.GetComponent<MeshFilter>().sharedMesh=s.mesh;var r=go.GetComponent<MeshRenderer>();r.sharedMaterial=material;r.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;return s;}
  void Block(Surface s,Vector3 p,Vector3 scale){int first=s.vertices.Count;for(int i=0;i<cubeVertices.Length;i++){s.vertices.Add(p+Vector3.Scale(cubeVertices[i],scale));s.normals.Add(cubeNormals[i]);s.uv.Add(cubeUv[i]);}foreach(int i in cubeTriangles)s.triangles.Add(first+i);}
  public void Rebuild(List<NatureStreamPlan.Chunk> chunks){
   earth.Clear();grass.Clear();trail.Clear();foreach(var c in chunks){Block(earth,new Vector3((c.a+c.b)*.5f,c.y-skirt*.5f,(back-front)*.5f),new Vector3(c.b-c.a,skirt,front+back));Block(grass,new Vector3((c.a+c.b)*.5f,c.y-.018f,(back-front)*.5f),new Vector3(c.b-c.a,.036f,front+back));if(c.trail)Trail(c);}
   earth.Upload();grass.Upload();trail.Upload();
  }
  void Trail(NatureStreamPlan.Chunk c){int count=Mathf.Max(1,Mathf.CeilToInt((c.b-c.a)/1.2f)),first=trail.vertices.Count;
   for(int i=0;i<=count;i++){float x=Mathf.Lerp(c.a,c.b,i/(float)count),half=.73f+.1f*NatureStreamPlan.Noise(unchecked(seed+c.room*2000+Mathf.RoundToInt(x/1.2f)*11));trail.vertices.Add(new Vector3(x,c.y+.006f,-half));trail.vertices.Add(new Vector3(x,c.y+.006f,half+.08f));trail.normals.Add(Vector3.up);trail.normals.Add(Vector3.up);trail.uv.Add(new Vector2(x*.4f,0));trail.uv.Add(new Vector2(x*.4f,.6f));if(i<count){int v=first+i*2;trail.triangles.Add(v);trail.triangles.Add(v+1);trail.triangles.Add(v+2);trail.triangles.Add(v+2);trail.triangles.Add(v+1);trail.triangles.Add(v+3);}}
  }
  public void Dispose(){Destroy(earth.mesh);Destroy(grass.mesh);Destroy(trail.mesh);Destroy(root);}
  static void Destroy(UnityEngine.Object o){if(!o)return;if(Application.isPlaying)UnityEngine.Object.Destroy(o);else UnityEngine.Object.DestroyImmediate(o);}
 }
}
