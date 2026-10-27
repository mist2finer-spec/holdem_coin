"""Reference img2img with a fixed face-protection mask and original-face composite.
Not identity learning or a pose-transfer model. Mask coordinates are for supplied Hong.
"""
import argparse,json,urllib.request,uuid,sys
from pathlib import Path
# Portable embedded Python may omit the script directory from sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_hong as base

PROMPT='''Subtle cleanup of the input 2D anime game character illustration.
Keep exactly the same character, pose, orientation, framing and silhouette.
Preserve her original face, eyes, expression, very long straight dark hair,
black cold-shoulder crop top, detached sleeves, skirt, straps, stockings and boots.
Preserve the original drawing style and colors. One adult woman only.
No new accessories, no weapons, no text. Do not redesign the face or outfit.'''


def upload(server,path):
    boundary='ComfyHong'+uuid.uuid4().hex
    name='hong_ref_'+uuid.uuid4().hex+'.png'
    payload=(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\nContent-Type: image/png\r\n\r\n'.encode()+path.read_bytes()+f'\r\n--{boundary}--\r\n'.encode())
    req=urllib.request.Request(server.rstrip('/')+'/upload/image',data=payload,headers={'Content-Type':'multipart/form-data; boundary='+boundary})
    with urllib.request.urlopen(req,timeout=90) as r:d=json.load(r)
    return (d.get('subfolder','').rstrip('/')+'/' if d.get('subfolder') else '')+d['name']


def reference_graph(args,name):
    g=base_graph(args)
    w,h=args.width,args.height
    x,y=int(w*args.face_x),int(h*args.face_y)
    fw,fh=max(1,int(w*args.face_width)),max(1,int(h*args.face_height))
    if min(x,y)<0 or x+fw>w or y+fh>h:raise ValueError('Face rectangle exceeds canvas')
    feather=min(4,fw//4,fh//4)
    g['11']={'class_type':'LoadImage','inputs':{'image':name}}
    g['12']={'class_type':'ImageScale','inputs':{'image':['11',0],'upscale_method':'lanczos','width':w,'height':h,'crop':'disabled'}}
    g['7']={'class_type':'VAEEncode','inputs':{'pixels':['12',0],'vae':['6',0]}}
    g['13']={'class_type':'SolidMask','inputs':{'value':0.0,'width':w,'height':h}}
    g['14']={'class_type':'SolidMask','inputs':{'value':1.0,'width':fw,'height':fh}}
    g['15']={'class_type':'FeatherMask','inputs':{'mask':['14',0],'left':feather,'top':feather,'right':feather,'bottom':feather}}
    g['16']={'class_type':'MaskComposite','inputs':{'destination':['13',0],'source':['15',0],'x':x,'y':y,'operation':'add'}}
    g['17']={'class_type':'InvertMask','inputs':{'mask':['16',0]}}
    g['18']={'class_type':'SetLatentNoiseMask','inputs':{'samples':['7',0],'mask':['17',0]}}
    g['8']['inputs'].update(latent_image=['18',0],denoise=args.denoise)
    g['19']={'class_type':'ImageCompositeMasked','inputs':{'destination':['9',0],'source':['12',0],'x':0,'y':0,'resize_source':False,'mask':['16',0]}}
    g['10']['inputs'].update(images=['19',0],filename_prefix='hong_reference_lock/hong')
    return g

base_graph=base.graph

def main(args):
    if not args.reference.is_file():raise RuntimeError('Missing original image: '+str(args.reference))
    if args.reference.read_bytes()[:8]!=b'\x89PNG\r\n\x1a\n':raise ValueError('Reference must be a PNG')
    if not .01<=args.denoise<=.45:raise ValueError('Use denoise0.01..0.45 for this fixed-pose preservation workflow')
    name=upload(args.server,args.reference)
    base.graph=lambda a:reference_graph(a,name)
    print('REFERENCE: '+str(args.reference),flush=True)
    print('FACE LOCK: preserve original head/face at the same position; not pose transfer.',flush=True)
    base.run(args)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--base',type=Path,default=Path('G:/AI/ComfyUI_windows_portable'))
    p.add_argument('--reference',type=Path,default=Path(__file__).resolve().parent/'hong_reference.png')
    p.add_argument('--server',default='http://127.0.0.1:8188');p.add_argument('--prompt',default=PROMPT);p.add_argument('--prompt-file',type=Path)
    p.add_argument('--width',type=int,default=512);p.add_argument('--height',type=int,default=768);p.add_argument('--steps',type=int,default=8)
    p.add_argument('--seed',type=int,default=42);p.add_argument('--denoise',type=float,default=.20);p.add_argument('--timeout',type=int,default=3600)
    p.add_argument('--face-x',type=float,default=.40);p.add_argument('--face-y',type=float,default=.015)
    p.add_argument('--face-width',type=float,default=.28);p.add_argument('--face-height',type=float,default=.19)
    p.add_argument('--download-vae',action='store_true');p.add_argument('--check-only',action='store_true')
    try:main(p.parse_args())
    except KeyboardInterrupt:print('Stopped waiting; the server job may still run.',file=sys.stderr);sys.exit(130)
    except Exception as e:print('ERROR: '+str(e),file=sys.stderr);sys.exit(1)
