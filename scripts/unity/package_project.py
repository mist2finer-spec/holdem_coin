"""Create a prepared project/update ZIP; runtime dependencies are installed by the included official-source repair."""
import argparse,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def package(output):
 project=ROOT/'unity/IslandGame';dest=Path(output);dest.parent.mkdir(parents=True,exist_ok=True)
 if not (project/'Assets/Island/Resources/RpgCatalog.json').is_file():raise RuntimeError('Run prepare_assets.py first')
 files=[]
 for part in ['Assets/Island','Packages','ProjectSettings']:
  for f in (project/part).rglob('*'):
   if f.is_file() and not any(p.startswith('com.esotericsoftware.') for p in f.parts):files.append((f,'IslandGame/'+f.relative_to(project).as_posix()))
 for name in ['README_KO.md','ASSET_LICENSES.md']:files.append((project/name,'IslandGame/'+name))
 for name in ['repair_project.ps1','install_project.ps1']:files.append((ROOT/'scripts/unity'/name,name))
 files.append((ROOT/'docs/unity/INSTALL_CURRENT_KO.md','START_HERE_KO.md'))
 with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for src,name in sorted(files,key=lambda item:item[1]):z.write(src,name)
 with zipfile.ZipFile(dest) as z:
  if z.testzip():raise RuntimeError('ZIP integrity failure')
 print('UNITY_PROJECT_ZIP_READY',dest,len(files),'files',dest.stat().st_size,'bytes')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();package(a.output)
