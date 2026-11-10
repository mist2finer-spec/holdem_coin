using System.Collections.Generic;using UnityEngine;using UnityEngine.Rendering;
namespace IslandGame {
 public sealed class SourceEnvironmentProps:MonoBehaviour {
  public int Trees,Rocks;bool applied;
  public static void Apply(Transform branch){var c=branch.GetComponent<SourceEnvironmentProps>();if(!c)c=branch.gameObject.AddComponent<SourceEnvironmentProps>();c.Replace();}
  void Replace(){if(applied)return;var assets=Resources.Load<SourceEnvironmentAssets>("SourceEnvironmentAssets");if(!assets)return;applied=true;
   var targets=new List<Transform>();foreach(var t in GetComponentsInChildren<Transform>(true)){string n=t.name.ToLowerInvariant();if(n.StartsWith("tree /")||n.StartsWith("rock /")||(t.parent==transform&&(n.Contains("tree")||n.Contains("rock")||n.Contains("stone"))))targets.Add(t);}
   foreach(var target in targets){bool tree=target.name.ToLowerInvariant().Contains("tree");var choices=tree?assets.trees:assets.rocks;if(choices==null||choices.Length==0)continue;var rr=target.GetComponentsInChildren<Renderer>(true);if(rr.Length==0)continue;Bounds b=rr[0].bounds;foreach(var r in rr)b.Encapsulate(r.bounds);
    foreach(var g in target.GetComponentsInChildren<LODGroup>(true))g.enabled=false;foreach(var r in rr)r.forceRenderingOff=true;
    var prefab=choices[(tree?Trees++:Rocks++)%choices.Length];var obj=Instantiate(prefab,target,false);obj.name="Source environment visual";obj.transform.SetPositionAndRotation(new Vector3(b.center.x,b.min.y,b.center.z),target.rotation);obj.transform.localScale=Vector3.one;
    var renderers=obj.GetComponentsInChildren<Renderer>(true);var sourceBounds=renderers[0].bounds;foreach(var r in renderers)sourceBounds.Encapsulate(r.bounds);float scale=tree?b.size.y/Mathf.Max(.01f,sourceBounds.size.y):Mathf.Max(b.size.x,b.size.y,b.size.z)/Mathf.Max(.01f,Mathf.Max(sourceBounds.size.x,sourceBounds.size.y,sourceBounds.size.z));obj.transform.localScale*=Mathf.Clamp(scale,.03f,8);sourceBounds=renderers[0].bounds;foreach(var r in renderers)sourceBounds.Encapsulate(r.bounds);obj.transform.position+=new Vector3(b.center.x-sourceBounds.center.x,b.min.y-sourceBounds.min.y,b.center.z-sourceBounds.center.z);
    foreach(var t in obj.GetComponentsInChildren<Transform>(true))t.gameObject.layer=30;foreach(var r in renderers){r.shadowCastingMode=ShadowCastingMode.On;r.receiveShadows=true;}if(!target.GetComponent<BattleOccluder>())target.gameObject.AddComponent<BattleOccluder>();
   }
  }
 }
}
