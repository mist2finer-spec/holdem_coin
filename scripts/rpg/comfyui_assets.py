"""Standalone ComfyUI asset bridge. Python standard library only; no game runtime import."""
import argparse, hashlib, json, os, subprocess, sys, time, uuid
from pathlib import Path
from urllib import request, parse, error
ROOT=Path(__file__).resolve().parents[2]
CONFIG=ROOT/'workflows/comfyui/upstream.json'

def read(path): return json.loads(Path(path).read_text(encoding='utf-8'))
def save(path,value):
 path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def api(base,path,payload=None,content_type='application/json'):
 data=None if payload is None else (json.dumps(payload).encode() if not isinstance(payload,bytes) else payload)
 req=request.Request(base.rstrip('/')+path,data=data,headers={'Content-Type':content_type} if data else {})
 try:
  with request.urlopen(req,timeout=30) as r:return r.read()
 except error.HTTPError as e:raise RuntimeError(f'ComfyUI HTTP {e.code}: '+e.read(4096).decode(errors='replace')) from e

def bootstrap():
 cfg=read(CONFIG);dest=ROOT/'.tools/ComfyUI'
 if not dest.exists():
  dest.parent.mkdir(exist_ok=True)
  subprocess.run(['git','clone','--depth','1',cfg['repository'],str(dest)],check=True)
 if subprocess.check_output(['git','-C',str(dest),'status','--porcelain'],text=True).strip():raise ValueError('ComfyUI checkout has local changes; preserve them before bootstrap.')
 subprocess.run(['git','-C',str(dest),'fetch','--depth','1','origin',cfg['commit']],check=True)
 subprocess.run(['git','-C',str(dest),'checkout','--detach',cfg['commit']],check=True)
 print('COMFYUI_SOURCE_READY',cfg['commit']);print('Install the official GPU-specific PyTorch build and requirements in a separate venv. See docs/rpg/COMFYUI.md.')

def doctor(base):
 stats=json.loads(api(base,'/system_stats'));objects=json.loads(api(base,'/object_info'))
 missing=set(read(ROOT/'workflows/comfyui/img2img.api.json')[k]['class_type'] for k in read(ROOT/'workflows/comfyui/img2img.api.json'))-set(objects)
 if missing:raise ValueError('Missing core nodes: '+', '.join(sorted(missing)))
 checkpoints=objects['CheckpointLoaderSimple']['input']['required']['ckpt_name'][0]
 print(json.dumps({'status':'COMFYUI_CONNECTED','checkpointCount':len(checkpoints),'checkpoints':checkpoints,'devices':stats.get('devices',[])},ensure_ascii=False))

def prepare(args):
 roster=read(ROOT/'public/rpg/characters/roster.json');c=next((c for c in roster if c['id']==args.character),None)
 if c is None:raise ValueError('Unknown character')
 if not args.checkpoint:raise ValueError('--checkpoint must match a checkpoint installed in ComfyUI')
 source=ROOT/'public/rpg/characters'/c['id']/'rig/preview.png'
 graph=read(ROOT/'workflows/comfyui/img2img.api.json')
 graph['4']['inputs']['ckpt_name']=args.checkpoint
 graph['3']['inputs'].update(seed=args.seed,denoise=args.denoise)
 graph['6']['inputs']['text']=f'Preserve the exact identity, face, hairstyle, outfit and proportions of this existing character. Clean game character reference, full body. {args.prompt}'
 graph['9']['inputs']['filename_prefix']='holdem-review/'+c['id']
 save(args.job,{'format':'holdem-comfy-job-v1','character':c['id'],'reference':str(source.relative_to(ROOT)),'referenceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'upstream':read(CONFIG),'workflow':graph})
 print('COMFYUI_JOB_READY',args.job)

def upload(base,source):
 boundary='holdem-'+uuid.uuid4().hex
 body=(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{source.name}"\r\nContent-Type: image/png\r\n\r\n').encode()+source.read_bytes()+f'\r\n--{boundary}--\r\n'.encode()
 return json.loads(api(base,'/upload/image',body,'multipart/form-data; boundary='+boundary))

def run(args):
 job=read(args.job);source=(ROOT/job['reference']).resolve()
 if not source.is_relative_to((ROOT/'public/rpg/characters').resolve()):raise ValueError('Reference must be a roster asset')
 if hashlib.sha256(source.read_bytes()).hexdigest()!=job['referenceSha256']:raise ValueError('Reference changed; prepare again')
 info=upload(args.url,source);graph=job['workflow']
 graph['10']['inputs']['image']='/'.join(filter(None,[info.get('subfolder'),info['name']]))
 queued=json.loads(api(args.url,'/prompt',{'prompt':graph,'client_id':str(uuid.uuid4())}))
 if queued.get('node_errors'):raise ValueError(json.dumps(queued['node_errors']))
 prompt_id=queued['prompt_id'];deadline=time.monotonic()+args.timeout
 while time.monotonic()<deadline:
  entry=json.loads(api(args.url,'/history/'+parse.quote(prompt_id,safe=''))).get(prompt_id)
  if entry:
   status=entry.get('status',{})
   if status.get('status_str')=='error':raise RuntimeError(json.dumps(status.get('messages',[]))[-3000:])
   if status.get('completed'):
    dest=ROOT/'data/comfyui/review'/job['character']/prompt_id;dest.mkdir(parents=True,exist_ok=False)
    outputs=[]
    for node,out in entry.get('outputs',{}).items():
     for i,img in enumerate(out.get('images',[])):
      query=parse.urlencode({k:img[k] for k in ['filename','subfolder','type'] if k in img})
      content=api(args.url,'/view?'+query)
      if not content.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError('Expected PNG review image')
      path=dest/f'{len(outputs):03d}.png';path.write_bytes(content);outputs.append(path.name)
    if not outputs:raise ValueError('Completed workflow produced no images')
    save(dest/'provenance.json',{'job':job,'promptId':prompt_id,'outputs':outputs})
    print('COMFYUI_REVIEW_READY',dest);return
  time.sleep(1)
 raise TimeoutError(f'ComfyUI job {prompt_id} exceeded {args.timeout}s; queued job may still be running. Inspect ComfyUI queue before retrying.')

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default=os.environ.get('COMFYUI_URL','http://127.0.0.1:8188'))
 sub=p.add_subparsers(dest='command',required=True);sub.add_parser('bootstrap');sub.add_parser('doctor')
 q=sub.add_parser('prepare');q.add_argument('--character',required=True);q.add_argument('--checkpoint',required=True);q.add_argument('--prompt',default='');q.add_argument('--seed',type=int,default=42);q.add_argument('--denoise',type=float,default=.25);q.add_argument('--job',default='data/comfyui/job.json')
 q=sub.add_parser('run');q.add_argument('--job',default='data/comfyui/job.json');q.add_argument('--timeout',type=float,default=600)
 a=p.parse_args()
 if a.command=='bootstrap':bootstrap()
 elif a.command=='doctor':doctor(a.url)
 elif a.command=='prepare':
  if not 0<a.denoise<=.5:raise ValueError('Use denoise in (0, 0.5] to limit identity drift')
  prepare(a)
 else:
  if a.timeout<=0:raise ValueError('Timeout must be positive')
  run(a)
if __name__=='__main__':
 try:main()
 except (ValueError,RuntimeError,OSError,KeyError,TimeoutError,subprocess.CalledProcessError) as e:print('COMFYUI_ERROR:',str(e),file=sys.stderr);sys.exit(1)
