using UnityEngine;
using UnityEngine.EventSystems;
namespace IslandGame {
 public sealed class IslandHudStick:MonoBehaviour,IPointerDownHandler,IDragHandler,IPointerUpHandler,ICancelHandler {
  public IslandApp app;public RectTransform knob;public float Value{get;private set;}int pointer=int.MinValue;
  public void OnPointerDown(PointerEventData e){if(!app.HudCanInput)return;pointer=e.pointerId;OnDrag(e);}
  public void OnDrag(PointerEventData e){if(e.pointerId!=pointer||!app.HudCanInput)return;Vector2 p;RectTransformUtility.ScreenPointToLocalPointInRectangle((RectTransform)transform,e.position,e.pressEventCamera,out p);Value=Mathf.Clamp(p.x/30,-1,1);if(knob)knob.anchoredPosition=new Vector2(Value*23,0);}
  public void OnPointerUp(PointerEventData e){if(e.pointerId==pointer)ResetInput();}
  public void OnCancel(BaseEventData e){ResetInput();}
  public void ResetInput(){Value=0;pointer=int.MinValue;if(knob)knob.anchoredPosition=Vector2.zero;if(app)app.HudMove(0);}
  void OnDisable(){ResetInput();}
  void OnApplicationFocus(bool focus){if(!focus)ResetInput();}
 }
}
