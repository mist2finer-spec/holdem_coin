"""Export one real Unity map scene, including qualified references and static batches.

UnityPy==1.25.4, numpy, Pillow. Rendering: render_dungeon.py (moderngl/EGL).
Source bundles are read only. No original game/server is launched.
"""
import argparse,gzip,hashlib,json,math
from pathlib import Path
import numpy as np
import UnityPy
from UnityPy.classes.PPtr import PPtr
from UnityPy.helpers.MeshHelper import MeshHandler

ROOT=Path(__file__).resolve().parents[2]

def trs(t):
    p=t.get('m_LocalPosition',{});q=t.get('m_LocalRotation',{});s=t.get('m_LocalScale',{})
    x,y,z,w=[q.get(k,1 if k=='w' else 0) for k in 'xyzw'];m=np.eye(4)
    m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag([s.get(k,1) for k in 'xyz'])
    m[:3,3]=[p.get(k,0) for k in 'xyz'];return m

def dump(path,value,compact=False):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':') if compact else None,indent=None if compact else 2)+'\n')

class SceneExport:
    def __init__(self,scenes,assets,out):
        self.env=UnityPy.load(str(scenes),str(assets));self.out=out;self.trees={};self.worlds={};self.active={};self.geometry={};self.materials={};self.textures={};self.errors=[]
        self.source_hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [scenes,assets]}
    def key(self,o):return o.assets_file.name+'#'+str(o.path_id)
    def tree(self,o):
        k=self.key(o)
        if k not in self.trees:self.trees[k]=o.read_typetree()
        return self.trees[k]
    def resolve(self,source,ref):
        if not ref or not ref.get('m_PathID'):return None
        return PPtr(m_FileID=ref.get('m_FileID',0),m_PathID=int(ref['m_PathID']),assetsfile=source.assets_file).deref()
    def components(self,go):
        return [self.resolve(go,c['component']) for c in self.tree(go).get('m_Component',[])]
    def transform(self,go):return next((c for c in self.components(go) if c.type.name in ['Transform','RectTransform']),None)
    def world(self,tr,visiting=None):
        if tr is None:return np.eye(4)
        key=self.key(tr)
        if key in self.worlds:return self.worlds[key]
        visiting=set() if visiting is None else visiting
        if key in visiting:raise ValueError('Transform cycle '+key)
        visiting.add(key);t=self.tree(tr);parent=self.resolve(tr,t.get('m_Father'));m=self.world(parent,visiting)@trs(t);visiting.remove(key);self.worlds[key]=m;return m
    def is_active(self,tr):
        key=self.key(tr)
        if key in self.active:return self.active[key]
        t=self.tree(tr);go=self.resolve(tr,t['m_GameObject']);parent=self.resolve(tr,t.get('m_Father'));result=self.tree(go).get('m_IsActive',True) and (not parent or self.is_active(parent));self.active[key]=result;return result
    def texture(self,o):
        if not o:return None
        key=self.key(o)
        if key in self.textures:return key
        d=o.read();filename=hashlib.sha256(key.encode()).hexdigest()[:16]+'.png';dest=self.out/'textures'/filename;dest.parent.mkdir(parents=True,exist_ok=True);im=d.image.convert('RGBA');im.save(dest,optimize=True)
        self.textures[key]={'name':d.m_Name,'file':'textures/'+filename,'size':list(im.size),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'unityFormat':int(d.m_TextureFormat)};return key
    def material(self,o):
        if not o:return None
        key=self.key(o)
        if key in self.materials:return key
        t=self.tree(o);props=t.get('m_SavedProperties',{});envs=dict(props.get('m_TexEnvs',[]));main=envs.get('_MainTex',envs.get('_BaseMap',{}));floats=dict(props.get('m_Floats',[]));colors=dict(props.get('m_Colors',[]));tex=self.resolve(o,main.get('m_Texture'))
        self.materials[key]={'name':t['m_Name'],'texture':self.texture(tex),'color':colors.get('_BaseColor',colors.get('_Color',dict(r=1,g=1,b=1,a=1))),'uvScale':[main.get('m_Scale',{}).get(k,1) for k in 'xy'],'uvOffset':[main.get('m_Offset',{}).get(k,0) for k in 'xy'],'cutoff':floats.get('_Cutoff',.02),'raw':t};return key
    def mesh(self,o):
        key=self.key(o)
        if key in self.geometry:return key
        d=o.read();h=MeshHandler(d);h.process();v=h.m_Vertices;uv=h.m_UV0;uv2=h.m_UV1
        self.geometry[key]={'name':d.m_Name,'positions':v,'uv':uv if uv and len(uv)==len(v) else [[0,0]]*len(v),'uv2':uv2 if uv2 and len(uv2)==len(v) else [[0,0]]*len(v),'submeshes':h.get_triangles()};return key
    def export(self,scene):
        path='Assets/InHouse/Maps/Scenes/'+scene+'.unity';ptr=self.env.container[path]
        # Streamed-scene container is a null PPtr in the companion sharedAssets file.
        # Its matching CAB (without .sharedAssets) contains the actual instantiated scene.
        file_name=ptr.assetsfile.name.removesuffix('.sharedAssets');f=next(o.assets_file for o in self.env.objects if o.assets_file.name==file_name)
        renderers=[];nodes=[];lights=[];flames=[];camera=None;settings={};blocks=[];raw_scene=[]
        for o in f.objects.values():
            typ=o.type.name
            if typ=='GameObject':
                t=self.tree(o);tr=self.transform(o)
                if not tr:continue
                parent=self.resolve(tr,self.tree(tr).get('m_Father'));nodes.append({'id':self.key(o),'name':t['m_Name'],'transformId':self.key(tr),'parent':self.key(parent) if parent else None,'local':self.tree(tr),'world':self.world(tr).tolist(),'active':self.is_active(tr)})
            if typ=='LightmapSettings':
                t=self.tree(o);settings['lightmapSettings']=t;settings['lightmaps']=[self.texture(self.resolve(o,r['m_Lightmap'])) for r in t['m_Lightmaps']]
            if typ=='RenderSettings':settings['renderSettings']=self.tree(o)
            if typ=='MonoBehaviour':
                t=self.tree(o)
                if '_grid' in t:
                    blocks=t['_grid'].get('blocks',[]);settings['mapHelper']=t
                    config=self.resolve(o,t.get('_mapSceneConfig'))
                    if config:settings['mapSceneConfig']=self.tree(config)
                    settings['blockDefinitions']={}
                    for b in blocks:
                        meta=self.resolve(o,b['meta'])
                        if meta:settings['blockDefinitions'][self.key(meta)]=self.tree(meta)
            if typ not in ['MeshRenderer','Camera','Light','ParticleSystemRenderer']:continue
            t=self.tree(o);go=self.resolve(o,t['m_GameObject']);tr=self.transform(go)
            if not tr:continue
            name=self.tree(go)['m_Name'];m=self.world(tr);active=self.is_active(tr) and t.get('m_Enabled',True)
            if typ=='Camera':camera={'raw':t,'world':m.tolist(),'name':name};continue
            if typ=='Light':
                lights.append({'id':self.key(o),'name':name,'world':m.tolist(),'active':active,'raw':t});continue
            if not active:continue
            if typ=='ParticleSystemRenderer':
                for ref in t.get('m_Materials',[]):
                    mat=self.material(self.resolve(o,ref));mt=self.materials.get(mat,{});tex=self.textures.get(mt.get('texture'),{})
                    if 'firesequence' in tex.get('name','').lower():
                        ps=next((c for c in self.components(go) if c.type.name=='ParticleSystem'),None)
                        flames.append({'id':self.key(o),'name':name,'world':m.tolist(),'material':mat,'particle':self.tree(ps) if ps else {},'renderer':t})
                continue
            mf=next((c for c in self.components(go) if c.type.name=='MeshFilter'),None)
            if not mf:continue
            try:mesh=self.resolve(mf,self.tree(mf)['m_Mesh'])
            except FileNotFoundError as error:
                self.errors.append({'name':name,'kind':'external-mesh','reference':self.tree(mf)['m_Mesh'],'reason':str(error)});continue
            if not mesh:continue
            geo=self.mesh(mesh);batch=t.get('m_StaticBatchInfo',{});count=batch.get('subMeshCount',0);first=batch.get('firstSubMesh',0)
            batch_root=self.resolve(o,t.get('m_StaticBatchRoot'))
            combined=count>0 and self.geometry[geo]['name'].startswith('Combined Mesh')
            model=self.world(batch_root) if combined and batch_root else np.eye(4) if combined else m
            mats=[self.material(self.resolve(o,r)) for r in t['m_Materials']]
            subs=list(range(first,first+count)) if count else list(range(len(self.geometry[geo]['submeshes'])))
            renderers.append({'id':self.key(o),'name':name,'geometry':geo,'materials':mats,'world':model.tolist(),'instanceWorld':m.tolist(),'submeshes':subs,'staticBatch':combined,'lightmap':t.get('m_LightmapIndex',65535),'lightmapUV':t.get('m_LightmapTilingOffset',dict(x=1,y=1,z=0,w=0)),'raw':t})
        if not camera:raise ValueError('Original camera missing')
        evidence={'scene':scene,'sourcePath':path,'sceneFile':file_name,'nodes':nodes,'blocks':blocks,'settings':settings,'lights':lights,'camera':camera,'flames':flames}
        scene_data={'scene':scene,'coordinateSystem':'Unity left-handed, Y up; world matrices are row-major arrays','camera':camera,'geometry':self.geometry,'materials':{k:{a:b for a,b in v.items() if a!='raw'} for k,v in self.materials.items()},'textures':self.textures,'renderers':[{k:v for k,v in r.items() if k!='raw'} for r in renderers],'lightmaps':settings.get('lightmaps',[]),'lights':[{k:v for k,v in l.items() if k!='raw'} for l in lights],'flames':flames,'scope':'Original mesh placement and UV export. Unity shaders/physical lens/lightmap HDR decoding need an explicit renderer adapter.'}
        dump(self.out/'scene.json',scene_data,True)
        raw={'renderers':renderers,'materials':self.materials,**evidence};(self.out/'source.json.gz').write_bytes(gzip.compress(json.dumps(raw,separators=(',',':')).encode(),mtime=0))
        summary={'scene':scene,'sourcePath':path,'sceneFile':file_name,'sourceSha256':self.source_hashes,'nodes':len(nodes),'renderers':len(renderers),'meshes':len(self.geometry),'materials':len(self.materials),'textures':len(self.textures),'lights':len(lights),'flames':len(flames),'blocks':len(blocks),'unresolved':self.errors,'camera':camera,'blockPlacements':blocks}
        dump(self.out/'evidence.json',summary);print(json.dumps({k:v for k,v in summary.items() if k not in ['camera','blockPlacements']}),flush=True)
        print('camera world',camera['world'],flush=True)
        return scene_data

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--scenes',type=Path,required=True);p.add_argument('--assets',type=Path,required=True);p.add_argument('--scene',default='Map002_001');p.add_argument('--output',type=Path,default=ROOT/'public/rpg/maps/candle-dungeon');a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
    SceneExport(a.scenes,a.assets,a.output).export(a.scene)
