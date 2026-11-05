using UnityEngine;
namespace IslandGame {
 // Ports ResourceHud.tsx SVG/CSS geometry, without generated bitmap art.
 [RequireComponent(typeof(CanvasRenderer))]
 public sealed class IslandHudArt:UnityEngine.UI.MaskableGraphic {
  public enum Kind{Circle,Orb,Flask}
  public Kind shape;public Color liquid=new Color(.8f,.15f,.25f);public float fill=1;
  public void SetFill(float value){value=Mathf.Clamp01(value);if(Mathf.Abs(value-fill)>.001f){fill=value;SetVerticesDirty();}}
  protected override void OnPopulateMesh(UnityEngine.UI.VertexHelper vh){
   vh.Clear();var rect=rectTransform.rect;var center=rect.center;float r=Mathf.Min(rect.width,rect.height)*.5f;
   if(shape==Kind.Flask){
    Vector2[] outline={new Vector2(-.24f,.88f),new Vector2(.24f,.88f),new Vector2(.24f,.26f),new Vector2(.7f,-.22f),new Vector2(.7f,-.84f),new Vector2(-.7f,-.84f),new Vector2(-.7f,-.22f),new Vector2(-.24f,.26f)};
    for(int i=0;i<outline.Length;i++)Triangle(vh,center,center+outline[i]*r,center+outline[(i+1)%outline.Length]*r,new Color(.42f,.57f,.6f),new Color(.3f,.42f,.46f));
    Quad(vh,center+new Vector2(-.55f,-.72f)*r,center+new Vector2(.55f,-.15f)*r,liquid,liquid*.65f);
    Quad(vh,center+new Vector2(-.34f,.68f)*r,center+new Vector2(.34f,.94f)*r,new Color(.76f,.66f,.44f),new Color(.45f,.34f,.18f));return;
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
  static void Triangle(UnityEngine.UI.VertexHelper vh,Vector2 a,Vector2 b,Vector2 c,Color inner,Color outer){int n=vh.currentVertCount;vh.AddVert(a,inner,Vector2.zero);vh.AddVert(b,outer,Vector2.zero);vh.AddVert(c,outer,Vector2.zero);vh.AddTriangle(n,n+1,n+2);}
  static void Quad(UnityEngine.UI.VertexHelper vh,Vector2 low,Vector2 high,Color upper,Color lower){int n=vh.currentVertCount;vh.AddVert(low,lower,Vector2.zero);vh.AddVert(new Vector2(high.x,low.y),lower,Vector2.zero);vh.AddVert(high,upper,Vector2.zero);vh.AddVert(new Vector2(low.x,high.y),upper,Vector2.zero);vh.AddTriangle(n,n+1,n+2);vh.AddTriangle(n,n+2,n+3);}
  static void Disk(UnityEngine.UI.VertexHelper vh,Vector2 center,float r,Color inner,Color outer){for(int i=0;i<64;i++){float a=i*Mathf.PI/32,b=(i+1)*Mathf.PI/32;Triangle(vh,center,center+new Vector2(Mathf.Cos(a),Mathf.Sin(a))*r,center+new Vector2(Mathf.Cos(b),Mathf.Sin(b))*r,inner,outer);}}
  static void Ring(UnityEngine.UI.VertexHelper vh,Vector2 center,float outer,float inner,Color top,Color bottom){for(int i=0;i<64;i++){float a=i*Mathf.PI/32,b=(i+1)*Mathf.PI/32;int n=vh.currentVertCount;Vector2 p=new Vector2(Mathf.Cos(a),Mathf.Sin(a)),q=new Vector2(Mathf.Cos(b),Mathf.Sin(b));Color c=Color.Lerp(bottom,top,(p.y+1)*.5f);vh.AddVert(center+p*inner,c,Vector2.zero);vh.AddVert(center+p*outer,c,Vector2.zero);vh.AddVert(center+q*outer,c,Vector2.zero);vh.AddVert(center+q*inner,c,Vector2.zero);vh.AddTriangle(n,n+1,n+2);vh.AddTriangle(n,n+2,n+3);}}
 }
}
