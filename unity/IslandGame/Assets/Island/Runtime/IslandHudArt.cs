using System.Collections.Generic;
using UnityEngine;
namespace IslandGame {
 // Ports ResourceHud.tsx SVG/CSS geometry, without generated bitmap art.
 // Plate/Round/Bar/icon kinds: procedural stand-ins for the art-lead HUD v1 sprites (IslandHudSkin) until those PNGs are approved and added.
 [RequireComponent(typeof(CanvasRenderer))]
 public sealed class IslandHudArt:UnityEngine.UI.MaskableGraphic {
  public enum Kind{Circle,Orb,Flask,Plate,Round,Bar,IconMenu,IconClose,IconLock,IconBack}
  public Kind shape;public Color liquid=new Color(.8f,.15f,.25f);public float fill=1;
  public Color edge=new Color(.79f,.65f,.38f);public float edgeWidth=4;
  public void SetFill(float value){value=Mathf.Clamp01(value);if(Mathf.Abs(value-fill)>.001f){fill=value;SetVerticesDirty();}}
  public void SetColors(Color body,Color rim){if(body==liquid&&rim==edge)return;liquid=body;edge=rim;SetVerticesDirty();}
  protected override void OnPopulateMesh(UnityEngine.UI.VertexHelper vh){
   vh.Clear();var rect=rectTransform.rect;var center=rect.center;float r=Mathf.Min(rect.width,rect.height)*.5f;
   if(shape==Kind.Flask){
    Vector2[] outline={new Vector2(-.24f,.88f),new Vector2(.24f,.88f),new Vector2(.24f,.26f),new Vector2(.7f,-.22f),new Vector2(.7f,-.84f),new Vector2(-.7f,-.84f),new Vector2(-.7f,-.22f),new Vector2(-.24f,.26f)};
    for(int i=0;i<outline.Length;i++)Triangle(vh,center,center+outline[i]*r,center+outline[(i+1)%outline.Length]*r,new Color(.42f,.57f,.6f),new Color(.3f,.42f,.46f));
    Quad(vh,center+new Vector2(-.55f,-.72f)*r,center+new Vector2(.55f,-.15f)*r,liquid,liquid*.65f);
    Quad(vh,center+new Vector2(-.34f,.68f)*r,center+new Vector2(.34f,.94f)*r,new Color(.76f,.66f,.44f),new Color(.45f,.34f,.18f));return;
   }
   if(shape==Kind.Plate){
    // Chamfered panel: top-left and bottom-right corners cut, rim then body.
    float c=Mathf.Min(16,Mathf.Min(rect.width,rect.height)*.22f),e=Mathf.Min(edgeWidth,Mathf.Min(rect.width,rect.height)*.25f);
    Poly(vh,Chamfer(rect,c),edge,Dim(edge,.7f));
    var inner=new Rect(rect.x+e,rect.y+e,rect.width-2*e,rect.height-2*e);Poly(vh,Chamfer(inner,Mathf.Max(0,c-e*.6f)),liquid,Dim(liquid,.55f));return;
   }
   if(shape==Kind.Round){
    Disk(vh,center,r,edge,Dim(edge,.6f));Disk(vh,center,r-Mathf.Min(edgeWidth,r*.2f),liquid,Dim(liquid,.5f));
    Ring(vh,center,r*.86f,r*.83f,new Color(1,1,1,.16f),new Color(1,1,1,.04f));return;
   }
   if(shape==Kind.Bar){
    if(fill<=0)return;var high=new Vector2(rect.xMin+rect.width*fill,rect.yMax);Quad(vh,rect.min,high,liquid,Dim(liquid,.62f));
    Quad(vh,new Vector2(rect.xMin,rect.yMax-rect.height*.3f),high,new Color(1,1,1,.22f),new Color(1,1,1,.04f));return;
   }
   if(shape==Kind.IconMenu){float w=r*1.1f,h=r*.14f;for(int i=-1;i<=1;i++){var c=center+new Vector2(0,i*r*.42f);Quad(vh,c-new Vector2(w*.5f,h),c+new Vector2(w*.5f,h),liquid,liquid);}return;}
   if(shape==Kind.IconClose){Bar(vh,center,new Vector2(1,1).normalized,r*.62f,r*.13f,liquid);Bar(vh,center,new Vector2(1,-1).normalized,r*.62f,r*.13f,liquid);return;}
   if(shape==Kind.IconBack){Bar(vh,center+new Vector2(-r*.06f,r*.24f),new Vector2(1,1).normalized,r*.36f,r*.13f,liquid);Bar(vh,center+new Vector2(-r*.06f,-r*.24f),new Vector2(1,-1).normalized,r*.36f,r*.13f,liquid);return;}
   if(shape==Kind.IconLock){
    Ring(vh,center+new Vector2(0,r*.18f),r*.42f,r*.28f,liquid,liquid);
    Quad(vh,center+new Vector2(-r*.56f,-r*.7f),center+new Vector2(r*.56f,r*.14f),liquid,Dim(liquid,.8f));
    Disk(vh,center+new Vector2(0,-r*.26f),r*.11f,new Color(.05f,.07f,.09f),new Color(.05f,.07f,.09f));return;
   }
   Disk(vh,center,r,new Color(.13f,.22f,.25f),new Color(.035f,.08f,.11f));
   Ring(vh,center,r*.95f,r*.88f,new Color(.55f,.57f,.45f),new Color(.2f,.4f,.43f));
   if(shape==Kind.Orb){
    float inner=r*.77f,top=Mathf.Lerp(-inner,inner,fill);
    for(int i=0;i<48;i++){float y0=-inner+2*inner*i/48,y1=Mathf.Min(top,-inner+2*inner*(i+1)/48);if(y1<=y0)break;
     float w0=Mathf.Sqrt(Mathf.Max(0,inner*inner-y0*y0)),w1=Mathf.Sqrt(Mathf.Max(0,inner*inner-y1*y1));
     Color c0=Color.Lerp(liquid*.35f,liquid,(y0/inner+1)*.5f),c1=Color.Lerp(liquid*.35f,liquid,(y1/inner+1)*.5f);
     int n=vh.currentVertCount;vh.AddVert(center+new Vector2(-w0,y0),c0,Vector2.zero);vh.AddVert(center+new Vector2(w0,y0),c0,Vector2.zero);vh.AddVert(center+new Vector2(w1,y1),c1,Vector2.zero);vh.AddVert(center+new Vector2(-w1,y1),c1,Vector2.zero);vh.AddTriangle(n,n+1,n+2);vh.AddTriangle(n,n+2,n+3);
    }
    Disk(vh,center+new Vector2(-r*.28f,r*.32f),r*.16f,new Color(1,1,1,.55f),new Color(1,1,1,0));
   }
  }
  static Color Dim(Color c,float k)=>new Color(c.r*k,c.g*k,c.b*k,c.a);
  static Vector2[] Chamfer(Rect q,float c){return new[]{new Vector2(q.xMin,q.yMin),new Vector2(q.xMax-c,q.yMin),new Vector2(q.xMax,q.yMin+c),new Vector2(q.xMax,q.yMax),new Vector2(q.xMin+c,q.yMax),new Vector2(q.xMin,q.yMax-c)};}
  // Convex polygon, vertical gradient (top colour -> bottom colour).
  static void Poly(UnityEngine.UI.VertexHelper vh,Vector2[] p,Color top,Color bottom){
   float y0=float.MaxValue,y1=float.MinValue;Vector2 c=Vector2.zero;foreach(var v in p){y0=Mathf.Min(y0,v.y);y1=Mathf.Max(y1,v.y);c+=v;}c/=p.Length;
   int n=vh.currentVertCount;vh.AddVert(c,Color.Lerp(bottom,top,.5f),Vector2.zero);
   foreach(var v in p)vh.AddVert(v,Color.Lerp(bottom,top,y1>y0?(v.y-y0)/(y1-y0):1),Vector2.zero);
   for(int i=0;i<p.Length;i++)vh.AddTriangle(n,n+1+i,n+1+(i+1)%p.Length);
  }
  static void Bar(UnityEngine.UI.VertexHelper vh,Vector2 c,Vector2 dir,float half,float thick,Color color){Vector2 n=new Vector2(-dir.y,dir.x)*thick,a=dir*half;int i=vh.currentVertCount;vh.AddVert(c-a-n,color,Vector2.zero);vh.AddVert(c+a-n,color,Vector2.zero);vh.AddVert(c+a+n,color,Vector2.zero);vh.AddVert(c-a+n,color,Vector2.zero);vh.AddTriangle(i,i+1,i+2);vh.AddTriangle(i,i+2,i+3);}
  static void Triangle(UnityEngine.UI.VertexHelper vh,Vector2 a,Vector2 b,Vector2 c,Color inner,Color outer){int n=vh.currentVertCount;vh.AddVert(a,inner,Vector2.zero);vh.AddVert(b,outer,Vector2.zero);vh.AddVert(c,outer,Vector2.zero);vh.AddTriangle(n,n+1,n+2);}
  static void Quad(UnityEngine.UI.VertexHelper vh,Vector2 low,Vector2 high,Color upper,Color lower){int n=vh.currentVertCount;vh.AddVert(low,lower,Vector2.zero);vh.AddVert(new Vector2(high.x,low.y),lower,Vector2.zero);vh.AddVert(high,upper,Vector2.zero);vh.AddVert(new Vector2(low.x,high.y),upper,Vector2.zero);vh.AddTriangle(n,n+1,n+2);vh.AddTriangle(n,n+2,n+3);}
  static void Disk(UnityEngine.UI.VertexHelper vh,Vector2 center,float r,Color inner,Color outer){for(int i=0;i<64;i++){float a=i*Mathf.PI/32,b=(i+1)*Mathf.PI/32;Triangle(vh,center,center+new Vector2(Mathf.Cos(a),Mathf.Sin(a))*r,center+new Vector2(Mathf.Cos(b),Mathf.Sin(b))*r,inner,outer);}}
  static void Ring(UnityEngine.UI.VertexHelper vh,Vector2 center,float outer,float inner,Color top,Color bottom){for(int i=0;i<64;i++){float a=i*Mathf.PI/32,b=(i+1)*Mathf.PI/32;int n=vh.currentVertCount;Vector2 p=new Vector2(Mathf.Cos(a),Mathf.Sin(a)),q=new Vector2(Mathf.Cos(b),Mathf.Sin(b));Color c=Color.Lerp(bottom,top,(p.y+1)*.5f);vh.AddVert(center+p*inner,c,Vector2.zero);vh.AddVert(center+p*outer,c,Vector2.zero);vh.AddVert(center+q*outer,c,Vector2.zero);vh.AddVert(center+q*inner,c,Vector2.zero);vh.AddTriangle(n,n+1,n+2);vh.AddTriangle(n,n+2,n+3);}}
 }

 // Sprite slots for the art-lead HUD v1 set (maintenance/ui-ref4-20261121/art/v1/manifest.json). Names are the manifest asset keys.
 // Empty today: no PNG is in the project, so every slot falls back to IslandHudArt. After approval, copy sprites/<key>.png to
 // Assets/Island/Resources/IslandHud/v1/<key>.png and the next battle HUD build uses them (no code change). Borders are the manifest
 // nine_slice_border_px values (left,right,top,bottom) re-ordered for Sprite.Create (left,bottom,right,top).
 public static class IslandHudSkin {
  public const string Folder="IslandHud/v1/";
  static readonly Dictionary<string,Vector4> Borders=new Dictionary<string,Vector4>{
   {"top_stage_bar",LRTB(32,32,24,24)},{"zone_counter_plate",LRTB(26,26,22,22)},{"level_badge",LRTB(16,16,14,14)},{"bar_frame",LRTB(20,20,16,16)},
   {"skill_slot_square",LRTB(24,24,24,24)},{"menu_popup_panel",LRTB(40,40,40,40)},{"menu_item_button",LRTB(24,24,24,24)}};
  static Vector4 LRTB(float l,float r,float t,float b)=>new Vector4(l,b,r,t);
  public static Vector4 Border(string key)=>Borders.TryGetValue(key,out var b)?b:Vector4.zero;
  // Caller owns (and destroys) the returned sprite. Null = slot empty, use the procedural fallback.
  public static Sprite Load(string key){
   var texture=Resources.Load<Texture2D>(Folder+key);if(!texture)return null;
   return Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f),100,0,SpriteMeshType.FullRect,Border(key));
  }
 }
}
