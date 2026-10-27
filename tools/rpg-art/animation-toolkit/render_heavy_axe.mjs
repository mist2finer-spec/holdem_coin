import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2),arg=k=>path.resolve(args[args.indexOf(k)+1]),project=arg('--project'),out=arg('--out'),previous=arg('--previous');
const {createCanvas,loadImage}=await import(pathToFileURL(project+'/node_modules/@napi-rs/canvas/index.js'));
const {TextureAtlas,CanvasTexture,SkeletonJson,AtlasAttachmentLoader,Skeleton,AnimationState,AnimationStateData,Physics,SkeletonRenderer}=await import(pathToFileURL(project+'/node_modules/@esotericsoftware/spine-canvas/dist/index.js'));
async function load(dir){const atlas=new TextureAtlas(fs.readFileSync(dir+'/hong.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new CanvasTexture(await loadImage(dir+'/'+p.name)));return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(dir+'/hong.json')));}
const sets=[await load(previous),await load(out+'/rig')];Skeleton.yDown=true;fs.mkdirSync(out+'/frames',{recursive:true});const results=[];
function equip(sk){sk.setSkinByName('axe');sk.setSlotsToSetupPose();sk.findSlot('weapon-front').setAttachment(sk.getAttachmentByName('weapon-front','held-axe'));sk.findSlot('weapon-back').setAttachment(null)}
function bottom(sk){let y=-Infinity;for(const n of ['front-foot','back-foot']){const slot=sk.findSlot(n),v=new Float32Array(8);slot.getAttachment().computeWorldVertices(slot,v,0,2);for(let i=1;i<8;i+=2)y=Math.max(y,v[i])}return y}
const floor=sets.map(d=>{const sk=new Skeleton(d);equip(sk);sk.updateWorldTransform(Physics.update);return bottom(sk)});
for(let i=0;i<70;i++){
 const t=i/50,attack=t>=.3&&t<.9,age=attack?t-.3:0,canvas=createCanvas(1000,480),ctx=canvas.getContext('2d');const capture={time:t,attackAge:age};
 for(let col=0;col<2;col++){
  ctx.save();ctx.translate(col*500,0);ctx.fillStyle=col?'#152c30':'#192329';ctx.fillRect(0,0,500,480);ctx.fillStyle=col?'#f2d6a1':'#abb9b8';ctx.font='bold 19px sans-serif';ctx.fillText(col?'HEAVY AXE v2':'PREVIOUS SD TEST',18,30);ctx.font='12px sans-serif';ctx.fillText(col?'0.25s WINDUP  /  0.05s SNAP  /  0.08s HOLD':'Same Hong art / same weapon',18,52);ctx.fillStyle='#2c4238';ctx.fillRect(0,414,500,66);ctx.strokeStyle='#67816d';ctx.beginPath();ctx.moveTo(0,414);ctx.lineTo(500,414);ctx.stroke();ctx.fillStyle='#0c1c20';ctx.beginPath();ctx.ellipse(212,416,65,7,0,0,Math.PI*2);ctx.fill();
  const sk=new Skeleton(sets[col]);equip(sk);const state=new AnimationState(new AnimationStateData(sets[col])),name=attack?(col?'heavy-axe-slash':'axe-attack1'):'axe-stay1';const entry=state.setAnimation(0,name,false);state.update(attack?age:0);state.apply(sk);sk.x=210;sk.y=414-floor[col]*1.5;sk.scaleX=sk.scaleY=1.5;sk.updateWorldTransform(Physics.update);
  // Old preview snapped feet each frame. New pose preserves authored hip depth / IK support feet.
  if(!col){sk.y+=414-bottom(sk);sk.updateWorldTransform(Physics.pose)}
  ctx.imageSmoothingEnabled=false;new SkeletonRenderer(ctx).draw(sk);
  const phase=!attack?'READY':age<.25?'WINDUP':age<.30?'SNAP':age<.38?'HIT STOP':'FOLLOW THROUGH';ctx.fillStyle=col?'#edca83':'#98abaa';ctx.font='14px sans-serif';ctx.fillText(col?phase:attack?'ATTACK':'READY',18,454);
  if(col){capture.rotation=Object.fromEntries(sk.bones.map(b=>[b.data.name,b.rotation]));capture.bonePositions=Object.fromEntries(sk.bones.map(b=>[b.data.name,[b.worldX,b.worldY]]));capture.footError=bottom(sk)-414;capture.slashAlpha=sk.findSlot('slash-fx').color.a;capture.slashAttachment=sk.findSlot('slash-fx').getAttachment()?.name??null;}
  if(!sk.bones.every(b=>[b.a,b.b,b.c,b.d,b.worldX,b.worldY].every(Number.isFinite)))throw Error('Nonfinite '+i+':'+col);
  ctx.restore();
 }
 results.push(capture);fs.writeFileSync(out+'/frames/frame-'+String(i).padStart(3,'0')+'.png',canvas.toBuffer('image/png'));
}
fs.writeFileSync(out+'/render-samples.json',JSON.stringify(results));console.log('HEAVY_AXE_RUNTIME_RENDERED',results.length,'frames');
