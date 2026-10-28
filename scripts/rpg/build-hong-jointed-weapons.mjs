/** Hong joint export: compact authored combos informed by native Knight numeric motion.
 * Server owns damage. Source Knight has one sword attack; combo variations are newly authored. */
import fs from 'node:fs';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import * as R from '@esotericsoftware/spine-canvas';
const input='archive/rpg/hong-authoring/jointed-parts-v8-3',out='public/rpg/characters/hong/spine';
const base=JSON.parse(fs.readFileSync(input+'/rig/hong.json')),ref=JSON.parse(fs.readFileSync(input+'/knight-motion.json'));
R.Skeleton.yDown=false;const raw=structuredClone(base),bodyNames=JSON.parse(fs.readFileSync(input+'/parts-manifest.json')).partNames;
raw.skeleton.hash='hong-jointed-weapons-v9';delete raw.skeleton.images;
raw.bones.find(b=>b.name==='weapon').name='weapon-front';raw.bones.push({name:'weapon-back',parent:'far-hand',x:7},{name:'spear-support-target',parent:'weapon-front',y:-19});
raw.ik.push({name:'spear-support',order:2,bones:['far-upper-arm','far-forearm'],target:'spear-support-target',mix:0,bendPositive:true});
raw.transform=[{name:'spear-palm-axis',order:3,bones:['far-hand'],target:'weapon-front',rotation:90,mixRotate:0,mixX:0,mixY:0,mixScaleX:0,mixScaleY:0,mixShearY:0}];
raw.slots=raw.slots.map(s=>s.name==='weapon'?{name:'weapon-front',bone:'weapon-front'}:s);
raw.slots.splice(raw.slots.findIndex(s=>s.name==='far-hand'),0,{name:'weapon-back',bone:'weapon-back'});
const art={};for(const f of fs.readdirSync(input+'/rig/parts').filter(f=>f.endsWith('.png')))art[f.slice(0,-4)]=await loadImage(input+'/rig/parts/'+f);
const canvas=createCanvas(512,512),ctx=canvas.getContext('2d');let x=4,y=4,rh=0;const lines=['hong.png','size:512,512','format:RGBA8888','filter:Nearest,Nearest','repeat:none','pma:false'];
for(const[n,img]of Object.entries(art)){if(x+img.width+4>512){x=4;y+=rh+8;rh=0;}if(y+img.height+4>512)throw Error('Atlas overflow');ctx.drawImage(img,x,y);lines.push(n,`bounds:${x},${y},${img.width},${img.height}`);x+=img.width+8;rh=Math.max(rh,img.height);}
fs.writeFileSync(out+'/hong.png',canvas.toBuffer('image/png'));for(const n of ['hong.atlas','hong.atlas.txt'])fs.writeFileSync(out+'/'+n,lines.join('\n')+'\n');
const gear={sword:['held-sword',34,68],axe:['held-axe',42,61],dual:['held-dual',25.145,47.0788],spear:['held-spear',48.0803,70.1207]};
raw.skins=['unarmed','sword','axe','dual','spear'].map(type=>{const a=Object.fromEntries(bodyNames.map(n=>[n,structuredClone(base.skins[0].attachments[n])]));
 if(type!=='unarmed'){const[n,px,py]=gear[type],g=art[n],att={type:'region',path:n,width:g.width,height:g.height,x:g.width/2-px,y:py-g.height/2};a['weapon-front']={[n]:att};if(type==='dual')a['weapon-back']={[n]:structuredClone(att)};}return{name:type,attachments:a};});
raw.animations={};
const atlas=new R.TextureAtlas(lines.join('\n'));for(const p of atlas.pages)p.setTexture(new R.CanvasTexture({width:512,height:512}));
const loader=new R.SkeletonJson(new R.AtlasAttachmentLoader(atlas)),data=loader.readSkeletonData(raw),baseData=loader.readSkeletonData(base);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),wrap=n=>((n+180)%360+360)%360-180,rad=n=>n*Math.PI/180,deg=n=>n*180/Math.PI,axis=b=>deg(Math.atan2(b.c,b.a)),round=n=>+n.toFixed(6),smooth=n=>{n=clamp(n,0,1);return n*n*(3-2*n)};
const update=s=>s.updateWorldTransform(R.Physics.pose);
function world(s,n,a){const b=s.findBone(n);b.rotation=a-(b.parent?axis(b.parent):0);update(s);}
function sample(n,u){const c=ref.clips[n];return c.samples[Math.round(clamp(u,0,1)*(c.samples.length-1))].bones;}
function basePose(n,u,type){const src=new R.Skeleton(baseData),a=baseData.findAnimation(n);src.setSkinByName('unarmed');src.setSlotsToSetupPose();a.apply(src,0,a.duration*u,false,[],1,R.MixBlend.replace,R.MixDirection.mixIn);update(src);
 const s=new R.Skeleton(data);s.setSkinByName(type);s.setSlotsToSetupPose();for(const b of s.bones){const from=src.findBone(b.data.name);if(from)for(const k of ['x','y','rotation','scaleX','scaleY','shearX','shearY'])b[k]=from[k];}
 for(const c of s.ikConstraints)c.mix=c.data.name==='spear-support'?0:1;for(const c of s.transformConstraints)c.mixRotate=0;
 s.findSlot('weapon-front').setAttachment(type==='unarmed'?null:s.getAttachmentByName('weapon-front',gear[type][0]));
 s.findSlot('weapon-back').setAttachment(type==='dual'?s.getAttachmentByName('weapon-back','held-dual'):null);s.findSlot('shield').setAttachment(null);update(s);return s;
}
const contacts={},manifest={version:9,bodyParts:16,bones:raw.bones.length,base:'TRUE JOINT RIG v8.3',heroVisualScale:1.25,secondaryGripRange:[4,24],method:'Knight has one sword_attack, not a source combo. Four sword/three axe/five dual/four spear attacks are authored compact variants. Native buff_1/2/3 torso and arm deltas drive skills.',animations:{}};
raw.animations={};
function pose(d,u){
 const attack=d.action.startsWith('attack'),skill=d.action.startsWith('skill'),stage=Number(d.action.replace(/\D/g,''))||1;
 const src=attack?(d.type==='unarmed'?'unarmed-attack'+stage:'idle'):['run1','dash'].includes(d.action)?'run':d.action==='walk'?'walk':'idle';
 const s=basePose(src,u,d.type),hip=s.findBone('pelvis'),torso=s.findBone('torso');let near=[-105,10,0],far=[-65,35,0],weapon=-20,backWeapon=20;
 if(attack&&d.type!=='unarmed'){
  const hit=d.contact/d.duration,hold=.075/d.duration;
  const w=u<hit-.10?0:u<hit?smooth((u-hit+.10)/.10):u<hit+hold?1:1-smooth((u-hit-hold)/(1-hit-hold)),wind=u<hit?smooth(u/hit)*(1-w):0;
  const b=sample('sword_attack',u),b0=sample('sword_attack',0);
  hip.x+=(d.type==='spear'?10:stage===4?8:5)*w-2*wind;torso.rotation+=clamp(wrap(b.body2.axis-b0.body2.axis)*.18,-8,8)-6*w;update(s);
  if(d.type==='sword'){
   const p=[[-12,-10],[-25,15],[-8,-8],[-38,-40],[-25,-20]][stage-1];
   near=[-105+(105+p[0])*w-8*wind+clamp(wrap(b.shoulder_L.axis-b0.shoulder_L.axis)*.18,-15,15),10+(p[1]-10)*w+80*wind,0];
   weapon=wrap(b.sword.axis-90)+(stage===2?55:stage===3?-20:stage===4?-40:0);if(stage===3)weapon=-90+15*wind;
  }else if(d.type==='axe'){near=[-105+75*w-10*wind,10-65*w+100*wind,0];weapon=40+100*wind-190*w+(stage-1)*12;
  }else if(d.type==='dual'){
   const lead=stage%2===1?near:far,other=stage%2===1?far:near;lead[0]=-105+90*w-12*wind;lead[1]=10-35*w+65*wind;other[0]=-65-25*w;other[1]=35+35*w;
   if(stage===5){near=[-105+87*w,10-20*w,0];far=[-65+40*w,35-30*w,0];}
   weapon=(stage%2?45:-130)+(stage%2?-180:165)*w+25*wind;backWeapon=(stage%2?-130:45)+(stage%2?165:-180)*w-25*wind;
  }else if(d.type==='spear'){const h=stage===2?10:stage===3?-25:-5;near=[-105+(105+h)*w,10+(h-10)*w+25*wind,0];weapon=stage===4?-20-140*w:-90+h+12*wind;}
 }else if(skill){
  const n=['buff_1','buff_2','buff_3'][(stage-1)%3],b=sample(n,u),b0=sample(n,0);
  torso.rotation+=clamp(wrap(b.body2.axis-b0.body2.axis)*.35,-12,12);hip.y+=clamp((b.body.y-b0.body.y)*.10,-3,4);
  near=[-105+clamp(wrap(b.shoulder_L.axis-b0.shoulder_L.axis)*.5,-40,70),10+clamp(wrap(b.arm_L.axis-b0.arm_L.axis)*.5,-40,75),0];
  far=[-65+clamp(wrap(b.shoulder_R.axis-b0.shoulder_R.axis)*.5,-50,65),35+clamp(wrap(b.arm_R.axis-b0.arm_R.axis)*.5,-45,75),0];weapon=-25+Math.sin(u*Math.PI)*45;backWeapon=-weapon;
 }else if(d.action==='avoid1'){const w=Math.sin(Math.PI*u);hip.y-=9*w;torso.rotation-=20*w;hip.x+=6*w;
 }else if(d.action==='defeat1')torso.rotation+=12*Math.sin(Math.PI*u);
 else if(d.action==='die1'){hip.y-=25*Math.min(1,u*2);hip.rotation=-55*Math.min(1,u*2);
 }else if(d.action==='victory1'){near=[-120,-15+65*Math.sin(Math.PI*u),0];far=[-55,65,0];}
 if(d.type==='unarmed'&&attack||d.type!=='spear'&&['run1','dash','walk'].includes(d.action)){near=null;far=null;}
 if(d.type==='spear'&&!attack&&!skill){near=[-80,-10,0];far=[-65,35,0];weapon=-90;}
 update(s);if(near)for(const[side,a]of[['near',near],['far',far]]){world(s,side+'-upper-arm',clamp(a[0],-150,5));world(s,side+'-forearm',a[1]);world(s,side+'-hand',a[2]);}
 world(s,'head',0);if(d.type!=='unarmed'){world(s,'weapon-front',weapon);if(d.type==='dual')world(s,'weapon-back',backWeapon);}
 if(d.type==='spear'){
  const originalFore=axis(s.findBone('near-forearm')),weaponAngle=axis(s.findBone('weapon-front'));
  function candidate(){
   const g=s.findBone('weapon-front'),shaft=rad(axis(g)+90),upper=s.findBone('far-upper-arm');let best={grip:12,score:Infinity,error:Infinity};
   for(let v=4;v<=24;v+=.25){const dx=g.worldX-Math.cos(shaft)*(v+7)-upper.worldX,dy=g.worldY-Math.sin(shaft)*(v+7)-upper.worldY,distance=Math.hypot(dx,dy),error=Math.max(0,distance-29.5)+Math.max(0,6-distance),score=error*1000+Math.abs(v-12);if(score<best.score)best={grip:v,score,error};}
   return best;
  }
  let best=candidate(),chosen=originalFore;
  // Retarget the lead elbow slightly when both hands cannot physically reach the same shaft.
  if(best.error>.0001){
   outer:for(let offset=2;offset<=90;offset+=2)for(const sign of [-1,1]){
    const a=originalFore+offset*sign;world(s,'near-forearm',a);world(s,'near-hand',0);world(s,'weapon-front',weaponAngle);
    const test=candidate();if(test.score<best.score){best=test;chosen=a;}if(test.error<.0001){best=test;chosen=a;break outer;}
   }
   world(s,'near-forearm',chosen);world(s,'near-hand',0);world(s,'weapon-front',weaponAngle);
  }
  const grip=best.grip;
  s.findBone('spear-support-target').y=-grip-7;
  s.findIkConstraint('spear-support').mix=1;s.findTransformConstraint('spear-palm-axis').mixRotate=1;update(s);
 }

 const v=new Float32Array(8),h=new Float32Array(8);s.findSlot('hair-back').getAttachment().computeWorldVertices(s.findSlot('hair-back'),v,0,2);s.findSlot('head').getAttachment().computeWorldVertices(s.findSlot('head'),h,0,2);
 const excess=Math.max(v[1],v[3],v[5],v[7])-Math.max(h[1],h[3],h[5],h[7])+2;if(excess>0){s.findBone('hair-back').y-=excess;update(s);}return s;
}
function reduce(keys,props,tolerance){
 if(keys.every(k=>props.every(p=>Math.abs(k[p]-keys[0][p])<1e-6)))return [keys[0]];
 const keep=new Set([0,keys.length-1]);
 function visit(a,b){let score=0,index=-1;for(let i=a+1;i<b;i++){const t=(keys[i].time-keys[a].time)/(keys[b].time-keys[a].time);const e=Math.max(...props.map(p=>Math.abs(keys[i][p]-(keys[a][p]+t*(keys[b][p]-keys[a][p])))));if(e>score){score=e;index=i;}}
 if(score>tolerance){keep.add(index);visit(a,index);visit(index,b);}}
 visit(0,keys.length-1);return [...keep].sort((a,b)=>a-b).map(i=>keys[i]);
}
function bake(d){
 const name=d.type==='unarmed'?d.action:d.type+'-'+d.action,n=Math.ceil(d.duration*60),times=new Set(Array.from({length:n+1},(_,i)=>round(i*d.duration/n)));if(d.contact!==null)times.add(d.contact);
 const samples=[...times].sort((a,b)=>a-b).map(t=>({t,s:pose(d,t/d.duration)})),a={bones:{},slots:{'weapon-front':{attachment:[{time:0,name:d.type==='unarmed'?null:gear[d.type][0]}]},'weapon-back':{attachment:[{time:0,name:d.type==='dual'?'held-dual':null}]},shield:{attachment:[{time:0,name:null}]}},ik:{'near-leg-ik':[{mix:1,bendPositive:false}],'far-leg-ik':[{mix:1,bendPositive:false}],'spear-support':[{mix:d.type==='spear'?1:0,bendPositive:true}]},transform:{'spear-palm-axis':[{mixRotate:d.type==='spear'?1:0,mixX:0,mixY:0,mixScaleX:0,mixScaleY:0,mixShearY:0}]}};
 for(const b of raw.bones){const k={rotate:[],translate:[],scale:[],shear:[]};for(const{t,s}of samples){const v=s.findBone(b.name),rest=v.data;k.rotate.push({time:t,value:round(v.rotation-rest.rotation)});k.translate.push({time:t,x:round(v.x-rest.x),y:round(v.y-rest.y)});k.scale.push({time:t,x:v.scaleX,y:v.scaleY});k.shear.push({time:t,x:v.shearX,y:v.shearY});}
 for(let i=1;i<k.rotate.length;i++)k.rotate[i].value=round(k.rotate[i-1].value+wrap(k.rotate[i].value-k.rotate[i-1].value));for(const kind of Object.keys(k)){
 const props=kind==='rotate'?['value']:['x','y'],defaultValue=kind==='scale'?1:0;
 if(k[kind].every(v=>props.every(p=>Math.abs(v[p]-defaultValue)<1e-6)))delete k[kind];
 else k[kind]=reduce(k[kind],props,kind==='rotate'?.01:.001);
 }
 if(Object.keys(k).length)a.bones[b.name]=k;}
 if(d.contact!==null){a.events=[{time:d.contact,name:'hit-window',int:d.action.startsWith('skill')?0:Number(d.action.replace(/\D/g,''))}];contacts[name]=d.contact;}
 raw.animations[name]=a;manifest.animations[name]={...d,source:d.action.startsWith('skill')?['Knight buff_1','Knight buff_2','Knight buff_3'][(Number(d.action.slice(5))-1)%3]:d.type==='sword'?'Knight sword_attack with authored combo variation':d.type==='dual'?'Alternating hand chain':d.type==='spear'?'Live off-hand shaft IK plus palm-axis constraint':'v8.3 joint adaptation'};
}
for(const type of ['unarmed','sword','axe','dual','spear']){
 for(const[action,duration]of[['stay1',1.2],['walk',1.2],['run1',.8],['dash',.55],['avoid1',.55],['defeat1',.45],['die1',.8],['victory1',1.2]])bake({type,action,duration,contact:null});
 for(let i=1;i<=5;i++){const duration=type==='dual'?.44+i*.025:type==='axe'?.72+i*.05:type==='spear'?.60+i*.035:type==='sword'?.62+i*.035:[.5,.56,.66,.60,.74][i-1];bake({type,action:'attack'+i,duration,contact:type==='unarmed'?[.20,.23,.28,.25,.31][i-1]:round(duration*.5667/1.4)});}
 for(let i=1;i<=6;i++){const duration=[1,1.15,1.2][(i-1)%3];bake({type,action:'skill'+i,duration,contact:round(duration*.45)});}
}
fs.writeFileSync(out+'/hong.json',JSON.stringify(raw));fs.writeFileSync(out+'/manifest.json',JSON.stringify(manifest,null,2));fs.writeFileSync('src/components/rpg/data/hong-runtime-motion.json',JSON.stringify(contacts,null,2));console.log('HONG_JOINTED_V9',raw.bones.length,'bones',Object.keys(raw.animations).length,'clips');
