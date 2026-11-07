using UnityEngine;using UnityEngine.EventSystems;
namespace IslandGame.Diorama {
 [DisallowMultipleComponent]
 public sealed class DioramaPreviewControls:MonoBehaviour {
  public bool visible=true;DioramaPreviewStage stage;Canvas canvas;UnityEngine.UI.Text label;
  void Start(){stage=GetComponent<DioramaPreviewStage>();if(!stage)return;var go=new GameObject("Preview controls",typeof(RectTransform),typeof(Canvas),typeof(UnityEngine.UI.CanvasScaler),typeof(UnityEngine.UI.GraphicRaycaster));go.transform.SetParent(transform,false);canvas=go.GetComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=30;var scaler=go.GetComponent<UnityEngine.UI.CanvasScaler>();scaler.uiScaleMode=UnityEngine.UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1080,1920);scaler.matchWidthOrHeight=.5f;
   if(!FindFirstObjectByType<EventSystem>()){var events=new GameObject("Preview input",typeof(EventSystem),typeof(StandaloneInputModule));events.transform.SetParent(transform,false);}
   var panel=new GameObject("Bottom comparison bar",typeof(RectTransform),typeof(UnityEngine.UI.Image));panel.transform.SetParent(go.transform,false);var rect=(RectTransform)panel.transform;rect.anchorMin=new Vector2(0,0);rect.anchorMax=new Vector2(1,0);rect.pivot=new Vector2(.5f,0);rect.offsetMin=new Vector2(20,35);rect.offsetMax=new Vector2(-20,230);panel.GetComponent<UnityEngine.UI.Image>().color=new Color(.025f,.045f,.06f,.92f);
   label=Text(panel.transform,"Status",new Vector2(.03f,.57f),new Vector2(.97f,.97f),27);
   Button(panel.transform,"장면",0,()=>{stage.shot=(DioramaView)(((int)stage.shot+1)%3);stage.ResetSample();});
   Button(panel.transform,"재질",1,()=>{stage.surface=stage.surface==DioramaSurface.UrpLit?DioramaSurface.SoftNilo:DioramaSurface.UrpLit;stage.ResetSample();});
   Button(panel.transform,"이동 / 정지",2,()=>{stage.animate=!stage.animate;stage.ResetSample();});
   Button(panel.transform,"Rim",3,()=>{stage.rim=!stage.rim;stage.RefreshLook();});
  }
  UnityEngine.UI.Text Text(Transform parent,string name,Vector2 min,Vector2 max,int size){var go=new GameObject(name,typeof(RectTransform),typeof(UnityEngine.UI.Text));go.transform.SetParent(parent,false);var r=(RectTransform)go.transform;r.anchorMin=min;r.anchorMax=max;r.offsetMin=r.offsetMax=Vector2.zero;var text=go.GetComponent<UnityEngine.UI.Text>();text.font=Resources.Load<Font>("Fonts/NotoSansCJKkr-Regular");text.fontSize=size;text.color=new Color(.88f,.91f,.92f);text.alignment=TextAnchor.MiddleCenter;text.raycastTarget=false;return text;}
  void Button(Transform parent,string title,int index,UnityEngine.Events.UnityAction action){var go=new GameObject(title,typeof(RectTransform),typeof(UnityEngine.UI.Image),typeof(UnityEngine.UI.Button));go.transform.SetParent(parent,false);var r=(RectTransform)go.transform;r.anchorMin=new Vector2(.025f+index*.24f,.08f);r.anchorMax=new Vector2(.245f+index*.24f,.52f);r.offsetMin=r.offsetMax=Vector2.zero;go.GetComponent<UnityEngine.UI.Image>().color=new Color(.12f,.21f,.25f);go.GetComponent<UnityEngine.UI.Button>().onClick.AddListener(action);Text(go.transform,"Label",Vector2.zero,Vector2.one,25).text=title;}
  void Update(){if(!canvas)return;canvas.enabled=visible;if(Time.frameCount%15==0){string view=stage.shot==DioramaView.ForestSide?"숲 횡스크롤":stage.shot==DioramaView.BossQuarter?"보스 쿼터뷰":"어두운 구역";label.text=view+" · "+(stage.surface==DioramaSurface.SoftNilo?"Soft Nilo":"URP Lit")+" · 후처리 OFF";}}
 }
}
