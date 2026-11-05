using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace IslandGame {
 public sealed class SkillTreeManager : MonoBehaviour {
  public SkillTreeCameraController Controller;
  public event Action<SkillTreeNodeData> OnNodeSelected;
  public IReadOnlyDictionary<string,SkillTreeNode> Nodes=>nodes;
  public string StartID {get;private set;}="root";
  public string SelectedID {get;private set;}
  public int Remaining {get;private set;}
  public int Budget {get;private set;}
  public int LayerMask=>1<<gameObject.layer;
  public float WorldZ=>transform.position.z;
  public string[] PreviewPath {get;private set;}=new string[0];
  public int PreviewCost {get;private set;}
  public bool HasLiveBuild {get;private set;}
  readonly SkillTreeLayout layout=new SkillTreeLayout();
  readonly Dictionary<string,SkillTreeNode> nodes=new Dictionary<string,SkillTreeNode>();
  readonly HashSet<string> acquired=new HashSet<string>();
  readonly List<string> acquiredOrder=new List<string>();
  readonly List<KeyValuePair<string,string>> links=new List<KeyValuePair<string,string>>();
  string revision;Sprite ring;Texture2D texture;Material lineMaterial;Mesh linkMesh;MeshRenderer linkRenderer;
  public void Initialize(SkillTreeCameraController camera,int layer){
   Controller=camera;gameObject.layer=layer;
   texture=new Texture2D(64,64,TextureFormat.RGBA32,false){name="SkillTree shared rings",filterMode=FilterMode.Bilinear,wrapMode=TextureWrapMode.Clamp};
   var pixels=new Color[64*64];for(int y=0;y<64;y++)for(int x=0;x<64;x++){float d=Vector2.Distance(new Vector2(x+.5f,y+.5f),new Vector2(32,32))/32;float alpha=d>.87f&&d<.99f||d<.30f?1:d>.70f&&d<.76f?.45f:d<.87f?.12f:0;pixels[y*64+x]=new Color(1,1,1,alpha);}texture.SetPixels(pixels);texture.Apply(false,true);
   ring=Sprite.Create(texture,new Rect(0,0,64,64),new Vector2(.5f,.5f),64);
   var go=new GameObject("Constellation links",typeof(MeshFilter),typeof(MeshRenderer));go.transform.SetParent(transform,false);go.layer=layer;
   lineMaterial=new Material(Shader.Find("Sprites/Default")){name="SkillTree batched vertex lines"};linkRenderer=go.GetComponent<MeshRenderer>();linkRenderer.sharedMaterial=lineMaterial;linkRenderer.sortingOrder=0;linkRenderer.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;
   linkMesh=new Mesh{name="SkillTree link batch"};linkMesh.MarkDynamic();go.GetComponent<MeshFilter>().sharedMesh=linkMesh;
  }
  public bool Bind(JObject state,JObject fallback,Func<JObject,string> nameResolver){
   var build=state?["build"] as JObject;HasLiveBuild=build?["state"] is JObject;
   string key=(string)state?["id"]+":"+state?["buildRevision"]+":"+(string)build?["state"]?["nodes"]?.ToString(Newtonsoft.Json.Formatting.None)+":"+build?["remaining"];
   if(revision==key)return false;revision=key;
   var tree=build?["tree"] as JObject??fallback;var list=tree?["nodes"] as JArray;var edges=tree?["edges"] as JArray;if(list==null||edges==null)return false;
   StartID=(string)build?["start"]?["nodeId"]??"root";Remaining=build?.Value<int?>("remaining")??0;Budget=build?.Value<int?>("budget")??Remaining;
   acquired.Clear();acquiredOrder.Clear();foreach(var id in (build?["state"]?["nodes"] as JArray??new JArray()).Values<string>())if(acquired.Add(id))acquiredOrder.Add(id);
   var displayPositions=layout.Build(list);
   var present=new HashSet<string>();Vector2 min=new Vector2(float.PositiveInfinity,float.PositiveInfinity),max=new Vector2(float.NegativeInfinity,float.NegativeInfinity);
   foreach(var source in list.OfType<JObject>()){
    string id=(string)source["id"];if(string.IsNullOrEmpty(id)||!present.Add(id))continue;
    string kind=(string)source["kind"];bool start=id==StartID;var pos=displayPositions[id];
    var data=new SkillTreeNodeData{ID=id,Name=nameResolver==null?(string)source["name"]:nameResolver(source),Description=(string)source["description"]??"",Attribute=(string)source["attribute"],Type=start?SkillTreeNodeType.Start:kind=="socket"?SkillTreeNodeType.Socket:kind=="keystone"?SkillTreeNodeType.Keystone:kind=="notable"?SkillTreeNodeType.Notable:SkillTreeNodeType.Small,Acquired=acquired.Contains(id),IsStart=start,Transformed=source["transformedBy"]?.Type==JTokenType.String,AllocationCost=Mathf.Max(1,source.Value<int?>("allocationCost")??1),Position=pos};
    SkillTreeNode node;if(!nodes.TryGetValue(id,out node)){var go=new GameObject("Node · "+id,typeof(SpriteRenderer),typeof(CircleCollider2D),typeof(SkillTreeNode));go.transform.SetParent(transform,false);go.layer=gameObject.layer;node=go.GetComponent<SkillTreeNode>();nodes[id]=node;}
    node.transform.localPosition=new Vector3(pos.x,pos.y,0);node.Bind(data,ring);min=Vector2.Min(min,pos);max=Vector2.Max(max,pos);
   }
   foreach(var id in nodes.Keys.Where(id=>!present.Contains(id)).ToArray()){nodes[id].gameObject.SetActive(false);Destroy(nodes[id].gameObject);nodes.Remove(id);}
   links.Clear();foreach(var edge in edges){string a=edge is JArray?(string)edge[0]:(string)edge["from"],b=edge is JArray?(string)edge[1]:(string)edge["to"];if(a==null||b==null||!nodes.ContainsKey(a)||!nodes.ContainsKey(b))continue;links.Add(new KeyValuePair<string,string>(a,b));nodes[a].Data.ConnectedNodeIDs.Add(b);nodes[b].Data.ConnectedNodeIDs.Add(a);}
   foreach(var node in nodes.Values)node.Data.Available=!node.Data.Acquired&&Remaining>=node.Data.AllocationCost&&node.Data.ConnectedNodeIDs.Any(acquired.Contains);
   Controller.SetBounds((Vector2)transform.position+min-Vector2.one*3,(Vector2)transform.position+max+Vector2.one*3);
   bool first=SelectedID==null||!nodes.ContainsKey(SelectedID);if(first)SelectedID=nodes.ContainsKey(StartID)?StartID:nodes.Keys.FirstOrDefault();
   UpdateSelection();if(first&&SelectedID!=null)Controller.FocusNode(nodes[SelectedID].transform.position,true);return true;
  }
  public string[] FindPath(string target){
   if(!nodes.ContainsKey(target)||acquired.Contains(target))return new string[0];
   var queue=new List<string>(acquiredOrder);var parent=new Dictionary<string,string>();foreach(var id in queue)parent[id]=null;
   for(int i=0;i<queue.Count&&!parent.ContainsKey(target);i++){
    SkillTreeNode n;if(!nodes.TryGetValue(queue[i],out n))continue;
    foreach(var next in n.Data.ConnectedNodeIDs)if(!parent.ContainsKey(next)){parent[next]=queue[i];queue.Add(next);}
   }
   if(!parent.ContainsKey(target))return new string[0];var path=new List<string>();for(string id=target;id!=null;id=parent[id])path.Add(id);path.Reverse();return path.ToArray();
  }
  public bool CanAllocate(string id)=>HasLiveBuild&&nodes.ContainsKey(id)&&nodes[id].Data.Available;
  public bool CanAllocatePath=>HasLiveBuild&&PreviewPath.Length>1&&PreviewCost<=Remaining;
  public bool CanRefund(string id){
   if(!HasLiveBuild||id==StartID||!acquired.Contains(id))return false;
   var seen=new HashSet<string>{StartID};var queue=new List<string>{StartID};for(int i=0;i<queue.Count;i++){
    SkillTreeNode node;if(!nodes.TryGetValue(queue[i],out node))continue;
    foreach(var next in node.Data.ConnectedNodeIDs)if(next!=id&&acquired.Contains(next)&&seen.Add(next))queue.Add(next);
   }return acquired.All(n=>n==id||seen.Contains(n));
  }
  public void SelectNode(string id){if(!nodes.ContainsKey(id))return;SelectedID=id;UpdateSelection();}
  void UpdateSelection(){
   PreviewPath=SelectedID==null?new string[0]:FindPath(SelectedID);PreviewCost=PreviewPath.Skip(1).Sum(id=>nodes[id].Data.AllocationCost);var guide=new HashSet<string>(PreviewPath);
   foreach(var pair in nodes)pair.Value.Refresh(pair.Key==SelectedID,guide.Contains(pair.Key));BuildLinks(guide);
   SkillTreeNode node;if(SelectedID!=null&&nodes.TryGetValue(SelectedID,out node))OnNodeSelected?.Invoke(node.Data);
  }
  void BuildLinks(HashSet<string> guide){
   var vertices=new List<Vector3>();var colors=new List<Color>();var indices=new List<int>();
   var pathEdges=new HashSet<string>();for(int i=1;i<PreviewPath.Length;i++){pathEdges.Add(PreviewPath[i-1]+":"+PreviewPath[i]);pathEdges.Add(PreviewPath[i]+":"+PreviewPath[i-1]);}
   foreach(var edge in links){
    Vector2 a=nodes[edge.Key].Data.Position,b=nodes[edge.Value].Data.Position;bool lit=acquired.Contains(edge.Key)&&acquired.Contains(edge.Value),path=pathEdges.Contains(edge.Key+":"+edge.Value);
    Vector2 normal=new Vector2(-(b-a).y,(b-a).x).normalized*(path?.018f:.010f);Color color=path?new Color(1,.80f,.40f):lit?new Color(.78f,.61f,.32f):new Color(.23f,.30f,.34f);int at=vertices.Count;
    vertices.Add(a+normal);vertices.Add(a-normal);vertices.Add(b-normal);vertices.Add(b+normal);for(int i=0;i<4;i++)colors.Add(color);indices.AddRange(new[]{at,at+1,at+2,at,at+2,at+3});
   }
   linkMesh.Clear();linkMesh.SetVertices(vertices);linkMesh.SetColors(colors);linkMesh.SetTriangles(indices,0);linkMesh.RecalculateBounds();
  }
  public void FocusStart(){if(nodes.ContainsKey(StartID)){SelectNode(StartID);Controller.ResetView(nodes[StartID].transform.position);}}
  void OnDestroy(){if(linkMesh)Destroy(linkMesh);if(lineMaterial)Destroy(lineMaterial);if(ring)Destroy(ring);if(texture)Destroy(texture);}
 }
}
