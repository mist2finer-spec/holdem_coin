using UnityEngine;
using UnityEngine.UI;
namespace IslandGame {
 [RequireComponent(typeof(CanvasRenderer))]
 public sealed class IslandPokerTableSurface:IslandPokerPanel {
  void Line(VertexHelper vh,Vector2 a,Vector2 b,Color c){var n=new Vector2(-(b-a).y,(b-a).x).normalized*.35f;int s=vh.currentVertCount;vh.AddVert(a+n,c,Vector2.zero);vh.AddVert(a-n,c,Vector2.zero);vh.AddVert(b-n,c,Vector2.zero);vh.AddVert(b+n,c,Vector2.zero);vh.AddTriangle(s,s+1,s+2);vh.AddTriangle(s,s+2,s+3);}
  protected override void OnPopulateMesh(VertexHelper vh){
   vh.Clear();var r=rectTransform.rect;float rad=r.width*.43f;
   Round(vh,r,rad,new Color(.28f,.28f,.32f),new Color(.065f,.07f,.10f));
   r.xMin+=4;r.xMax-=4;r.yMin+=4;r.yMax-=4;Round(vh,r,rad-4,new Color(.48f,.46f,.49f),new Color(.1f,.09f,.12f));
   r.xMin+=10;r.xMax-=10;r.yMin+=10;r.yMax-=10;Round(vh,r,rad-14,new Color(.04f,.05f,.07f),new Color(.04f,.05f,.07f));
   r.xMin+=5;r.xMax-=5;r.yMin+=5;r.yMax-=5;Round(vh,r,rad-19,new Color(.80f,.62f,.31f),new Color(.51f,.32f,.14f));
   r.xMin+=2;r.xMax-=2;r.yMin+=2;r.yMax-=2;Round(vh,r,rad-21,new Color(.035f,.38f,.40f),new Color(.015f,.20f,.24f));
   float rr=rad-25;for(float y=r.yMin+30;y<r.yMax-15;y+=42)for(float x=r.xMin+25;x<r.xMax-15;x+=42){var p=new Vector2(x,y);var nearest=new Vector2(Mathf.Clamp(x,r.xMin+rr,r.xMax-rr),Mathf.Clamp(y,r.yMin+rr,r.yMax-rr));if(Vector2.Distance(p,nearest)>rr-25)continue;var c=new Color(.53f,.78f,.73f,.06f);Line(vh,p+Vector2.up*20,p+Vector2.right*20,c);Line(vh,p+Vector2.right*20,p+Vector2.down*20,c);Line(vh,p+Vector2.down*20,p+Vector2.left*20,c);Line(vh,p+Vector2.left*20,p+Vector2.up*20,c);}
  }
 }
}
