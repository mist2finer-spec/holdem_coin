using UnityEngine;
using UnityEngine.EventSystems;
namespace MountSunday.Review {
 // Review-only mobile touch controls. No server or game player dependencies.
 public sealed class ReviewControls:MonoBehaviour {
  MountSundayFreeFlight flight;CharacterController cc;Vector2 stick,look;float yaw,pitch,vy;bool flying;int point,moveFinger=-1,lookFinger=-1;Vector2 origin;UnityEngine.UI.Text label;
  void Start(){flight=GetComponent<MountSundayFreeFlight>();cc=GetComponent<CharacterController>();yaw=transform.eulerAngles.y;
   var canvas=new GameObject("Review navigation",typeof(Canvas),typeof(UnityEngine.UI.CanvasScaler),typeof(UnityEngine.UI.GraphicRaycaster));canvas.GetComponent<Canvas>().renderMode=RenderMode.ScreenSpaceOverlay;var scaler=canvas.GetComponent<UnityEngine.UI.CanvasScaler>();scaler.uiScaleMode=UnityEngine.UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1280,720);scaler.matchWidthOrHeight=.5f;
   if(!FindFirstObjectByType<EventSystem>())new GameObject("Review event system",typeof(EventSystem),typeof(StandaloneInputModule));
   label=Text(canvas.transform,"Mount Sunday • WALK\nWASD / right mouse | Tab: Fly | Shift: Run\nTouch: left half move, right half look",new Vector2(12,-12),new Vector2(720,80));
   Button(canvas.transform,"WALK / FLY",new Vector2(-12,-12),()=>{flying=!flying;flight.flyMode=flying;cc.enabled=!flying;vy=0;label.text="Mount Sunday • "+(flying?"FLY":"WALK")+"\nWASD / right mouse • Tab: Fly • Shift: Run\nTouch: left half move • right half look";});
   Button(canvas.transform,"NEXT POINT",new Vector2(-12,-62),()=>{var r=flight.route;if(!r||r.waypoints.Length==0)return;int i=point++%r.waypoints.Length;cc.enabled=false;transform.position=r.waypoints[i].position+Vector3.up*1f;vy=0;cc.enabled=!flying;});
   if(Application.isMobilePlatform)flight.enabled=false;
  }
  static UnityEngine.UI.Text Text(Transform parent,string text,Vector2 pos,Vector2 size){var go=new GameObject("Instructions",typeof(RectTransform),typeof(UnityEngine.UI.Text));go.transform.SetParent(parent,false);var rt=(RectTransform)go.transform;rt.anchorMin=rt.anchorMax=rt.pivot=new Vector2(0,1);rt.anchoredPosition=pos;rt.sizeDelta=size;var t=go.GetComponent<UnityEngine.UI.Text>();t.font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");t.fontSize=19;t.text=text;t.color=new Color(.98f,.96f,.86f);t.raycastTarget=false;return t;}
  static void Button(Transform parent,string text,Vector2 pos,UnityEngine.Events.UnityAction action){var go=new GameObject(text,typeof(RectTransform),typeof(UnityEngine.UI.Image),typeof(UnityEngine.UI.Button));go.transform.SetParent(parent,false);var r=(RectTransform)go.transform;r.anchorMin=r.anchorMax=r.pivot=Vector2.one;r.anchoredPosition=pos;r.sizeDelta=new Vector2(170,42);go.GetComponent<UnityEngine.UI.Image>().color=new Color(.12f,.16f,.18f,.85f);go.GetComponent<UnityEngine.UI.Button>().onClick.AddListener(action);var t=Text(go.transform,text,new Vector2(8,-9),new Vector2(160,30));t.fontSize=18;}
  void OnApplicationFocus(bool focus){if(!focus){moveFinger=lookFinger=-1;stick=look=Vector2.zero;}}
  void Update(){if(!Application.isMobilePlatform)return;look=Vector2.zero;
   foreach(var t in Input.touches){if(t.phase==TouchPhase.Began){if(EventSystem.current&&EventSystem.current.IsPointerOverGameObject(t.fingerId))continue;if(t.position.x<Screen.width*.45f&&moveFinger<0){moveFinger=t.fingerId;origin=t.position;}else if(lookFinger<0)lookFinger=t.fingerId;}
    if(t.fingerId==moveFinger)stick=Vector2.ClampMagnitude((t.position-origin)/(Screen.height*.15f),1);if(t.fingerId==lookFinger)look=t.deltaPosition;
    if(t.phase==TouchPhase.Ended||t.phase==TouchPhase.Canceled){if(t.fingerId==moveFinger){moveFinger=-1;stick=Vector2.zero;}if(t.fingerId==lookFinger)lookFinger=-1;}}
   yaw+=look.x*.12f;pitch=Mathf.Clamp(pitch-look.y*.12f,-80,80);transform.rotation=Quaternion.Euler(0,yaw,0);flight.viewTransform.localRotation=Quaternion.Euler(pitch,0,0);float dt=Mathf.Min(Time.unscaledDeltaTime,.05f);
   Vector3 dir=(flying?flight.viewTransform.forward:transform.forward)*stick.y+transform.right*stick.x;
   if(flying)transform.position+=dir*28*dt;else{if(cc.isGrounded&&vy<0)vy=-2;vy=Mathf.Max(-45,vy-20*dt);cc.Move((dir*5.5f+Vector3.up*vy)*dt);}
  }
 }
}
