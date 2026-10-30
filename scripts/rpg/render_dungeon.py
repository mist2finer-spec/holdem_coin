"""Render the recovered real meshes/UVs with software OpenGL (Mesa EGL).

The wide orthographic bake is an explicit belt-scroll adapter. native.png uses
the serialized camera/FOV plus its physical lens shift. Unity post effects are
not claimed; RGBM lightmap interpretation is recorded as a renderer assumption.
Requires numpy, moderngl, Pillow. No Blender or game installation required.
"""
import argparse,json,math
from pathlib import Path
import numpy as np
import moderngl
from PIL import Image,ImageChops
from restore_dungeon import dump

VERT='''#version 330
in vec3 position;in vec2 uv;in vec2 uv2;uniform mat4 mvp;out vec2 vuv;out vec2 vlm;out float depthX;
void main(){gl_Position=mvp*vec4(position,1);vuv=uv;vlm=uv2;depthX=position.x;}
'''
FRAG='''#version 330
in vec2 vuv;in vec2 vlm;in float depthX;out vec4 frag;uniform sampler2D base;uniform sampler2D lightmap;uniform int clipSide;
uniform vec4 tint;uniform vec4 uvst;uniform vec4 lmst;uniform bool haslm;uniform float exposure;
void main(){if(clipSide<0&&depthX> -3.99)discard;if(clipSide>0&&depthX< -4.01)discard;vec4 tex=texture(base,vuv*uvst.xy+uvst.zw)*tint;if(tex.a<.03)discard;
vec3 albedo=pow(max(tex.rgb,vec3(0)),vec3(2.2));vec3 lighting=vec3(.38);
if(haslm){vec4 lm=texture(lightmap,vlm*lmst.xy+lmst.zw);lighting=max(vec3(.025),pow(lm.rgb,vec3(2.2))*pow(max(lm.a,.001),2.2)*34.49324);}
vec3 col=vec3(1)-exp(-albedo*lighting*exposure);frag=vec4(pow(max(col,vec3(0)),vec3(1./2.2)),tex.a);}
'''

class Renderer:
    def __init__(self,root):
        self.root=root;self.data=json.loads((root/'scene.json').read_text());self.ctx=moderngl.create_standalone_context(backend='egl');self.program=self.ctx.program(vertex_shader=VERT,fragment_shader=FRAG);self.tex={};self.draws=[]
        c=self.ctx;self.white=c.texture((1,1),4,b'\xff'*4)
        for key,meta in self.data['textures'].items():
            im=Image.open(root/meta['file']).convert('RGBA').transpose(Image.Transpose.FLIP_TOP_BOTTOM);t=c.texture(im.size,4,im.tobytes());t.filter=(moderngl.LINEAR,moderngl.LINEAR);t.repeat_x=t.repeat_y=True;self.tex[key]=t
        for r in self.data['renderers']:
            g=self.data['geometry'][r['geometry']];v=np.array(g['positions'],dtype='f4');m=np.array(r['world']);v=(np.c_[v,np.ones(len(v))]@m.T)[:,:3]
            stream=np.c_[v,np.array(g['uv']),np.array(g['uv2'])].astype('f4');buffer=c.buffer(stream.tobytes())
            for i,sub in enumerate(r['submeshes']):
                if sub>=len(g['submeshes']):raise ValueError('Static batch submesh outside geometry')
                indices=np.array(g['submeshes'][sub],dtype='i4').ravel()
                if not len(indices):continue
                ib=c.buffer(indices.tobytes());vao=c.vertex_array(self.program,[(buffer,'3f 2f 2f','position','uv','uv2')],index_buffer=ib)
                self.draws.append((r,vao,self.data['materials'].get(r['materials'][min(i,len(r['materials'])-1)]) if r['materials'] else None))
        self.program['base']=0;self.program['lightmap']=1
    def render(self,width,height,center_z=None,orthographic=False,span=14,exposure=1.6,clip_side=0):
        data=self.data;cam=np.array(data['camera']['world'],dtype='f8').copy();raw=data['camera']['raw'];near=raw['near clip plane'];far=raw['far clip plane'];aspect=width/height
        if center_z is not None:cam[2,3]=center_z
        proj=np.zeros((4,4));proj[2,2]=(far+near)/(far-near);proj[2,3]=-2*far*near/(far-near)
        if orthographic:
            proj=np.eye(4);proj[0,0]=2/(span*aspect);proj[1,1]=2/span;proj[2,2]=2/(far-near);proj[2,3]=-(far+near)/(far-near)
        else:
            f=1/math.tan(math.radians(raw['field of view'])/2);proj[0,0]=f/aspect;proj[1,1]=f;proj[3,2]=1
            shift=raw.get('m_LensShift',{});proj[0,2]=-2*shift.get('x',0);proj[1,2]=-2*shift.get('y',0)
        mvp=proj@np.linalg.inv(cam);ctx=self.ctx;fbo=ctx.simple_framebuffer((width,height),components=4);fbo.use();ctx.viewport=(0,0,width,height);ctx.enable(moderngl.DEPTH_TEST|moderngl.BLEND);ctx.blend_func=moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA;fbo.clear(0,0,0,0) if clip_side else fbo.clear(.012,.016,.025,1)
        self.program['clipSide']=clip_side
        self.program['mvp'].write(mvp.T.astype('f4').tobytes());self.program['exposure']=exposure
        for r,vao,mat in self.draws:
            mat=mat or {};tex=self.tex.get(mat.get('texture'),self.white);tex.use(0);self.program['tint']=tuple(mat.get('color',{}).get(k,1) for k in 'rgba');self.program['uvst']=tuple(mat.get('uvScale',[1,1])+mat.get('uvOffset',[0,0]));idx=r['lightmap'];haslm=0<=idx<len(data['lightmaps']);self.program['haslm']=haslm
            self.tex[data['lightmaps'][idx]].use(1) if haslm else self.white.use(1);self.program['lmst']=tuple(r['lightmapUV'].get(k,1 if k in 'xy' else 0) for k in 'xyzw');vao.render()
        im=Image.frombytes('RGBA',(width,height),fbo.read(components=4,alignment=1)).transpose(Image.Transpose.FLIP_TOP_BOTTOM);fbo.release();return im,mvp

def project(matrix,world,width,height):
    p=matrix@np.array([*world,1]);p=p[:3]/p[3];return [(p[0]+1)*width/2,(1-p[1])*height/2,float(p[2])]

def main():
    p=argparse.ArgumentParser();p.add_argument('root',type=Path);a=p.parse_args();r=Renderer(a.root)
    native,_=r.render(720,804);native.save(a.root/'native.png')
    # Original StartPoint Z=-63 and EndPoint Z=7, corridor floor Y=10..11.
    # Keep native camera rotation/X/Y and project Z onto a long orthographic strip.
    width,height=4096,768;span=14;center=-28;im,mvp=r.render(width,height,center_z=center,orthographic=True,span=span);im.convert('RGB').save(a.root/'panorama.webp',quality=92,method=6)
    back,_=r.render(width,height,center_z=center,orthographic=True,span=span,clip_side=-1);back.save(a.root/'background.webp',lossless=True,method=6)
    front,_=r.render(width,height,center_z=center,orthographic=True,span=span,clip_side=1);front.save(a.root/'foreground.webp',lossless=True,method=6)
    flames=[]
    for f in r.data['flames']:
        xyz=np.array(f['world'])[:3,3].tolist();point=project(mvp,xyz,width,height);mat=r.data['materials'][f['material']];meta=r.data['textures'][mat['texture']];uv=f['particle'].get('UVModule',{})
        flames.append({'id':f['id'],'name':f['name'],'pixel':point[:2],'world':xyz,'texture':meta['file'],'tilesX':max(1,uv.get('tilesX',1)),'tilesY':max(1,uv.get('tilesY',1)),'duration':f['particle'].get('InitialModule',{}).get('startLifetime',{}).get('scalar',1),'scale':max(.1,abs(f['world'][0][0])),'size':f['particle'].get('InitialModule',{}).get('startSize',{}).get('scalar',1)})
    # Rendered floor triangles have dominant horizontal surface Y=10 (880 square units).
    # StartPoint Y=11 is the actor origin and must not be used as the sprite's foot plane.
    floor=project(mvp,[-4,10,center],width,height)[1];start=project(mvp,[-4,10,-63],width,height)[0];end=project(mvp,[-4,10,7],width,height)[0]
    parts=[]
    for item in r.data['renderers']:
        g=r.data['geometry'][item['geometry']];vertices=np.array(g['positions']);world=(np.c_[vertices,np.ones(len(vertices))]@np.array(item['world']).T)[:,:3]
        used=np.unique(np.array([tri for sub in item['submeshes'] for tri in g['submeshes'][sub]]).ravel());points=[project(mvp,v,width,height) for v in world[used]];xs=[p[0] for p in points];ys=[p[1] for p in points]
        mat=r.data['materials'].get(item['materials'][0],{}) if item['materials'] else {};tex=r.data['textures'].get(mat.get('texture'),{})
        parts.append({'name':item['name'],'id':item['id'],'mesh':g['name'],'staticBatch':item['staticBatch'],'bounds':[min(xs),min(ys),max(xs),max(ys)],'texture':tex.get('file'),'material':mat.get('name'),'worldPosition':np.array(item['instanceWorld'])[:3,3].tolist()})
    dump(a.root/'layout.json',{'version':1,'scene':r.data['scene'],'image':'panorama.webp','background':'background.webp','foreground':'foreground.webp','actorDepthPlaneX':-4,'size':[width,height],'groundY':floor,'groundWorldY':10,'actorOriginY':11,'pixelsPerNativeUnit':height/span,'startPixel':start,'endPixel':end,'nativeTravelAxis':'Z','nativeTravelRange':[-63,7],'projection':mvp.tolist(),'flames':flames,'parts':parts,'renderer':r.ctx.info['GL_RENDERER'],'assumptions':['Orthographic belt-scroll projection; original scene uses a physical perspective camera.','RGBM decode multiplier 34.49324 / exponent 2.2 and exposure 1.6 are web renderer assumptions.','Unity vignette/dither post-process planes are unresolved; no substitute geometry was invented.','Foreground split is a 2.5D web adaptation at native actor start depth X=-4.']})
    print('DUNGEON_RENDERED',len(r.draws),'draws',len(flames),'flames','floor',floor,'start/end',start,end,flush=True)
if __name__=='__main__':main()
