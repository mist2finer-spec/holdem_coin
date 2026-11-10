using UnityEngine;

namespace IslandGame {
 [DisallowMultipleComponent,RequireComponent(typeof(Camera))]
 public sealed class CameraHorizontalWidthLock : MonoBehaviour {
  [Min(.1f)] public float targetHorizontalWidth=12f;
  [Range(.05f,.45f)] public float groundViewportY=.18f;
  [Range(.1f,.9f)] public float actorViewportX=.38f;
  public float cameraDistance=10f;
  Camera view;
  public void Apply(){
   if(!view)view=GetComponent<Camera>();
   if(view.orthographic&&view.aspect>.001f)view.orthographicSize=targetHorizontalWidth/(2*view.aspect);
  }
  public Vector3 PositionForGround(Vector3 ground){
   Apply();return ground-view.transform.forward*cameraDistance
    +view.transform.right*((.5f-actorViewportX)*targetHorizontalWidth)
    +view.transform.up*((.5f-groundViewportY)*2*view.orthographicSize);
  }
  void LateUpdate(){Apply();}
 }
}
