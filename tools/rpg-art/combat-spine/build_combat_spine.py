"""Confirmed combat candidate -> editable matte/parts -> local masked repair -> Spine draft."""
import argparse,collections,hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'spine-draft'))
import spine_builder as b
from PIL import Image,ImageChops,ImageDraw
SOURCE=ROOT.parent/'combat-base/review/hong-generated-review.png'
SOURCE_SHA='233a3520b0f91eb95b8f742ddb5d640dcb0e95e0acc0003b99ff9f05eea3a540'

def read_image(path,mode):
 with Image.open(path) as im:return im.convert(mode)

def border_matte(image):
 """Only near-black (max channel <=12) connected to the image border is proposed as background.
 This is not semantic matting. Keep original RGB and expose an editable alpha mask.
 """
 rgb=image.convert('RGB');w,h=rgb.size;pixels=rgb.load();seen=set();todo=collections.deque()
 for x in range(w):todo.extend([(x,0),(x,h-1)])
 for y in range(h):todo.extend([(0,y),(w-1,y)])
 while todo:
  x,y=todo.popleft()
  if (x,y) in seen or not 0<=x<w or not 0<=y<h or max(pixels[x,y])>12:continue
  seen.add((x,y));todo.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
 alpha=Image.new('L',(w,h),255);a=alpha.load()
 for xy in seen:a[xy]=0
 return alpha

def export(a):
 b.export(a);dest=a.out/'spine';sk=b.load(dest/'hong.json')
 # A root-anchored residue would produce a ghost body during animation. Do not export it.
 sk['slots']=[s for s in sk['slots'] if s['name']!='unassigned-source']
 for skin in sk['skins']:skin['attachments'].pop('unassigned-source',None)
 b.save(dest/'hong.json',sk)
 c=b.config(a);manifest=b.load(a.out/'parts_manifest.json');preview=Image.new('RGBA',(256,256))
 for name in c['drawOrder']:
  info=manifest['parts'][name];art=read_image(a.out/'parts'/f'{name}.png','RGBA');preview.alpha_composite(art,tuple(info['bounds'][:2]))
 preview.save(a.out/'review/setup_preview.png')
 # Repack only attached parts. Nearest filtering preserves this pixel source.
 images={s['attachment']:read_image(dest/'parts'/f"{s['attachment']}.png",'RGBA') for s in sk['slots'] if s.get('attachment')}
 atlas=Image.new('RGBA',(512,512));x=y=4;row=0;lines=['hong.png','size:512,512','format:RGBA8888','filter:Nearest,Nearest','repeat:none','pma:false']
 for name,im in images.items():
  if x+im.width+4>512:x=4;y+=row+4;row=0
  if y+im.height+4>512:raise ValueError('Atlas exceeded 512px; geometry needs review')
  atlas.alpha_composite(im,(x,y));lines.extend([name,f'bounds:{x},{y},{im.width},{im.height}']);x+=im.width+4;row=max(row,im.height)
 atlas.save(dest/'hong.png')
 for name in ['hong.atlas','hong.atlas.txt']:(dest/name).write_text('\n'.join(lines)+'\n',encoding='utf-8')
 r=b.load(a.out/'readiness.json');r.update(sourceStage='confirmed compact combat candidate',residualIncludedInRig=False,semanticSegmentation=False,
  alphaMethod='editable near-black border flood fill; threshold12',animations=['setup','idle-preview'],status='DRAFT_REQUIRES_MATTE_PART_AND_RIG_REVIEW')
 b.save(a.out/'readiness.json',r)


def prepare(a):
 if b.load(a.config).get('width')!=256:raise ValueError('Use the new 256px combat-pose config, not the previous tall-body polygons.')
 if a.out.exists():raise FileExistsError('Preserve existing work. Choose a new -Out folder for changed masks/polygons.')
 if b.sha(a.source)!=SOURCE_SHA:raise ValueError('Use the confirmed last combat result, not the long-body reference or a new generation.')
 original=read_image(a.source,'RGB')
 if original.size!=(256,256):raise ValueError('Expected original 256x256 result')
 alpha=read_image(a.alpha_mask,'L') if a.alpha_mask else border_matte(original)
 if alpha.size!=original.size:raise ValueError('Alpha mask must be 256x256')
 a.out.mkdir(parents=True);(a.out/'review').mkdir();original.save(a.out/'review/original-rgb.png');alpha.save(a.out/'alpha_mask.png')
 rgba=original.convert('RGBA');rgba.putalpha(alpha);rgba.save(a.out/'review/transparent-candidate.png')
 source=a.source;a.source=a.out/'review/transparent-candidate.png';b.prepare(a);a.source=source
 b.save(a.out/'combat_source.json',{'originalSha256':SOURCE_SHA,'referenceSha256':b.sha(a.out/'reference.png'),'originalPreserved':True,'alphaReviewed':False,'partsReviewed':False})
 export(a)
 editor=a.out/'edit_parts.html'
 editor.write_text(editor.read_text(encoding='utf-8').replace('</style>','canvas{width:768px;image-rendering:pixelated;max-height:none}</style>'),encoding='utf-8')
 template=(ROOT/'matte_editor.html').read_text(encoding='utf-8')
 import base64
 for key,path in [('__ORIGINAL__',a.out/'review/original-rgb.png'),('__MASK__',a.out/'alpha_mask.png')]:template=template.replace(key,'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode())
 (a.out/'edit_matte.html').write_text(template,encoding='utf-8')
 print('NEXT: Inspect edit_matte.html and edit_parts.html. Edited masks/configs go into a NEW output folder.')


def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('stage',choices=['prepare','repair','approve','export','report']);p.add_argument('--out',type=Path,required=True);p.add_argument('--source',type=Path,default=SOURCE);p.add_argument('--config',type=Path);p.add_argument('--alpha-mask',type=Path);p.add_argument('--part',default='back-upper-arm');p.add_argument('--candidate',type=Path);p.add_argument('--base',type=Path,default=Path('G:/AI/ComfyUI_windows_portable'));p.add_argument('--server',default='http://127.0.0.1:8188');p.add_argument('--seed',type=int,default=42);p.add_argument('--denoise',type=float,default=.55);p.add_argument('--timeout',type=int,default=3600);p.add_argument('--prompt',default='Compact game pixel art, crisp clusters, limited palette. Preserve the original Hong colors and scale.');p.add_argument('--download-vae',action='store_true');a=p.parse_args()
 if a.stage=='prepare':
  a.config=a.config or ROOT/'hong_combat_parts.json';prepare(a);return
 if not (a.out/'combat_source.json').is_file():raise ValueError('Not a combat-spine work folder. Run Prepare in a new folder first.')
 if a.stage=='repair':
  queue=b.comfy.request(a.server,'/queue')
  if queue.get('queue_running') or queue.get('queue_pending'):raise RuntimeError('Queue busy; no new generation submitted.')
  b.repair(a)
 elif a.stage=='approve':
  if not a.candidate:raise ValueError('Pass the exact reviewed -Candidate PNG; candidates are not auto-selected.')
  b.approve(a);export(a)
 elif a.stage=='export':export(a)
 else:print(json.dumps(b.load(a.out/'readiness.json'),ensure_ascii=False,indent=2))
if __name__=='__main__':
 try:main()
 except KeyboardInterrupt:print('Stopped waiting; inspect existing ComfyUI queue before retrying.',file=sys.stderr);sys.exit(130)
 except Exception as e:print('ERROR: '+str(e),file=sys.stderr);sys.exit(1)
