using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace IslandGame {
 /// <summary>Shared PNG profiles. Runtime labels remain separate from artwork.</summary>
 public static class PokerProfileAssets {
  static JObject manifest;
  static readonly Dictionary<string,Texture2D> cache=new Dictionary<string,Texture2D>();
  public static Font Font { get { return font??(font=UnityEngine.Font.CreateDynamicFontFromOSFont(new[]{"Malgun Gothic","Noto Sans CJK KR","Arial"},20)); } }
  static Font font;
  public static int Level(int value) { return Math.Max(1,value); }
  public static Texture2D Portrait(int portrait) {
   if(manifest==null){var text=Resources.Load<TextAsset>("PokerProfiles");if(text)manifest=JObject.Parse(text.text);}
   JToken selected=null;foreach(var c in manifest?["characters"] as JArray??new JArray())if(c.Value<int>("portrait")==portrait)selected=c;
   if(selected==null)foreach(var c in manifest?["characters"] as JArray??new JArray())if(c.Value<int>("portrait")==7)selected=c;
   string asset=(string)selected?["asset"]??"/poker/profiles/hong.png";
   return Load("WebAssets"+asset.Substring(0,asset.Length-4));
  }
  public static Texture2D Dealer { get { return Load("WebAssets/poker/profiles/dealer-disc"); } }
  static Texture2D Load(string path) { Texture2D result;if(!cache.TryGetValue(path,out result)){result=Resources.Load<Texture2D>(path);cache[path]=result;}return result; }
 }

 /// <summary>Add to a uGUI RectTransform; Bind uses the same 256x286 design as React.</summary>
 [RequireComponent(typeof(RectTransform))]
 public sealed class PokerProfileView : MonoBehaviour {
  RectTransform design;RawImage portrait,dealer;Text nickname,chips,level,dealerText,blind,fold;Outline active;
  void Awake(){Ensure();}
  void Ensure() {
   if(design)return;
   // Editor-created sample children survive a domain reload; private references do not.
   // Rebind the existing hierarchy rather than creating duplicate portraits on Play.
   var existing=transform.Find("Profile design") as RectTransform;
   if(existing){
    design=existing;portrait=design.Find("Portrait").GetComponent<RawImage>();active=portrait.GetComponent<Outline>();
    nickname=design.Find("Name").GetComponent<Text>();chips=design.Find("Chips").GetComponent<Text>();level=design.Find("Level").GetComponent<Text>();
    dealer=design.Find("Dealer").GetComponent<RawImage>();dealerText=design.Find("Dealer letter").GetComponent<Text>();blind=design.Find("Blind").GetComponent<Text>();fold=design.Find("Fold").GetComponent<Text>();Fit();return;
   }
   design=Rect("Profile design",transform,0,0,256,286);design.anchorMin=design.anchorMax=design.pivot=new Vector2(.5f,.5f);design.anchoredPosition=Vector2.zero;
   portrait=Picture("Portrait",0,0,256,256);active=portrait.gameObject.AddComponent<Outline>();active.effectColor=new Color(.2f,1,.8f,.8f);active.effectDistance=new Vector2(3,-3);
   var plate=Rect("Info",design,0,218,256,68);var panel=plate.gameObject.AddComponent<Image>();panel.color=new Color(.015f,.025f,.045f,.88f);panel.raycastTarget=false;
   nickname=Label("Name",8,222,166,28,22,TextAnchor.MiddleLeft);nickname.resizeTextForBestFit=true;nickname.resizeTextMinSize=14;nickname.resizeTextMaxSize=22;
   var badge=Rect("Level background",design,176,222,74,28).gameObject.AddComponent<Image>();badge.color=new Color(.08f,.32f,.7f);badge.raycastTarget=false;
   level=Label("Level",176,222,74,28,22,TextAnchor.MiddleCenter);
   chips=Label("Chips",7,251,242,31,31,TextAnchor.MiddleCenter);chips.resizeTextForBestFit=true;chips.resizeTextMinSize=18;chips.resizeTextMaxSize=31;
   dealer=Picture("Dealer",192,24,62,62);dealer.texture=PokerProfileAssets.Dealer;dealerText=Label("Dealer letter",192,24,62,62,30,TextAnchor.MiddleCenter);dealerText.text="D";
   blind=Label("Blind",206,175,49,26,22,TextAnchor.MiddleCenter);var bg=blind.gameObject.AddComponent<Outline>();bg.effectDistance=new Vector2(2,-2);bg.effectColor=Color.black;
   fold=Label("Fold",55,121,146,35,27,TextAnchor.MiddleCenter);fold.text="FOLD";fold.color=new Color(1,.65f,.72f);
   Fit();
  }
  static RectTransform Rect(string name,Transform parent,float x,float y,float w,float h) {
   var go=new GameObject(name,typeof(RectTransform));var rt=go.GetComponent<RectTransform>();rt.SetParent(parent,false);rt.anchorMin=rt.anchorMax=rt.pivot=new Vector2(0,1);rt.anchoredPosition=new Vector2(x,-y);rt.sizeDelta=new Vector2(w,h);return rt;
  }
  RawImage Picture(string name,float x,float y,float w,float h){var image=Rect(name,design,x,y,w,h).gameObject.AddComponent<RawImage>();image.raycastTarget=false;return image;}
  Text Label(string name,float x,float y,float w,float h,int size,TextAnchor alignment){var t=Rect(name,design,x,y,w,h).gameObject.AddComponent<Text>();t.font=PokerProfileAssets.Font;t.fontSize=size;t.fontStyle=FontStyle.Bold;t.alignment=alignment;t.color=Color.white;t.raycastTarget=false;t.horizontalOverflow=HorizontalWrapMode.Overflow;t.verticalOverflow=VerticalWrapMode.Truncate;return t;}
  void LateUpdate(){if(design)Fit();}
  void Fit(){var area=((RectTransform)transform).rect;float scale=Math.Min(area.width/256,area.height/286);design.localScale=Vector3.one*Math.Max(.001f,scale);}
  public void Bind(int portraitId,string playerName,string chipLabel,int playerLevel=1,bool isDealer=false,string blindLabel="",bool isActive=false,bool folded=false) {
   Ensure();portrait.texture=PokerProfileAssets.Portrait(portraitId);nickname.text=playerName??"";chips.text=chipLabel??"0";level.text="★"+PokerProfileAssets.Level(playerLevel);
   dealer.gameObject.SetActive(isDealer);dealerText.gameObject.SetActive(isDealer);blind.text=blindLabel??"";blind.gameObject.SetActive(!string.IsNullOrEmpty(blindLabel));active.enabled=isActive;fold.gameObject.SetActive(folded);portrait.color=folded?new Color(.55f,.55f,.55f):Color.white;
  }
 }

 /// <summary>Adapter for the repository's existing immediate-mode poker prototype.</summary>
 public static class PokerProfileGui {
  public static void Draw(Rect area,int portrait,string name,string chips,int level,bool dealer,string blind,bool active,bool folded) {
   Color saved=GUI.color;float unit=area.width/256;
   Func<float,float,float,float,Rect> box=(x,y,w,h)=>new Rect(area.x+x*unit,area.y+y*unit,w*unit,h*unit);
   var art=PokerProfileAssets.Portrait(portrait);if(art){GUI.color=folded?new Color(.55f,.55f,.55f):Color.white;GUI.DrawTexture(box(0,0,256,256),art);GUI.color=saved;}
   GUI.color=active?new Color(.08f,.22f,.2f,.94f):new Color(.02f,.03f,.05f,.9f);GUI.DrawTexture(box(0,218,256,68),Texture2D.whiteTexture);
   GUI.color=new Color(.08f,.32f,.7f);GUI.DrawTexture(box(176,222,74,28),Texture2D.whiteTexture);GUI.color=Color.white;
   var text=new GUIStyle(GUI.skin.label){font=PokerProfileAssets.Font,fontStyle=FontStyle.Bold,fontSize=Math.Max(7,(int)(22*unit)),alignment=TextAnchor.MiddleLeft,clipping=TextClipping.Clip};text.normal.textColor=Color.white;
   GUI.Label(box(8,222,166,28),name??"",text);text.alignment=TextAnchor.MiddleCenter;GUI.Label(box(176,222,74,28),"★"+PokerProfileAssets.Level(level),text);
   text.fontSize=Math.Max(8,(int)(29*unit));GUI.Label(box(4,251,248,31),chips??"0",text);
   if(dealer){if(PokerProfileAssets.Dealer)GUI.DrawTexture(box(192,24,62,62),PokerProfileAssets.Dealer);GUI.Label(box(192,24,62,62),"D",text);}
   text.fontSize=Math.Max(7,(int)(22*unit));if(!string.IsNullOrEmpty(blind))GUI.Label(box(205,175,50,28),blind,text);if(folded)GUI.Label(box(55,122,146,35),"FOLD",text);GUI.color=saved;
  }
 }
}
