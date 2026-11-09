using UnityEditor.Build;using UnityEditor.Build.Reporting;using UnityEngine;using UnityEngine.SceneManagement;
namespace IslandGame.Editor {
 // The boss Terrain is loaded from Resources. Include its dependencies in the
 // build scene so Unity retains terrain/instancing support. Never alters saved scenes.
 public sealed class RuntimeTerrainBuildSupport:IProcessSceneWithReport {
  public int callbackOrder=>0;
  public void OnProcessScene(Scene scene,BuildReport report){
   if(report==null||!scene.path.EndsWith("/Island.unity"))return;
   var settings=Resources.Load<BattleDioramaSettings>("BattleDioramaSettings");
   if(!settings||!settings.groundPalette||!settings.terrain)throw new BuildFailedException("Boss Terrain dependencies are missing");
   var go=new GameObject("Build-only runtime Terrain dependencies");go.SetActive(false);SceneManager.MoveGameObjectToScene(go,scene);
   var terrain=go.AddComponent<Terrain>();terrain.terrainData=settings.groundPalette;terrain.materialTemplate=settings.terrain;terrain.drawInstanced=true;
  }
 }
}
