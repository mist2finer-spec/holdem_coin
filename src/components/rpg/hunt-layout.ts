/** World-space simulation stays independent of this fixed, hero-centered viewport.
 * Padding beyond map edges keeps the hero anchored even at either boundary.
 * Unity can use the same x coordinates and an orthographic follow camera.
 */
export function huntViewport(width:number,heroX:number){
 const worldWidth=Math.max(1125,width*1.25);
 const zoom=width/worldWidth;
 const camera=heroX-worldWidth/2;
 return {worldWidth,zoom,camera,screenX:(x:number)=>(x-camera)*zoom};
}
