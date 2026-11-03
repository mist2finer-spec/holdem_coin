#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace IslandGame.Editor {
 public static class PokerProfileMenu {
  [MenuItem("GameObject/UI/Island Poker Profile",false,2060)]
  public static void Create() {
   Transform parent=Selection.activeTransform;
   if(!parent||!parent.GetComponentInParent<Canvas>()) {
    var canvasObject=new GameObject("Poker profile canvas",typeof(RectTransform),typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster));
    Undo.RegisterCreatedObjectUndo(canvasObject,"Create poker profile canvas");
    canvasObject.GetComponent<Canvas>().renderMode=RenderMode.ScreenSpaceOverlay;
    var scaler=canvasObject.GetComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(390,844);scaler.matchWidthOrHeight=.5f;parent=canvasObject.transform;
   }
   var host=new GameObject("Player profile",typeof(RectTransform));Undo.RegisterCreatedObjectUndo(host,"Create poker profile");
   var rt=host.GetComponent<RectTransform>();rt.SetParent(parent,false);rt.anchorMin=rt.anchorMax=rt.pivot=new Vector2(.5f,.5f);rt.anchoredPosition=Vector2.zero;rt.sizeDelta=new Vector2(96,107.25f);
   host.AddComponent<PokerProfileView>().Bind(7,"플레이어","10,000",1,true,"SB");Selection.activeGameObject=host;
   Debug.Log("Poker profile sample only. Bind live name/chips/level/D/SB/BB with PokerProfileView.Bind. Export shared assets first; existing scene is not replaced.");
  }
 }
}
#endif
