using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
namespace MountSunday.Review {
 public static class FinishReviewScene {
  [Serializable] public class Area {public string name;public Vector3 center;public float radius,heightRange;public int removedObstacles;}
  [Serializable] public class Areas {public Area[] areas;}
  public static void Apply(){
   var parent=new GameObject("Review combat clearings - no gameplay integration");var areas=new List<Area>();
   var ground=UnityEngine.Object.FindObjectsByType<MeshCollider>(FindObjectsSortMode.None).Where(c=>c.name.StartsWith("Terrain_")).ToArray();
   Vector3[] centers={new Vector3(-610,0,340),new Vector3(-520,0,320),new Vector3(-440,0,285),new Vector3(-650,0,385)};
   for(int i=0;i<centers.Length;i++){
    Vector3 p=centers[i];p.y=Height(ground,p);float radius=i==3?12:8,min=10000,max=-10000;int removed=0;
    for(float x=-radius;x<=radius;x+=2)for(float z=-radius;z<=radius;z+=2)if(x*x+z*z<=radius*radius){float h=Height(ground,p+new Vector3(x,0,z));min=Mathf.Min(min,h);max=Mathf.Max(max,h);}
    foreach(var g in UnityEngine.Object.FindObjectsByType<LODGroup>(FindObjectsSortMode.None))if(g.transform.parent&&(g.transform.parent.name=="tree"||g.transform.parent.name=="rock")){
     var q=g.transform.position;if(Vector2.Distance(new Vector2(p.x,p.z),new Vector2(q.x,q.z))<radius+2){g.gameObject.SetActive(false);removed++;}
    }
    var marker=new GameObject("Arena0"+(i+1)+" radius "+radius+"m");marker.transform.SetParent(parent.transform);marker.transform.position=p;
    areas.Add(new Area{name=marker.name,center=p,radius=radius,heightRange=max-min,removedObstacles=removed});
   }
   File.WriteAllText("Assets/MountSunday/Review/CombatClearings.json",JsonUtility.ToJson(new Areas{areas=areas.ToArray()},true));
   RemoveRiverTrees();EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene());AssetDatabase.Refresh();
  }
  static float Height(MeshCollider[] ground,Vector3 p){foreach(var c in ground)if(c.Raycast(new Ray(new Vector3(p.x,600,p.z),Vector3.down),out var hit,1200))return hit.point.y;throw new Exception("Missing ground "+p);}
  public static void RemoveRiverTrees(){var removed=new List<string>();foreach(var g in UnityEngine.Object.FindObjectsByType<LODGroup>(FindObjectsSortMode.None).Where(g=>g.transform.parent&&g.transform.parent.name=="tree")){var p=g.transform.position;float streamX=-490+.5f*p.z+10*Mathf.Sin((250-p.z)/180);if(Mathf.Abs(p.x-streamX)/Mathf.Sqrt(1.25f)<9.5f){g.gameObject.SetActive(false);removed.Add(g.name);}}File.WriteAllText("Assets/MountSunday/Review/RiverTreeCleanup.txt",string.Join("\n",removed));EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene());}
 }
}
