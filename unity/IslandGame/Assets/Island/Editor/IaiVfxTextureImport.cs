using UnityEditor;
using UnityEngine;

namespace IslandGame.EditorTools {
 // V2 kit basic attack VFX materials (art/out_v1 R0-R9, README_KO.md): import rules kept in one place.
 // R0 ramps are sRGB colour; every other sheet is a linear mask. No mips (flipbook cells have 5 px padding),
 // clamp except the horizontally tiling R2 grain.
 public sealed class IaiVfxTextureImport : AssetPostprocessor {
  public const string Folder="Assets/Island/Resources/IaiVfx/";
  // C arc meshes (IaiVfx/C/*.fbx): mesh only, no materials, rig or animation; the file scale is kept (1 unit = 1 m, feet origin).
  void OnPreprocessModel(){
   if(!assetPath.StartsWith(Folder+"C/"))return;
   var m=(ModelImporter)assetImporter;m.materialImportMode=ModelImporterMaterialImportMode.None;m.animationType=ModelImporterAnimationType.None;m.importAnimation=false;
   m.importBlendShapes=false;m.importCameras=false;m.importLights=false;m.isReadable=false;m.meshCompression=ModelImporterMeshCompression.Off;m.importNormals=ModelImporterNormals.None;m.importTangents=ModelImporterTangents.None;
  }
  void OnPreprocessTexture(){
   if(!assetPath.StartsWith(Folder))return;
   var t=(TextureImporter)assetImporter;string name=System.IO.Path.GetFileNameWithoutExtension(assetPath);
   // C "백광 플립북" (art_helper export/C, IaiVfx/C/): sRGB colour + straight alpha, no mips, clamp. Android ASTC 4x4 (8 bpp):
   // the 2048 x 1024 flipbook is 2 MB there instead of 8 MB uncompressed; the colour sheet has no packed mask channels to smear.
   if(name.StartsWith("C_")){
    t.textureType=TextureImporterType.Default;t.sRGBTexture=true;t.mipmapEnabled=false;t.isReadable=false;t.npotScale=TextureImporterNPOTScale.None;
    t.alphaSource=TextureImporterAlphaSource.FromInput;t.alphaIsTransparency=false;t.wrapModeU=t.wrapModeV=TextureWrapMode.Clamp;t.filterMode=FilterMode.Bilinear;t.anisoLevel=0;
    t.maxTextureSize=2048;t.textureCompression=TextureImporterCompression.CompressedHQ;
    t.SetPlatformTextureSettings(new TextureImporterPlatformSettings{name="Android",overridden=true,maxTextureSize=2048,format=TextureImporterFormat.ASTC_4x4,compressionQuality=100});
    return;
   }
   bool ramp=name.StartsWith("R0_");
   t.textureType=TextureImporterType.Default;t.sRGBTexture=ramp;t.mipmapEnabled=false;t.isReadable=false;t.npotScale=TextureImporterNPOTScale.None;
   t.alphaSource=name.StartsWith("R5_")?TextureImporterAlphaSource.FromInput:TextureImporterAlphaSource.None;t.alphaIsTransparency=false;
   t.wrapModeU=name.StartsWith("R2_")?TextureWrapMode.Repeat:TextureWrapMode.Clamp;t.wrapModeV=TextureWrapMode.Clamp;
   t.filterMode=FilterMode.Bilinear;t.anisoLevel=0;t.maxTextureSize=name.StartsWith("R10_")?2048:1024; // R10 flipbook: 4 x 512 px cells in one row
   // Uncompressed: block compression (Android ETC) smears the packed R/G/B mask channels and the hard cel edges.
   // All eleven sheets together are about 2 MB of texture memory (+2 MB for the R10 arc flipbook, 2048 x 256 RGBA).
   t.textureCompression=TextureImporterCompression.Uncompressed;
  }
 }
}
