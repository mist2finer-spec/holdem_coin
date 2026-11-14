"""Export current web assets/catalog into the real Unity project root (never a nested project)."""
import argparse, hashlib, json, shutil, subprocess
from pathlib import Path
from export_poker_profiles import export_profiles
ROOT=Path(__file__).resolve().parents[2]
UI_ROOTS={'public/ui','public/ui-buttons'}
UI_FRAME='public/rpg/FrameCombatArtSkillFrame.png'

def export_ui(project_path):
 """Add shared UI without overwriting local assets, .meta files or gameplay catalogs."""
 project=Path(project_path).expanduser().resolve()
 if not (project/'Assets').is_dir() or not (project/'Packages/manifest.json').is_file():raise RuntimeError('Not a Unity project: '+str(project))
 destination=project/'Assets/Island/Resources';target=destination/'WebAssets'
 sources=sorted(p for root in UI_ROOTS for p in (ROOT/root).rglob('*') if p.is_file() and p.suffix.lower() in {'.png','.jpg','.jpeg','.json'})
 frame=ROOT/UI_FRAME
 if frame.is_file():sources.append(frame)
 if not sources:raise RuntimeError('No shared UI source assets found')
 planned=[];conflicts=[]
 for src in sources:
  out=target/src.relative_to(ROOT/'public');payload=src.read_bytes();digest=hashlib.sha256(payload).hexdigest()
  if out.exists() and (not out.is_file() or out.read_bytes()!=payload):conflicts.append(str(out))
  planned.append((out,payload,{'source':src.relative_to(ROOT).as_posix(),'destination':out.relative_to(destination).as_posix(),'sha256':digest}))
 manifest=destination/'asset-export.json'
 rows=json.loads(manifest.read_text(encoding='utf-8')) if manifest.is_file() else []
 by_path={row['destination']:row for row in rows}
 if len(by_path)!=len(rows):raise RuntimeError('Duplicate destinations in existing asset-export.json')
 for _,_,row in planned:
  old=by_path.get(row['destination'])
  if old is not None and old!=row:conflicts.append('manifest: '+row['destination'])
 if conflicts:raise RuntimeError('Preserving local changes; UI export conflicts: '+str(conflicts))
 added=0
 for out,payload,row in planned:
  if not out.exists():out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(payload);added+=1
  if row['destination'] not in by_path:rows.append(row);by_path[row['destination']]=row
 serialized=json.dumps(rows,indent=2)+'\n'
 if not manifest.is_file() or manifest.read_text(encoding='utf-8')!=serialized:
  manifest.parent.mkdir(parents=True,exist_ok=True);manifest.write_text(serialized,encoding='utf-8')
 print('UNITY_UI_READY',len(planned),'assets;',added,'added; existing files and .meta preserved')
 return rows

def source_commit():
 try:return subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()
 except (OSError,subprocess.CalledProcessError):return 'source-archive'

def prepare(checkout=True,project_path=None,skip_catalog=False):
 project=Path(project_path).expanduser().resolve() if project_path else ROOT/'unity/IslandGame'
 if not (project/'Assets').is_dir() or not (project/'Packages/manifest.json').is_file():raise RuntimeError('Project root must contain Assets and Packages/manifest.json: '+str(project))
 data=json.loads((ROOT/'src/components/rpg/data/labyrinth-runtime.json').read_text(encoding='utf-8'))
 heroes={'axe':'characters/hong/native-axe/hong','sword':'characters/hong/native-sword/hong','dual':'characters/hong/native-dual/hong','spear':'characters/hong/native-spear/hong','unarmed':'characters/hong/native-axe/hong'}
 roots={'public/poker','public/rpg/maps/candle-dungeon','public/audio/poker','public/rpg/weapons'}|UI_ROOTS
 for h in heroes.values():roots.add('public/rpg/'+str(Path(h).parent))
 for a in data['assets'].values():roots.add('public/rpg/'+str(Path(a['skeleton']).parent))
 try:tracked=subprocess.check_output(['git','ls-files','-z','public'],cwd=ROOT,stderr=subprocess.DEVNULL).decode().split('\0')
 except (OSError,subprocess.CalledProcessError):tracked=[p.relative_to(ROOT).as_posix() for p in (ROOT/'public').rglob('*') if p.is_file()]
 selected=[p for p in tracked if p and (any(p.startswith(r+'/') for r in roots) or p==UI_FRAME or (Path(p).parent==Path('public/rpg') and Path(p).name.startswith('SkillIcon_'))) and Path(p).suffix.lower() in {'.png','.jpg','.jpeg','.webp','.json','.atlas','.mp3','.wav','.ogg'} and '/textures/' not in p and not p.endswith('scene.json')]
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
 export_profiles(project)
 print('UNITY_ASSETS_READY',len(rows),str(project))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--no-checkout',action='store_true');p.add_argument('--project-path');p.add_argument('--skip-catalog',action='store_true');p.add_argument('--ui-only',action='store_true',help='Add shared UI only; reject differing local files and preserve .meta/catalog/index');a=p.parse_args()
 if a.ui_only:export_ui(a.project_path or ROOT/'unity/IslandGame')
 else:prepare(not a.no_checkout,a.project_path,a.skip_catalog)
