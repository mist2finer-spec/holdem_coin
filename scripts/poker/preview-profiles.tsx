// Offline gallery generated from the actual React component, with embedded assets.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {PokerPlayerProfile} from '../../src/components/poker/PokerPlayerProfile';
import roster from '../../public/poker/profiles/manifest.json';
const out=process.argv[2]??'/tmp/poker-profile-preview.html';
const css=fs.readFileSync('src/components/poker/poker-profile.css','utf8');
const markup=renderToStaticMarkup(<main style={{display:'grid',gridTemplateColumns:'repeat(3, 170px)',gap:28,padding:32}}>
 {roster.characters.map(c=><section key={c.id} style={{width:170,['--profile-width' as string]:'170px'}}>
  <PokerPlayerProfile portrait={c.portrait} name={c.label} chips="25,208,035" level={1} dealer blind={c.portrait===7?'SB':undefined}/>
 </section>)}
</main>);
const embedded=markup.replace(/(?:src|href)="(\/poker\/profiles\/[^" ]+\.png)"/g,(match,asset)=>match.replace(asset,'data:image/png;base64,'+fs.readFileSync(path.join('public',asset)).toString('base64')));
fs.writeFileSync(out,`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;background:radial-gradient(ellipse at top,#153f46,#0c1421);color:white}*{box-sizing:border-box}${css}</style>${embedded}</html>`);
console.log(out);
