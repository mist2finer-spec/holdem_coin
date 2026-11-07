using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;

namespace IslandGame {
 [RequireComponent(typeof(UnityEngine.UI.RawImage))]
 public sealed class SkillTreeViewportInput : MonoBehaviour,IPointerDownHandler,IPointerUpHandler,IBeginDragHandler,IDragHandler,IEndDragHandler,IScrollHandler,ICancelHandler {
  public SkillTreeCameraController Controller;
  public SkillTreeManager Manager;
  public float TapMovementPixels=12,TapMaxSeconds=.45f,TapRadiusPixels=18;
  sealed class Finger {public Vector2 start,current;public float time;public bool moved;public Camera eventCamera;}
  readonly Dictionary<int,Finger> fingers=new Dictionary<int,Finger>();
  readonly List<UnityEngine.UI.ScrollRect> locked=new List<UnityEngine.UI.ScrollRect>();
  readonly List<bool> wasEnabled=new List<bool>();
  Vector2 previousCenter;float previousDistance;bool baseline,multiTouch,dirty;
  UnityEngine.UI.RawImage image;
  public int ActivePointers=>fingers.Count;
  public bool ParentScrollLocked=>locked.Count>0;
  void Awake(){image=GetComponent<UnityEngine.UI.RawImage>();}
  bool Inside(Vector2 p,Camera c){
   if(!RectTransformUtility.RectangleContainsScreenPoint((RectTransform)transform,p,c))return false;
   foreach(var mask in GetComponentsInParent<UnityEngine.UI.RectMask2D>())if(mask.isActiveAndEnabled&&!RectTransformUtility.RectangleContainsScreenPoint((RectTransform)mask.transform,p,c))return false;
   return true;
  }
  public bool ScreenToUV(Vector2 screen,Camera eventCamera,out Vector2 uv){
   var rect=(RectTransform)transform;uv=Vector2.zero;if(rect.rect.width<=0||rect.rect.height<=0)return false;
   Vector2 local;if(!RectTransformUtility.ScreenPointToLocalPointInRectangle(rect,screen,eventCamera,out local))return false;
   uv=new Vector2((local.x-rect.rect.xMin)/rect.rect.width,(local.y-rect.rect.yMin)/rect.rect.height);return true;
  }
  void LockParents(){
   foreach(var scroll in GetComponentsInParent<UnityEngine.UI.ScrollRect>()){
    locked.Add(scroll);wasEnabled.Add(scroll.enabled);scroll.StopMovement();scroll.enabled=false;
   }
  }
  void UnlockParents(){for(int i=0;i<locked.Count;i++)if(locked[i]){locked[i].StopMovement();locked[i].enabled=wasEnabled[i];}locked.Clear();wasEnabled.Clear();}
  public void OnPointerDown(PointerEventData e){
   if(!isActiveAndEnabled||Controller==null||!Inside(e.position,e.pressEventCamera))return;
   if(fingers.Count==0){LockParents();multiTouch=false;}
   fingers[e.pointerId]=new Finger{start=e.position,current=e.position,time=Time.unscaledTime,eventCamera=e.pressEventCamera};
   if(fingers.Count>1){multiTouch=true;foreach(var f in fingers.Values)f.moved=true;}
   baseline=false;dirty=true;e.Use();ProcessGesture();
  }
  public void OnBeginDrag(PointerEventData e){if(fingers.ContainsKey(e.pointerId)){fingers[e.pointerId].moved=true;e.Use();}}
  public void OnDrag(PointerEventData e){Finger f;if(!fingers.TryGetValue(e.pointerId,out f))return;f.current=e.position;f.moved|=(f.current-f.start).sqrMagnitude>TapMovementPixels*TapMovementPixels;dirty=true;e.Use();}
  public void OnEndDrag(PointerEventData e){OnPointerUp(e);}
  public void OnPointerUp(PointerEventData e){
   Finger f;if(!fingers.TryGetValue(e.pointerId,out f))return;
   f.current=e.position;f.moved|=(f.current-f.start).sqrMagnitude>TapMovementPixels*TapMovementPixels;dirty=true;ProcessGesture();
   bool tap=!multiTouch&&!f.moved&&Time.unscaledTime-f.time<=TapMaxSeconds&&Inside(e.position,f.eventCamera);
   fingers.Remove(e.pointerId);baseline=false;
   if(tap)SelectAt(e.position,f.eventCamera);
   if(fingers.Count==0){UnlockParents();multiTouch=false;}else {dirty=true;ProcessGesture();}e.Use();
  }
  void LateUpdate(){
   // Pointer IDs belong to the EventSystem; only track touches that began inside this viewport.
   foreach(var touch in Input.touches){Finger f;if(!fingers.TryGetValue(touch.fingerId,out f))continue;f.current=touch.position;f.moved|=(f.current-f.start).sqrMagnitude>TapMovementPixels*TapMovementPixels;dirty=true;if(touch.phase==TouchPhase.Canceled){CancelGesture();return;}}
   ProcessGesture();
  }
  void ProcessGesture(){
   if(!dirty||fingers.Count==0||Controller==null)return;dirty=false;
   Finger first=null,second=null;foreach(var f in fingers.Values){if(first==null)first=f;else{second=f;break;}}
   Vector2 center=second==null?first.current:(first.current+second.current)*.5f;
   float distance=second==null?0:Vector2.Distance(first.current,second.current);
   if(baseline){
    Vector2 oldUV,newUV;if(ScreenToUV(previousCenter,first.eventCamera,out oldUV)&&ScreenToUV(center,first.eventCamera,out newUV)){
     Controller.Pan(newUV-oldUV);
     if(second!=null&&distance>4&&previousDistance>4)Controller.Zoom(previousDistance/distance,newUV);
    }
   }
   previousCenter=center;previousDistance=distance;baseline=true;
  }
  void SelectAt(Vector2 screen,Camera eventCamera){
   if(Manager==null)return;Vector2 uv;if(!ScreenToUV(screen,eventCamera,out uv)||uv.x<0||uv.x>1||uv.y<0||uv.y>1)return;
   if(!image)image=GetComponent<UnityEngine.UI.RawImage>();var crop=image.uvRect;uv=crop.position+Vector2.Scale(uv,crop.size);
   Physics2D.SyncTransforms();var camera=Controller.TreeCamera;var ray=camera.ViewportPointToRay(uv);var hit=Physics2D.GetRayIntersection(ray,100,Manager.LayerMask);
   SkillTreeNode node=hit.collider?hit.collider.GetComponent<SkillTreeNode>():null;
   if(!node){
    var point=camera.ViewportToWorldPoint(new Vector3(uv.x,uv.y,Manager.WorldZ-camera.transform.position.z));
    float pixels=Vector2.Distance(RectTransformUtility.WorldToScreenPoint(eventCamera,transform.TransformPoint(new Vector3(0,((RectTransform)transform).rect.height,0))),RectTransformUtility.WorldToScreenPoint(eventCamera,transform.position));
    float radius=2*camera.orthographicSize*TapRadiusPixels/Mathf.Max(1,pixels);float nearest=float.PositiveInfinity;
    foreach(var collider in Physics2D.OverlapCircleAll(point,radius,Manager.LayerMask)){var candidate=collider.GetComponent<SkillTreeNode>();if(!candidate)continue;float d=((Vector2)candidate.transform.position-(Vector2)point).sqrMagnitude;if(d<nearest-.000001f||Mathf.Abs(d-nearest)<.000001f&&(node==null||string.CompareOrdinal(candidate.Data.ID,node.Data.ID)<0)){nearest=d;node=candidate;}}
   }
   if(node){Manager.SelectNode(node.Data.ID);float diameter=SkillTreeNode.Radius(node.Data.Type)*Controller.ViewportHeightInUIUnits/Controller.TreeCamera.orthographicSize;if(diameter<10)Manager.FocusNodeNeighborhood(node.Data.ID);}
  }
  public void OnScroll(PointerEventData e){Vector2 uv;if(Controller&&ScreenToUV(e.position,e.enterEventCamera,out uv)){Controller.Zoom(Mathf.Exp(-e.scrollDelta.y*.12f),uv);e.Use();}}
  public void CancelGesture(){fingers.Clear();baseline=false;multiTouch=false;dirty=false;UnlockParents();}
  public void OnCancel(BaseEventData e){CancelGesture();}
  void OnDisable(){CancelGesture();}
  void OnApplicationFocus(bool focus){if(!focus)CancelGesture();}
  void OnApplicationPause(bool pause){if(pause)CancelGesture();}
 }
}
