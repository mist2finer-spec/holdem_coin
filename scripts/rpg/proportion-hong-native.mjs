/** Final proportional retarget, after the deterministic HD/seam pass. */
import fs from 'node:fs';import {execFileSync}from 'node:child_process';import crypto from 'node:crypto';
export const ARM_LENGTH=.92,ARM_THICKNESS=.85;
export const ARM_TRANSLATE_BONES=['Larm2','Rarm2','Rarm3','Rarm4','bone3','bone4','B_wp3'];
const weapons=process.argv.includes('--axe-only')?['axe']:['axe','sword','dual','spear'];
const decode=v=>{let i=0,rows=[];while(i<v.length){const n=v[i++],row=[];for(let j=0;j<n;j++){row.push({bone:v[i],x:v[i+1],y:v[i+2],w:v[i+3]});i+=4;}rows.push(row);}return rows;};
const encode=rows=>rows.flatMap(row=>[row.length,...row.flatMap(v=>[v.bone,v.x,v.y,v.w])]);
for(const weapon of weapons){
 const root=`public/rpg/characters/hong/native-${weapon}`,raw=JSON.parse(fs.readFileSync(root+'/hong.json'));
 if(!raw.skeleton.hash?.endsWith('-seams1'))throw Error('Proportions require a fresh seam pass');
 const bone=n=>raw.bones.find(b=>b.name===n),ids=Object.fromEntries(raw.bones.map((b,i)=>[b.name,i]));
 const thigh=new Set([ids.Rleg,ids.Lleg]),shin=new Set([ids.Rleg2,ids.Lleg2]),feet=new Set([ids.Rleg3,ids.Lleg3]),arms=new Set([ids.Larm,ids.Larm2,ids.Rarm,ids.Rarm2]);
 bone('center').y=31.5;
 for(const n of ['Rleg','Rleg2','Lleg','Lleg2'])bone(n).length=13.8;
 for(const n of ['Rleg2','Lleg2','Rleg3','Lleg3'])bone(n).x=13.8;
 for(const i of arms)raw.bones[i].length*=ARM_LENGTH;
 // Child joints and both foreground grip targets follow the shortened segments.
 for(const n of ['Larm2','Rarm2','Rarm3','Rarm4']){bone(n).x*=ARM_LENGTH;if(bone(n).y)bone(n).y*=ARM_LENGTH;}
 // Rear weapon grips are authored under the torso, rather than under the wrist.
 for(const [n,shoulder]of [['bone3','Larm'],['bone4','Rarm'],['B_wp3','Rarm']])for(const axis of ['x','y'])bone(n)[axis]=(bone(shoulder)[axis]??0)+((bone(n)[axis]??0)-(bone(shoulder)[axis]??0))*ARM_LENGTH;
 // Default IK reach below full extension; the leg-specific native motion survives.
 const kneeReach={};for(const [leg,target]of [['Lleg','Ltarget'],['Rleg','Rtarget']]){
  const hip=bone(leg),t=bone(target),dx=t.x-((bone('center').x??0)+(hip.x??0)),reach=27.6*.97;
  t.y=31.5+(hip.y??0)-Math.sqrt(Math.max(1,reach*reach-dx*dx));kneeReach[leg]={targetY:t.y,reachRatio:.97};
 }
 let legVertices=0,armVertices=0;
 for(const [slot,attachments]of Object.entries(raw.skins[0].attachments))for(const a of Object.values(attachments)){
  if(!['Lleg2','Rleg','Larm','Rarm'].includes(slot)||a.type!=='mesh')continue;
  if(a.vertices.length===a.uvs.length){if(['Larm','Rarm'].includes(slot))for(let i=0;i<a.vertices.length;i+=2){a.vertices[i]*=ARM_LENGTH;a.vertices[i+1]*=ARM_THICKNESS;armVertices++;}continue;}
  const rows=decode(a.vertices);
  for(const row of rows)for(const v of row){
   if(['Lleg2','Rleg'].includes(slot)){
    if(thigh.has(v.bone)){v.x*=.92;v.y*=1.08;legVertices++;}
    else if(shin.has(v.bone)){v.x*=.92;v.y*=1.24;legVertices++;}
    else if(feet.has(v.bone)){v.y*=1.08;legVertices++;}
   }else if(arms.has(v.bone)){v.x*=ARM_LENGTH;v.y*=ARM_THICKNESS;armVertices++;}
  }a.vertices=encode(rows);
 }
 for(const a of Object.values(raw.animations)){
  for(const name of ARM_TRANSLATE_BONES)for(const k of a.bones?.[name]?.translate??[]){
   if(k.x!==undefined)k.x*=ARM_LENGTH;if(k.y!==undefined)k.y*=ARM_LENGTH;
   // Translate Bezier handles contain absolute component values, interleaved with time.
   if(Array.isArray(k.curve))k.curve=k.curve.map((v,i)=>i%2?v*ARM_LENGTH:v);
  }
  for(const slot of ['Larm','Rarm'])for(const timeline of Object.values(a.attachments?.default?.[slot]??{}))for(const k of timeline.deform??[])if(k.vertices)k.vertices=k.vertices.map((v,i)=>v*(((k.offset??0)+i)%2?ARM_THICKNESS:ARM_LENGTH));
 }
 raw.skeleton.hash+='-proportions1';fs.writeFileSync(root+'/hong.json',JSON.stringify(raw));
 const manifest=JSON.parse(fs.readFileSync(root+'/manifest.json'));
 manifest.proportions={revision:1,centerHeight:31.5,legLength:13.8,legAxis:.92,thighThickness:1.08,shinThickness:1.24,ankleThickness:1.08,armLength:ARM_LENGTH,armThickness:ARM_THICKNESS,gripTranslations:ARM_TRANSLATE_BONES,kneeReach,legVertices,armVertices};
 if(manifest.textureUpgrade)manifest.textureUpgrade.geometrySha256=crypto.createHash('sha256').update(fs.readFileSync(root+'/hong.json')).digest('hex');
 manifest.centerHeight=31.5;manifest.legLengths=13.8;fs.writeFileSync(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log('HONG_PROPORTIONS',weapon,{legVertices,armVertices,kneeReach});
}
execFileSync('python3',['scripts/rpg/proportion-hong-textures.py',...weapons],{stdio:'inherit'});
