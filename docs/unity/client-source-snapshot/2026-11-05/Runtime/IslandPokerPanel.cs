using UnityEngine;
using UnityEngine.UI;
namespace IslandGame {
 [RequireComponent(typeof(CanvasRenderer))]
 public class IslandPokerPanel:MaskableGraphic {
  public float Radius=8,Border=1;public Color Edge=new Color(.51f,.37f,.18f);public Color Top=new Color(.08f,.12f,.16f),Bottom=new Color(.025f,.04f,.06f);
  protected void Round(VertexHelper vh,Rect r,float radius,Color top,Color bottom){
   radius=Mathf.Clamp(radius,0,Mathf.Min(r.width,r.height)/2);int center=vh.currentVertCount;vh.AddVert(r.center,Color.Lerp(bottom,top,.5f),Vector2.zero);
   for(int corner=0;corner<4;corner++)for(int i=0;i<=8;i++){float a=(corner*90+i*90f/8)*Mathf.Deg2Rad;var c=new Vector2(corner==0||corner==3?r.xMax-radius:r.xMin+radius,corner<2?r.yMax-radius:r.yMin+radius);var p=c+new Vector2(Mathf.Cos(a),Mathf.Sin(a))*radius;vh.AddVert(p,Color.Lerp(bottom,top,Mathf.InverseLerp(r.yMin,r.yMax,p.y)),Vector2.zero);}
   for(int i=0;i<36;i++)vh.AddTriangle(center,center+1+i,center+1+(i+1)%36);
  }
  protected override void OnPopulateMesh(VertexHelper vh){vh.Clear();var r=rectTransform.rect;Round(vh,r,Radius,Edge,Edge);r.xMin+=Border;r.xMax-=Border;r.yMin+=Border;r.yMax-=Border;Round(vh,r,Radius-Border,Top,Bottom);}
 }
}
