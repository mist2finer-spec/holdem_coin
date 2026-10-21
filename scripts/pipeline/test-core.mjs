import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyDiff,contextFor} from './core.mjs';
test('patches require unique matches, allowed paths and strict blocks',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'diff-test-'));
 try{
 fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src/test.ts'),'export function answer(){return 1;}\n');
 const allowed=new Set(['src/test.ts']);const diff='src/test.ts\n<<<<<<< SEARCH\nreturn 1;\n=======\nreturn 2;\n>>>>>>> REPLACE\n';
 assert.equal(applyDiff(root,diff,allowed),1);assert.match(fs.readFileSync(path.join(root,'src/test.ts'),'utf8'),/return 2/);
 assert.throws(()=>applyDiff(root,diff,allowed),/exactly once/);
 assert.throws(()=>applyDiff(root,'explanation\n'+diff,allowed),/Only SEARCH/);
 assert.throws(()=>applyDiff(root,diff.replace('src/test.ts','../.env'),allowed),/Unlisted/);
 assert.match(contextFor(root,['src/test.ts#answer']).context,/function answer/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
