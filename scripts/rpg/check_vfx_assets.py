"""Offline VFX extraction/bake integrity; no LLM, network or original APK required."""
import gzip,hashlib,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
def main():
    arc=ROOT/'archive/rpg/vfx';m=json.loads((arc/'manifest.json').read_text());ids=set();count=0
    assert len(m['prefabs'])==633 and len(m['textures'])==741
    for t in m['textures']:
        file=arc/t['file'];assert hashlib.sha256(file.read_bytes()).hexdigest()==t['sha256'];im=Image.open(file);assert list(im.size)==t['size']
    for p in m['prefabs']:
        assert p['id'] not in ids;ids.add(p['id']);raw=json.loads(gzip.decompress((arc/p['raw']).read_bytes()));nodeids={n['id'] for n in raw['nodes']}
        for n in raw['nodes']:assert n['parent'] is None or n['parent'] in nodeids
        for f in p['textures']:assert (arc/f).is_file()
        for f in raw.get('meshes',{}).values():assert (arc/f).is_file()
        if p['preview']:
            im=Image.open(ROOT/('public'+p['preview']));duration=0
            for i in range(im.n_frames):im.seek(i);duration+=im.info['duration']
            assert duration==2000,(p['id'],duration);count+=1
    r=json.loads((ROOT/'public/rpg/vfx/runtime/manifest.json').read_text());assert len(r['effects'])==6
    for e in r['effects']:
        im=Image.open(ROOT/('public'+e['sheet']));assert im.size==(2048,1024);assert im.mode=='RGBA';assert im.getchannel('A').getbbox();assert e['visibleFrames']>0
    print('VFX_ASSETS_PASSED',len(m['prefabs']),len(m['textures']),count)
if __name__=='__main__':main()
