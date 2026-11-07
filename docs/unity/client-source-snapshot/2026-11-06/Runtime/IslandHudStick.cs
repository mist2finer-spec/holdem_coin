using UnityEngine;
using UnityEngine.EventSystems;
namespace IslandGame {
 public sealed class IslandHudStick:MonoBehaviour,IPointerDownHandler,IDragHandler,IPointerUpHandler,ICancelHandler {
  public IslandApp app;public RectTransform knob;public float Value=>Vector.x;public Vector2 Vector{get;private set;}int pointer=int.MinValue;
  public bool IsPressed=>pointer!=int.MinValue;
  public static float NormalizeAxis(float axis){const float dead=.12f;float v=Mathf.Clamp(axis,-1,1);return Mathf.Abs(v)<=dead?0:Mathf.Sign(v)*(Mathf.Abs(v)-dead)/(1-dead);}
  public static Vector2 Resolve(Vector2 raw,bool planar){
   if(!planar)return new Vector2(NormalizeAxis(raw.x),0);
   float length=Mathf.Min(1,raw.magnitude);return length<=.12f?Vector2.zero:raw.normalized*((length-.12f)/.88f);
  }
  public void OnPointerDown(PointerEventData e){if(IsPressed||!app||!app.HudCanInput)return;pointer=e.pointerId;OnDrag(e);}
  public void OnDrag(PointerEventData e){
   if(e.pointerId!=pointer||!app||!app.HudCanInput)return;var rect=(RectTransform)transform;Vector2 p;
   if(!RectTransformUtility.ScreenPointToLocalPointInRectangle(rect,e.position,e.pressEventCamera,out p))return;
   float radius=Mathf.Max(1,Mathf.Min(rect.rect.width,rect.rect.height)*.35f);
   Vector=Resolve((p-rect.rect.center)/radius,app.HudPlanarMovement);
   if(knob)knob.anchoredPosition=Vector*Mathf.Max(0,(rect.rect.width-knob.rect.width)*.5f-4);
   app.HudMove(Vector);
  }
  public void OnPointerUp(PointerEventData e){if(e.pointerId==pointer)ResetInput();}
  public void OnCancel(BaseEventData e){ResetInput();}
  public void ResetInput(){Vector=Vector2.zero;pointer=int.MinValue;if(knob)knob.anchoredPosition=Vector2.zero;if(app)app.HudMove(0);}
  void OnDisable(){ResetInput();}
  void OnApplicationFocus(bool focus){if(!focus)ResetInput();}
 }
}
