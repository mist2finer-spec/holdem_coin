using System;
using System.Linq;
using Newtonsoft.Json.Linq;
using TMPro;
using UnityEngine;

namespace IslandGame {
 public sealed class IslandGrowthPanel : MonoBehaviour {
  IslandApp app;TMP_FontAsset font;GameObject root,treeWorld;Canvas canvas;
  RectTransform safe,frame,scrollRect,content,detail,treeSection,list,viewRect,summaryRect,tools;
  UnityEngine.UI.ScrollRect scroll;UnityEngine.UI.RawImage image;
  TextMeshProUGUI summary,selection,description,feedback,zoomLabel;
  UnityEngine.UI.Button allocate,path,refund,reset,toggleDetail;bool detailExpanded,helpExpanded;
  Camera treeCamera;RenderTexture texture;string tab="tree",listKey,revisionAtCommand,noticeAtCommand;bool pending;
  float pendingAt,lastPanelWidth;int oldW,oldH;
  public SkillTreeManager Tree {get;private set;}
  public SkillTreeViewportInput ViewportInput {get;private set;}
  public SkillTreeCameraController CameraController {get;private set;}
  public bool Visible=>root&&root.activeInHierarchy;
  public bool CommandPending=>pending;
  public UnityEngine.UI.ScrollRect ParentScroll=>scroll;
  public void Initialize(IslandApp owner,TMP_FontAsset sharedFont){
   app=owner;font=sharedFont;
   root=new GameObject("GrowthCanvas",typeof(RectTransform),typeof(Canvas),typeof(UnityEngine.UI.CanvasScaler),typeof(UnityEngine.UI.GraphicRaycaster));root.transform.SetParent(transform,false);
   canvas=root.GetComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=40;
   var scaler=root.GetComponent<UnityEngine.UI.CanvasScaler>();scaler.uiScaleMode=UnityEngine.UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(390,844);scaler.matchWidthOrHeight=0;
   safe=Rect("SafeArea",root.transform);Stretch(safe);frame=Rect("GrowthFrame",safe);Fill(frame,new Color(.025f,.045f,.07f));
   var title=Text(frame,"GrowthTitle","성장 · 속성 성좌",22);Box(title.rectTransform,16,14,285,36);
   var close=Button(frame,"CloseGrowth","닫기",()=>app.HudMenu(""));Box((RectTransform)close.transform,318,12,60,40);
   string[] ids={"arts","traits","tree"},names={"훈련","특성","성좌 트리"};
   for(int i=0;i<ids.Length;i++){string key=ids[i];var button=Button(frame,"Tab"+key,names[i],()=>ChangeTab(key));Box((RectTransform)button.transform,12+i*124,62,118,40);}
   scrollRect=Rect("GrowthScroll",frame);scroll=scrollRect.gameObject.AddComponent<UnityEngine.UI.ScrollRect>();scroll.horizontal=false;scroll.movementType=UnityEngine.UI.ScrollRect.MovementType.Clamped;scroll.inertia=true;scroll.decelerationRate=.1f;
   var mask=Rect("Viewport",scrollRect);Stretch(mask);var background=Fill(mask,new Color(.025f,.045f,.07f));background.raycastTarget=true;mask.gameObject.AddComponent<UnityEngine.UI.RectMask2D>();
   content=Rect("Content",mask);content.anchorMin=new Vector2(0,1);content.anchorMax=new Vector2(1,1);content.pivot=new Vector2(.5f,1);content.anchoredPosition=Vector2.zero;content.sizeDelta=Vector2.zero;
   var layout=content.gameObject.AddComponent<UnityEngine.UI.VerticalLayoutGroup>();layout.padding=new RectOffset(8,8,8,12);layout.spacing=10;layout.childControlWidth=true;layout.childControlHeight=true;layout.childForceExpandWidth=true;layout.childForceExpandHeight=false;
   var fitter=content.gameObject.AddComponent<UnityEngine.UI.ContentSizeFitter>();fitter.horizontalFit=UnityEngine.UI.ContentSizeFitter.FitMode.Unconstrained;fitter.verticalFit=UnityEngine.UI.ContentSizeFitter.FitMode.PreferredSize;
   scroll.content=content;scroll.viewport=mask;
   summaryRect=Rect("BuildSummary",content);Height(summaryRect,32);summary=Text(summaryRect,"Summary","",13);Stretch(summary.rectTransform);
   treeSection=Rect("ConstellationSection",content);var treeLayout=treeSection.gameObject.AddComponent<UnityEngine.UI.VerticalLayoutGroup>();treeLayout.spacing=8;treeLayout.childControlWidth=treeLayout.childControlHeight=true;treeLayout.childForceExpandHeight=false;
   
   tools=Rect("TreeTools",treeSection);Height(tools,44);
   var minus=Button(tools,"ZoomOut","−",()=>CameraController.Zoom(1.22f,Vector2.one*.5f));Box((RectTransform)minus.transform,0,0,44,44);
   var plus=Button(tools,"ZoomIn","+",()=>CameraController.Zoom(1/1.22f,Vector2.one*.5f));Box((RectTransform)plus.transform,50,0,44,44);
   var focus=Button(tools,"FocusStart","내 시작점",()=>Tree.FocusStart());Box((RectTransform)focus.transform,100,0,100,44);var all=Button(tools,"FocusAll","전체 보기",()=>Tree.FocusAll());Box((RectTransform)all.transform,206,0,72,44);var help=Button(tools,"TreeHelp","?",()=>{helpExpanded=!helpExpanded;frame.Find("GrowthScroll/Viewport/Content/ConstellationSection/TreeLegend").gameObject.SetActive(helpExpanded);Layout();});Box((RectTransform)help.transform,284,0,44,44);zoomLabel=Text(tools,"Zoom","",11);zoomLabel.gameObject.SetActive(false);
   viewRect=Rect("SkillTreeViewport",treeSection);Height(viewRect,390);image=viewRect.gameObject.AddComponent<UnityEngine.UI.RawImage>();image.raycastTarget=true;image.uvRect=new Rect(0,0,1,1);
   ViewportInput=viewRect.gameObject.AddComponent<SkillTreeViewportInput>();
   var legend=Text(treeSection,"TreeLegend","한 손가락 이동 · 두 손가락 확대 · 노드 탭\n금색 습득 / 밝은 테두리 습득 가능 / 청록색 선택",11);Height(legend.rectTransform,46);legend.gameObject.SetActive(false);
   list=Rect("TrainingAndTraits",content);var listLayout=list.gameObject.AddComponent<UnityEngine.UI.VerticalLayoutGroup>();listLayout.spacing=10;listLayout.childControlWidth=listLayout.childControlHeight=true;listLayout.childForceExpandHeight=false;
   
   detail=Rect("NodeOverlay",frame);Fill(detail,new Color(.055f,.095f,.13f));selection=Text(detail,"SelectedNode","시작점을 선택하세요",17);description=Text(detail,"NodeDescription","",12);
   toggleDetail=Button(detail,"ToggleDetail","상세",()=>{detailExpanded=!detailExpanded;toggleDetail.GetComponentInChildren<TextMeshProUGUI>().text=detailExpanded?"접기":"상세";Layout();});
   allocate=Button(detail,"AllocateNode","배우기",()=>Send("core-allocate-"+Tree.SelectedID));
   path=Button(detail,"AllocatePath","경로 할당",()=>Send("core-path-"+Tree.SelectedID));
   refund=Button(detail,"RefundNode","회수",()=>Send("core-refund-"+Tree.SelectedID));
   reset=Button(detail,"ResetTree","전체 회수",()=>Send("core-reset"));feedback=Text(detail,"Feedback","",11);
   int layer=LayerMask.NameToLayer("SkillTree");if(layer<0)throw new InvalidOperationException("SkillTree layer must be configured before play");
   treeWorld=new GameObject("SkillTreeWorld");treeWorld.transform.SetParent(transform,false);treeWorld.transform.position=new Vector3(10000,10000,0);treeWorld.layer=layer;
   var cameraObject=new GameObject("SkillTreeCamera",typeof(Camera));cameraObject.transform.SetParent(treeWorld.transform,false);cameraObject.transform.localPosition=new Vector3(17,-17,-10);
   treeCamera=cameraObject.GetComponent<Camera>();treeCamera.orthographic=true;treeCamera.cullingMask=1<<layer;treeCamera.clearFlags=CameraClearFlags.SolidColor;treeCamera.backgroundColor=new Color(.018f,.033f,.055f);treeCamera.nearClipPlane=.1f;treeCamera.farClipPlane=30;treeCamera.allowHDR=false;treeCamera.allowMSAA=false;
   CameraController=cameraObject.AddComponent<SkillTreeCameraController>();Tree=treeWorld.AddComponent<SkillTreeManager>();Tree.Initialize(CameraController,layer);Tree.OnNodeSelected+=SelectNode;
   ViewportInput.Controller=CameraController;ViewportInput.Manager=Tree;
   root.SetActive(false);treeWorld.SetActive(false);
  }
  void ChangeTab(string id){ViewportInput.CancelGesture();tab=id;listKey=null;scroll.StopMovement();scroll.verticalNormalizedPosition=1;Refresh();}
  void Update(){
   if(!root||!app)return;bool show=app.HudGrowthOpen&&!app.BossTrialsVisible;
   if(root.activeSelf!=show){root.SetActive(show);if(show){scroll.verticalNormalizedPosition=1;}else{ViewportInput.CancelGesture();pending=false;}}
   treeWorld.SetActive(show&&tab=="tree");if(!show)return;Layout();Refresh();
  }
  void Refresh(){
   if(app.HudSession.State==null)return;var state=app.HudSession.State;var build=state["build"] as JObject;
   if(pending&&((state["buildRevision"]?.ToString()??"")!=revisionAtCommand||app.HudNotice!=noticeAtCommand||!app.HudSession.Active||Time.unscaledTime-pendingAt>16)){pending=false;feedback.text=app.HudNotice;}
   treeSection.gameObject.SetActive(tab=="tree");list.gameObject.SetActive(tab!="tree");detail.gameObject.SetActive(tab=="tree");
   var progress=state["progress"] as JObject;
   summary.text="";
   if(tab=="tree"){
    Tree.Bind(state,app.GrowthCatalog?["tree"] as JObject,app.GrowthNodeName);
    summary.text=$"남은 {Tree.Remaining} / {Tree.Budget} P · {Tree.Nodes.Count}개 노드";
    zoomLabel.text=Mathf.RoundToInt(CameraController.DefaultOrthographicSize/CameraController.TargetSize*100)+"%";
    if(Tree.SelectedID!=null&&Tree.Nodes.ContainsKey(Tree.SelectedID))SelectNode(Tree.Nodes[Tree.SelectedID].Data);
    ResizeTexture();
   }else{
    summary.text=tab=="traits"?"특성 포인트 "+(state["development"]?["traitPoints"]??0)+"P · 서버 확인 후 반영":"전투 훈련 · 골드 "+RpgContracts.Amount(progress?["gold"]);
    RefreshList(state,progress);
   }
  }
  void SelectNode(SkillTreeNodeData data){
   selection.text=data.Name+" · "+(data.IsStart?"내 시작점":data.Acquired?"습득함":data.Type==SkillTreeNodeType.Keystone?"핵심":data.Type==SkillTreeNodeType.Socket?"주얼 소켓":"미습득");
   description.text=data.Description+(Tree.PreviewPath.Length>1?$"\n연결 경로 {Tree.PreviewPath.Length-1}개 · 필요 {Tree.PreviewCost}P":"");
   allocate.GetComponentInChildren<TextMeshProUGUI>().text="배우기 · "+data.AllocationCost+"P";path.GetComponentInChildren<TextMeshProUGUI>().text="경로 · "+Tree.PreviewCost+"P";
   bool active=app.HudSession.Active&&!pending;allocate.interactable=active&&Tree.CanAllocate(data.ID);path.interactable=active&&Tree.CanAllocatePath;refund.interactable=active&&Tree.CanRefund(data.ID);reset.interactable=active&&Tree.Nodes.Values.Count(n=>n.Data.Acquired)>1;
   if(pending)feedback.text="서버에서 변경을 확인하는 중…";else if(!string.IsNullOrEmpty(app.HudNotice))feedback.text=app.HudNotice;else feedback.text=data.IsStart?"다른 영역으로의 무료 시작점 변경은 지원하지 않습니다.":data.Type==SkillTreeNodeType.Socket?"주얼 소켓 · 습득과 주얼 장착은 별개입니다.":"중간 노드 회수로 연결이 끊기면 회수할 수 없습니다.";
  }
  public void Send(string action){
   if(pending||!app.HudSession.Active)return;
   if(action!="core-reset"&&action!="core-allocate-"+Tree.SelectedID&&action!="core-path-"+Tree.SelectedID&&action!="core-refund-"+Tree.SelectedID)return;
   if(action.StartsWith("core-allocate-")&&!Tree.CanAllocate(Tree.SelectedID)||action.StartsWith("core-path-")&&!Tree.CanAllocatePath||action.StartsWith("core-refund-")&&!Tree.CanRefund(Tree.SelectedID))return;
   pending=true;pendingAt=Time.unscaledTime;revisionAtCommand=app.HudSession.State?["buildRevision"]?.ToString()??"";app.GrowthCommand(action);noticeAtCommand=app.HudNotice;
  }
  void RefreshList(JObject state,JObject progress){
   string key=tab+":"+state["development"]?.ToString()+":"+progress?["traits"]?.ToString()+":"+progress?["gold"];
   if(key==listKey)return;listKey=key;float rowWidth=frame.rect.width-40;foreach(Transform child in list){child.gameObject.SetActive(false);Destroy(child.gameObject);}
   if(tab=="arts"){
    var claim=Button(list,"ClaimIdle","방치 보상 받기",()=>app.GrowthCommand("idle-claim"));Height((RectTransform)claim.transform,44);claim.interactable=progress?["idle"]!=null&&app.HudSession.Active;
   }
   if(tab=="traits")foreach(var ability in app.GrowthCatalog?["abilities"] as JArray??new JArray()){
    string id=ability["id"].ToString();int level=progress?["traits"]?[id]?.Value<int>()??0,points=state["development"]?["traitPoints"]?.Value<int>()??0;
    var row=Rect("Trait"+id,list);Height(row,82);Fill(row,new Color(.06f,.10f,.14f));var name=Text(row,"Name",(string)ability["name"]+" · "+level+" / 10",14);Box(name.rectTransform,12,6,rowWidth-88,28);
    var hint=Text(row,"Hint",(string)ability["hint"]??"",11);Box(hint.rectTransform,12,36,rowWidth-88,36);var button=Button(row,"Train","+1",()=>app.GrowthCommand("trait-"+id));Box((RectTransform)button.transform,rowWidth-70,20,60,44);button.interactable=points>0&&level<10&&app.HudSession.Active;
   }else foreach(var art in state["development"]?["arts"] as JArray??new JArray()){
    string id=art["id"].ToString();var ability=(app.GrowthCatalog?["abilities"] as JArray)?.FirstOrDefault(a=>JToken.DeepEquals(a["id"],art["ability"]));
    var row=Rect("Art"+id,list);Height(row,112);Fill(row,new Color(.06f,.10f,.14f));var text=Text(row,"Name",((string)ability?["name"]??id)+" · Lv."+art["level"]+"\n다음 비용 "+RpgContracts.Amount(art["nextCost"])+" · "+art["lock"],13);Box(text.rectTransform,12,6,rowWidth-24,48);
    int index=0;foreach(int amount in new[]{1,10,100}){int n=amount;var button=Button(row,"Train"+n,"+"+n,()=>app.GrowthCommand("art-"+id+"-"+n));Box((RectTransform)button.transform,8+index++*(rowWidth-16)/3,62,(rowWidth-24)/3,42);button.interactable=(art["quantity"]?.Value<int>()??0)>0&&app.HudSession.Active;}
   }
  }
  void Layout(){
   var area=Screen.safeArea;safe.anchorMin=new Vector2(area.x/Screen.width,area.y/Screen.height);safe.anchorMax=new Vector2(area.xMax/Screen.width,area.yMax/Screen.height);safe.offsetMin=safe.offsetMax=Vector2.zero;
   var rect=(RectTransform)canvas.transform;float h=rect.rect.height*area.height/Screen.height,w=Mathf.Min(rect.rect.width*area.width/Screen.width,h*.68f);frame.anchorMin=frame.anchorMax=frame.pivot=Vector2.one*.5f;frame.anchoredPosition=Vector2.zero;frame.sizeDelta=new Vector2(w,h);if(Mathf.Abs(w-lastPanelWidth)>.1f){lastPanelWidth=w;listKey=null;}
   Box((RectTransform)frame.Find("CloseGrowth"),w-72,12,60,40);for(int i=0;i<3;i++)Box((RectTransform)frame.Find("Tab"+new[]{"arts","traits","tree"}[i]),12+i*(w-24)/3,62,(w-30)/3,40);
   float detailH=tab=="tree"?(detailExpanded?220:112):0;Box(scrollRect,4,110,w-8,h-118-detailH);Box(detail,8,h-detailH-4,w-16,detailH);
   float dw=w-16;Box(selection.rectTransform,12,5,dw-100,30);Box((RectTransform)toggleDetail.transform,dw-78,0,66,38);description.gameObject.SetActive(detailExpanded);reset.gameObject.SetActive(detailExpanded);
   if(detailExpanded){Box(description.rectTransform,12,42,dw-24,56);float bw=(dw-30)/2;Box((RectTransform)allocate.transform,10,102,bw,44);Box((RectTransform)path.transform,20+bw,102,bw,44);Box((RectTransform)refund.transform,10,152,bw,44);Box((RectTransform)reset.transform,20+bw,152,bw,44);Box(feedback.rectTransform,12,198,dw-24,18);}
   else{float bw=(dw-32)/3;Box((RectTransform)allocate.transform,8,40,bw,44);Box((RectTransform)path.transform,16+bw,40,bw,44);Box((RectTransform)refund.transform,24+2*bw,40,bw,44);Box(feedback.rectTransform,12,88,dw-24,20);}
   Height(viewRect,Mathf.Max(180,h-118-detailH-32-44-42-(helpExpanded?54:0)));

  }
  void ResizeTexture(){
   if(viewRect.rect.width<=0||viewRect.rect.height<=0)return;
   int width=Mathf.Clamp(Mathf.CeilToInt(viewRect.rect.width*canvas.scaleFactor*1.5f/32)*32,256,1024),height=Mathf.Clamp(Mathf.CeilToInt(viewRect.rect.height*canvas.scaleFactor*1.5f/32)*32,256,1536);
   CameraController.ViewportHeightInUIUnits=viewRect.rect.height;CameraController.SetViewportAspect(viewRect.rect.width/viewRect.rect.height);if(texture&&oldW==width&&oldH==height)return;bool firstTexture=texture==null;oldW=width;oldH=height;
   if(texture){treeCamera.targetTexture=null;image.texture=null;texture.Release();Destroy(texture);}
   texture=new RenderTexture(width,height,0,RenderTextureFormat.ARGB32){name="SkillTree Viewport RT",filterMode=FilterMode.Bilinear,wrapMode=TextureWrapMode.Clamp,antiAliasing=1,useMipMap=false};texture.Create();treeCamera.targetTexture=texture;treeCamera.aspect=viewRect.rect.width/viewRect.rect.height;image.texture=texture;if(firstTexture)Tree.FocusStart();
  }
  RectTransform Rect(string name,Transform parent){var go=new GameObject(name,typeof(RectTransform));go.transform.SetParent(parent,false);return (RectTransform)go.transform;}
  static void Box(RectTransform r,float x,float y,float w,float h){r.anchorMin=r.anchorMax=new Vector2(0,1);r.pivot=new Vector2(0,1);r.anchoredPosition=new Vector2(x,-y);r.sizeDelta=new Vector2(w,h);}
  static void Stretch(RectTransform r){r.anchorMin=Vector2.zero;r.anchorMax=Vector2.one;r.offsetMin=r.offsetMax=Vector2.zero;}
  static void Height(RectTransform r,float h){var e=r.GetComponent<UnityEngine.UI.LayoutElement>()??r.gameObject.AddComponent<UnityEngine.UI.LayoutElement>();e.minHeight=e.preferredHeight=h;e.flexibleHeight=0;}
  static UnityEngine.UI.Image Fill(RectTransform r,Color color){var image=r.gameObject.AddComponent<UnityEngine.UI.Image>();image.color=color;image.raycastTarget=false;return image;}
  TextMeshProUGUI Text(Transform parent,string name,string value,float size){var r=Rect(name,parent);var text=r.gameObject.AddComponent<TextMeshProUGUI>();text.font=font;text.text=value;text.fontSize=size;text.color=new Color(.88f,.85f,.73f);text.alignment=TextAlignmentOptions.MidlineLeft;text.raycastTarget=false;text.overflowMode=TextOverflowModes.Ellipsis;return text;}
  UnityEngine.UI.Button Button(Transform parent,string name,string label,Action action){var r=Rect(name,parent);var image=Fill(r,new Color(.09f,.19f,.24f));image.raycastTarget=true;var button=r.gameObject.AddComponent<UnityEngine.UI.Button>();button.targetGraphic=image;button.navigation=new UnityEngine.UI.Navigation{mode=UnityEngine.UI.Navigation.Mode.None};button.onClick.AddListener(()=>action());var colors=button.colors;colors.disabledColor=new Color(.40f,.44f,.46f,.65f);button.colors=colors;var text=Text(r,"Label",label,13);text.alignment=TextAlignmentOptions.Center;Stretch(text.rectTransform);return button;}
  void OnDestroy(){if(ViewportInput)ViewportInput.CancelGesture();if(Tree)Tree.OnNodeSelected-=SelectNode;if(treeCamera)treeCamera.targetTexture=null;if(texture){texture.Release();Destroy(texture);}if(treeWorld)Destroy(treeWorld);if(root)Destroy(root);}
 }
}
