"""Reproducible export from tracked public assets. No guessed/generated replacement images."""
import argparse,hashlib,json,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def prepare(checkout=True):
 data=json.loads((ROOT/'src/components/rpg/data/labyrinth-runtime.json').read_text())
 heroes={'axe':'characters/hong/native-axe/hong','sword':'characters/hong/native-sword/hong','dual':'characters/hong/native-dual/hong','spear':'characters/hong/native-spear/hong','unarmed':'characters/hong/native-axe/hong'}
 roots={'public/poker','public/rpg/maps/candle-dungeon','public/audio/poker'}
 for h in heroes.values():roots.add('public/rpg/'+str(Path(h).parent))
 for a in data['assets'].values():roots.add('public/rpg/'+str(Path(a['skeleton']).parent))
 tracked=subprocess.check_output(['git','ls-files','-z','public'],cwd=ROOT).decode().split('\0')
 selected=[p for p in tracked if p and any(p.startswith(r+'/') for r in roots) and Path(p).suffix.lower() in {'.png','.jpg','.webp','.json','.atlas','.mp3','.wav','.ogg'} and '/textures/' not in p and not p.endswith('scene.json')]
 selected=[p for p in selected if not(p.endswith('.png') and p[:-4]+'.webp' in selected)]
 # Native map WebP requires conversion: Unity TextureImporter does not load WebP.
 required=[f'public/rpg/{h}.{ext}' for h in set(heroes.values()) for ext in ['json','atlas','png']]
 for a in data['assets'].values():required.extend(f"public/rpg/{a['skeleton']}.{e}" for e in ['json','atlas'])
 if checkout:
  missing=[p for p in selected if not (ROOT/p).exists()]
  if missing:subprocess.run(['git','sparse-checkout','add',*sorted(roots)],cwd=ROOT,check=True)
 destination=ROOT/'unity/IslandGame/Assets/Island/Resources';target=destination/'WebAssets';target.mkdir(parents=True,exist_ok=True)
 missing=[p for p in required if not (ROOT/p).exists()]
 if missing:raise RuntimeError('Missing original assets: '+str(missing[:10]))
 rows=[]
 for name in selected:
  src=ROOT/name
  if not src.exists():raise FileNotFoundError(name)
  out=target/src.relative_to(ROOT/'public');out.parent.mkdir(parents=True,exist_ok=True)
  if src.suffix=='.webp':
   from PIL import Image
   out=out.with_suffix('.png');Image.open(src).save(out)
  elif src.suffix=='.atlas':out=out.with_suffix('.atlas.txt');shutil.copyfile(src,out)
  else:shutil.copyfile(src,out)
  rows.append({'source':name,'destination':str(out.relative_to(destination)),'sha256':hashlib.sha256(out.read_bytes()).hexdigest()})
 monsters={k:{**data['assets'][v['asset']]} for k,v in data['monsters'].items() if v['asset'] in data['assets']}
 unresolved={k:v['asset'] for k,v in data['monsters'].items() if v['asset'] not in data['assets']}
 index={'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'heroes':heroes,'monsters':monsters,'unresolvedMonsterAssets':unresolved}
 (destination/'AssetIndex.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
 (destination/'asset-export.json').write_text(json.dumps(rows,indent=2)+'\n')
 print('UNITY_ASSETS_READY',len(rows))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--no-checkout',action='store_true');a=p.parse_args();prepare(not a.no_checkout)
