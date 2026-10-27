"""Z-Image Turbo prompt-only generator. Python standard library; local ComfyUI."""
import argparse,json,struct,time,urllib.request,urllib.error,uuid,sys
from pathlib import Path

VAE_URL='https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors'
DEFAULT_PROMPT='''One adult female fantasy RPG character named Hong, full body, solo.
Very long straight black hair, blunt bangs, violet eyes. Black high-neck
cold-shoulder cropped top, detached long black sleeves, black pleated mini skirt,
black belts and thigh straps, dark thigh-high stockings, black combat boots.
Three-quarter side view facing right, neutral battle-ready standing pose,
arms slightly separated from the torso, both hands visible and relaxed,
both feet fully visible, no weapon. Clean detailed 2D anime game illustration,
consistent anatomy, clear silhouette, plain light gray background,
no scenery, no ground shadow, no lettering, no watermark.
No ponytails, no fox ears, no tail, no jacket, no dress. One character only.'''

def request(server,path,body=None,timeout=30):
    data=None if body is None else json.dumps(body).encode('utf8')
    req=urllib.request.Request(server.rstrip('/')+path,data=data,headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:return json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'HTTP {e.code} {path}: {e.read().decode("utf8",errors="replace")[-3000:]}') from e


def ensure_vae(base,download):
    target=base/'ComfyUI/models/vae/ae.safetensors'
    if target.is_file() and target.stat().st_size>1024*1024:return target
    if not download:raise RuntimeError(f'Missing {target}. Run with --download-vae.')
    target.parent.mkdir(parents=True,exist_ok=True)
    partial=target.with_suffix('.safetensors.partial')
    print('Downloading official ae.safetensors (about 320 MB); existing models are preserved.',flush=True)
    with urllib.request.urlopen(VAE_URL,timeout=120) as r,partial.open('wb') as out:
        length=int(r.headers.get('Content-Length',0));done=0;next_report=32*1024*1024
        while True:
            chunk=r.read(1024*1024)
            if not chunk:break
            out.write(chunk);done+=len(chunk)
            if done>=next_report:print(f'  {done//1048576} MB',flush=True);next_report+=32*1024*1024
        if length and done!=length:raise RuntimeError('Incomplete VAE download; rerun.')
    with partial.open('rb') as f:
        raw=f.read(8)
        if len(raw)!=8:raise RuntimeError('Invalid safetensors header')
        header_size=struct.unpack('<Q',raw)[0]
        if not 2<header_size<64*1024*1024:raise RuntimeError('Invalid safetensors header size')
        header=json.loads(f.read(header_size))
        if not isinstance(header,dict) or done<1024*1024:raise RuntimeError('Invalid VAE file')
    partial.replace(target);print('VAE downloaded.',flush=True);return target


def graph(args):
    return {
      '1':{'class_type':'UNETLoader','inputs':{'unet_name':'z_image_turbo_bf16.safetensors','weight_dtype':'default'}},
      '2':{'class_type':'ModelSamplingAuraFlow','inputs':{'model':['1',0],'shift':3.0}},
      '3':{'class_type':'CLIPLoader','inputs':{'clip_name':'qwen_3_4b.safetensors','type':'lumina2','device':'default'}},
      '4':{'class_type':'CLIPTextEncode','inputs':{'clip':['3',0],'text':args.prompt}},
      '5':{'class_type':'ConditioningZeroOut','inputs':{'conditioning':['4',0]}},
      '6':{'class_type':'VAELoader','inputs':{'vae_name':'ae.safetensors'}},
      '7':{'class_type':'EmptySD3LatentImage','inputs':{'width':args.width,'height':args.height,'batch_size':1}},
      '8':{'class_type':'KSampler','inputs':{'model':['2',0],'positive':['4',0],'negative':['5',0],
          'latent_image':['7',0],'seed':args.seed,'steps':args.steps,'cfg':1.0,
          'sampler_name':'res_multistep','scheduler':'simple','denoise':1.0}},
      '9':{'class_type':'VAEDecode','inputs':{'samples':['8',0],'vae':['6',0]}},
      '10':{'class_type':'SaveImage','inputs':{'images':['9',0],'filename_prefix':'hong_prompt/hong'}}}


def validate_graph(g,objects):
    for node in g.values():
        typ=node['class_type']
        if typ not in objects:raise RuntimeError(f'Missing built-in node: {typ}. Update ComfyUI first.')
        fields=objects[typ]['input'].get('required',{})
        for key,spec in fields.items():
            if key not in node['inputs']:
                opts=spec[1] if len(spec)>1 and isinstance(spec[1],dict) else {}
                if 'default' in opts:node['inputs'][key]=opts['default']
                elif typ=='ModelSamplingAuraFlow' and key=='sampling' and isinstance(spec[0],list) and 'flow' in spec[0]:node['inputs'][key]='flow'
                else:raise RuntimeError(f'Unrecognized required input {typ}.{key}; export /object_info for diagnosis.')
            value=node['inputs'][key]
            if isinstance(spec[0],list) and not isinstance(value,list) and value not in spec[0]:
                raise RuntimeError(f'{typ}.{key}={value!r} not available. Choices: {spec[0]}')


def run(args):
    if args.width%16 or args.height%16 or min(args.width,args.height)<64:raise ValueError('Width/height must be multiples of 16 and >=64')
    if not 1<=args.steps<=100 or not 0<=args.seed<2**64:raise ValueError('Invalid steps/seed')
    ensure_vae(args.base,args.download_vae)
    try:objects=request(args.server,'/object_info')
    except Exception as e:raise RuntimeError('Start ComfyUI and leave its terminal open at '+args.server+'\n'+str(e)) from e
    if args.prompt_file:args.prompt=args.prompt_file.read_text(encoding='utf-8-sig').strip()
    if not args.prompt.strip():raise ValueError('Empty prompt')
    g=graph(args);validate_graph(g,objects)
    out=args.base/'hong_jobs'/time.strftime('%Y%m%d-%H%M%S')
    out=out.with_name(out.name+'-'+uuid.uuid4().hex[:6]);out.mkdir(parents=True)
    (out/'workflow.api.json').write_text(json.dumps(g,indent=2,ensure_ascii=False),encoding='utf8')
    (out/'prompt.txt').write_text(args.prompt,encoding='utf8')
    if args.check_only:print('CHECK_PASSED; workflow saved at '+str(out));return
    reply=request(args.server,'/prompt',{'prompt':g,'client_id':str(uuid.uuid4())})
    if reply.get('node_errors'):raise RuntimeError(json.dumps(reply['node_errors'],ensure_ascii=False))
    pid=reply.get('prompt_id')
    if not pid:raise RuntimeError('No prompt_id: '+str(reply))
    (out/'submission.json').write_text(json.dumps(reply,indent=2),encoding='utf8')
    print('Queued '+pid+'; first load can be very slow on 4GB VRAM.',flush=True)
    print('Native output: '+str(args.base/'ComfyUI/output/hong_prompt'),flush=True)
    started=time.monotonic();last_report=0
    while time.monotonic()-started<args.timeout:
        history=request(args.server,'/history/'+pid);entry=history.get(pid)
        if entry:
            (out/'history.json').write_text(json.dumps(entry,indent=2,ensure_ascii=False),encoding='utf8')
            status=entry.get('status',{})
            if status.get('status_str')=='error':
                raise RuntimeError('ComfyUI execution failed: '+json.dumps(status.get('messages',[]),ensure_ascii=False)[-3000:])
            images=[im for node in entry.get('outputs',{}).values() for im in node.get('images',[])]
            if images:
                from urllib.parse import urlencode
                for index,im in enumerate(images):
                    url=args.server.rstrip('/')+'/view?'+urlencode({k:im[k] for k in ['filename','subfolder','type'] if k in im})
                    with urllib.request.urlopen(url,timeout=60) as r:(out/f'result-{index+1}.png').write_bytes(r.read())
                print('GENERATION_PASSED\nResults: '+str(out),flush=True);return
            if status.get('completed'):raise RuntimeError('Completed without image output. See '+str(out/'history.json'))
        elapsed=int(time.monotonic()-started)
        if elapsed-last_report>=30:print(f'Waiting: {elapsed}s; see the ComfyUI terminal for progress.',flush=True);last_report=elapsed
        time.sleep(2)
    raise RuntimeError('Wait timed out. The queued job was not cancelled; inspect ComfyUI before submitting again.')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--base',type=Path,default=Path('G:/AI/ComfyUI_windows_portable'))
    p.add_argument('--server',default='http://127.0.0.1:8188');p.add_argument('--prompt',default=DEFAULT_PROMPT);p.add_argument('--prompt-file',type=Path)
    p.add_argument('--width',type=int,default=512);p.add_argument('--height',type=int,default=768);p.add_argument('--steps',type=int,default=8)
    p.add_argument('--seed',type=int,default=42);p.add_argument('--timeout',type=int,default=3600);p.add_argument('--download-vae',action='store_true');p.add_argument('--check-only',action='store_true')
    try:run(p.parse_args())
    except KeyboardInterrupt:print('Stopped waiting; check ComfyUI queue before retrying.',file=sys.stderr);sys.exit(130)
    except Exception as e:print('ERROR: '+str(e),file=sys.stderr);sys.exit(1)
