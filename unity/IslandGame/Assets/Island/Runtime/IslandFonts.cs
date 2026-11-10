using System;
using TMPro;
using UnityEngine;
using UnityEngine.TextCore.LowLevel;

namespace IslandGame {
 // Ship a licensed Korean font so the Android player never depends on Windows fonts.
 public static class IslandFonts {
  const string ResourcePath="Fonts/NotoSansCJKkr-Regular";
  static Font bundledFont;
  static Font BundledFont {get{if(!bundledFont)bundledFont=Resources.Load<Font>(ResourcePath);return bundledFont;}}
  public static Font CreateGuiFont(){
   var source=BundledFont;
   if(source)return source;
   var font=Font.CreateDynamicFontFromOSFont(new[]{"Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR","Arial"},14);
   font.hideFlags=HideFlags.DontSave;return font;
  }
  public static void ReleaseGuiFont(Font font){if(font&&font!=bundledFont)UnityEngine.Object.Destroy(font);}
  public static TMP_FontAsset CreateSdfFont(){
   var source=BundledFont;
   var font=source?TMP_FontAsset.CreateFontAsset(source,48,5,GlyphRenderMode.SDFAA,1024,1024,AtlasPopulationMode.Dynamic,true):TMP_FontAsset.CreateFontAsset("Malgun Gothic","Regular",48);
   if(!font)font=TMP_FontAsset.CreateFontAsset("Arial","Regular",48);
   if(!font)throw new InvalidOperationException("No font available for Island UI");
   font.name="Island Korean Runtime SDF";font.hideFlags=HideFlags.DontSave;return font;
  }
 }
}
