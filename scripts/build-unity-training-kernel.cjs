const fs=require('fs'),path=require('path'),crypto=require('crypto');
const repo=path.resolve(__dirname,'..'),requireMini=require('module').createRequire(path.join(repo,'mini-services/poker-server/package.json'));
(async()=>{
 const {outputFiles,metafile}=await requireMini('esbuild').build({entryPoints:[path.join(repo,'src/lib/training-client-kernel.ts')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2020',minify:true,metafile:true});
 const raw=outputFiles[0].text,sha256=crypto.createHash('sha256').update(raw).digest('hex');
 const dir=path.join(repo,'docs/unity/client-source-snapshot/2026-11-09-local/Resources');fs.mkdirSync(dir,{recursive:true});
 const output=path.join(dir,'TrainingCombatKernel.js.txt'),metadata=path.join(dir,'TrainingCombatKernel.manifest.json');
 const manifest=JSON.stringify({protocol:'island-training-local-v1',sha256,bytes:Buffer.byteLength(raw),sourceFiles:Object.keys(metafile.inputs).sort()},null,2)+'\n';
 if(process.argv.includes('--check')){if(fs.readFileSync(output,'utf8')!==raw||fs.readFileSync(metadata,'utf8')!==manifest)throw Error('Stale training combat bundle');}
 else{fs.writeFileSync(output,raw);fs.writeFileSync(metadata,manifest);}
 console.log(JSON.stringify({sha256,bytes:Buffer.byteLength(raw),checked:process.argv.includes('--check')}));
})().catch(e=>{console.error(e);process.exitCode=1});
