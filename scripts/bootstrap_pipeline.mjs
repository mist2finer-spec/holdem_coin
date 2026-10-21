import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(Number(process.versions.node.split('.')[0])<22)throw Error('Node.js 22+ required');
for(const [dir,pkg] of [['.','typescript'],['mini-services/poker-server','tsx']]){
 const base=path.resolve(root,dir);try{createRequire(path.join(base,'package.json')).resolve(pkg);}catch{
  const result=spawnSync('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:base,stdio:'inherit'});if(result.status!==0)process.exit(1);
 }
}
console.log('BOOTSTRAP_PASSED (Node fetch + TypeScript AST + tsx + node:test)');
