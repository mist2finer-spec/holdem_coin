"""Hong source-art cutout starter + optional ComfyUI part repair + Spine4.2 import.
Draft geometry is editable. Never claims automatic semantic segmentation/finished rig.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import argparse,hashlib,json,math,shutil,time,urllib.request,uuid,base64
try:
    from PIL import Image,ImageDraw,ImageChops,ImageOps
except ImportError:
    raise SystemExit('Pillow missing. Use run_spine.ps1 to install/check it.')
import comfy_client as comfy
ROOT=Path(__file__).resolve().parent


def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def save(p,d):Path(p).write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def config(a):
    p=a.config or a.out/'parts_config.json'
    return load(p if p.exists() else ROOT/'hong_parts.json')
def working(source,width):
    im=Image.open(source).convert('RGBA');return im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS)
def safe_name(name):
    if not name or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in name):raise ValueError('Unsafe part name')
    return name

def validate(c):
    seen=set()
    for p in c['parts']:
        name=safe_name(p['name'])
        if name in seen:raise ValueError('Duplicate part '+name)
        if p['parent'] not in seen and p['parent']!='root':raise ValueError('Parents must precede children: '+name)
        for pair in [p['pivot'],*p['polygon']]:
            if len(pair)!=2 or not all(math.isfinite(v) and 0<=v<=1 for v in pair):raise ValueError('Invalid normalized coordinate')
        if len(p['polygon'])<3:raise ValueError('Need polygon with >=3 points')
        seen.add(name)
    if set(c['drawOrder'])!=seen or len(c['drawOrder'])!=len(seen):raise ValueError('Invalid draw order')


def part_image(im,p):
    mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon([(round(x*im.width),round(y*im.height)) for x,y in p['polygon']],fill=255)
    bounds=mask.getbbox()
    if not bounds:raise ValueError('Empty polygon '+p['name'])
    alpha=ImageChops.multiply(im.getchannel('A'),mask)
    art=im.copy();art.putalpha(alpha)
    # Occluded parts have no known pixels. Never copy unrelated hair/body as a limb.
    if p.get('occluded'):art.putalpha(Image.new('L',im.size))
    return art.crop(bounds),mask.crop(bounds),bounds


def prepare(a):
    c=config(a);validate(c);a.out.mkdir(parents=True,exist_ok=True)
    for folder in ['original_parts','parts','masks','candidates','review','spine']:(a.out/folder).mkdir(exist_ok=True)
    if not (a.out/'reference.png').exists():shutil.copyfile(a.source,a.out/'reference.png')
    elif sha(a.out/'reference.png')!=sha(a.source):raise ValueError('Different source in existing output; choose a new -Out folder')
    save(a.out/'parts_config.json',c)
    im=working(a.source,c['width']);im.save(a.out/'review/reference.png')
    manifest=load(a.out/'parts_manifest.json') if (a.out/'parts_manifest.json').exists() else {'sourceSha256':sha(a.source),'parts':{}}
    # Disjoint ownership avoids a second face hiding in the back-hair cutout.
    ownership={};occupied=Image.new('L',im.size)
    for name in reversed(c['drawOrder']):
        p=next(p for p in c['parts'] if p['name']==name)
        full=Image.new('L',im.size)
        if not p.get('occluded'):ImageDraw.Draw(full).polygon([(round(x*im.width),round(y*im.height)) for x,y in p['polygon']],fill=255)
        ownership[name]=ImageChops.subtract(full,occupied);occupied=ImageChops.lighter(occupied,full)
    residual=im.copy();residual.putalpha(ImageChops.multiply(im.getchannel('A'),ImageChops.invert(occupied)))
    residual.save(a.out/'parts/unassigned-source.png')
    for p in c['parts']:
        name=p['name'];art,mask,bounds=part_image(im,p)
        alpha=ImageChops.multiply(im.getchannel('A'),ownership[name]);art.putalpha(alpha.crop(bounds))
        old=manifest['parts'].get(name,{})
        if old.get('approved') and old.get('bounds')!=list(bounds):raise ValueError('Approved part geometry changed; choose a new output folder')
        art.save(a.out/'original_parts'/f'{name}.png');mask.save(a.out/'masks'/f'{name}.png')
        current=manifest['parts'].get(name,{})
        if not current.get('approved'):
            art.save(a.out/'parts'/f'{name}.png')
            current={'origin':'occluded-no-original-pixels' if p.get('occluded') else 'original-polygon-cutout','approved':False}
        current.update(bounds=list(bounds),pivot=[p['pivot'][0]*im.width,p['pivot'][1]*im.height],size=list(art.size),needsCompletion=p.get('occluded',False) or p.get('needsCompletion',False))
        manifest['parts'][name]=current
    save(a.out/'parts_manifest.json',manifest)
    write_editor(a.out,c)
    export(a)
    print('PREPARED: '+str(a.out));print('Edit polygons/pivots in edit_parts.html. These are drafts, not finished segmentation.')


def upload(server,path):
    boundary='SpineKit'+uuid.uuid4().hex;name='spine_'+uuid.uuid4().hex+'.png'
    body=(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\nContent-Type: image/png\r\n\r\n'.encode()+path.read_bytes()+f'\r\n--{boundary}--\r\n'.encode())
    req=urllib.request.Request(server.rstrip('/')+'/upload/image',data=body,headers={'Content-Type':'multipart/form-data; boundary='+boundary})
    with urllib.request.urlopen(req,timeout=90) as r:d=json.load(r)
    return (d.get('subfolder','').rstrip('/')+'/' if d.get('subfolder') else '')+d['name']


def make_repair_graph(a,image,mask,prompt):
    opts=argparse.Namespace(width=512,height=512,prompt=prompt,steps=8,seed=a.seed)
    g=comfy.graph(opts)
    g['11']={'class_type':'LoadImage','inputs':{'image':image}}
    g['12']={'class_type':'LoadImage','inputs':{'image':mask}}
    g['13']={'class_type':'ImageToMask','inputs':{'image':['12',0],'channel':'red'}}
    g['7']={'class_type':'VAEEncode','inputs':{'pixels':['11',0],'vae':['6',0]}}
    g['14']={'class_type':'SetLatentNoiseMask','inputs':{'samples':['7',0],'mask':['13',0]}}
    g['8']['inputs']['latent_image']=['14',0]
    g['8']['inputs']['denoise']=a.denoise
    g['10']['inputs']['filename_prefix']='hong_spine_candidates/'+safe_name(a.part)
    return g


def repair(a):
    c=config(a);p=next((p for p in c['parts'] if p['name']==a.part),None)
    if not p:raise ValueError('Unknown part; see parts_config.json')
    if p.get('locked'):raise ValueError('Head is locked to original art. Do not regenerate identity.')
    if not .1<=a.denoise<=1:raise ValueError('Denoise must be0.1..1')
    manifest=load(a.out/'parts_manifest.json');info=manifest['parts'][a.part]
    art=Image.open(a.out/'parts'/f'{a.part}.png').convert('RGBA')
    if p.get('occluded') and not info.get('approved'):
        front=p.get('referencePart')
        if not front:raise ValueError('Occluded part needs referencePart or a manual sketch')
        art=Image.open(a.out/'parts'/f'{front}.png').convert('RGBA')
        art=art.resize(tuple(info['size']),Image.Resampling.LANCZOS)
    mask=Image.open(a.out/'masks'/f'{a.part}.png').convert('L')
    w,h=info['size'];scale=min(440/w,440/h);pw,ph=max(1,round(w*scale)),max(1,round(h*scale));x,y=(512-pw)//2,(512-ph)//2
    flat=Image.new('RGB',(512,512),(160,160,160));flat.paste(art.resize((pw,ph),Image.Resampling.LANCZOS),(x,y),art.resize((pw,ph),Image.Resampling.LANCZOS).getchannel('A'))
    noise=Image.new('L',(512,512));noise.paste(mask.resize((pw,ph),Image.Resampling.NEAREST),(x,y))
    job=a.out/'candidates'/(a.part+'-'+time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:5]);job.mkdir(parents=True)
    flat.save(job/'input.png');noise.convert('RGB').save(job/'repair_mask.png')
    prompt=('One isolated '+p['description']+'. Reconstruct the complete part including the hidden surface and rounded joint overlap. '
        'Match the input black outfit, colors, material, proportions and anime linework. Exactly one detached body part, no face, no head, no whole person, no text, no background objects. Keep the part inside its original silhouette. '+a.prompt)
    comfy.ensure_vae(a.base,a.download_vae)
    g=make_repair_graph(a,upload(a.server,job/'input.png'),upload(a.server,job/'repair_mask.png'),prompt)
    comfy.validate_graph(g,comfy.request(a.server,'/object_info'));save(job/'workflow.api.json',g)
    reply=comfy.request(a.server,'/prompt',{'prompt':g,'client_id':str(uuid.uuid4())});save(job/'submission.json',reply)
    if reply.get('node_errors') or not reply.get('prompt_id'):raise RuntimeError(str(reply))
    pid=reply['prompt_id'];print('QUEUED '+pid+'; candidate only, never automatically approved.',flush=True)
    start=time.monotonic();last=0
    while time.monotonic()-start<a.timeout:
        entry=comfy.request(a.server,'/history/'+pid).get(pid)
        if entry:
            save(job/'history.json',entry)
            if entry.get('status',{}).get('status_str')=='error':raise RuntimeError(json.dumps(entry['status'])[-2500:])
            images=[im for out in entry.get('outputs',{}).values() for im in out.get('images',[])]
            if images:
                from urllib.parse import urlencode
                with urllib.request.urlopen(a.server.rstrip('/')+'/view?'+urlencode(images[0]),timeout=60) as r:(job/'generated.png').write_bytes(r.read())
                generated=Image.open(job/'generated.png').convert('RGBA').crop((x,y,x+pw,y+ph)).resize((w,h),Image.Resampling.LANCZOS)
                generated.putalpha(mask);generated.save(job/'candidate.png')
                save(job/'candidate.json',{'part':a.part,'sourceSha256':manifest['sourceSha256'],'size':[w,h],'status':'unreviewed-ai-candidate','silhouette':'manual polygon, not AI segmentation'})
                print('CANDIDATE: '+str(job/'candidate.png'));return
        elapsed=int(time.monotonic()-start)
        if elapsed-last>=30:print('Waiting '+str(elapsed)+'s',flush=True);last=elapsed
        time.sleep(2)
    raise RuntimeError('Timeout waiting. Server job is not automatically cancelled.')


def approve(a):
    meta=load(a.candidate.parent/'candidate.json');manifest=load(a.out/'parts_manifest.json');name=safe_name(meta['part'])
    if meta['sourceSha256']!=manifest['sourceSha256']:raise ValueError('Candidate belongs to a different source')
    im=Image.open(a.candidate).convert('RGBA')
    if list(im.size)!=manifest['parts'][name]['size']:raise ValueError('Part dimensions changed; pivot mapping would break')
    previous=a.out/'parts'/f'{name}.png';backup=a.out/'review'/(name+'-before-'+uuid.uuid4().hex[:6]+'.png');shutil.copyfile(previous,backup)
    im.save(previous);manifest['parts'][name].update(origin='reviewed-ai-candidate',approved=True,candidateSha256=sha(a.candidate))
    save(a.out/'parts_manifest.json',manifest);export(a);print('APPROVED '+name)


def export(a):
    c=config(a);validate(c);m=load(a.out/'parts_manifest.json');im=working(a.out/'reference.png',c['width']);w,h=im.size
    positions={p['name']:(p['pivot'][0]*w-w/2,(.98-p['pivot'][1])*h) for p in c['parts']};positions['root']=(0,0)
    bones=[{'name':'root'}];attachments={};slots=[];allparts={}
    for p in c['parts']:
        name=p['name'];parent=p['parent'];x,y=positions[name];px,py=positions[parent]
        bones.append({'name':name,'parent':parent,'x':round(x-px,4),'y':round(y-py,4)})
    # Empty weapon mounts are real bone/slot points, not invented weapon images.
    for side in ['front','back']:bones.append({'name':'weapon-'+side,'parent':side+'-hand'})
    residual=Image.open(a.out/'parts/unassigned-source.png').convert('RGBA')
    preview=residual.copy()
    unassigned=sum(residual.getchannel('A').histogram()[1:])
    if unassigned:
        allparts['unassigned-source']=residual
        attachments['unassigned-source']={'unassigned-source':{'type':'region','path':'unassigned-source','x':0,'y':.48*h,'width':w,'height':h}}
        slots.append({'name':'unassigned-source','bone':'root','attachment':'unassigned-source'})
    for name in c['drawOrder']:
        info=m['parts'][name];part=Image.open(a.out/'parts'/f'{name}.png').convert('RGBA');box=info['bounds'];allparts[name]=part
        visible=part.getchannel('A').getbbox() is not None
        slot={'name':name,'bone':name}
        if visible:
            slot['attachment']=name;cx=(box[0]+box[2])/2-w/2;cy=.98*h-(box[1]+box[3])/2;bx,by=positions[name]
            attachments[name]={name:{'type':'region','path':name,'x':round(cx-bx,4),'y':round(cy-by,4),'width':part.width,'height':part.height}}
            preview.alpha_composite(part,(box[0],box[1]))
        slots.append(slot)
    slots.extend([{'name':'weapon-back','bone':'weapon-back'},{'name':'weapon-front','bone':'weapon-front'}])
    animations={'setup':{},'idle-preview':{'bones':{'root':{'translate':[{'time':0,'x':0,'y':0},{'time':1,'x':0,'y':2},{'time':2,'x':0,'y':0}]}}}}
    skeleton={'skeleton':{'spine':'4.2.43','images':'parts/','width':w,'height':h},'bones':bones,'slots':slots,'skins':[{'name':'default','attachments':attachments}],'animations':animations}
    dest=a.out/'spine';dest.mkdir(exist_ok=True);(dest/'parts').mkdir(exist_ok=True)
    save(dest/'hong.json',skeleton)
    atlas_size=1024;rects={};x=y=4;row=0
    for name,part in allparts.items():
        part.save(dest/'parts'/f'{name}.png')
        if part.width+8>atlas_size:raise ValueError('Part too wide for atlas')
        if x+part.width+4>atlas_size:x=4;y+=row+4;row=0
        rects[name]=(x,y);x+=part.width+4;row=max(row,part.height)
    used=y+row+4;atlas_h=2**math.ceil(math.log2(max(64,used)));atlas=Image.new('RGBA',(atlas_size,atlas_h))
    lines=['hong.png',f'size:{atlas_size},{atlas_h}','format:RGBA8888','filter:Linear,Linear','repeat:none','pma:false']
    for name,part in allparts.items():
        x,y=rects[name];atlas.alpha_composite(part,(x,y));lines.extend([name,f'bounds:{x},{y},{part.width},{part.height}'])
    atlas.save(dest/'hong.png');text='\n'.join(lines)+'\n';(dest/'hong.atlas.txt').write_text(text);(dest/'hong.atlas').write_text(text)
    preview.save(a.out/'review/setup_preview.png')
    sheet=Image.new('RGB',(800,math.ceil(len(allparts)/4)*230),(55,55,60));draw=ImageDraw.Draw(sheet)
    for i,(name,part) in enumerate(allparts.items()):
        tile=ImageOps.contain(part,(190,195));x,y=(i%4)*200,(i//4)*230;sheet.paste(tile,(x+(200-tile.width)//2,y),tile);draw.text((x+5,y+200),name,fill='white')
    sheet.save(a.out/'review/parts_contact_sheet.png')
    report={'status':'DRAFT_REQUIRES_REVIEW','parts':len(c['parts']),'unassignedSourcePixels':unassigned,'visible':len(attachments),'empty':[k for k,v in allparts.items() if not v.getchannel('A').getbbox()],
        'needsCompletion':[k for k,v in m['parts'].items() if v['needsCompletion'] and not v['approved']],
        'limitations':['Hand-authored rough polygons, not semantic segmentation.','Source pose retained; occluded back limbs have no original pixels.','Region attachments only, no mesh weights/IK or production attack animations.','AI candidates keep an editable polygon alpha; silhouettes require inspection.','Spine Editor import and Unity visual QA remain required.']}
    save(a.out/'readiness.json',report);print('EXPORTED DRAFT: '+str(dest/'hong.json'))


def write_editor(out,c):
    html=(ROOT/'editor_template.html').read_text(encoding='utf8');html=html.replace('__CONFIG__',json.dumps(c,ensure_ascii=False))
    data=base64.b64encode((out/'reference.png').read_bytes()).decode();html=html.replace('__IMAGE__','data:image/png;base64,'+data)
    (out/'edit_parts.html').write_text(html,encoding='utf8')


def main():
    p=argparse.ArgumentParser();p.add_argument('stage',choices=['prepare','repair','approve','export']);p.add_argument('--source',type=Path,default=ROOT/'hong_reference.png');p.add_argument('--out',type=Path,default=ROOT/'output');p.add_argument('--config',type=Path)
    p.add_argument('--part',default='torso');p.add_argument('--candidate',type=Path);p.add_argument('--prompt',default='');p.add_argument('--seed',type=int,default=42);p.add_argument('--denoise',type=float,default=.65);p.add_argument('--server',default='http://127.0.0.1:8188');p.add_argument('--timeout',type=int,default=3600)
    p.add_argument('--base',type=Path,default=Path('G:/AI/ComfyUI_windows_portable'));p.add_argument('--download-vae',action='store_true');a=p.parse_args()
    if a.stage=='approve' and not a.candidate:raise ValueError('--candidate path required')
    {'prepare':prepare,'repair':repair,'approve':approve,'export':export}[a.stage](a)
if __name__=='__main__':
    try:main()
    except KeyboardInterrupt:print('Stopped. Any server job may still run.',file=sys.stderr);sys.exit(130)
    except Exception as e:print('ERROR: '+str(e),file=sys.stderr);sys.exit(1)
