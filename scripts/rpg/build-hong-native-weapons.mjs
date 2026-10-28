/** Recover original Cat weapon rigs, then replace cosmetics with HD Hong.
 * Original source channels/constraints remain weapon-specific. No pose guessing.
 */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createCanvas,loadImage} from '@napi-rs/canvas';import {fitHongNativeGeometry} from './fit-hong-native-geometry.mjs';
const archive='archive/rpg/vardian-native-weapons',hong='public/rpg/characters/hong/native-axe',variants=[['sword','Sword','sword07'],['spear','Spear','spear07'],['dual','Dagger','dagger07']];
function selected(raw){const skins=Object.fromEntries(raw.skins.map(s=>[s.name,s])),cos='cos/cos15',skin=structuredClone(skins[cos].attachments);
 for(const [slot,a]of Object.entries(skins['weapon/grade7'].attachments))skin[slot]={...skin[slot],...structuredClone(a)};
 for(const [slot,atts]of Object.entries(skin))for(const [key,a]of Object.entries(atts))if(a.type==='linkedmesh'){const parent=skins[a.skin||'default'].attachments[slot][a.parent];if(parent.type!=='mesh')throw Error('Nested linked mesh');atts[key]={...structuredClone(parent),...(a.path?{path:a.path}:{}),...(a.name?{name:a.name}:{})};}
 const data=structuredClone(raw);data.skins=[{name:'default',attachments:skin}];data.skeleton.images='./parts/';delete data.skeleton.audio;
 for(const a of Object.values(data.animations)){const d=structuredClone(a.attachments?.[cos]??{});if(a.attachments?.['cos/cos0']?.face)d.face=structuredClone(a.attachments['cos/cos0'].face);if(Object.keys(d).length)a.attachments={default:d};else delete a.attachments;}
 return data;
}
function regions(text){const r={};let current;for(const l of text.split(/\r?\n/)){if(l&&!l.includes(':')&&!l.endsWith('.png'))current=r[l]={name:l};else if(current&&l.includes(':')){const [k,v]=l.split(':');current[k]=v;}}return r;}
async function packCat(raw,source,folder){fs.mkdirSync(folder,{recursive:true});const r=regions(fs.readFileSync(source+'.atlas','utf8')),image=await loadImage(source+'.png'),names=new Set();for(const a of Object.values(raw.skins[0].attachments))for(const [key,v]of Object.entries(a))names.add(v.path||v.name||key);
 let x=2,y=2,row=0;const positions=[];for(const n of names){const v=r[n];if(!v?.bounds)throw Error('Missing region '+n);const [sx,sy,w,h]=v.bounds.split(',').map(Number),pw=v.rotate==='90'?h:w,ph=v.rotate==='90'?w:h;if(x+pw+2>256){x=2;y+=row+4;row=0;}positions.push({n,v,sx,sy,w,h,pw,ph,x,y});x+=pw+4;row=Math.max(row,ph);}
 const height=2**Math.ceil(Math.log2(y+row+2)),c=createCanvas(256,height),ctx=c.getContext('2d'),lines=['cat.png',`size:256,${height}`,'filter:Linear,Linear','pma:false'];
 for(const p of positions){ctx.drawImage(image,p.sx,p.sy,p.pw,p.ph,p.x,p.y,p.pw,p.ph);lines.push(p.n,`bounds:${p.x},${p.y},${p.w},${p.h}`);for(const k of ['rotate','offsets','index'])if(p.v[k])lines.push(k+':'+p.v[k]);}
 fs.writeFileSync(folder+'/cat.json',JSON.stringify(raw));fs.writeFileSync(folder+'/cat.atlas',lines.join('\n')+'\n');fs.writeFileSync(folder+'/cat.png',c.toBuffer('image/png'));
}
function addHong(raw){const original=structuredClone(raw),skin=raw.skins[0].attachments;delete skin.tail;delete skin.face;
 for(const a of Object.values(skin))for(const v of Object.values(a))if(v.name?.startsWith('cos15_'))v.name=v.name.replace('cos15_','hong_');
 for(const s of raw.slots)if(['tail','face'].includes(s.name))delete s.attachment;
 function hair(view){const ref=skin.head[view],uv=ref.uvs,v=ref.vertices;const idx=(u,w)=>uv.findIndex((_,i)=>i%2===0&&uv[i]===u&&uv[i+1]===w),p00=idx(0,0),p10=idx(1,0),p01=idx(0,1);if([p00,p10,p01].some(i=>i<0))throw Error('Unsupported head mesh');const at=(u,w)=>[v[p00]+u*(v[p10]-v[p00])+w*(v[p01]-v[p00]),v[p00+1]+u*(v[p10+1]-v[p00+1])+w*(v[p01+1]-v[p00+1])];const span=view==='S_head'?.1:.2;return{name:view==='head'?'hair_front':view==='S_head'?'hair_side':'hair_back',type:'mesh',uvs:[1,1,0,1,0,0,1,0],triangles:[1,2,3,1,3,0],vertices:[...at(1+span,1.90),...at(-span,1.90),...at(-span,0),...at(1+span,0)],hull:4,width:view==='S_head'?35:43,height:57};}
 skin['hong-hair-under']={front:hair('head'),side:hair('S_head')};skin['hong-hair-over']={back:hair('B_head')};
 const oldSlots=original.slots.map(s=>s.name);raw.slots.splice(raw.slots.findIndex(s=>s.name==='Rarm'),0,{name:'hong-hair-under',bone:'head',attachment:'front'});raw.slots.splice(raw.slots.findIndex(s=>s.name==='head'),0,{name:'hong-hair-over',bone:'head'});const newSlots=raw.slots.map(s=>s.name);
 function order(offsets){const draw=Array(oldSlots.length).fill(null),unchanged=[];let index=0;for(const o of offsets??[]){const dest=oldSlots.indexOf(o.slot);while(index<dest)unchanged.push(oldSlots[index++]);draw[index+o.offset]=oldSlots[index++];}while(index<oldSlots.length)unchanged.push(oldSlots[index++]);for(let i=draw.length-1;i>=0;i--)if(draw[i]===null)draw[i]=unchanged.pop();return draw;}
 for(const [name,a]of Object.entries(raw.animations)){delete a.slots?.face;delete a.slots?.tail;if(a.attachments?.default)delete a.attachments.default.face;a.slots??={};const under=[],over=[];for(const k of [{time:0,name:'head'},...(a.slots.head?.attachment??[])]){const v=k.name??'head';under.push({time:k.time??0,name:v==='B_head'?null:v==='S_head'?'side':'front'});over.push({time:k.time??0,name:v==='B_head'?'back':null});}a.slots['hong-hair-under']={attachment:under};a.slots['hong-hair-over']={attachment:over};
 a.drawOrder=[{time:0,offsets:[]},...(original.animations[name].drawOrder??[])].map(k=>{const desired=order(k.offsets);desired.splice(desired.indexOf('Rarm'),0,'hong-hair-under');desired.splice(desired.indexOf('head'),0,'hong-hair-over');return{time:k.time??0,offsets:newSlots.map((slot,i)=>({slot,offset:desired.indexOf(slot)-i}))};});}
 return raw;
}
for(const [weapon,type,region]of variants){const source=archive+'/Hero_'+type+'01',original=JSON.parse(fs.readFileSync(source+'.json')),cat=selected(original),folder=archive+'/cat-'+weapon;await packCat(cat,source,folder);
 const {raw,notes}=fitHongNativeGeometry(addHong(structuredClone(cat))),out='public/rpg/characters/hong/native-'+weapon;fs.mkdirSync(out,{recursive:true});raw.skeleton.hash='hong-native-'+weapon+'-v1-hd';
 const page=await loadImage(hong+'/hong.png'),c=createCanvas(2048,1024),ctx=c.getContext('2d');ctx.drawImage(page,0,0);
 // Axe-specific arm registration must never propagate into the other weapon skins.
 const shared=regions(fs.readFileSync(hong+'/hong.atlas','utf8'));
 for(const name of ['hong_Rarm','hong_B_Rarm']){const [x,y,w,h]=shared[name].bounds.split(',').map(Number);ctx.clearRect(x,y,w,h);ctx.drawImage(await loadImage(hong+'/parts-hd/'+name+'.png'),x,y);}
 ctx.clearRect(8,8,328,688);
 const r=regions(fs.readFileSync(source+'.atlas','utf8'))[region];if(!r||r.rotate)throw Error('Unexpected weapon region');const [x,y,w,h]=r.bounds.split(',').map(Number);if(w!==82||h!==172)throw Error('Weapon dimensions differ');ctx.imageSmoothingEnabled=false;ctx.drawImage(await loadImage(source+'.png'),x,y,w,h,8,8,w*4,h*4);
 fs.writeFileSync(out+'/hong.png',c.toBuffer('image/png'));fs.writeFileSync(out+'/hong.json',JSON.stringify(raw));for(const suffix of ['', '-linear','-nearest'])fs.writeFileSync(out+'/hong'+suffix+'.atlas',fs.readFileSync(hong+'/hong'+suffix+'.atlas','utf8').replaceAll('axe07',region));
 fs.writeFileSync(out+'/manifest.json',JSON.stringify({version:1,rig:'hong-native-'+weapon+'-v1',source:'Hero_'+type+'01',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source+'.json')).digest('hex'),spine:raw.skeleton.spine,costume:'cos/cos15',weapon:'weapon/grade7',weaponRegion:region,bones:raw.bones.length,clips:Object.keys(raw.animations),textureSize:[2048,1024],hairFlutter:false,...notes},null,2));console.log('NATIVE_WEAPON_RECOVERED',weapon,raw.bones.length,Object.keys(raw.animations).length);
}
