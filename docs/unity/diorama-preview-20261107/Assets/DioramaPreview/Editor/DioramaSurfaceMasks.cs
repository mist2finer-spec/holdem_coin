using System;using System.IO;using UnityEngine;using UnityEditor;
namespace IslandGame.Diorama.Editor {
 // Deterministic starting masks from existing painted color regions. Original GLB textures stay immutable.
 // Coarse semantic classification is exposed as separate editable assets, not claimed to be artist-painted UV masks.
 public static class DioramaSurfaceMasks {
  [MenuItem("Island/Diorama/Regenerate separate surface masks")]
  static void MenuGenerate(){Generate();}
  public static object Generate(){var hero=Resources.Load<Battle3DAssets>("Battle3DAssets").heroMaterial.mainTexture;var boss=Resources.Load<UnityBossAssets>("UnityBossAssets").bossMaterial.mainTexture;Build(hero,"Hero",false);Build(boss,"Boss",true);AssetDatabase.SaveAssets();return new{generated=6,originalTexturesChanged=false,classification="color-region starting mask; inspect against model"};}
  static void Build(Texture source,string name,bool boss){var rt=RenderTexture.GetTemporary(Mathf.Min(512,source.width),Mathf.Min(512,source.height),0,RenderTextureFormat.ARGB32,RenderTextureReadWrite.sRGB);Graphics.Blit(source,rt);var previous=RenderTexture.active;RenderTexture.active=rt;var input=new Texture2D(rt.width,rt.height,TextureFormat.RGBA32,false);input.ReadPixels(new Rect(0,0,rt.width,rt.height),0,0);input.Apply();RenderTexture.active=previous;RenderTexture.ReleaseTemporary(rt);var presets=new[]{"Armor","Cloth","Leather","Skin","Core"};var roleMaterials=System.Array.ConvertAll(presets,n=>AssetDatabase.LoadAssetAtPath<Material>("Assets/DioramaPreview/Settings/"+n+".mat"));var pixels=input.GetPixels();var surface=new Color[pixels.Length];var metallic=new Color[pixels.Length];var emission=new Color[pixels.Length];int[] counts=new int[5];
   for(int i=0;i<pixels.Length;i++){var c=pixels[i];Color.RGBToHSV(c,out float h,out float saturation,out float value);int role;
    if(boss)role=c.b>c.r*1.6f&&c.g>c.r*1.3f&&value>.24f?4:saturation<.28f?0:2;
    else role=c.r>.5f&&c.g>c.b*1.12f&&c.g>c.r*.55f?3:c.r>c.b*1.15f&&c.g<c.r*.85f?1:saturation<.18f&&value>.45f?0:2;
    counts[role]++;float m=roleMaterials[role].GetFloat("_Metallic"),s=roleMaterials[role].GetFloat("_Smoothness"),e=role==4?Mathf.SmoothStep(0,1,Mathf.InverseLerp(.24f,.75f,value)):0;
    surface[i]=new Color(m,s,e,1);metallic[i]=new Color(m,m,m,s);emission[i]=new Color(c.r*e,c.g*e,c.b*e,1);
   }
   Save(name+"SurfaceMask",input.width,input.height,surface,true);Save(name+"MetallicGloss",input.width,input.height,metallic,true);Save(name+"Emission",input.width,input.height,emission,false);UnityEngine.Object.DestroyImmediate(input);
   File.WriteAllText("Assets/DioramaPreview/"+name+"MaskClassification.json",Newtonsoft.Json.JsonConvert.SerializeObject(new{source=AssetDatabase.GetAssetPath(source),roles=new[]{"armor","cloth","leather","skin","core"},pixels=counts,method="color regions, reviewable prototype",originalPreserved=true},Newtonsoft.Json.Formatting.Indented));
  }
  public static object RemoveOld(){foreach(string role in new[]{"Hero","Boss"})foreach(string kind in new[]{"SurfaceMask","MetallicGloss","Emission"})AssetDatabase.DeleteAsset("Assets/DioramaPreview/Resources/"+role+kind+".asset");return new{removedLegacyMasks=true};}
  static void Save(string name,int width,int height,Color[] colors,bool linear){string path="Assets/DioramaPreview/Resources/"+name+".png";var texture=new Texture2D(width,height,TextureFormat.RGBA32,false,linear);texture.SetPixels(colors);texture.Apply(false,false);File.WriteAllBytes(path,texture.EncodeToPNG());UnityEngine.Object.DestroyImmediate(texture);AssetDatabase.ImportAsset(path);var importer=(TextureImporter)AssetImporter.GetAtPath(path);importer.sRGBTexture=!linear;importer.isReadable=false;importer.mipmapEnabled=true;importer.maxTextureSize=512;importer.textureCompression=TextureImporterCompression.Compressed;var android=importer.GetPlatformTextureSettings("Android");android.overridden=true;android.maxTextureSize=512;android.format=TextureImporterFormat.ASTC_6x6;importer.SetPlatformTextureSettings(android);importer.SaveAndReimport();}
 }
}