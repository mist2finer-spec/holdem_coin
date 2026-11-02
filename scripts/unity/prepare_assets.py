"""Export current web assets/catalog into the real Unity project root (never a nested project)."""
import argparse, hashlib, json, shutil, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def source_commit():
 try:return subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()
 except (OSError,subprocess.CalledProcessError):return 'source-archive'

def prepare(checkout=True,project_path=None,skip_catalog=False):
 project=Path(project_path).expanduser().resolve() if project_path else ROOT/'unity/IslandGame'
 if not (project/'Assets').is_dir() or not (project/'Packages/manifest.json').is_file():raise RuntimeError('Project root must contain Assets and Packages/manifest.json: '+str(project))
 data=json.loads((ROOT/'src/components/rpg/data/labyrinth-runtime.json').read_text(encoding='utf-8'))
 heroes={'axe':'characters/hong/native-axe/hong','sword':'characters/hong/native-sword/hong','dual':'characters/hong/native-dual/hong','spear':'characters/hong/native-spear/hong','unarmed':'characters/hong/native-axe/hong'}
 roots={'public/poker','public/rpg/maps/candle-dungeon','public/audio/poker','public/rpg/weapons'}
 for h in heroes.values():roots.add('public/rpg/'+str(Path(h).parent))
 for a in data['assets'].values():roots.add('public/rpg/'+str(Path(a['skeleton']).parent))
 try:tracked=subprocess.check_output(['git','ls-files','-z','public'],cwd=ROOT,stderr=subprocess.DEVNULL).decode().split('\0')
 except (OSError,subprocess.CalledProcessError):tracked=[p.relative_to(ROOT).as_posix() for p in (ROOT/'public').rglob('*') if p.is_file()]
 selected=[p for p in tracked if p and (any(p.startswith(r+'/') for r in roots) or (Path(p).parent==Path('public/rpg') and Path(p).name.startswith('SkillIcon_'))) and Path(p).suffix.lower() in {'.png','.jpg','.webp','.json','.atlas','.mp3','.wav','.ogg'} and '/textures/' not in p and not p.endswith('scene.json')]
 selected=[p for p in selected if not(p.endswith('.png') and p[:-4]+'.webp' in selected)]
 required=[f'public/rpg/{h}.{ext}' for h in set(heroes.values()) for ext in ['json','atlas','png']]
 for a in data['assets'].values():required.extend(f"public/rpg/{a['skeleton']}.{e}" for e in ['json','atlas'])
 if checkout and any(not (ROOT/p).exists() for p in selected):subprocess.run(['git','sparse-checkout','add',*sorted(roots)],cwd=ROOT,check=True)
 destination=project/'Assets/Island/Resources';target=destination/'WebAssets';target.mkdir(parents=True,exist_ok=True)
 missing=[p for p in required if not (ROOT/p).exists()]
 if missing:raise RuntimeError('Missing original assets: '+str(missing[:10]))
 rows=[]
 for name in sorted(selected):
  src=ROOT/name
  if not src.exists():raise FileNotFoundError(name)
  out=target/src.relative_to(ROOT/'public');out.parent.mkdir(parents=True,exist_ok=True)
  if src.suffix=='.webp':
   from PIL import Image
   out=out.with_suffix('.png');Image.open(src).save(out)
  elif src.suffix=='.atlas':out=out.with_suffix('.atlas.txt');shutil.copyfile(src,out)
  else:shutil.copyfile(src,out)
  rows.append({'source':name,'destination':out.relative_to(destination).as_posix(),'sha256':hashlib.sha256(out.read_bytes()).hexdigest()})
 catalog=destination/'RpgCatalog.json'
 if not skip_catalog:
  subprocess.run(['node','--import',str(ROOT/'mini-services/poker-server/node_modules/tsx/dist/loader.mjs'),str(ROOT/'scripts/unity/export_catalog.ts'),str(catalog)],cwd=ROOT,check=True)
 elif not catalog.is_file():
  supplied=ROOT/'unity/IslandGame/Assets/Island/Resources/RpgCatalog.json'
  if not supplied.is_file():raise RuntimeError('No prepared RpgCatalog; run without --skip-catalog from a source checkout.')
  shutil.copyfile(supplied,catalog)
 rows.append({'source':'@current-web-catalog','destination':'RpgCatalog.json','sha256':hashlib.sha256(catalog.read_bytes()).hexdigest()})
 monsters={k:{**data['assets'][v['asset']]} for k,v in data['monsters'].items() if v['asset'] in data['assets']}
 unresolved={k:v['asset'] for k,v in data['monsters'].items() if v['asset'] not in data['assets']}
 index={'schema':3,'sourceCommit':source_commit(),'heroes':heroes,'monsters':monsters,'unresolvedMonsterAssets':unresolved,'catalog':'RpgCatalog','spineRuntime':'4.2','serverAuthority':'existing Node RPG services'}
 (destination/'AssetIndex.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (destination/'asset-export.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
 print('UNITY_ASSETS_READY',len(rows),str(project))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--no-checkout',action='store_true');p.add_argument('--project-path');p.add_argument('--skip-catalog',action='store_true');a=p.parse_args();prepare(not a.no_checkout,a.project_path,a.skip_catalog)
