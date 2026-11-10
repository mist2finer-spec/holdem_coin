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
  public int LayoutRebuildCount=>layout.RebuildCount;
  public int RenderedEdgeCount=>links.Count;
  readonly List<Vector3> lineVertices=new List<Vector3>();readonly List<Color> lineColors=new List<Color>();readonly List<int> lineIndices=new List<int>();
  int widthBand=int.MinValue;
  readonly Dictionary<string,SkillTreeNode> nodes=new Dictionary<string,SkillTreeNode>();
  readonly HashSet<string> acquired=new HashSet<string>();
  readonly List<string> acquiredOrder=new List<string>();
  readonly List<KeyValuePair<string,string>> links=new List<KeyValuePair<string,string>>();
  string revision;Sprite ring,fillSprite,socketSprite,startSprite,diamondFill;Texture2D texture;Material lineMaterial;Mesh linkMesh;MeshRenderer linkRenderer;
  public void Initialize(SkillTreeCameraController camera,int layer){
   Controller=camera;gameObject.layer=layer;
   texture=new Texture2D(320,64,TextureFormat.RGBA32,false){name="SkillTree shared attribute and state atlas",filterMode=FilterMode.Bilinear,wrapMode=TextureWrapMode.Clamp};
   var pixels=new Color[320*64];for(int y=0;y<64;y++)for(int x=0;x<320;x++){int tile=x/64;float dx=(x%64+.5f-32)/32,dy=(y+.5f-32)/32,d=tile==2||tile==4?Mathf.Abs(dx)+Mathf.Abs(dy):Mathf.Sqrt(dx*dx+dy*dy);float alpha=tile==1||tile==4?(d<.8f?1:0):d>.87f&&d<.99f||tile==3&&d>.68f&&d<.73f?1:0;pixels[y*320+x]=new Color(1,1,1,alpha);}texture.SetPixels(pixels);texture.Apply(false,true);
   ring=Sprite.Create(texture,new Rect(0,0,64,64),new Vector2(.5f,.5f),64);fillSprite=Sprite.Create(texture,new Rect(64,0,64,64),new Vector2(.5f,.5f),64);socketSprite=Sprite.Create(texture,new Rect(128,0,64,64),new Vector2(.5f,.5f),64);startSprite=Sprite.Create(texture,new Rect(192,0,64,64),new Vector2(.5f,.5f),64);diamondFill=Sprite.Create(texture,new Rect(256,0,64,64),new Vector2(.5f,.5f),64);
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
   var displayPositions=layout.Build(list,edges);foreach(var warning in layout.Warnings)Debug.LogWarning("SkillTree: "+warning);
   var present=new HashSet<string>();Vector2 min=new Vector2(float.PositiveInfinity,float.PositiveInfinity),max=new Vector2(float.NegativeInfinity,float.NegativeInfinity);
   foreach(var source in list.OfType<JObject>()){
    string id=(string)source["id"];if(string.IsNullOrEmpty(id)||!present.Add(id))continue;
    string kind=(string)source["kind"];bool start=id==StartID;var pos=displayPositions[id];
    var data=new SkillTreeNodeData{ID=id,Name=nameResolver==null?(string)source["name"]:nameResolver(source),Description=(string)source["description"]??"",Attribute=(string)source["attribute"],Type=start||source["startFor"]!=null?SkillTreeNodeType.Start:kind=="socket"?SkillTreeNodeType.Socket:kind=="keystone"?SkillTreeNodeType.Keystone:kind=="notable"?SkillTreeNodeType.Notable:SkillTreeNodeType.Small,Acquired=acquired.Contains(id),IsStart=start,Transformed=source["transformedBy"]?.Type==JTokenType.String,AllocationCost=Mathf.Max(1,source.Value<int?>("allocationCost")??1),Position=pos};
    SkillTreeNode node;if(!nodes.TryGetValue(id,out node)){var go=new GameObject("Node · "+id,typeof(SpriteRenderer),typeof(CircleCollider2D),typeof(SkillTreeNode));go.transform.SetParent(transform,false);go.layer=gameObject.layer;node=go.GetComponent<SkillTreeNode>();nodes[id]=node;}
    node.transform.localPosition=new Vector3(pos.x,pos.y,0);node.Bind(data,data.Type==SkillTreeNodeType.Start?startSprite:data.Type==SkillTreeNodeType.Socket?socketSprite:ring,data.Type==SkillTreeNodeType.Socket?diamondFill:fillSprite);min=Vector2.Min(min,pos);max=Vector2.Max(max,pos);
   }
   foreach(var id in nodes.Keys.Where(id=>!present.Contains(id)).ToArray()){nodes[id].gameObject.SetActive(false);Destroy(nodes[id].gameObject);nodes.Remove(id);}
   links.Clear();foreach(var edge in edges){string a=edge is JArray?(string)edge[0]:(string)edge["from"],b=edge is JArray?(string)edge[1]:(string)edge["to"];if(a==null||b==null||!nodes.ContainsKey(a)||!nodes.ContainsKey(b))continue;links.Add(new KeyValuePair<string,string>(a,b));nodes[a].Data.ConnectedNodeIDs.Add(b);nodes[b].Data.ConnectedNodeIDs.Add(a);}
   foreach(var node in nodes.Values)node.Data.Available=!node.Data.Acquired&&Remaining>=node.Data.AllocationCost&&node.Data.ConnectedNodeIDs.Any(acquired.Contains);
   Controller.SetBounds((Vector2)transform.position+min-Vector2.one*3,(Vector2)transform.position+max+Vector2.one*3);
   bool first=SelectedID==null||!nodes.ContainsKey(SelectedID);if(first)SelectedID=nodes.ContainsKey(StartID)?StartID:nodes.Keys.FirstOrDefault();
   UpdateSelection();if(first&&SelectedID!=null)FocusNodeNeighborhood(SelectedID,true);return true;
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
   lineVertices.Clear();lineColors.Clear();lineIndices.Clear();
   var pathEdges=new HashSet<string>();for(int i=1;i<PreviewPath.Length;i++)pathEdges.Add(SkillTreeLayout.EdgeKey(PreviewPath[i-1],PreviewPath[i]));
   float unit=2*Controller.TreeCamera.orthographicSize/Mathf.Max(1,Controller.ViewportHeightInUIUnits);
   foreach(var edge in links){
    string key=SkillTreeLayout.EdgeKey(edge.Key,edge.Value);bool lit=acquired.Contains(edge.Key)&&acquired.Contains(edge.Value),path=pathEdges.Contains(key);
    Vector2[] points;if(!layout.Routes.TryGetValue(key,out points))points=new[]{nodes[edge.Key].Data.Position,nodes[edge.Value].Data.Position};
    for(int k=1;k<points.Length;k++){
     Vector2 a=points[k-1],b=points[k];Vector2 normal=new Vector2(-(b-a).y,(b-a).x).normalized*unit*(path?1.4f:.55f);Color color=path?new Color(1,.80f,.40f):lit?new Color(.78f,.61f,.32f):new Color(.23f,.30f,.34f);int at=lineVertices.Count;
     lineVertices.Add(a+normal);lineVertices.Add(a-normal);lineVertices.Add(b-normal);lineVertices.Add(b+normal);for(int i=0;i<4;i++)lineColors.Add(color);lineIndices.Add(at);lineIndices.Add(at+1);lineIndices.Add(at+2);lineIndices.Add(at);lineIndices.Add(at+2);lineIndices.Add(at+3);
    }
   }
   linkMesh.Clear();linkMesh.SetVertices(lineVertices);linkMesh.SetColors(lineColors);linkMesh.SetTriangles(lineIndices,0);linkMesh.RecalculateBounds();
  }
  void LateUpdate(){if(!Controller||nodes.Count==0)return;int band=Mathf.FloorToInt(Mathf.Log(Mathf.Max(.1f,Controller.TreeCamera.orthographicSize),2)*4);if(band==widthBand)return;widthBand=band;BuildLinks(null);}
  public void FocusNodeNeighborhood(string id,bool instant=false){
   if(!nodes.ContainsKey(id))return;Rect r;if(layout.TryFocus(id,out r)){Controller.FocusBounds(r.min+(Vector2)transform.position,r.max+(Vector2)transform.position,instant);return;}
   var p=nodes[id].transform.position;Controller.FocusBounds((Vector2)p-Vector2.one*2.6f,(Vector2)p+Vector2.one*2.6f,instant);
  }
  public void FocusStart(){if(nodes.ContainsKey(StartID)){SelectNode(StartID);FocusNodeNeighborhood(StartID);}}
  public void FocusAll(){if(nodes.Count==0)return;Controller.FocusBounds(Controller.MinPanBounds,Controller.MaxPanBounds);}
  void OnDestroy(){if(linkMesh)Destroy(linkMesh);if(lineMaterial)Destroy(lineMaterial);foreach(var sprite in new[]{ring,fillSprite,socketSprite,startSprite,diamondFill})if(sprite)Destroy(sprite);if(texture)Destroy(texture);}
 }
}
