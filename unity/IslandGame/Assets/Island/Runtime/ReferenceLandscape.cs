using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
namespace IslandGame {
 // Visual-only extension owned by each streamed zone. No colliders or terrain edits.
 public sealed class ReferenceLandscape:MonoBehaviour {
  readonly List<Object> owned=new List<Object>();Transform panorama;Camera view;bool built;int zone;
  public bool WaterReady {get;private set;}
  public void Bind(Camera camera,int index){view=camera;zone=index;if(!view)return;view.GetUniversalAdditionalCameraData().requiresDepthTexture=true;if(built)return;built=true;
   var texture=Resources.Load<Texture2D>("ReferencePanorama");var shader=Resources.Load<Shader>("ReferenceBackdrop");
   if(texture&&shader){var mat=new Material(shader){name="Alpine panorama · peach/sage"};mat.mainTexture=texture;owned.Add(mat);panorama=Surface("Layered alpine distance",Quad(),mat).transform;
    foreach(var r in GetComponentsInChildren<Renderer>(true))if(r.name=="Distant context - no physics")r.forceRenderingOff=true;
   }
   if(zone==4||zone==5){var mat=new Material(Resources.Load<Shader>("ReferenceRiver")){name="Flowing river · depth and shoreline foam"};owned.Add(mat);
    // Bridge underside is -3.45; the water stays below its walking deck. The
    // authored banks/depth buffer form the shoreline and hide the outer edges.
    var river=Surface("River beneath bridge",RiverMesh(zone==4?9:16,105),mat);river.transform.position=new Vector3(zone==4?0:9,zone==4?-3.05f:-3.2f,15);WaterReady=true;
   }
  }
  void LateUpdate(){if(!panorama||!view)return;
   const float distance=48;float height=2*distance*Mathf.Tan(view.fieldOfView*Mathf.Deg2Rad*.5f);
   // Low parallax: ample overscan while the near terrain still moves in full 3D.
   var p=view.transform.position+view.transform.forward*distance;p.x-=view.transform.position.x*.12f;
   panorama.SetPositionAndRotation(p,view.transform.rotation);panorama.localScale=new Vector3(height*3,height,1);
  }
  GameObject Surface(string name,Mesh mesh,Material material){owned.Add(mesh);var go=new GameObject(name,typeof(MeshFilter),typeof(MeshRenderer));go.layer=30;go.transform.SetParent(transform,false);go.GetComponent<MeshFilter>().sharedMesh=mesh;var r=go.GetComponent<MeshRenderer>();r.sharedMaterial=material;r.shadowCastingMode=ShadowCastingMode.Off;r.receiveShadows=false;return go;}
  static Mesh Quad(){return new Mesh{name="Panorama quad",vertices=new[]{new Vector3(-.5f,-.5f,0),new Vector3(.5f,-.5f,0),new Vector3(-.5f,.5f,0),new Vector3(.5f,.5f,0)},uv=new[]{new Vector2(0,0),new Vector2(1,0),new Vector2(0,1),new Vector2(1,1)},triangles=new[]{0,2,1,1,2,3}};}
  static Mesh RiverMesh(float halfWidth,float length){const int nx=12,nz=64;var vertices=new Vector3[(nx+1)*(nz+1)];var triangles=new int[nx*nz*6];int k=0;
   for(int z=0;z<=nz;z++)for(int x=0;x<=nx;x++){float depth=((float)z/nz-.5f)*length;float bend=Mathf.Sin(depth*.055f)*2;float taper=Mathf.Lerp(1,.22f,Mathf.SmoothStep(0,1,Mathf.InverseLerp(0,45,depth)));vertices[z*(nx+1)+x]=new Vector3(((float)x/nx*2-1)*halfWidth*taper+bend,0,depth);if(x<nx&&z<nz){int a=z*(nx+1)+x;triangles[k++]=a;triangles[k++]=a+nx+1;triangles[k++]=a+1;triangles[k++]=a+1;triangles[k++]=a+nx+1;triangles[k++]=a+nx+2;}}
   var mesh=new Mesh{name="Subdivided river"};mesh.vertices=vertices;mesh.triangles=triangles;mesh.RecalculateBounds();return mesh;
  }
  void OnDestroy(){foreach(var asset in owned)if(asset)Destroy(asset);}
 }
}
