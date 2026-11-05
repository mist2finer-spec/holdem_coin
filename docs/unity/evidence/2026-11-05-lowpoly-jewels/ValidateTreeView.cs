using System;
using System.IO;
using System.Linq;
using UnityEngine;
using IslandGame;
using TMPro;
using Newtonsoft.Json.Linq;
public static class ValidateTreeView {
 static int checks;static void Check(bool ok,string message){if(!ok)throw new Exception(message);checks++;}
 public static object Main(){
  checks=0;var p=UnityEngine.Object.FindFirstObjectByType<IslandGrowthPanel>();Check(p.Visible,"Growth panel hidden");Check(p.Tree.Nodes.Count==780&&p.Tree.RenderedEdgeCount==907,"Incomplete base tree");
  var buttons=p.GetComponentsInChildren<UnityEngine.UI.Button>().Where(b=>b.isActiveAndEnabled).ToArray();foreach(var b in buttons){var corners=new Vector3[4];((RectTransform)b.transform).GetWorldCorners(corners);Check(corners.All(v=>{var q=RectTransformUtility.WorldToScreenPoint(null,v);return q.x>=Screen.safeArea.xMin-1&&q.x<=Screen.safeArea.xMax+1&&q.y>=Screen.safeArea.yMin-1&&q.y<=Screen.safeArea.yMax+1;}),"Button outside SafeArea: "+b.name);}
  var view=(RectTransform)p.ViewportInput.transform;Check(view.rect.height>Screen.height/(float)Screen.width*390*.45f,"Tree viewport too short");
  var available=p.Tree.Nodes.Values.First(n=>n.Data.Available);var ring=available.GetComponent<SpriteRenderer>();var fill=available.transform.Find("Attribute fill").GetComponent<SpriteRenderer>();Check(ring&&fill&&ring.color!=fill.color,"Attribute/state not separated");
  int rebuild=p.Tree.LayoutRebuildCount;for(int i=0;i<5;i++)p.SendMessage("Refresh");Check(p.Tree.LayoutRebuildCount==rebuild,"State refresh recomputes layout");
  IslandGame.Editor.BattleHudReview.Click("ToggleDetail");p.SendMessage("Layout");Check(GameObject.Find("ResetTree")!=null,"Expanded reset control missing");IslandGame.Editor.BattleHudReview.Click("ToggleDetail");
  var report=new{status="PASS",checks,width=Screen.width,height=Screen.height,viewportHeight=view.rect.height,baseNodes=p.Tree.Nodes.Count,renderedEdges=p.Tree.RenderedEdgeCount,layoutRebuilds=p.Tree.LayoutRebuildCount};File.WriteAllText("C:/Users/SHK/island-lowpoly-jewel-review/view-"+Screen.width+"x"+Screen.height+".json",Newtonsoft.Json.JsonConvert.SerializeObject(report,Newtonsoft.Json.Formatting.Indented));return report;
 }
 public static object Expanded(){
  var a=UnityEngine.Object.FindFirstObjectByType<IslandApp>();var p=a.GetComponent<IslandGrowthPanel>();var source=a.HudSession.State;var generated=JObject.Parse(File.ReadAllText("C:/Users/SHK/island-tree-design-review/expansion-graph.json"));var fixture=(JObject)source.DeepClone();
  fixture["id"]="isolated-expanded-display";fixture["buildRevision"]=99999;fixture["build"]=new JObject{{"state",generated["build"].DeepClone()},{"tree",new JObject{{"nodes",generated["nodes"].DeepClone()},{"edges",generated["edges"].DeepClone()}}},{"start",new JObject{{"nodeId","root"}}},{"remaining",62},{"budget",90}};
  var map=a.HudSession.Map;a.HudSession.Close();a.HudSession.State=fixture;a.HudSession.Map=map;a.HudSession.Active=false;a.HudSession.Paused=true;
  p.Tree.Bind(fixture,null,a.GrowthNodeName);if(p.Tree.Nodes.Count!=832||p.Tree.RenderedEdgeCount!=965)throw new Exception("Dynamic binding incomplete");
  var camera=p.CameraController;var large=p.Tree.Nodes["jewel_9"].transform.position;float angle=-10*Mathf.Deg2Rad;var center=(Vector2)large+new Vector2(Mathf.Cos(angle)*9,Mathf.Sin(angle)*9);camera.FocusBounds(center-new Vector2(10,8),center+new Vector2(10,8),true);
  return new{status="PASS",nodes=p.Tree.Nodes.Count,edges=p.Tree.RenderedEdgeCount};
 }
 public static object Restore(){var a=UnityEngine.Object.FindFirstObjectByType<IslandApp>();a.SendMessage("StartRpg",false);return new{restartedIsolatedSession=true};}
}
