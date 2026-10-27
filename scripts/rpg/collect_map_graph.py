"""Lossless Unity scene graph export, preserving serialized-file-local PathIDs.
Usage: python collect_map_graph.py --bundle <map_scenes*.bundle> --output <new-dir>
Requires UnityPy (pip install UnityPy). No connection to the original game server.
"""
import argparse,hashlib,json
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
 import UnityPy
 if output.exists():raise FileExistsError('Choose a new output directory')
 output.mkdir(parents=True)
 env=UnityPy.load(str(bundle));records=[];errors=[];assets={}
 for obj in env.objects:
  if obj.type.name not in ['MonoBehaviour','Transform','RectTransform','GameObject','MonoScript']:continue
  serialized=obj.assets_file.name
  ident=identity(bundle.name,serialized,obj.path_id)
  assets.setdefault(serialized,{'externals':[{'path':getattr(e,'path',None),'guid':str(getattr(e,'guid',''))} for e in obj.assets_file.externals]})
  try:
   tree=obj.read_typetree();row={'identity':ident,'type':obj.type.name,'tree':tree}
   dest=output/'objects'/hashlib.sha256(ident['id'].encode()).hexdigest();dest=dest.with_suffix('.json');dest.parent.mkdir(exist_ok=True)
   if dest.exists():raise ValueError('Duplicate qualified Unity identity')
   dest.write_text(json.dumps(row,ensure_ascii=False,default=str)+'\n');records.append({'identity':ident,'type':obj.type.name,'file':str(dest.relative_to(output))})
  except Exception as e:errors.append({'identity':ident,'error':str(e)})
 manifest={'bundle':bundle.name,'sha256':hashlib.sha256(bundle.read_bytes()).hexdigest(),'serializedFiles':assets,'objects':records,'errors':errors,'scope':'Raw graph evidence, not automatic original stage placement. Keep external file table; do not join by PathID alone.'}
 (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');return {'objects':len(records),'errors':len(errors),'serializedFiles':len(assets),'output':str(output)}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--bundle',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();print(json.dumps(collect(a.bundle,a.output)))
