"""Lossless Unity scene graph export, preserving serialized-file-local PathIDs.
Usage: python collect_map_graph.py --bundle <map_scenes*.bundle> --output <new-dir>
Requires UnityPy (pip install UnityPy). No connection to the original game server.
"""
import argparse,hashlib,json,shutil,tempfile,zipfile
from pathlib import Path

def identity(bundle,serialized_file,path_id):
 return {'bundle':bundle,'serialized_file':serialized_file,'path_id':str(path_id),'id':json.dumps([bundle,serialized_file,str(path_id)],separators=(',',':'))}

def reference_key(source,ref,externals):
 """Return a qualified identity; external files require an explicit caller mapping."""
 pid=str(ref['m_PathID']);fid=ref['m_FileID']
 if pid=='0':return None
 if fid==0:return identity(source['bundle'],source['serialized_file'],pid)
 key=(source['bundle'],source['serialized_file'],fid)
 if key not in externals:raise ValueError('Missing external serialized-file mapping: '+str(key))
 bundle,serialized=externals[key];return identity(bundle,serialized,pid)

def collect(bundle,output):
 # UnityPy retains its input reader. Own the OS handle explicitly so Windows
 # can remove an APK extraction directory even while readers are still referenced.
 with bundle.open("rb") as stream:
  return _collect_stream(bundle,output,stream)

def _collect_stream(bundle,output,stream):
 import UnityPy
 if output.exists():raise FileExistsError('Choose a new output directory')
 output.mkdir(parents=True)
 env=UnityPy.load(stream);records=[];errors=[];assets={};file_keys={}
 for obj in env.objects:
  if obj.type.name not in ['MonoBehaviour','MonoScript','Transform','RectTransform','GameObject']:continue
  file_keys.setdefault(id(obj.assets_file),str(len(file_keys))+':'+obj.assets_file.name)
  serialized=file_keys[id(obj.assets_file)]
  ident=identity(bundle.name,serialized,obj.path_id)
  assets.setdefault(serialized,{'originalName':obj.assets_file.name,'externals':[{'path':getattr(e,'path',None),'guid':str(getattr(e,'guid',''))} for e in obj.assets_file.externals]})
  try:
   tree=obj.read_typetree();row={'identity':ident,'type':obj.type.name,'tree':tree}
   dest=output/'objects'/hashlib.sha256(ident['id'].encode()).hexdigest();dest=dest.with_suffix('.json');dest.parent.mkdir(exist_ok=True)
   if dest.exists():raise ValueError('Duplicate qualified Unity identity')
   dest.write_text(json.dumps(row,ensure_ascii=False,default=str)+'\n',encoding='utf-8');records.append({'identity':ident,'type':obj.type.name,'file':str(dest.relative_to(output))})
  except Exception as e:errors.append({'identity':ident,'error':str(e)})
 containers=[]
 for asset_path,ref in env.container.items():
  try:
   # env.container holds PPtr in current UnityPy; the target reader owns assets_file.
   target=ref.deref() if callable(getattr(ref,'deref',None)) else ref
   target_file=target.assets_file
   file_keys.setdefault(id(target_file),str(len(file_keys))+':'+target_file.name)
   serialized=file_keys[id(target_file)]
   assets.setdefault(serialized,{'originalName':target_file.name,'externals':[{'path':getattr(e,'path',None),'guid':str(getattr(e,'guid',''))} for e in target_file.externals]})
   containers.append({'assetPath':asset_path,'serializedFile':serialized,'originalSerializedName':target_file.name,'pathId':str(target.path_id)})
  except Exception as error:errors.append({'container':asset_path,'error':str(error)})
 manifest={'containers':containers,'bundle':bundle.name,'sha256':hashlib.sha256(bundle.read_bytes()).hexdigest(),'serializedFiles':assets,'objects':records,'errors':errors,'scope':'Raw graph evidence, not automatic original stage placement. Keep external file table; do not join by PathID alone.'}
 (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');return {'objects':len(records),'errors':len(errors),'serializedFiles':len(assets),'output':str(output)}
def collect_apk(apk,output):
 """Read the original map bundle directly from a split APK; never extract arbitrary paths."""
 with zipfile.ZipFile(apk) as archive:
  matches=[r for r in archive.infolist() if Path(r.filename).name.startswith('map_scenes') and r.filename.endswith('.bundle') and not r.is_dir()]
  if len(matches)!=1:raise ValueError(f'Expected one original map_scenes bundle, found {len(matches)}')
  member=matches[0]
  if member.file_size>2*1024**3:raise ValueError('Map bundle exceeds bounded extraction size')
  with tempfile.TemporaryDirectory(prefix='vardian-map-bundle-') as tmp:
   bundle=Path(tmp)/Path(member.filename).name
   with archive.open(member) as src,bundle.open('wb') as dst:shutil.copyfileobj(src,dst)
   result=collect(bundle,output)
 manifest_path=output/'manifest.json';manifest=json.loads(manifest_path.read_text(encoding='utf-8'));
 with apk.open('rb') as stream:apk_hash=hashlib.file_digest(stream,'sha256').hexdigest()
 manifest['sourceApk']={'name':apk.name,'sha256':apk_hash,'member':member.filename};manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');return result

if __name__=='__main__':
 p=argparse.ArgumentParser();source=p.add_mutually_exclusive_group(required=True);source.add_argument('--bundle',type=Path);source.add_argument('--apk',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args();print(json.dumps(collect(a.bundle,a.output) if a.bundle else collect_apk(a.apk,a.output)))
