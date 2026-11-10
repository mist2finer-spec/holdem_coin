#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEngine;
using UnityEngine.EventSystems;
namespace IslandGame.Editor {
 public static class BattleHudReview {
  public static void SetSize(int width,int height){
   var assembly=typeof(EditorWindow).Assembly;var sizesType=assembly.GetType("UnityEditor.GameViewSizes");
   var singleton=typeof(ScriptableSingleton<>).MakeGenericType(sizesType);
   var sizes=singleton.GetProperty("instance",BindingFlags.Public|BindingFlags.Static|BindingFlags.FlattenHierarchy).GetValue(null);
   var groupType=assembly.GetType("UnityEditor.GameViewSizeGroupType");
   var group=sizesType.GetMethod("GetGroup").Invoke(sizes,new[]{Enum.Parse(groupType,EditorUserBuildSettings.activeBuildTarget==BuildTarget.Android?"Android":"Standalone")});
   var sizeType=assembly.GetType("UnityEditor.GameViewSize");var kind=assembly.GetType("UnityEditor.GameViewSizeType");
   var name="Island HUD "+width+"x"+height;
   var labels=(string[])group.GetType().GetMethod("GetDisplayTexts").Invoke(group,null);
   int index=Array.FindIndex(labels,s=>s.Contains(name));
   if(index<0){var item=Activator.CreateInstance(sizeType,BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance,null,new object[]{Enum.Parse(kind,"FixedResolution"),width,height,name},null);
    group.GetType().GetMethod("AddCustomSize").Invoke(group,new[]{item});index=(int)group.GetType().GetMethod("GetTotalCount").Invoke(group,null)-1;}
   var gameType=assembly.GetType("UnityEditor.GameView");var window=EditorWindow.GetWindow(gameType);
   gameType.GetProperty("selectedSizeIndex",BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance).SetValue(window,index);
   window.Show();window.Focus();window.Repaint();
  }
  public static void Capture(string path){Directory.CreateDirectory(Path.GetDirectoryName(path));ScreenCapture.CaptureScreenshot(path);}
  public static string Click(string name){
   var button=UnityEngine.Object.FindObjectsByType<UnityEngine.UI.Button>(FindObjectsSortMode.None).FirstOrDefault(b=>b.name==name&&b.isActiveAndEnabled);
   if(button==null||!button.interactable)throw new Exception("Button unavailable: "+name);
   var center=RectTransformUtility.WorldToScreenPoint(null,button.transform.position);
   var pointer=new PointerEventData(EventSystem.current){position=center,button=PointerEventData.InputButton.Left};
   var hits=new System.Collections.Generic.List<RaycastResult>();EventSystem.current.RaycastAll(pointer,hits);
   if(hits.Count==0||!(hits[0].gameObject==button.gameObject||hits[0].gameObject.transform.IsChildOf(button.transform)))throw new Exception("Raycast blocked: "+name);
   ExecuteEvents.ExecuteHierarchy(hits[0].gameObject,pointer,ExecuteEvents.pointerDownHandler);
   ExecuteEvents.ExecuteHierarchy(hits[0].gameObject,pointer,ExecuteEvents.pointerUpHandler);
   ExecuteEvents.ExecuteHierarchy(hits[0].gameObject,pointer,ExecuteEvents.pointerClickHandler);
   return "Raycast + pointer down/up/click: "+name;
  }

  public static string Report(string path){
   var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();var hud=UnityEngine.Object.FindFirstObjectByType<IslandBattleHud>();var session=app.HudSession;var state=session.State;
   var report=new Newtonsoft.Json.Linq.JObject{
    ["timeUtc"]=DateTime.UtcNow.ToString("O"),["width"]=Screen.width,["height"]=Screen.height,["frame"]=Time.frameCount,
    ["active"]=session.Active,["paused"]=session.Paused,["auto"]=session.Auto,["move"]=session.Move,["notice"]=app.HudNotice,
    ["status"]=(string)state?["status"],["sequence"]=state?["sequence"]?.DeepClone(),["heroX"]=state?["hero"]?["x"]?.DeepClone(),
    ["hudVisible"]=hud.Visible,["dispatches"]=hud.UiDispatches,["lastInput"]=hud.LastInput,
    ["eventSystems"]=UnityEngine.Object.FindObjectsByType<EventSystem>(FindObjectsSortMode.None).Length};
   var buttons=hud.GetComponentsInChildren<UnityEngine.UI.Button>(true);var list=new Newtonsoft.Json.Linq.JArray();
   for(int i=0;i<6;i++){var b=buttons.First(x=>x.name=="Skill"+i);var icon=b.transform.Find("Icon").GetComponent<UnityEngine.UI.Image>();list.Add(new Newtonsoft.Json.Linq.JObject{["slot"]=i,["equipped"]=RpgContracts.SkillEnabled(state,i),["canCast"]=RpgContracts.CanCast(state,i),["interactable"]=b.interactable,["iconVisible"]=icon.gameObject.activeInHierarchy,["iconLoaded"]=icon.sprite!=null,["cooldown"]=state?["cooldowns"]?[i]?.DeepClone(),["total"]=state?["cooldownTotals"]?[i]?.DeepClone()});}
   report["skills"]=list;var outside=new Newtonsoft.Json.Linq.JArray();
   foreach(var button in buttons.Where(b=>b.gameObject.activeInHierarchy)){
    var corners=new Vector3[4];((RectTransform)button.transform).GetWorldCorners(corners);
    if(corners.Any(p=>p.x<-.5f||p.y<-.5f||p.x>Screen.width+.5f||p.y>Screen.height+.5f))outside.Add(button.name);
   }report["buttonsOutsideScreen"]=outside;
   var label=hud.GetComponentsInChildren<TMPro.TextMeshProUGUI>(true).First();uint[] missing;report["koreanGlyphs"]=label.font.HasCharacters("체력 마나 소지품 성장 던전 점프 슬라이드 회피 촛불 미궁 액티브",out missing,true,true);report["missingGlyphs"]=new Newtonsoft.Json.Linq.JArray(missing??new uint[0]);
   Directory.CreateDirectory(Path.GetDirectoryName(path));File.WriteAllText(path,report.ToString());return report.ToString();
  }
  public static void Stick(float direction,bool release=false){
   var control=UnityEngine.Object.FindFirstObjectByType<IslandHudStick>();var center=RectTransformUtility.WorldToScreenPoint(null,control.transform.position);var e=new PointerEventData(EventSystem.current){position=center,pointerId=91,button=PointerEventData.InputButton.Left};
   if(release){ExecuteEvents.Execute(control.gameObject,e,ExecuteEvents.pointerUpHandler);return;}
   ExecuteEvents.Execute(control.gameObject,e,ExecuteEvents.pointerDownHandler);e.position=center+new Vector2(direction*35,0);ExecuteEvents.Execute(control.gameObject,e,ExecuteEvents.dragHandler);
  }
 }
}
#endif
