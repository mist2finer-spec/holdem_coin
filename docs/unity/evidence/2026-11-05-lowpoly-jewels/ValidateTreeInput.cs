using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using IslandGame;

public static class ValidateTreeInput {
 static readonly List<string> checks=new List<string>();
 static void Check(bool pass,string message){if(!pass)throw new Exception(message);checks.Add(message);}
 static PointerEventData Pointer(int id,Vector2 p)=>new PointerEventData(EventSystem.current){pointerId=id,position=p,button=PointerEventData.InputButton.Left};
 public static object Main(){
  checks.Clear();var p=UnityEngine.Object.FindFirstObjectByType<IslandGrowthPanel>();var input=p.ViewportInput;var controller=p.CameraController;var rect=(RectTransform)input.transform;var scroll=p.ParentScroll;
  var node=p.Tree.Nodes["0_1"];controller.FocusNode(node.transform.position,true);Physics2D.SyncTransforms();
  var uv=controller.TreeCamera.WorldToViewportPoint(node.transform.position);
  Vector2 screen=RectTransformUtility.WorldToScreenPoint(null,rect.TransformPoint(new Vector3(rect.rect.xMin+uv.x*rect.rect.width,rect.rect.yMin+uv.y*rect.rect.height,0)));
  Vector2 roundtrip;Check(input.ScreenToUV(screen,null,out roundtrip)&&Vector2.Distance(roundtrip,uv)<.001f,"Screen/UV round trip");
  int selected=0;Action<SkillTreeNodeData> handler=d=>selected++;p.Tree.OnNodeSelected+=handler;
  var tap=Pointer(-101,screen);var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(tap,hits);Check(hits.Count>0&&hits[0].gameObject==input.gameObject,"uGUI raycast reaches RawImage");
  ExecuteEvents.Execute(input.gameObject,tap,ExecuteEvents.pointerDownHandler);Check(!scroll.enabled&&input.ParentScrollLocked,"Parent locked on pointer acquisition");
  ExecuteEvents.Execute(input.gameObject,tap,ExecuteEvents.pointerUpHandler);Check(p.Tree.SelectedID=="0_1"&&selected==1,"2D raycast selects expected node once");Check(scroll.enabled&&!input.ParentScrollLocked,"Parent restored after tap");
  var before=controller.TargetPosition;var drag=Pointer(-102,screen);input.OnPointerDown(drag);input.OnBeginDrag(drag);drag.position+=new Vector2(45,30);input.OnDrag(drag);input.SendMessage("LateUpdate");input.OnPointerUp(drag);Check(Vector2.Distance(before,controller.TargetPosition)>.1f,"Single finger pan changes target");Check(selected==1,"Dragging does not select nodes");
  controller.FocusNode(node.transform.position,true);
  var center=RectTransformUtility.WorldToScreenPoint(null,rect.TransformPoint(rect.rect.center));
  var one=Pointer(11,center+Vector2.left*35);var two=Pointer(12,center+Vector2.right*35);float size=controller.TargetSize;
  input.OnPointerDown(one);input.OnPointerDown(two);Check(!scroll.enabled&&input.ActivePointers==2,"Two fingers own viewport");
  one.position+=Vector2.left*30;two.position+=Vector2.right*30;input.OnDrag(one);input.OnDrag(two);input.SendMessage("LateUpdate");Check(controller.TargetSize<size,"Pinch out zooms in");
  input.OnPointerUp(one);Check(!scroll.enabled&&input.ActivePointers==1,"Parent stays locked until last finger");var afterPinch=controller.TargetPosition;two.position+=Vector2.right*10;input.OnDrag(two);input.SendMessage("LateUpdate");Check(Vector2.Distance(afterPinch,controller.TargetPosition)>.001f&&Vector2.Distance(afterPinch,controller.TargetPosition)<.5f,"Pinch to one-finger pan continues without jump");input.OnPointerUp(two);Check(scroll.enabled&&input.ActivePointers==0&&selected==1,"Pinch release restores parent without tap");
  input.OnPointerDown(Pointer(20,center));input.CancelGesture();Check(scroll.enabled&&!input.ParentScrollLocked,"Cancel restores parent");
  scroll.enabled=false;input.OnPointerDown(Pointer(21,center));input.CancelGesture();Check(!scroll.enabled,"Originally disabled parent remains disabled");scroll.enabled=true;
  input.OnPointerDown(Pointer(22,center));input.enabled=false;Check(scroll.enabled&&!input.ParentScrollLocked,"Disabling input restores parent");input.enabled=true;
  controller.Zoom(1e-6f,Vector2.one*.5f);Check(Mathf.Approximately(controller.TargetSize,controller.MinOrthographicSize),"Minimum zoom clamp");controller.Zoom(1e6f,Vector2.one*.5f);Check(controller.TargetSize<=controller.MaxOrthographicSize,"Maximum zoom clamp");
  controller.FocusNode(node.transform.position,true);controller.Pan(Vector2.one*10000);controller.Snap();var pos=controller.TargetPosition;Check(pos.x>=controller.MinPanBounds.x&&pos.x<=controller.MaxPanBounds.x&&pos.y>=controller.MinPanBounds.y&&pos.y<=controller.MaxPanBounds.y,"Pan bounds clamp");
  controller.TargetSize.ToString();p.Tree.FocusStart();controller.Snap();p.Tree.OnNodeSelected-=handler;
  var report=new{status="PASS",count=checks.Count,checks,nodes=p.Tree.Nodes.Count,texture=p.ViewportInput.GetComponent<UnityEngine.UI.RawImage>().texture.name};File.WriteAllText("C:/Users/SHK/island-ui-review/input-validation.json",Newtonsoft.Json.JsonConvert.SerializeObject(report,Newtonsoft.Json.Formatting.Indented));return report;
 }
}
