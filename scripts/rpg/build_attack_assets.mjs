/** Slice image_gen atlases into independent attack sheets. No pose synthesis or repainting.
 * Usage: node scripts/rpg/build_attack_assets.mjs /absolute/inputs.json
 * Inputs: {characterId: absoluteGeneratedPngPath}. Originals are copied unchanged.
 */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import sharp from 'sharp';
const root=process.cwd(),inputs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const modes=['unarmed','sword','axe','dual','spear'],CW=512,CH=384,FX=256,FY=352;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function components(data,w,h){
 const seen=new Uint8Array(w*h),out=[],queue=new Int32Array(w*h);
 for(let start=0;start<w*h;start++){
  if(seen[start]||data[start*4+3]<40)continue;
  let first=0,last=1;queue[0]=start;seen[start]=1;let minX=w,minY=h,maxX=0,maxY=0,n=0,sx=0,sy=0;const pixels=[];
  while(first<last){const p=queue[first++],x=p%w,y=Math.floor(p/w);pixels.push(p);n++;sx+=x;sy+=y;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const q=yy*w+xx;if(!seen[q]&&data[q*4+3]>=40){seen[q]=1;queue[last++]=q;}}
  }
  out.push({pixels,n,cx:sx/n,cy:sy/n,minX,minY,maxX,maxY});
 }
 return out;
}
async function extract(filename,id,rowCount=5,rowLimit=1){
 const bytes=fs.readFileSync(filename),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(!data.some((v,i)=>i%4===3&&v===0))throw Error('No alpha '+id);
 const cc=components(data,info.width,info.height).filter(c=>c.cy<info.height*rowLimit),large=cc.filter(c=>c.n>info.width*info.height*.004).sort((a,b)=>b.n-a.n);
 if(large.length!==rowCount*4)throw Error(`${id}: expected${rowCount*4} connected body silhouettes, found${large.length}, counts ${large.map(c=>c.n)}`);
 const rowOrder=large.sort((a,b)=>a.cy-b.cy),bodies=[];
 for(let row=0;row<rowCount;row++)bodies.push(...rowOrder.slice(row*4,row*4+4).sort((a,b)=>a.cx-b.cx));
 const sets=bodies.map(b=>new Set(b.pixels));
 for(const c of cc){if(large.includes(c))continue;const nearest=bodies.map((b,i)=>({i,d:((b.cx-c.cx)/info.width)**2+((b.cy-c.cy)/info.height)**2})).sort((a,b)=>a.d-b.d)[0];for(const p of c.pixels)sets[nearest.i].add(p);}
 // Keep original low-alpha edge pixels; the 40 threshold only separates bodies.
 for(let p=0;p<info.width*info.height;p++){if(data[p*4+3]===0||data[p*4+3]>=40||Math.floor(p/info.width)>=info.height*rowLimit)continue;
  const x=p%info.width,y=Math.floor(p/info.width);let best=0,distance=Infinity;
  for(let i=0;i<bodies.length;i++){const b=bodies[i],d=((b.cx-x)/info.width)**2+((b.cy-y)/info.height)**2;if(d<distance){best=i;distance=d;}}
  sets[best].add(p);
 }
 const cells=[];
 for(let i=0;i<rowCount*4;i++){
  const pts=[...sets[i]],xs=pts.map(p=>p%info.width),ys=pts.map(p=>Math.floor(p/info.width));
  const left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys),width=right-left+1,height=bottom-top+1;
  const raw=Buffer.alloc(width*height*4);
  // Exact source RGBA pixels, including their alpha; no green-screen deletion.
  for(const p of pts){const x=p%info.width-left,y=Math.floor(p/info.width)-top;data.copy(raw,(y*width+x)*4,p*4,p*4+4);}
  const footXs=pts.filter(p=>Math.floor(p/info.width)>=bottom-Math.max(3,height*.035)).map(p=>p%info.width).sort((a,b)=>a-b);
  const foot=footXs[Math.floor(footXs.length/2)]-left;
  cells.push({raw,width,height,foot});
 }
 return {cells,bytes};
}
for(const [id,entry] of Object.entries(inputs)){
 if(process.argv[3]&&process.argv[3]!==id)continue;
 if(!/^[a-z-]+$/.test(id)||!fs.existsSync(`public/rpg/characters/${id}/sheet.png`))throw Error('Unknown character '+id);
 const filename=typeof entry==='string'?entry:entry.atlas;
 const {cells,bytes}=await extract(filename,id,typeof entry==='string'?5:4,typeof entry==='string'?1:.8);
 let override;
 if(typeof entry!=='string'){
  override=await extract(entry.spear,id+'-spear',1,1);
  const factor=cells[0].height/override.cells[0].height;
  for(const c of override.cells){const width=Math.max(1,Math.round(c.width*factor)),height=Math.max(1,Math.round(c.height*factor));
   const raw=await sharp(c.raw,{raw:{width:c.width,height:c.height,channels:4}}).resize(width,height,{kernel:'nearest'}).raw().toBuffer();
   cells.push({raw,width,height,foot:c.foot*factor});
  }
 }
 const scale=Math.min(205/cells[0].height,340/Math.max(...cells.map(c=>c.height)),244/Math.max(...cells.map(c=>c.foot)),244/Math.max(...cells.map(c=>c.width-c.foot)));
 const dest=`public/rpg/characters/${id}/attacks`;fs.mkdirSync(dest,{recursive:true});fs.copyFileSync(filename,dest+'/source-v1.png');
 if(override)fs.copyFileSync(entry.spear,dest+'/source-spear-v1.png');
 const manifest={version:1,format:'weapon-attack-v1',character:id,generator:'built-in image_gen',source:'source-v1.png',sourceSha256:hash(bytes),overrides:override?{spear:{source:'source-spear-v1.png',sha256:hash(override.bytes)}}:undefined,cell:[CW,CH],footAnchor:[FX,FY],facing:'right',animations:{}};
 for(let row=0;row<5;row++){
  const layers=[];const frameHashes=[];
  for(let col=0;col<4;col++){const cell=cells[row*4+col],width=Math.max(1,Math.round(cell.width*scale)),height=Math.max(1,Math.round(cell.height*scale));
   const png=await sharp(cell.raw,{raw:{width:cell.width,height:cell.height,channels:4}}).resize(width,height,{kernel:'nearest'}).png().toBuffer();
   const left=FX-Math.round(cell.foot*scale),top=FY-height;
   if(left<0||left+width>CW||top<0)throw Error(`${id}/${modes[row]}/${col}: clipping, adjust atlas normalization`);
   layers.push({input:png,left:col*CW+left,top});frameHashes.push(hash(png));
  }
  const sheet=await sharp({create:{width:CW*4,height:CH,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();fs.writeFileSync(`${dest}/${modes[row]}.png`,sheet);
  manifest.animations[modes[row]]={sheet:modes[row]+'.png',frames:4,impactFrame:['hong','longhair-man'].includes(id)?1:2,sha256:hash(sheet),frameHashes};
 }
 fs.writeFileSync(dest+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log('ATTACK_SHEETS_BUILT',id);
}
