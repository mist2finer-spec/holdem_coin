using UnityEditor;
using UnityEngine;

namespace IslandGame.EditorTools {
 // V2 kit basic attack VFX materials (art/out_v1 R0-R9, README_KO.md): import rules kept in one place.
 // R0 ramps are sRGB colour; every other sheet is a linear mask. No mips (flipbook cells have 5 px padding),
 // clamp except the horizontally tiling R2 grain.
 public sealed class IaiVfxTextureImport : AssetPostprocessor {
  public const string Folder="Assets/Island/Resources/IaiVfx/";
  void OnPreprocessTexture(){
   if(!assetPath.StartsWith(Folder))return;
   var t=(TextureImporter)assetImporter;string name=System.IO.Path.GetFileNameWithoutExtension(assetPath);
   bool ramp=name.StartsWith("R0_");
   t.textureType=TextureImporterType.Default;t.sRGBTexture=ramp;t.mipmapEnabled=false;t.isReadable=false;t.npotScale=TextureImporterNPOTScale.None;
   t.alphaSource=name.StartsWith("R5_")?TextureImporterAlphaSource.FromInput:TextureImporterAlphaSource.None;t.alphaIsTransparency=false;
   t.wrapModeU=name.StartsWith("R2_")?TextureWrapMode.Repeat:TextureWrapMode.Clamp;t.wrapModeV=TextureWrapMode.Clamp;
   t.filterMode=FilterMode.Bilinear;t.anisoLevel=0;t.maxTextureSize=1024;
   // Uncompressed: block compression (Android ETC) smears the packed R/G/B mask channels and the hard cel edges.
   // All eleven sheets together are about 2 MB of texture memory.
   t.textureCompression=TextureImporterCompression.Uncompressed;
  }
 }
}
