const fs=require('fs'),path=require('path'),crypto=require('crypto');
const repo=path.resolve(__dirname,'..');const requireMini=require('module').createRequire(path.join(repo,'mini-services/poker-server/package.json'));requireMini('tsx/cjs');
const esbuild=requireMini('esbuild'),base=path.join(repo,'src/components/rpg');
const {LABYRINTH}=require(path.join(base,'hunt-labyrinth.ts'));
(async()=>{
const {outputFiles,metafile}=await esbuild.build({entryPoints:[path.join(base,'rogue-stage/client-kernel.ts')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2020',minify:true,metafile:true,plugins:[{name:'server-compiled-loadout',setup(build){
 for(const [name,file]of[['hunt-build','compiled-build'],['hunt-progression','compiled-growth']])build.onResolve({filter:new RegExp('(^|/)'+name+'$')},()=>({path:path.join(base,'rogue-stage',file+'.ts')}));
 build.onResolve({filter:/(^|\/)hunt-labyrinth$/},()=>({path:'labyrinth',namespace:'stage-data'}));build.onLoad({filter:/.*/,namespace:'stage-data'},()=>({contents:'export const LABYRINTH='+JSON.stringify({monsters:LABYRINTH.monsters,ai:LABYRINTH.ai,actions:LABYRINTH.actions})+';',loader:'ts'}));
}}]});
const raw=outputFiles[0].text;
const sha=crypto.createHash('sha256').update(raw).digest('hex');
const out=path.join(repo,'unity/IslandGame/Assets/Island/Resources/RogueStageKernel.js.txt');
const meta=path.join(repo,'src/lib/generated/rogue-stage-kernel.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(path.dirname(meta),{recursive:true});
const metadata=JSON.stringify({protocol:'island-stage-v1',sha256:sha,bytes:Buffer.byteLength(raw),sourceFiles:Object.keys(metafile.inputs).sort()},null,2)+'\n';
if(process.argv.includes('--check')){if(fs.readFileSync(out,'utf8')!==raw||fs.readFileSync(meta,'utf8').replace(/\r\n/g,'\n')!==metadata)throw Error('Stage kernel is stale. Run npm run unity:stage:kernel.');}
else {fs.writeFileSync(out,raw);fs.writeFileSync(meta,metadata);}console.log(JSON.stringify({sha256:sha,bytes:Buffer.byteLength(raw),checked:process.argv.includes('--check')}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
