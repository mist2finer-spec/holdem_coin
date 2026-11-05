using UnityEngine;

namespace IslandGame {
 [RequireComponent(typeof(Camera))]
 public sealed class SkillTreeCameraController : MonoBehaviour {
  public Vector2 MinPanBounds=new Vector2(9980,9980),MaxPanBounds=new Vector2(10020,10020);
  public float MinOrthographicSize=1.2f,MaxOrthographicSize=42,DefaultOrthographicSize=4.5f,Smoothing=14;
  public Camera TreeCamera {get;private set;}
  public Vector2 TargetPosition {get;private set;}
  public float TargetSize {get;private set;}
  public float ViewportHeightInUIUnits=400;
  bool initialized;
  void Awake(){Initialize();}
  public void Initialize(){if(initialized)return;TreeCamera=GetComponent<Camera>();TreeCamera.orthographic=true;TargetPosition=transform.position;TargetSize=DefaultOrthographicSize;TreeCamera.orthographicSize=TargetSize;initialized=true;}
  Vector2 ClampPosition(Vector2 p,float size){
   float halfX=size*TreeCamera.aspect,halfY=size;
   p.x=MaxPanBounds.x-MinPanBounds.x<=halfX*2?(MinPanBounds.x+MaxPanBounds.x)/2:Mathf.Clamp(p.x,MinPanBounds.x+halfX,MaxPanBounds.x-halfX);
   p.y=MaxPanBounds.y-MinPanBounds.y<=halfY*2?(MinPanBounds.y+MaxPanBounds.y)/2:Mathf.Clamp(p.y,MinPanBounds.y+halfY,MaxPanBounds.y-halfY);return p;
  }
  public void SetBounds(Vector2 min,Vector2 max){Initialize();MinPanBounds=Vector2.Min(min,max);MaxPanBounds=Vector2.Max(min,max);MaxOrthographicSize=Mathf.Max(42,Mathf.Max((MaxPanBounds.y-MinPanBounds.y)*.55f,(MaxPanBounds.x-MinPanBounds.x)*.55f/Mathf.Max(.1f,TreeCamera.aspect)));TargetPosition=ClampPosition(TargetPosition,TargetSize);}
  public void Pan(Vector2 viewportDelta){Initialize();TargetPosition=ClampPosition(TargetPosition-new Vector2(viewportDelta.x*2*TargetSize*TreeCamera.aspect,viewportDelta.y*2*TargetSize),TargetSize);}
  public void Zoom(float factor,Vector2 anchorUV){
   Initialize();if(float.IsNaN(factor)||float.IsInfinity(factor)||factor<=0)return;
   float next=Mathf.Clamp(TargetSize*factor,MinOrthographicSize,MaxOrthographicSize);
   TargetPosition+=new Vector2((anchorUV.x-.5f)*2*(TargetSize-next)*TreeCamera.aspect,(anchorUV.y-.5f)*2*(TargetSize-next));TargetSize=next;TargetPosition=ClampPosition(TargetPosition,TargetSize);
  }
  public void FocusNode(Vector3 worldPosition,bool instant=false){Initialize();TargetPosition=ClampPosition(worldPosition,TargetSize);if(instant)Snap();}
  public void FocusBounds(Vector2 min,Vector2 max,bool instant=false){Initialize();float size=Mathf.Max((max.y-min.y)*.55f,(max.x-min.x)*.55f/Mathf.Max(.1f,TreeCamera.aspect));MaxOrthographicSize=Mathf.Max(MaxOrthographicSize,size);TargetSize=Mathf.Clamp(size,MinOrthographicSize,MaxOrthographicSize);TargetPosition=ClampPosition((min+max)*.5f,TargetSize);if(instant)Snap();}
  public void SetViewportAspect(float aspect){Initialize();if(aspect<=0)return;float old=TreeCamera.aspect;if(Mathf.Abs(old-aspect)>.001f){TargetSize*=old/aspect;TreeCamera.aspect=aspect;SetBounds(MinPanBounds,MaxPanBounds);TargetSize=Mathf.Clamp(TargetSize,MinOrthographicSize,MaxOrthographicSize);}}
  public void ResetView(Vector3 worldPosition){TargetSize=DefaultOrthographicSize;FocusNode(worldPosition);}
  public void Snap(){Initialize();TargetPosition=ClampPosition(TargetPosition,TargetSize);transform.position=new Vector3(TargetPosition.x,TargetPosition.y,transform.position.z);TreeCamera.orthographicSize=TargetSize;}
  void LateUpdate(){
   Initialize();TargetSize=Mathf.Clamp(TargetSize,MinOrthographicSize,MaxOrthographicSize);TargetPosition=ClampPosition(TargetPosition,TargetSize);
   float t=1-Mathf.Exp(-Smoothing*Time.unscaledDeltaTime);float size=Mathf.Lerp(TreeCamera.orthographicSize,TargetSize,t);TreeCamera.orthographicSize=size;
   var p=Vector2.Lerp(transform.position,TargetPosition,t);p=ClampPosition(p,size);transform.position=new Vector3(p.x,p.y,transform.position.z);
  }
 }
}
