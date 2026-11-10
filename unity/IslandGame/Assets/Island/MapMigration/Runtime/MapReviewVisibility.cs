using System.Collections.Generic;
using UnityEngine;
namespace IslandGame.MapReview {
 [ExecuteAlways] public sealed class MapReviewVisibility:MonoBehaviour {
  public Camera view;public Transform actors,props;public int hiddenGroups;
  readonly List<Renderer> hidden=new List<Renderer>();
  void Update(){Apply();}
  public void Apply(){Restore();hiddenGroups=0;if(!view||!actors||!props)return;foreach(Transform g in props){if(!g.name.StartsWith("tree /")&&!g.name.StartsWith("rock /"))continue;var rr=g.GetComponentsInChildren<Renderer>();if(rr.Length==0)continue;var b=rr[0].bounds;foreach(var r in rr)b.Encapsulate(r.bounds);b.Expand(.4f);bool hide=false;foreach(Transform actor in actors){if(!actor.gameObject.activeInHierarchy)continue;var target=actor.position+Vector3.up*.75f;var delta=target-view.transform.position;if(b.IntersectRay(new Ray(view.transform.position,delta.normalized),out float t)&&t<delta.magnitude-.3f){hide=true;break;}}if(hide){foreach(var r in rr){if(r.forceRenderingOff)continue;r.forceRenderingOff=true;hidden.Add(r);}hiddenGroups++;}}}
  void Restore(){foreach(var r in hidden)if(r)r.forceRenderingOff=false;hidden.Clear();}
  void OnDisable(){Restore();}
 }
}
