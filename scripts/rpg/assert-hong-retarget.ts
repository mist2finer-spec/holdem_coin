import assert from 'node:assert/strict';
const retargeted=new Set(['Larm2','Rarm2','Rarm3','Rarm4','bone3','bone4','B_wp3']);
function close(a:any,b:any,path=''){
 if(typeof b==='number'){assert.ok(Math.abs(a-b)<1e-8,path);return;}
 if(b===null||typeof b!=='object'){assert.deepEqual(a,b,path);return;}
 assert.deepEqual(Object.keys(a),Object.keys(b),path);for(const k of Object.keys(b))close(a[k],b[k],path+'.'+k);
}
/** Only local translation distances/Bezier value handles are retargeted. */
export function assertNativeBoneTimelines(actual:any,source:any){
 const expected=structuredClone(source);
 for(const name of retargeted)for(const key of expected?.[name]?.translate??[]){if(key.x!==undefined)key.x*=.92;if(key.y!==undefined)key.y*=.92;if(Array.isArray(key.curve))key.curve=key.curve.map((v:number,i:number)=>i%2?v*.92:v);}
 if(expected===undefined)assert.equal(actual,undefined);else close(actual,expected,'bones');
}
