"""Resume the local Z-Image combat-base workflow; never promote art into the game."""
import argparse,hashlib,json,sys,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'combat-base'))
import generate_combat_base as combat
import comfy_client as client

MODELS={'UNETLoader':('unet_name','z_image_turbo_bf16.safetensors'),'CLIPLoader':('clip_name','qwen_3_4b.safetensors'),'VAELoader':('vae_name','ae.safetensors')}

def options(base,server,seed=42,denoise=.35):
 return argparse.Namespace(base=base,server=server,seed=seed,denoise=denoise,steps=8,width=512,height=512,timeout=3600,
  reference=ROOT.parent/'combat-base/hong_combat_reference.png',prompt=combat.PROMPT,prompt_file=None,download_vae=False,check_only=False)

def doctor(args):
 if not args.reference.is_file():raise ValueError('Missing combat reference: '+str(args.reference))
 try:
  objects=client.request(args.server,'/object_info');stats=client.request(args.server,'/system_stats');queue=client.request(args.server,'/queue')
 except Exception as e:raise RuntimeError('ComfyUI API unavailable at '+args.server+'. Keep its terminal running. '+str(e)) from e
 graph=combat.graph(args,'REFERENCE_UPLOADED_DURING_GENERATE.png')
 # LoadImage filenames are checked only after an actual upload, not by a fake filename.
 client.validate_graph({k:v for k,v in graph.items() if v['class_type']!='LoadImage'},objects)
 for typ,(field,model) in MODELS.items():
  if model not in objects[typ]['input']['required'][field][0]:raise RuntimeError('Missing installed model '+model)
 result={'status':'CHECK_PASSED','server':args.server,'models':{typ:v[1] for typ,v in MODELS.items()},'devices':[d.get('name','unknown') for d in stats.get('devices',[])],
  'queueRunning':len(queue.get('queue_running',[])),'queuePending':len(queue.get('queue_pending',[])),
  'referenceSha256':hashlib.sha256(args.reference.read_bytes()).hexdigest(),'steps':8,'denoise':args.denoise,
  'stage':'combat-base candidate only; no Spine rig or transparent-art guarantee'}
 print(json.dumps(result,ensure_ascii=False,indent=2));return result

def report(work):
 if not work.is_dir():raise ValueError('Existing work folder not found: '+str(work))
 ready_path=work/'readiness.json'
 if not ready_path.is_file():raise ValueError('No readiness.json in this folder; select the extracted hong_spine_work directory')
 ready=json.loads(ready_path.read_text(encoding='utf-8-sig'))
 result={'status':'EXISTING_DRAFT_REPORT','work':str(work),'emptyParts':ready.get('empty',[]),'needsCompletion':ready.get('needsCompletion',[]),
  'unassignedSourcePixels':ready.get('unassignedSourcePixels'),'candidateCount':len(list((work/'candidates').glob('*/candidate.png'))),
  'next':'Archive the long-illustration draft; approve a compact combat base before redesigning its polygons/pivots.'}
 print(json.dumps(result,ensure_ascii=False,indent=2));return result

def generate(args):
 checked=doctor(args)
 if checked['queueRunning'] or checked['queuePending']:raise RuntimeError('ComfyUI queue is busy. Wait for the existing job; no duplicate job was submitted.')
 job=args.base/'hong_resume_records'/(time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:6]);job.mkdir(parents=True)
 meta={'status':'starting','referenceSha256':checked['referenceSha256'],'seed':args.seed,'denoise':args.denoise,'models':checked['models'],
  'source':'current combat sprite, not the long lobby illustration','faceComposite':False,'transparentArtVerified':False,'productionModified':False}
 (job/'resume.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
 try:
  combat.main(args)
 except BaseException:
  meta['status']='failed-or-wait-stopped; check ComfyUI queue before retry';(job/'resume.json').write_text(json.dumps(meta,indent=2),encoding='utf-8');raise
 meta['status']='candidate-generated-needs-review';(job/'resume.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
 print('NEXT: Review the image under '+str(args.base/'ComfyUI/output/hong_combat_base')+'. Do not apply the old tall-body polygons to this new base.')

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['check','generate','report']);p.add_argument('--base',type=Path,default=Path('G:/AI/ComfyUI_windows_portable'));p.add_argument('--server',default='http://127.0.0.1:8188');p.add_argument('--work',type=Path);p.add_argument('--seed',type=int,default=42);p.add_argument('--denoise',type=float,default=.35);p.add_argument('--prompt-file',type=Path)
 a=p.parse_args()
 if a.action=='report':return report(a.work or a.base/'hong_spine_work')
 if not 0<=a.seed<2**64 or not .1<=a.denoise<=.5:raise ValueError('Seed must be uint64; denoise must be 0.1..0.5')
 args=options(a.base,a.server,a.seed,a.denoise);args.prompt_file=a.prompt_file
 return doctor(args) if a.action=='check' else generate(args)
if __name__=='__main__':
 try:main()
 except KeyboardInterrupt:print('Stopped waiting. Check ComfyUI queue before retry.',file=sys.stderr);sys.exit(130)
 except Exception as e:print('ERROR: '+str(e),file=sys.stderr);sys.exit(1)
