/** Export presentation/catalog data from the CURRENT web source. No duplicated rule tables. */
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {ACTIVE_CATALOG,GEMS,CORE_NODES,CORE_EDGES,TREE_BOUNDS} from '../../src/components/rpg/hunt-build';
import {layoutTree,TREE_DISPLAY} from '../../src/components/rpg/tree-layout';
import {EQUIPMENT_LINK_CAPS,EQUIPMENT_LABELS,EQUIPMENT_SLOT_LABELS,EQUIPMENT_RARITIES,createStarterEquipment} from '../../src/components/rpg/idle-equipment';
import {ertelColor,SOCKET_CRAFT_COST} from '../../src/components/rpg/ertel-sockets';
import {GACHA_POLICY,EQUIPMENT_GACHA_WEIGHTS,createGemCollection} from '../../src/components/rpg/idle-gacha';
import {ABILITY_INFO,ABILITY_ORDER} from '../../src/components/rpg/hunt-development';
import growth from '../../src/components/rpg/data/recovered-growth.json';
const target=process.argv[2]??'unity/IslandGame/Assets/Island/Resources/RpgCatalog.json';
const layout=layoutTree(CORE_NODES,TREE_BOUNDS);
const catalog={schema:3,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),authority:'existing Node RPG services',
 active:ACTIVE_CATALOG.map(g=>({...g,color:ertelColor(g.id)})),support:GEMS.map(g=>({...g,color:ertelColor(g.id)})),
 equipment:{slots:EQUIPMENT_SLOT_LABELS,rarities:EQUIPMENT_RARITIES,labels:EQUIPMENT_LABELS,caps:EQUIPMENT_LINK_CAPS,weaponCurve:growth.weaponCurve,armorCurve:growth.armorCurve},
 crafting:{costs:SOCKET_CRAFT_COST,linkChance:.35,colorWeights:{red:.32,green:.32,blue:.32,white:.04},countPolicy:'uniform-inclusive-0-to-cap'},
 gacha:{...GACHA_POLICY,weights:EQUIPMENT_GACHA_WEIGHTS},abilities:ABILITY_ORDER.map(id=>({id,...ABILITY_INFO[id]})),
 tree:{display:TREE_DISPLAY,width:layout.width,height:layout.height,nodes:CORE_NODES.map(n=>({...n,displayX:layout.positions.get(n.id)!.x,displayY:layout.positions.get(n.id)!.y})),edges:CORE_EDGES.map(([from,to])=>({from,to}))},
 starter:{equipment:createStarterEquipment(),gemCollection:createGemCollection()},
};
fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(catalog,null,2)+'\n');
console.log(`UNITY_CATALOG_READY ${ACTIVE_CATALOG.length} active / ${GEMS.length} support / ${CORE_NODES.length} nodes -> ${target}`);
