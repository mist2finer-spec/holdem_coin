import {MeshAttachment,RegionAttachment,Physics,type Skeleton} from '@esotericsoftware/spine-core';
/** Actual posed attachment vertices, not the skeleton root, define feet/body contact.
 * Y increases downward. Hero uses leg slots so weapons/tails never set ground height.
 */
export function attachmentBottom(skeleton:Skeleton,slotNames:readonly string[]){
 let bottom=-Infinity;
 for(const slot of skeleton.slots){
  if(!slotNames.includes(slot.data.name))continue;
  const attachment=slot.getAttachment();let vertices:Float32Array;
  if(attachment instanceof RegionAttachment){vertices=new Float32Array(8);attachment.computeWorldVertices(slot,vertices,0,2);}
  else if(attachment instanceof MeshAttachment){vertices=new Float32Array(attachment.worldVerticesLength);attachment.computeWorldVertices(slot,0,vertices.length,vertices,0,2);}
  else continue;
  for(let i=1;i<vertices.length;i+=2)bottom=Math.max(bottom,vertices[i]);
 }
 return Number.isFinite(bottom)?bottom:null;
}
export function groundSkeleton(skeleton:Skeleton,groundY:number,slotNames:readonly string[]){
 const bottom=attachmentBottom(skeleton,slotNames);
 if(bottom===null)return false;
 skeleton.y+=groundY-bottom;
 skeleton.updateWorldTransform(Physics.pose);
 return true;
}
