/** World-space simulation stays independent of this fixed, hero-centered viewport.
 * Padding beyond map edges keeps the hero anchored even at either boundary.
 * Unity can use the same x coordinates and an orthographic follow camera.
 */
/** Visual-only portrait camera gain; world coordinates and hitboxes are unchanged. */
export const HUNT_PORTRAIT_ZOOM=1.8;
/** Compensate the wider camera so sprites remain readable at their previous size. */
export const HUNT_ACTOR_RENDER_GAIN=1.2;
/** Background artwork uses its own framing, not the actor/camera magnification. */
export const HUNT_BACKGROUND_GAIN=1.25;
export const HUNT_GROUND_RATIO=.84;
/** Visual only: actors retain their original collision radii and reach. */
export const HUNT_MONSTER_RENDER_SCALE=.88;
export function huntViewport(width:number,heroX:number){
 const worldWidth=Math.max(1125/HUNT_PORTRAIT_ZOOM,width*1.25);
 const zoom=width/worldWidth;
 const camera=heroX-worldWidth/2;
 return {worldWidth,zoom,camera,screenX:(x:number)=>(x-camera)*zoom};
}
