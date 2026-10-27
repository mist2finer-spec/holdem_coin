"""Combat-pixel reference, not a cutout of the long-proportion lobby illustration."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import argparse,json,urllib.request,uuid
import comfy_client as client

PROMPT='''One compact 2D pixel-art side-scrolling fantasy action RPG battle character.
Use the input combat sprite as the guide for head-to-body proportions, pose,
framing, black outfit and long black hair. Same character Hong, an adult woman.
Compact game-sprite anatomy, prominent head, short torso, sturdy short limbs,
clear hands, readable boots, crisp pixel clusters and limited shaded colors.
Three-quarter side view facing RIGHT, balanced combat-ready stance, bent knees,
arms in front ready to attack. Full body including both feet inside the canvas.
Black blunt bangs and very long straight dark hair, violet eyes, black
cold-shoulder cropped top with detached sleeves, black pleated skirt,
thigh straps, dark stockings and black boots. Unarmed. One character only.
Plain dark background. No scenery, no text, no effects.
No tall fashion-illustration proportions, no realistic rendering,
no smooth airbrushed painting, no new accessories.'''
base_graph=client.graph

def upload(server,path):
    boundary='CombatRef'+uuid.uuid4().hex;name='hong_combat_'+uuid.uuid4().hex+'.png'
    data=(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\nContent-Type: image/png\r\n\r\n'.encode()+path.read_bytes()+f'\r\n--{boundary}--\r\n'.encode())
    req=urllib.request.Request(server.rstrip('/')+'/upload/image',data=data,headers={'Content-Type':'multipart/form-data; boundary='+boundary})
    with urllib.request.urlopen(req,timeout=90) as r:d=json.load(r)
    return (d.get('subfolder','').rstrip('/')+'/' if d.get('subfolder') else '')+d['name']

def graph(args,name):
    g=base_graph(args)
    g['11']={'class_type':'LoadImage','inputs':{'image':name}}
    g['12']={'class_type':'ImageScale','inputs':{'image':['11',0],'upscale_method':'nearest-exact','width':512,'height':512,'crop':'disabled'}}
    g['7']={'class_type':'VAEEncode','inputs':{'pixels':['12',0],'vae':['6',0]}}
    g['8']['inputs']['denoise']=args.denoise
    g['13']={'class_type':'ImageScale','inputs':{'image':['9',0],'upscale_method':'nearest-exact','width':256,'height':256,'crop':'disabled'}}
    g['10']['inputs'].update(images=['13',0],filename_prefix='hong_combat_base/hong')
    return g

def main(args):
    if not args.reference.is_file():raise ValueError('Missing '+str(args.reference))
    if not .1<=args.denoise<=.8:raise ValueError('Use denoise0.1..0.8')
    name=upload(args.server,args.reference);client.graph=lambda a:graph(a,name)
    print('Combat sprite reference used. No original-face paste. Style/identity still require review.',flush=True)
    client.run(args)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--base',type=Path,default=Path('G:/AI/ComfyUI_windows_portable'));p.add_argument('--server',default='http://127.0.0.1:8188')
    p.add_argument('--reference',type=Path,default=Path(__file__).parent/'hong_combat_reference.png');p.add_argument('--prompt',default=PROMPT);p.add_argument('--prompt-file',type=Path)
    p.add_argument('--seed',type=int,default=42);p.add_argument('--denoise',type=float,default=.4);p.add_argument('--steps',type=int,default=8);p.add_argument('--timeout',type=int,default=3600)
    p.add_argument('--download-vae',action='store_true');p.add_argument('--check-only',action='store_true');p.set_defaults(width=512,height=512)
    try:main(p.parse_args())
    except Exception as e:print('ERROR: '+str(e),file=sys.stderr);sys.exit(1)
