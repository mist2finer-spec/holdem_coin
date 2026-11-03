// Render code-defined UI masks/frames over unchanged illustration pixels.
// The same transparent PNGs are consumed by React and Unity uGUI/IMGUI.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const folder=path.join(root,'public/poker/profiles');
const manifest=JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8'));
for(const item of manifest.characters){
 const source=await fs.readFile(path.join(root,'public',item.source));
 const meta=await sharp(source).metadata();
 const [x,y,width]=item.crop,scale=256/width,[cx,cy,rx,ry]=item.headEllipse;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 256 256">
 <defs>
 <linearGradient id="silver" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#f8fafc"/><stop offset=".25" stop-color="#8b929e"/><stop offset=".46" stop-color="#e5e8ed"/><stop offset=".7" stop-color="#555d69"/><stop offset="1" stop-color="#cbd1d9"/></linearGradient>
 <clipPath id="portrait"><circle cx="128" cy="138" r="106"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>
 </defs>
 <circle cx="128" cy="140" r="113" fill="#05070c"/>
 <circle cx="128" cy="137" r="110" fill="#282c36" stroke="url(#silver)" stroke-width="8"/>
 <circle cx="128" cy="138" r="105" fill="#292d36" stroke="#090b11" stroke-width="3"/>
 <image x="${-x*scale}" y="${-y*scale}" width="${meta.width*scale}" height="${meta.height*scale}" clip-path="url(#portrait)" xlink:href="data:image/jpeg;base64,${source.toString('base64')}"/>
 <path d="M22 140 A106 106 0 0 0 234 140" fill="none" stroke="#c9cdd6" stroke-opacity=".38" stroke-width="1.5"/>
 </svg>`;
 await sharp(Buffer.from(svg)).png({palette:true,quality:95,effort:10}).toFile(path.join(root,'public',item.asset));
}
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><radialGradient id="d" cx=".4" cy=".2" r=".8"><stop stop-color="#343a43"/><stop offset="1" stop-color="#070a0e"/></radialGradient></defs><circle cx="64" cy="66" r="61" fill="#000" fill-opacity=".65"/><circle cx="64" cy="62" r="57" fill="url(#d)" stroke="#010205" stroke-width="9"/><circle cx="64" cy="62" r="51" fill="none" stroke="#606975" stroke-opacity=".35" stroke-width="2"/></svg>`)).png().toFile(path.join(folder,'dealer-disc.png'));
console.log(`POKER_PROFILE_ASSETS_READY ${manifest.characters.length} portraits + dealer disc; original faces preserved`);
