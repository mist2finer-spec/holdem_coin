using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
namespace IslandGame.MapReview {
 [ExecuteAlways] public sealed class MapReviewGrass:MonoBehaviour {
  public int renderLayer;public Vector3[] positions; public Mesh nearMesh,farMesh;public Material material;public Camera view;public Transform hero;
  sealed class Cell {public Bounds bounds;public Matrix4x4[] matrices;}
  readonly List<Cell> cells=new List<Cell>(); readonly Plane[] planes=new Plane[6];
  public int DrawnCells{get;private set;} public int DrawnClumps{get;private set;}
  void OnEnable(){Rebuild();}
  public void Rebuild(){cells.Clear();if(positions==null)return;var map=new Dictionary<Vector2Int,List<Matrix4x4>>();foreach(var p in positions){var key=new Vector2Int(Mathf.FloorToInt(p.x/6),Mathf.FloorToInt(p.z/6));if(!map.TryGetValue(key,out var row))map[key]=row=new List<Matrix4x4>();float seed=Mathf.Repeat(p.x*13.37f+p.z*9.13f,1);row.Add(Matrix4x4.TRS(p,Quaternion.Euler(0,seed*360,0),Vector3.one*(.75f+seed*.45f)));}foreach(var pair in map){var b=new Bounds(pair.Value[0].GetColumn(3),Vector3.one);foreach(var m in pair.Value)b.Encapsulate((Vector3)m.GetColumn(3));b.Expand(2);cells.Add(new Cell{bounds=b,matrices=pair.Value.ToArray()});}}
  void Update(){if(!view||!material||!nearMesh)return;GeometryUtility.CalculateFrustumPlanes(view,planes);var center=hero?hero.position:Vector3.zero;Shader.SetGlobalVector("_MapReviewHero",new Vector4(center.x,center.y,center.z,1));DrawnCells=DrawnClumps=0;foreach(var c in cells){if(!GeometryUtility.TestPlanesAABB(planes,c.bounds))continue;float d=Vector3.Distance(center,c.bounds.center);if(d>32)continue;var rp=new RenderParams(material){worldBounds=c.bounds,layer=renderLayer,shadowCastingMode=ShadowCastingMode.Off,receiveShadows=true,camera=view};Graphics.RenderMeshInstanced(rp,d<17?nearMesh:farMesh,0,c.matrices);DrawnCells++;DrawnClumps+=c.matrices.Length;}}
  void OnDisable(){Shader.SetGlobalVector("_MapReviewHero",Vector4.zero);cells.Clear();}
 }
}
