/** Node 22.18+ (native TypeScript stripping). Validates Unity-only names against live source definitions. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(import.meta.url);
const {ACTIVE_CATALOG,GEMS}=require('../../src/components/rpg/build-catalog.ts');
const {ATTRIBUTE_NOTABLES}=require('../../src/components/rpg/passive-tree.ts');
const {JEWEL_CATALOG}=require('../../src/components/rpg/jewel-catalog.ts');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const catalog=JSON.parse(read('unity/IslandGame/Assets/Island/Resources/RpgCatalog.json'));
const overlayText=read('unity/IslandGame/Assets/Island/Resources/UnityDisplayNames.json');
const names=JSON.parse(overlayText);
let checks=0;
const same=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const ok=(condition,label)=>{assert.ok(condition,label);checks++;};
const keys=object=>Object.keys(object).sort();
const ids=items=>items.map(item=>item.id).sort();

// JSON.parse silently accepts duplicate object keys. Reject them before inspecting dictionaries.
function checkDuplicateKeys(text) {
 const tokens=text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?\d+(?:\.\d+)?|true|false|null/g)??[];
 let at=0;
 function value() {
  const token=tokens[at++];
  if(token==='{') {
   const seen=new Set();
   while(tokens[at]!=='}') {
    const key=JSON.parse(tokens[at++]);ok(!seen.has(key),'duplicate JSON key: '+key);seen.add(key);
    same(tokens[at++],':','JSON property separator');value();
    if(tokens[at]===',')at++;else break;
   }
   same(tokens[at++],'}','JSON object end');
  } else if(token==='[') {
   while(tokens[at]!==']'){value();if(tokens[at]===',')at++;else break;}
   same(tokens[at++],']','JSON array end');
  }
 }
 value();same(at,tokens.length,'all JSON tokens read');
}
checkDuplicateKeys(overlayText);
same(names.schema,1,'overlay schema');
same(names.locale,'ko','Korean display locale');
same(names.sourceDocument,'BIBLICAL-RENAME-008','source document identity');
same(names.scope,'unity-presentation-only','presentation-only scope');
same(keys(names),['schema','locale','scope','sourceDocument','active','support','notableTemplates','tree','jewels','jewelVariants','jewelNotables','jewelDescriptions','transformedNodes','transformedPrefixes','runtimeJewelNames'].sort(),'only approved label fields');
for(const group of ['active','support','notableTemplates','tree','jewels','jewelDescriptions','transformedNodes','transformedPrefixes','runtimeJewelNames'])
 for(const [id,label] of Object.entries(names[group]))ok(typeof label==='string'&&label.trim()===label&&label.length>0,`${group}/${id}: nonempty string label`);
for(const group of ['jewelVariants','jewelNotables'])
 for(const [id,entries] of Object.entries(names[group]))for(const [key,label] of Object.entries(entries))ok(typeof label==='string'&&label.trim()===label&&label.length>0,`${group}/${id}/${key}: string label`);

same(ids(ACTIVE_CATALOG),keys(names.active),'all 35 active IDs');
same(ids(GEMS),keys(names.support),'all 30 support IDs');
same(ACTIVE_CATALOG.length,35,'active definition count');
same(GEMS.length,30,'support definition count');
for(const [group,source] of [['active',ACTIVE_CATALOG],['support',GEMS]]) {
 same(catalog[group].length,source.length,group+' exported count');
 same(catalog[group].map(({color,...entry})=>entry),JSON.parse(JSON.stringify(source)),group+' export preserves mechanics and original names');
 same(new Set(Object.values(names[group])).size,source.length,group+' labels distinguish skills');
}

const templates=Object.values(ATTRIBUTE_NOTABLES).flat();
same(templates.length,60,'60 source notable templates');
same(ids(templates),keys(names.notableTemplates),'all notable template IDs');
const actualNodes=catalog.tree.nodes;
const nodeById=new Map(actualNodes.map(node=>[node.id,node]));
const targets=actualNodes.filter(node=>node.id.startsWith('keystone_')||(node.id.startsWith('attr_')&&node.category==='notable'));
same(keys(names.tree),ids(targets),'only exact generated runtime node IDs');
const seenTemplates=new Set();
for(const node of targets.filter(node=>node.id.startsWith('attr_'))) {
 const [,sectorText,localText]=node.id.split('_'),sector=Number(sectorText),local=Number(localText);
 const zone=[0,1,6].includes(sector)?'STR':[4,5].includes(sector)?'INT':'DEX';
 const pool=ATTRIBUTE_NOTABLES[zone],entry=pool[local%pool.length];
 const suffix=local>=pool.length?' '+(Math.floor(local/pool.length)+1):'';
 same(node.name,entry.name+suffix,node.id+' matches current generator template');
 same(names.tree[node.id],names.notableTemplates[entry.id]+suffix,node.id+' label preserves numbered occurrence');
 for(const [stat,value] of Object.entries(entry.stats))same(node[stat],value,node.id+' preserves '+stat);
 seenTemplates.add(entry.id);
}
same([...seenTemplates].sort(),ids(templates),'every PDF notable template has actual runtime nodes');
const passiveSource=read('src/components/rpg/passive-tree.ts');
const keystoneSection=passiveSource.split('const KEYSTONES:Named[]=[')[1]?.split('\n];')[0];
ok(keystoneSection,'keystone source section found');
const sourceKeystoneIds=[...keystoneSection.matchAll(/named\('([^']+)'/g)].map(match=>'keystone_'+match[1]);
same(sourceKeystoneIds.length,25,'25 source keystones');
same(sourceKeystoneIds.sort(),targets.filter(node=>node.category==='keystone').map(node=>node.id).sort(),'keystone prefix mapping');
const keystoneStats=[...keystoneSection.matchAll(/named\('([^']+)',(?:'[^']*'|"[^"]*"),\{([^}]*)\}/g)];
same(keystoneStats.length,25,'all current keystone stat literals inspected');
for(const [,id,statText] of keystoneStats) {
 const node=nodeById.get('keystone_'+id);
 for(const pair of statText.split(',')) {
  const [key,raw]=pair.split(':').map(value=>value.trim());
  const value=raw==='true'?true:raw==='false'?false:Number(raw);
  ok(typeof value==='boolean'||Number.isFinite(value),id+' stat literal is supported');
  same(node[key],value,id+' preserves '+key);
 }
}
same(names.tree.keystone_bloodless,'생명의 언약','keystone bloodless has its own label');
ok(names.notableTemplates.bloodless!==names.tree.keystone_bloodless,'notable/keystone bloodless collision avoided');
ok(names.notableTemplates.adders_touch!==names.tree.keystone_adders_touch,'notable/keystone adders_touch collision avoided');
for(const id of keys(names.tree))ok(nodeById.has(id),'actual tree ID exists: '+id);

const pdfJewels=JEWEL_CATALOG.filter(jewel=>['timeless','large','unique'].includes(jewel.kind));
same(pdfJewels.length,29,'29 PDF jewels');
same(['timeless','large','unique'].map(kind=>pdfJewels.filter(jewel=>jewel.kind===kind).length),[5,9,15],'PDF jewel category counts');
same(keys(names.jewels),ids(JEWEL_CATALOG),'all 49 current jewel IDs');
same(new Set(Object.values(names.jewels)).size,JEWEL_CATALOG.length,'jewel labels distinguish all current items');
// The published Unity snapshot remains byte-identical to the pre-trial baseline.
// Jewel label coverage is checked against the existing source catalog above/below.
// A full serialized jewel mechanics snapshot is outside this upload.
if(catalog.jewels!==undefined) {
 ok(Array.isArray(catalog.jewels),'optional jewel snapshot must be an array');
 same(catalog.jewels,JSON.parse(JSON.stringify(JEWEL_CATALOG)),'optional jewel export preserves all mechanics');
} else console.log('JEWEL_SNAPSHOT_NOT_INCLUDED: existing Unity baseline preserved; source label coverage checked');
same(keys(names.jewelVariants),ids(JEWEL_CATALOG.filter(jewel=>jewel.variants)),'only actual variant groups');
same(keys(names.jewelNotables),ids(JEWEL_CATALOG.filter(jewel=>jewel.notables)),'only actual cluster notable groups');
let variants=0,clusterNotables=0;
const dynamicNames=new Map();
for(const jewel of JEWEL_CATALOG) {
 same(names.runtimeJewelNames[jewel.name],names.jewels[jewel.id],jewel.id+' dynamic cluster name alias');
 if(jewel.variants) {
  same(keys(names.jewelVariants[jewel.id]),[...jewel.variants].sort(),jewel.id+' uses unchanged stored variant keys');
  variants+=jewel.variants.length;
 }
 if(jewel.notables) {
  same(keys(names.jewelNotables[jewel.id]),jewel.notables.map(notable=>notable.name).sort(),jewel.id+' notable source-name keys');
  for(const notable of jewel.notables) {
   const label=names.jewelNotables[jewel.id][notable.name];
   ok(!dynamicNames.has(notable.name)||dynamicNames.get(notable.name)===label,'unambiguous runtime cluster name: '+notable.name);
   dynamicNames.set(notable.name,label);clusterNotables++;
  }
 }
}
same(variants,15,'15 stored variant display aliases');
same(clusterNotables,27,'27 cluster notable aliases');
same(keys(names.runtimeJewelNames),JEWEL_CATALOG.map(jewel=>jewel.name).sort(),'no stale runtime jewel aliases');

const replacementRules={
 lethalpride:[['Karui','용사']],brutalrestraint:[['Maraketh','광야']],militantfaith:[['Templar','사제']],eleganthubris:[['Eternal','왕의']],
 gloriousvanity:[['Doryani',names.jewelVariants.gloriousvanity.Doryani],['Atziri',names.jewelVariants.gloriousvanity.Atziri],['Xibaqua',names.jewelVariants.gloriousvanity.Xibaqua]],
 watcherseye:[['Hatred',names.active.hatred],['Vitality',names.active.vitality]],
 forbiddenflame:[['Flame/Flesh','불꽃/육신']],forbiddenflesh:[['Flame/Flesh','불꽃/육신']],
};
same(keys(names.jewelDescriptions),keys(replacementRules),'only label substitutions have replacement descriptions');
for(const [id,replacements] of Object.entries(replacementRules)) {
 const source=JEWEL_CATALOG.find(jewel=>jewel.id===id).description;
 let expected=source;for(const [from,to] of replacements)expected=expected.replaceAll(from,to);
 same(names.jewelDescriptions[id],expected,id+' description changes labels only');
 same(names.jewelDescriptions[id].match(/[+-]?\d+(?:\.\d+)?/g),source.match(/[+-]?\d+(?:\.\d+)?/g),id+' description numbers unchanged');
}
const jewelRuntime=read('src/components/rpg/jewel-system.ts');
const transformed=[...jewelRuntime.matchAll(/name=\[(.*?)\]\[choice\]/g)].flatMap(match=>[...match[1].matchAll(/(['"])(.*?)\1/g)].map(token=>token[2]));
same(transformed.length,12,'12 actual timeless transformed names');
same(keys(names.transformedNodes),transformed.sort(),'actual timeless result labels');
same(keys(names.transformedPrefixes),[...JEWEL_CATALOG.find(jewel=>jewel.id==='gloriousvanity').variants].sort(),'actual attribute-transform prefixes');
same(35+30+templates.length+sourceKeystoneIds.length+pdfJewels.length,179,'PDF definition total');

console.log(`UNITY_DISPLAY_NAMES_PASSED checks=${checks}; PDF=179; active=35; support=30; templates=60; runtimeTree=${targets.length}; jewels=49; variants=${variants}; clusterNotables=${clusterNotables}; source mechanics unchanged`);
