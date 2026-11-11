using UnityEngine;
using IslandGame.MapReview;
namespace IslandGame {
 public sealed class MountZoneEnvironment:MonoBehaviour {
  public int zone;public Material background;public MapReviewGrass grass;
  bool occludersReady;
  void OnEnable(){SourceEnvironmentProps.Apply(transform);if(occludersReady)return;occludersReady=true;foreach(var t in GetComponentsInChildren<Transform>(true))if((t.name.StartsWith("tree /")||t.name.StartsWith("rock /"))&&!t.GetComponent<BattleOccluder>())t.gameObject.AddComponent<BattleOccluder>();}
  public void Bind(Camera camera,Transform hero){var landscape=GetComponent<ReferenceLandscape>()??gameObject.AddComponent<ReferenceLandscape>();landscape.Bind(camera,zone);var assets=Resources.Load<SourceEnvironmentAssets>("SourceEnvironmentAssets");if(assets&&zone>=0&&zone<assets.zones.Length){var source=GetComponent<SourceEnvironmentGrass>()??gameObject.AddComponent<SourceEnvironmentGrass>();source.Initialize(assets,zone==9&&GetComponent<ZoneTenArenaScene>()?Resources.Load<TextAsset>("ZoneTenArenaGrass"):assets.zones[zone],camera,hero);if(zone==9&&GetComponent<ZoneTenArenaScene>())source.bladeHeight=.65f;if(grass)grass.enabled=false;}if(grass){grass.view=camera;grass.hero=hero;grass.Rebuild();}if(camera){camera.clearFlags=CameraClearFlags.Skybox;var sky=camera.GetComponent<Skybox>();if(!sky)sky=camera.gameObject.AddComponent<Skybox>();sky.material=background;sky.enabled=background;RenderSettings.fog=true;RenderSettings.fogMode=FogMode.Linear;RenderSettings.fogStartDistance=70;RenderSettings.fogEndDistance=380;RenderSettings.fogColor=new Color(.55f,.64f,.70f);} }
 }
}
