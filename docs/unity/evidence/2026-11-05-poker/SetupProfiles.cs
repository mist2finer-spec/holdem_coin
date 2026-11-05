using UnityEditor;
using UnityEngine;
public static class SetupProfiles {
 public static object Main(){int count=0;foreach(var guid in AssetDatabase.FindAssets("t:Texture2D",new[]{"Assets/Island/Resources/WebAssets/poker/profiles"})){var path=AssetDatabase.GUIDToAssetPath(guid);var importer=(TextureImporter)AssetImporter.GetAtPath(path);importer.npotScale=TextureImporterNPOTScale.None;importer.mipmapEnabled=false;importer.alphaIsTransparency=true;importer.maxTextureSize=512;importer.SaveAndReimport();count++;}return new{profiles=count};}
}
