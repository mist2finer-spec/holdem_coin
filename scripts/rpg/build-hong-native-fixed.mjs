import fs from 'node:fs';import {createCanvas,loadImage} from '@napi-rs/canvas';import {fitHongNativeGeometry} from './fit-hong-native-geometry.mjs';
const src='archive/rpg/hong-native-v1',out='public/rpg/characters/hong/native-axe';
const {raw,notes}=fitHongNativeGeometry(JSON.parse(fs.readFileSync(src+'/source.json')));
raw.skeleton.hash='hong-native-axe-v2-uv-fit';raw.skeleton.images='./parts/';
const canvas=createCanvas(512,256),ctx=canvas.getContext('2d'),lines=['hong.png','size:512,256','filter:Linear,Linear','pma:false'];let x=2,y=2,row=0;
for(const file of fs.readdirSync(out+'/parts').filter(f=>f.endsWith('.png')).sort()){const im=await loadImage(out+'/parts/'+file);if(x+im.width+2>512){x=2;y+=row+4;row=0;}if(y+im.height+2>256)throw Error('Atlas overflow');ctx.drawImage(im,x,y);lines.push(file.slice(0,-4),`bounds:${x},${y},${im.width},${im.height}`);x+=im.width+4;row=Math.max(row,im.height);}
fs.writeFileSync(out+'/hong.png',canvas.toBuffer('image/png'));fs.writeFileSync(out+'/hong.atlas',lines.join('\n')+'\n');fs.writeFileSync(out+'/hong.json',JSON.stringify(raw));
fs.writeFileSync(out+'/manifest.json',JSON.stringify({version:2,rig:'hong-native-axe-v2',spine:raw.skeleton.spine,bones:raw.bones.length,clips:Object.keys(raw.animations),centerHeight:34,legLengths:15,skirtLift:7,legWeightCap:.25,...notes,hairFlutter:false},null,2));console.log('HONG_NATIVE_FIXED',notes);
