using UnityEngine;
using UnityEngine.EventSystems;
namespace IslandGame {
 public sealed class IslandHudStick:MonoBehaviour,IPointerDownHandler,IDragHandler,IPointerUpHandler,ICancelHandler {
  public IslandApp app;public RectTransform knob;public float Value{get;private set;}int pointer=int.MinValue;
  public bool IsPressed=>pointer!=int.MinValue;
  public static float NormalizeAxis(float axis){const float dead=.12f;float v=Mathf.Clamp(axis,-1,1);return Mathf.Abs(v)<=dead?0:Mathf.Sign(v)*(Mathf.Abs(v)-dead)/(1-dead);}
  public void OnPointerDown(PointerEventData e){if(IsPressed||!app||!app.HudCanInput)return;pointer=e.pointerId;OnDrag(e);}
  public void OnDrag(PointerEventData e){
   if(e.pointerId!=pointer||!app||!app.HudCanInput)return;var rect=(RectTransform)transform;Vector2 p;
   if(!RectTransformUtility.ScreenPointToLocalPointInRectangle(rect,e.position,e.pressEventCamera,out p))return;
   float radius=Mathf.Max(1,Mathf.Min(rect.rect.width,rect.rect.height)*.35f);
   Value=NormalizeAxis((p.x-rect.rect.center.x)/radius);
   if(knob)knob.anchoredPosition=new Vector2(Value*Mathf.Max(0,(rect.rect.width-knob.rect.width)*.5f-4),0);
   app.HudMove(Value);
  }
  public void OnPointerUp(PointerEventData e){if(e.pointerId==pointer)ResetInput();}
  public void OnCancel(BaseEventData e){ResetInput();}
  public void ResetInput(){Value=0;pointer=int.MinValue;if(knob)knob.anchoredPosition=Vector2.zero;if(app)app.HudMove(0);}
  void OnDisable(){ResetInput();}
  void OnApplicationFocus(bool focus){if(!focus)ResetInput();}
 }
}
