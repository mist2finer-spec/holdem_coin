import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const args=process.argv.slice(2),arg=k=>path.resolve(args[args.indexOf(k)+1]),root=arg('--rig'),project=arg('--project');
const {TextureAtlas,CanvasTexture,SkeletonJson,AtlasAttachmentLoader,Skeleton,AnimationState,AnimationStateData,Physics}=await import(pathToFileURL(project+'/node_modules/@esotericsoftware/spine-canvas/dist/index.js'));
const raw=JSON.parse(fs.readFileSync(root+'/hong.json')),atlas=new TextureAtlas(fs.readFileSync(root+'/hong.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:1024,height:512}));const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(raw);Skeleton.yDown=false;
function sample(t){const sk=new Skeleton(data);sk.setSkinByName('axe');sk.setSlotsToSetupPose();sk.findSlot('weapon-front').setAttachment(sk.getAttachmentByName('weapon-front','held-axe'));const st=new AnimationState(new AnimationStateData(data));st.setAnimation(0,'heavy-axe-slash',false);st.update(t);st.apply(sk);sk.updateWorldTransform(Physics.update);return sk;}
const close=(x,y,e=.003)=>assert.ok(Math.abs(x-y)<e,`${x} != ${y}`),wrap=v=>((v+180)%360+360)%360-180;const anim=raw.animations['heavy-axe-slash'];let vectorCurves=0,scalarCurves=0;
assert.equal(data.findAnimation('heavy-axe-slash').duration,.6000000238418579);
for(const tracks of Object.values(anim.bones))for(const [kind,rows]of Object.entries(tracks))for(const [i,row]of rows.entries()){
 if(i===rows.length-1)continue;assert.ok(row.curve,'Every authored segment has an explicit curve/hold');
 if(Array.isArray(row.curve)){assert.equal(row.curve.length,kind==='rotate'?4:8);row.curve.forEach(v=>assert.ok(Number.isFinite(v)));if(kind==='rotate')scalarCurves++;else vectorCurves++;}
}
const wind=sample(.25),hit=sample(.30001),hold=sample(.379);
close(wind.findBone('pelvis').x-wind.findBone('pelvis').data.x,-15);close(wind.findBone('pelvis').y-wind.findBone('pelvis').data.y,8);
close(hit.findBone('pelvis').x-hit.findBone('pelvis').data.x,45);close(hit.findBone('pelvis').y-hit.findBone('pelvis').data.y,-25);
close(wind.findBone('torso').scaleX,.88);close(hit.findBone('torso').scaleX,1.15);close(wind.findBone('torso').shearX,-12);close(hit.findBone('torso').shearX,15);
close(wrap(wind.findBone('weapon-front').getWorldRotationX()+90),110);close(wrap(hit.findBone('weapon-front').getWorldRotationX()+90),-70);
for(const t of [.31,.32,.34,.37,.379]){const sk=sample(t);for(const b of sk.bones)close(b.rotation,hit.findBone(b.data.name).rotation);}
close(sample(.3101).findBone('torso').x-sample(.3101).findBone('torso').data.x,3);close(sample(.3201).findBone('torso').x-sample(.3201).findBone('torso').data.x,-3);
assert.equal(sample(.24).findSlot('slash-fx').getAttachment(),null);assert.ok(sample(.251).findSlot('slash-fx').getAttachment());assert.equal(sample(.351).findSlot('slash-fx').getAttachment(),null);
close(sample(.251).findSlot('slash-fx').color.a,1,.03);close(sample(.351).findSlot('slash-fx').color.a,0);
for(let i=0;i<=120;i++){const sk=sample(i/200);for(const b of sk.bones)assert.ok([b.a,b.b,b.c,b.d,b.worldX,b.worldY].every(Number.isFinite));}
const start=sample(0),end=sample(.60);for(const b of start.bones){const last=end.findBone(b.data.name);close(wrap(b.rotation-last.rotation),0);close(b.x,last.x);close(b.y,last.y);}
const report={status:'PASSED',durationSeconds:.6,contactSeconds:.3,scalarBezierSegments:scalarCurves,vectorBezierSegments:vectorCurves,finitePoseSamples:121,bodyChainBones:23,bladeWorldAngles:[110,-70],holdWindow:[.30,.38],shakeAmplitude:3,nativeSlashAttachmentAndAlpha:true,headlessRuntime:'Official Spine 4.2.120',unityEditorTested:false,productionChanged:false};fs.writeFileSync(path.dirname(root)+'/validation.json',JSON.stringify(report,null,2));console.log(report);
