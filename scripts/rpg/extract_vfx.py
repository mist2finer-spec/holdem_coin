"""Read-only Unity FX extraction + bounded deterministic XY particle preview.

Requires UnityPy==1.25.4, Pillow==13.0.0. Not a Unity shader renderer.
python scripts/rpg/extract_vfx.py /path/to/fx.bundle [--only NAME ...]
Original typed trees are retained in per-prefab deterministic gzip files.
"""
import argparse, collections, gzip, hashlib, json, math, random, re
from concurrent.futures import ProcessPoolExecutor
from functools import lru_cache
from pathlib import Path
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler
from PIL import Image, ImageChops, ImageDraw, ImageStat

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'archive/rpg/vfx'
PUBLIC = ROOT / 'public/rpg/vfx'
SELECTED = {
    'ground-rift': 'FX_GroundBreaking_01',
    'dark-hole': 'FX_DarkHole_01',
    'blizzard': 'FX_Blizzard_Projectile_01',
    'holy-wrath': 'FX_HolyWrath_01',
    'whirlwind': 'FX_Whirlwind_01_L',
    'recovery': 'FX_Buff_Heal',
}
LIMITS = {'particlesPerEmitter': 36, 'emittersPerPreview': 48, 'frames': 32, 'seconds': 2.0}
RUNTIME_FOCUS = {'ground-rift':4.0,'whirlwind':3.0}

def runtime_focus(frames,slot):
    gain=RUNTIME_FOCUS.get(slot,1)
    if gain==1:return frames
    size=frames[0].width;half=size/gain/2;center=size/2
    return [f.crop((round(center-half),round(center-half),round(center+half),round(center+half))).resize((size,size),Image.Resampling.LANCZOS) for f in frames]

def curve(c, t):
    keys = c.get('m_Curve', [])
    if not keys: return 1.0
    if t <= keys[0]['time']: return keys[0]['value']
    for a, b in zip(keys, keys[1:]):
        if t <= b['time']:
            dt = b['time'] - a['time']
            if dt <= 0: return b['value']
            u = (t-a['time'])/dt
            # Unweighted Unity AnimationCurve Hermite tangents. Weighted tangents are documented as unsupported.
            m0, m1 = a.get('outSlope',0), b.get('inSlope',0)
            if not math.isfinite(m0) or not math.isfinite(m1): return a['value']
            return (2*u**3-3*u*u+1)*a['value']+(u**3-2*u*u+u)*dt*m0+(-2*u**3+3*u*u)*b['value']+(u**3-u*u)*dt*m1
    return keys[-1]['value']

def value(c, t=0, r=.5):
    if not isinstance(c, dict): return float(c or 0)
    mode, s = c.get('minMaxState',0), c.get('scalar',0)
    if mode == 0: return s
    if mode == 3: return c.get('minScalar',s)+(s-c.get('minScalar',s))*r
    hi = curve(c.get('maxCurve',{}),t)*s
    if mode == 2: return curve(c.get('minCurve',{}),t)*c.get('minScalar',s)*(1-r)+hi*r
    return hi

def gradient(g,t):
    def channel(name, count, prefix):
        keys = [(g.get(prefix+str(i),0)/65535,g.get('key'+str(i),{}).get(name,1)) for i in range(g.get(count,0))]
        if not keys: return 1
        if t <= keys[0][0]: return keys[0][1]
        for a,b in zip(keys, keys[1:]):
            if t<=b[0]: return a[1]+(b[1]-a[1])*(t-a[0])/max(1e-9,b[0]-a[0])
        return keys[-1][1]
    return [channel(n,'m_NumAlphaKeys' if n=='a' else 'm_NumColorKeys','atime' if n=='a' else 'ctime') for n in 'rgba']

def color(c,t=0,r=.5):
    mode=c.get('minMaxState',0)
    if mode in (1,2): return gradient(c.get('maxGradient',{}),t)
    hi=c.get('maxColor',dict(r=1,g=1,b=1,a=1));lo=c.get('minColor',hi)
    return [hi.get(n,1) if mode==0 else lo.get(n,1)*(1-r)+hi.get(n,1)*r for n in 'rgba']

def safe_name(name): return re.sub(r'[^A-Za-z0-9_.-]+','-',name).strip('-')
def ref(p): return int(p.get('m_PathID',0)) if isinstance(p,dict) and p.get('m_FileID',0)==0 else 0
def write_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

class Extractor:
    def __init__(self, source):
        self.source=source;self.env=UnityPy.load(str(source));self.objects={o.path_id:o for o in self.env.objects};self.trees={};self.textures={};self.meshes={}
    def tree(self,id):
        if id not in self.trees:self.trees[id]=self.objects[id].read_typetree()
        return self.trees[id]
    def prefab(self,goid):
        nodes=[];materials={};texids=set();seen=set()
        def walk(id,parent=None):
            if id in seen:return
            seen.add(id);go=self.tree(id);components=[];transform=None
            for c in go.get('m_Component',[]):
                cid=ref(c['component']);o=self.objects.get(cid)
                if not o:continue
                t=self.tree(cid);components.append({'id':str(cid),'type':o.type.name,'data':t})
                if o.type.name in ('Transform','RectTransform'):transform=t
                if o.type.name in ('ParticleSystemRenderer','MeshRenderer','TrailRenderer'):
                    for m in t.get('m_Materials',[]):
                        mid=ref(m)
                        if not mid or mid not in self.objects:continue
                        mt=self.tree(mid);materials[str(mid)]=mt
                        for _,te in mt.get('m_SavedProperties',{}).get('m_TexEnvs',[]):
                            tid=ref(te.get('m_Texture'))
                            if tid in self.objects and self.objects[tid].type.name=='Texture2D':texids.add(tid)
            nodes.append({'id':str(id),'parent':str(parent) if parent else None,'name':go['m_Name'],'active':go.get('m_IsActive',True),'components':components})
            if transform:
                for ch in transform.get('m_Children',[]):
                    ct=self.tree(ref(ch));walk(ref(ct['m_GameObject']),id)
        walk(goid)
        mids=set()
        for n in nodes:
            for c in n['components']:
                for key in ['m_Mesh','m_Mesh1','m_Mesh2','m_Mesh3']:
                    mid=ref(c['data'].get(key))
                    if mid in self.objects and self.objects[mid].type.name=='Mesh':mids.add(mid)
        for mid in mids:
            if mid in self.meshes:continue
            mesh=self.objects[mid].read();h=MeshHandler(mesh);h.process()
            dest=ARCHIVE/'meshes'/(str(mid)+'.json');write_json(dest,{'name':mesh.m_Name,'vertices':h.m_Vertices,'uv':h.m_UV0,'triangles':[t for group in h.get_triangles() for t in group]});self.meshes[mid]='meshes/'+dest.name
        return {'nodes':nodes,'materials':materials,'meshes':{str(mid):self.meshes[mid] for mid in mids}},texids
    def texture(self,id):
        if id not in self.textures:
            d=self.objects[id].read();name=safe_name(d.m_Name)+'-'+str(id)+'.png';dest=ARCHIVE/'textures'/name;dest.parent.mkdir(parents=True,exist_ok=True)
            im=d.image.convert('RGBA');im.save(dest,optimize=True)
            self.textures[id]={'id':str(id),'name':d.m_Name,'file':'textures/'+name,'size':list(im.size),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
        return self.textures[id]

def emitters(raw):
    result=[];world={};active={}
    for node in raw['nodes']:
        comps={c['type']:c['data'] for c in node['components']}
        tr=comps.get('Transform',comps.get('RectTransform',{}));p=tr.get('m_LocalPosition',{});s=tr.get('m_LocalScale',{});q=tr.get('m_LocalRotation',{})
        # XY transform projection with Z rotation. X/Y quaternion rotation and mesh perspective are not reproduced.
        angle=math.atan2(2*(q.get('w',1)*q.get('z',0)+q.get('x',0)*q.get('y',0)),1-2*(q.get('y',0)**2+q.get('z',0)**2))
        px,py,sx,sy,pa=world.get(node['parent'],(0,0,1,1,0));x=p.get('x',0)*sx;y=p.get('y',0)*sy
        world[node['id']]=(px+x*math.cos(pa)-y*math.sin(pa),py+x*math.sin(pa)+y*math.cos(pa),sx*s.get('x',1),sy*s.get('y',1),pa+angle)
        active[node['id']]=node['active'] and active.get(node['parent'],True)
        ps=comps.get('ParticleSystem');pr=comps.get('ParticleSystemRenderer')
        static=False
        if not ps and comps.get('MeshRenderer'):
            pr=comps['MeshRenderer'];static=True
            ps={'InitialModule':{'enabled':True,'startLifetime':{'scalar':2},'startSize':{'scalar':1}},'EmissionModule':{'enabled':True,'m_Bursts':[{'countCurve':{'scalar':1}}]}}
        if not ps or not pr or not active[node['id']] or not pr.get('m_Enabled',True) or not ps.get('playOnAwake',True):continue
        mats=[raw['materials'].get(str(ref(m))) for m in pr.get('m_Materials',[])];mat=next((m for m in mats if m),{})
        props=mat.get('m_SavedProperties',{});tex=dict(props.get('m_TexEnvs',[]));main=tex.get('_MainTex',tex.get('_BaseMap',{}));tid=ref(main.get('m_Texture'))
        floats=dict(props.get('m_Floats',[]));colors=dict(props.get('m_Colors',[]))
        mid=ref(comps.get('MeshFilter',{}).get('m_Mesh')) if static else ref(pr.get('m_Mesh')) if pr.get('m_RenderMode')==4 else 0
        result.append({'ps':ps,'world':world[node['id']],'texture':tid,'meshFile':raw.get('meshes',{}).get(str(mid)),'static':static,'materialColor':colors.get('_TintColor',colors.get('_Color',dict(r=1,g=1,b=1,a=1))),'additive':floats.get('_DstBlend_Mode',floats.get('_DstBlend'))==1 or 'add' in mat.get('m_Name','').lower(),'mesh':bool(mid)})
    return result

def particles(emitter, seed):
    ps=emitter['ps'];initial=ps['InitialModule'];em=ps['EmissionModule'];rng=random.Random(seed);births=[]
    if not initial.get('enabled',True) or not em.get('enabled',False):return []
    delay=max(0,value(ps.get('startDelay',{})));length=min(2,max(.01,ps.get('lengthInSec',1)))
    for b in em.get('m_Bursts',[]):
        if rng.random()>b.get('probability',1):continue
        cycles=min(8,max(1,b.get('cycleCount',1)))
        for cycle in range(cycles):
            births.extend([delay+b.get('time',0)+cycle*b.get('repeatInterval',0)]*min(36,max(0,round(value(b.get('countCurve',{}),r=rng.random())))))
    rate=max(0,value(em.get('rateOverTime',{})))
    if rate:births.extend(delay+i/rate for i in range(min(36,math.ceil(rate*length))))
    out=[]
    for birth in sorted(births)[:LIMITS['particlesPerEmitter']]:
        r=rng.random();life=max(.02,min(8,value(initial.get('startLifetime',{}),r=r)))
        size=max(.001,min(100,value(initial.get('startSize',{}),r=r)));sizeY=value(initial.get('startSizeY',{}),r=r) if initial.get('size3D') else size
        shape=ps.get('ShapeModule',{});radius=shape.get('radius',{});rad=radius.get('value',0) if isinstance(radius,dict) else radius
        theta=rng.random()*2*math.pi;d=math.sqrt(rng.random())*rad if shape.get('enabled') else 0
        # Initial shapes/directions are approximate in XY; retain all original modules in the archive.
        out.append({'born':birth,'life':life,'size':size,'sizeY':max(.001,sizeY),'r':r,'x':math.cos(theta)*d,'y':math.sin(theta)*d,'vx':math.cos(theta)*value(initial.get('startSpeed',{}),r=r),'vy':math.sin(theta)*value(initial.get('startSpeed',{}),r=r),'rotation':value(initial.get('startRotation',{}),r=r),'color':color(initial.get('startColor',{}),r=r)})
    return out

@lru_cache(maxsize=768)
def texture_image(path):
    im=Image.open(path).convert('RGBA');im.thumbnail((512,512))
    # Some custom Unity materials derive alpha from an RGB channel. Portable preview only:
    # remove near-uniform opaque edge colour, retaining the unmodified PNG in the archive.
    if im.getchannel('A').getextrema()[0]>250:
        corners=[im.getpixel(p)[:3] for p in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]]
        if max(max(v[i] for v in corners)-min(v[i] for v in corners) for i in range(3))<24:
            bg=tuple(round(sum(v[i] for v in corners)/4) for i in range(3))
            diff=ImageChops.difference(im.convert('RGB'),Image.new('RGB',im.size,bg));r,g,b=diff.split();a=ImageChops.lighter(r,ImageChops.lighter(g,b)).point(lambda x:min(255,max(0,x-4)*3));im.putalpha(a)
    return im

@lru_cache(maxsize=256)
def mesh_image(mesh_file,texture_file):
    mesh=json.loads((ARCHIVE/mesh_file).read_text());verts=mesh['vertices'];uvs=mesh['uv'];texture=texture_image(texture_file)
    if not verts or not uvs:return texture
    # Select the largest local planar projection; this is still not Unity's perspective camera.
    ranges=[max(v[i] for v in verts)-min(v[i] for v in verts) for i in range(3)];axes=sorted(range(3),key=lambda i:ranges[i],reverse=True)[:2];axes.sort()
    ax,ay=axes;lo=[min(v[i] for v in verts) for i in axes];span=[max(1e-5,ranges[i]) for i in axes];side=256;scale=240/max(span)
    xy=[((v[ax]-lo[0])*scale+8,248-(v[ay]-lo[1])*scale) for v in verts];out=Image.new('RGBA',(side,side))
    for tri in mesh['triangles']:
        a,b,c=[xy[i] for i in tri];source=[(uvs[i][0]*texture.width,(1-uvs[i][1])*texture.height) for i in tri]
        det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1])
        if abs(det)<1e-5:continue
        def coefficients(channel):
            u,v,w=[p[channel] for p in source];aa=((v-u)*(c[1]-a[1])-(w-u)*(b[1]-a[1]))/det;bb=((w-u)*(b[0]-a[0])-(v-u)*(c[0]-a[0]))/det
            return aa,bb,u-aa*a[0]-bb*a[1]
        tile=texture.transform((side,side),Image.Transform.AFFINE,coefficients(0)+coefficients(1),Image.Resampling.BILINEAR)
        mask=Image.new('L',(side,side));ImageDraw.Draw(mask).polygon([a,b,c],fill=255);tile.putalpha(ImageChops.multiply(tile.getchannel('A'),mask));out.alpha_composite(tile)
    box=out.getbbox();return out.crop(box) if box else out

def preview(raw, textures, seed, size=160):
    ems=emitters(raw)[:LIMITS['emittersPerPreview']]
    sets=[(e,particles(e,seed+i)) for i,e in enumerate(ems)]
    bounds=[1.0]
    for e,ps in sets:
        x,y,sx,sy,_=e['world']
        for p in ps:
            factor=max(abs(sx),abs(sy));sm=e['ps'].get('SizeModule',{});growth=max([1]+[value(sm.get('curve',{}),t) for t in [0,.25,.5,.75,1]]) if sm.get('enabled') else 1
            bounds.append(max(abs(x),abs(y))+min(20,(p['size']*growth+math.hypot(p['x'],p['y'])+min(p['life'],2)*math.hypot(p['vx'],p['vy']))*factor))
    units=max(1,min(30,sorted(bounds)[int((len(bounds)-1)*.9)]));px=size*.42/units
    frames=[];visible=0
    for fi in range(LIMITS['frames']):
        t=(fi+.5)*LIMITS['seconds']/LIMITS['frames'];out=Image.new('RGBA',(size,size))
        for e,ps in sets:
            psys=e['ps'];wx,wy,sx,sy,wa=e['world'];tid=e['texture'];tex=textures.get(tid)
            if not tex:continue
            base=mesh_image(e['meshFile'],str(ARCHIVE/tex['file'])) if e.get('meshFile') else texture_image(str(ARCHIVE/tex['file']));uv=psys.get('UVModule',{})
            for p in ps:
                age=t-p['born']
                if age<0 or age>=p['life']:continue
                u=age/p['life'];sprite=base
                if uv.get('enabled'):
                    nx=max(1,uv.get('tilesX',1));ny=max(1,uv.get('tilesY',1));idx=min(nx*ny-1,max(0,int((value(uv.get('frameOverTime',{}),u,p['r'])*uv.get('cycles',1)%1)*nx*ny)))
                    tw,th=base.width/nx,base.height/ny;row=ny-1-idx//nx
                    sprite=base.crop((round(idx%nx*tw),round(row*th),round((idx%nx+1)*tw),round((row+1)*th)))
                sm=psys.get('SizeModule',{});sz=value(sm.get('curve',{}),u,p['r']) if sm.get('enabled') else 1
                syz=value(sm.get('y',{}),u,p['r']) if sm.get('enabled') and sm.get('separateAxes') else sz
                width=min(size*2,max(1,round(p['size']*abs(sx)*max(0,sz)*px)));height=min(size*2,max(1,round(p['sizeY']*abs(sy)*max(0,syz)*px)))
                if e.get('meshFile'):height=min(size*2,max(1,round(width*base.height/base.width)))
                tile=sprite.resize((width,height),Image.Resampling.LANCZOS)
                c=p['color'];cm=psys.get('ColorModule',{});g=color(cm.get('gradient',{}),u,p['r']) if cm.get('enabled') else [1]*4;mc=e['materialColor'];tint=[max(0,min(255,round(c[i]*g[i]*mc.get(n,1)*255))) for i,n in enumerate('rgba')]
                tile=ImageChops.multiply(tile,Image.new('RGBA',tile.size,tuple(tint)))
                if e['additive']:
                    # Convert additive black to alpha for a portable source-over web sprite.
                    rr,gg,bb,aa=tile.split();lum=ImageChops.lighter(rr,ImageChops.lighter(gg,bb));tile.putalpha(ImageChops.multiply(aa,lum))
                rot=psys.get('RotationModule',{});spin=value(rot.get('curve',{}),u,p['r'])*age if rot.get('enabled') else 0
                tile=tile.rotate(-math.degrees(p['rotation']+spin+wa),resample=Image.Resampling.BICUBIC,expand=True)
                x=p['x']+p['vx']*age;y=p['y']+p['vy']*age
                tx=wx+x*math.cos(wa)-y*math.sin(wa);ty=wy+x*math.sin(wa)+y*math.cos(wa)
                out.alpha_composite(tile,(round(size/2+tx*px-tile.width/2),round(size/2-ty*px-tile.height/2)))
        visible+=bool(out.getbbox());frames.append(out)
    # Stable clip-wide crop: small actual particles should remain inspectable, with no per-frame zoom pumping.
    boxes=[f.getchannel('A').point(lambda a:255 if a>20 else 0).getbbox() for f in frames];boxes=[b for b in boxes if b]
    crop=None
    if boxes:
        b=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes));span=max(b[2]-b[0],b[3]-b[1]);span=min(size,max(24,round(span*1.15)))
        cx=(b[0]+b[2])/2;cy=(b[1]+b[3])/2;crop=[round(cx-span/2),round(cy-span/2),round(cx+span/2),round(cy+span/2)]
        frames=[f.crop(crop).resize((size,size),Image.Resampling.LANCZOS) for f in frames]
    return frames,{'emitters':len(ems),'visibleFrames':visible,'unitsHalfSpan':units,'pixelsPerUnit':px,'crop':crop,'meshEmitters':sum(e['mesh'] for e in ems)}

def save_gif(frames,path):
    bg=Image.new('RGBA',frames[0].size,'#122028');rgb=[Image.alpha_composite(bg,f).convert('RGB') for f in frames]
    rgb[0].save(path,save_all=True,append_images=rgb[1:],duration=[60,60,60,70]*8,loop=0,optimize=True,disposal=2)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('bundle',type=Path,nargs='?');ap.add_argument('--only',nargs='*');ap.add_argument('--rebake',action='store_true');args=ap.parse_args()
    if args.rebake:return rebake(args.only)
    if not args.bundle:ap.error('bundle path required without --rebake')
    x=Extractor(args.bundle);sha=hashlib.sha256(args.bundle.read_bytes()).hexdigest()
    for p in [ARCHIVE/'prefabs',PUBLIC/'previews',PUBLIC/'runtime']:p.mkdir(parents=True,exist_ok=True)
    catalog=[];runtime=[];names=collections.Counter()
    containers=sorted(x.env.container.items())
    for path,obj in containers:
        name=Path(path).stem;category=path.split('/Fxs/')[-1].split('/')[0]
        if args.only and name not in args.only:continue
        raw,tids=x.prefab(obj.path_id)
        for tid in tids:x.texture(tid)
        slug=safe_name(name);names[slug]+=1
        if names[slug]>1:slug+='-'+str(obj.path_id)
        data=json.dumps(raw,separators=(',',':'),ensure_ascii=False).encode()
        dest=ARCHIVE/'prefabs'/(slug+'.json.gz');dest.write_bytes(gzip.compress(data,mtime=0))
        entry={'id':slug,'name':name,'category':category,'sourcePath':path,'rootObjectId':str(obj.path_id),'raw':'prefabs/'+dest.name,'textures':[x.textures[i]['file'] for i in sorted(tids)],'particleSystems':sum(c['type']=='ParticleSystem' for n in raw['nodes'] for c in n['components']),'preview':None}
        if category=='Skill' or name in SELECTED.values():
            frames,info=preview(raw,x.textures,int(hashlib.sha256(path.encode()).hexdigest()[:8],16));gif=PUBLIC/'previews'/(slug+'.gif');save_gif(frames,gif);entry.update(info,preview='/rpg/vfx/previews/'+gif.name,previewMode='approximate-xy-particle-bake')
            for slot,selected in SELECTED.items():
                if name!=selected:continue
                big,meta=preview(raw,x.textures,20261030,size=256);big=runtime_focus(big,slot);meta['runtimeFocus']=RUNTIME_FOCUS.get(slot,1);sheet=Image.new('RGBA',(256*8,256*4))
                for i,f in enumerate(big):sheet.paste(f,((i%8)*256,(i//8)*256))
                sheet.save(PUBLIC/'runtime'/(slot+'.webp'),lossless=True,method=4)
                runtime.append({'id':slot,'sourcePrefab':name,'sourcePath':path,'sheet':'/rpg/vfx/runtime/'+slot+'.webp','cell':256,'columns':8,'frames':32,'duration':2,'anchor':[.5,.5],**meta,'mapping':'thematic-web-adaptation' if slot=='ground-rift' else 'prefab-name-match'})
        catalog.append(entry)
        if len(catalog)%25==0:print('EXTRACTED',len(catalog),flush=True)
    manifest={'sourceBundle':args.bundle.name,'sourceSha256':sha,'extractor':'UnityPy 1.25.4','previewLimits':LIMITS,'scope':'Original Unity data; GIFs are approximate XY particle/planar-mesh bakes, not Unity renders. Custom shaders, scripts, subemitters, trails, weighted curves and 3D perspective are not reproduced. Opaque texture edges may be keyed in previews only.','prefabs':catalog,'textures':sorted(x.textures.values(),key=lambda t:t['name']),'meshes':{str(k):v for k,v in x.meshes.items()}}
    write_json(ARCHIVE/'manifest.json',manifest);write_json(PUBLIC/'catalog.json',{'scope':manifest['scope'],'limits':LIMITS,'prefabs':[{k:v for k,v in p.items() if k not in ['textures','raw']} for p in catalog]});write_json(PUBLIC/'runtime/manifest.json',{'version':1,'sourceSha256':sha,'effects':runtime})
    print('VFX_WRITTEN',len(catalog),'prefabs',len(x.textures),'textures',len(runtime),'runtime effects',flush=True)

@lru_cache(maxsize=1)
def archived_textures():
    return {int(t['id']):t for t in json.loads((ARCHIVE/'manifest.json').read_text())['textures']}

def bake_entry(entry):
    textures=archived_textures();raw=json.loads(gzip.decompress((ARCHIVE/entry['raw']).read_bytes()));seed=int(hashlib.sha256(entry['sourcePath'].encode()).hexdigest()[:8],16)
    frames,info=preview(raw,textures,seed);save_gif(frames,PUBLIC/'previews'/(entry['id']+'.gif'));entry.update(info);updates={}
    for slot,selected in SELECTED.items():
        if entry['name']!=selected:continue
        big,meta=preview(raw,textures,20261030,size=256);big=runtime_focus(big,slot);meta['runtimeFocus']=RUNTIME_FOCUS.get(slot,1);sheet=Image.new('RGBA',(2048,1024))
        for i,f in enumerate(big):sheet.paste(f,((i%8)*256,(i//8)*256))
        sheet.save(PUBLIC/'runtime'/(slot+'.webp'),lossless=True,method=4);updates[slot]=meta
    return entry,updates

def rebake(only=None):
    m=json.loads((ARCHIVE/'manifest.json').read_text());r=json.loads((PUBLIC/'runtime/manifest.json').read_text());runtime={e['id']:e for e in r['effects']};count=0
    selected=[e for e in m['prefabs'] if (not only or e['name'] in only) and (e['category']=='Skill' or e['name'] in SELECTED.values())];byid={}
    with ProcessPoolExecutor(max_workers=4) as pool:
        for entry,updates in pool.map(bake_entry,selected):
            byid[entry['id']]=entry
            for slot,meta in updates.items():runtime[slot].update(meta)
            count+=1
            if count%25==0:print('REBAKED',count,flush=True)
    m['prefabs']=[byid.get(e['id'],e) for e in m['prefabs']]
    write_json(ARCHIVE/'manifest.json',m);write_json(PUBLIC/'catalog.json',{'scope':m['scope'],'limits':LIMITS,'prefabs':[{k:v for k,v in p.items() if k not in ['textures','raw']} for p in m['prefabs']]});r['effects']=list(runtime.values());write_json(PUBLIC/'runtime/manifest.json',r)
    print('REBAKE_WRITTEN',count,flush=True)

if __name__=='__main__':main()
