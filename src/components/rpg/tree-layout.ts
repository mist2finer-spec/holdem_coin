/** Presentation coordinates only. Never feed this layout into allocation or jewel-radius rules. */
export const TREE_DISPLAY={scale:3,padding:160,minZoom:.25,maxZoom:1.8,defaultZoom:.65} as const;
export type LayoutNode={id:string;x:number;y:number;kind:string;startFor?:string;clusterId?:string};
export function treeNodeSize(n:LayoutNode,zoom:number){const [base,minimum]=n.startFor?[72,36]:n.kind==='keystone'?[72,36]:n.kind==='notable'?[58,28]:n.kind==='socket'?[60,30]:[44,20];return Math.max(minimum,base*zoom);}
export function layoutTree(nodes:readonly LayoutNode[],bounds:{width:number;height:number}){
 const cell=192,gap=12,positions=new Map<string,{x:number;y:number;radius:number}>(),bins=new Map<string,{x:number;y:number;radius:number}[]>();
 const priority=(n:LayoutNode)=>(n.clusterId?10:0)+(n.startFor?0:n.kind==='keystone'?1:n.kind==='socket'?2:n.kind==='notable'?3:4);
 const ordered=[...nodes].sort((a,b)=>priority(a)-priority(b)||a.id.localeCompare(b.id,'en'));
 const fits=(x:number,y:number,radius:number)=>{if(x<radius+20||y<radius+20)return false;const bx=Math.floor(x/cell),by=Math.floor(y/cell);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const p of bins.get(`${bx+dx}:${by+dy}`)??[])if(Math.hypot(x-p.x,y-p.y)<radius+p.radius+gap)return false;return true;};
 let width=bounds.width*TREE_DISPLAY.scale+TREE_DISPLAY.padding*2,height=bounds.height*TREE_DISPLAY.scale+TREE_DISPLAY.padding*2;
 for(const n of ordered){
  const radius=(treeNodeSize(n,TREE_DISPLAY.minZoom)/2+4)/TREE_DISPLAY.minZoom,ox=n.x*TREE_DISPLAY.scale+TREE_DISPLAY.padding,oy=n.y*TREE_DISPLAY.scale+TREE_DISPLAY.padding;
  let x=ox,y=oy,placed=fits(x,y,radius);
  for(let ring=1;!placed&&ring<=180;ring++){const distance=ring*16,count=Math.ceil(2*Math.PI*distance/20);for(let i=0;i<count;i++){const angle=i/count*Math.PI*2,cx=ox+Math.cos(angle)*distance,cy=oy+Math.sin(angle)*distance;if(fits(cx,cy,radius)){x=cx;y=cy;placed=true;break;}}}
  if(!placed)throw Error('Unable to place passive node');const point={x,y,radius};positions.set(n.id,point);const key=`${Math.floor(x/cell)}:${Math.floor(y/cell)}`;const bucket=bins.get(key)??[];bucket.push(point);bins.set(key,bucket);width=Math.max(width,x+radius+TREE_DISPLAY.padding);height=Math.max(height,y+radius+TREE_DISPLAY.padding);
 }
 return {positions,width,height};
}
