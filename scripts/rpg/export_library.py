"""Lossless source archive + per-object metadata + individually editable images.
python scripts/rpg/export_library.py INPUT.zip --output rpg-assets
Requires requirements-assets.txt. Never modifies the input or public/rpg.
"""
import argparse, base64, collections, csv, hashlib, io, json, math, re, zipfile
from pathlib import Path
import UnityPy
from PIL import Image, ImageDraw


def safe(value):
    return re.sub(r'[^\w.\-]+', '_', str(value)).strip('._')[:110] or 'unnamed'


def encoded(value):
    if isinstance(value, bytes):
        return {'$bytes_base64': base64.b64encode(value).decode()}
    raise TypeError(type(value).__name__)


def normalize(value):
    if isinstance(value, dict): return {k: normalize(v) for k,v in value.items()}
    if isinstance(value, (list,tuple)): return [normalize(v) for v in value]
    if isinstance(value, int) and abs(value)>9007199254740991: return str(value)
    if isinstance(value, float) and not math.isfinite(value): return {'$float':str(value)}
    return value


def dump(value):
    return json.dumps(normalize(value), ensure_ascii=True, allow_nan=False, default=encoded, separators=(',', ':'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def text_bytes(data):
    return data.m_Script.encode('utf-8', errors='surrogateescape') if isinstance(data.m_Script, str) else bytes(data.m_Script)


def category(group, name):
    if group == 'model':
        return 'characters/' + ('heroes' if name.startswith('Hero_') else 'enemies' if name.startswith('Enemy_') else 'npcs' if name.startswith('NPC_') else 'objects')
    if group == 'map': return 'maps/lightmaps' if 'lightmap' in name.lower() else 'maps/backgrounds'
    if group == 'fx': return 'effects/textures'
    if group == 'uiicons':
        return 'ui/' + ('portraits' if 'portrait' in name.lower() else 'skills' if 'skill' in name.lower() else 'items' if name.startswith(('Gear', 'mat_', 'Item')) else 'icons')
    if group.startswith('ui'): return 'ui/' + group
    return 'misc/' + group


def atlas_regions(text):
    """Spine modern bounds/offsets and legacy xy/size/orig/offset syntax."""
    pages, region, page = [], None, None
    for line in text.splitlines():
        s = line.strip()
        if not s: region = None; page = None; continue
        if ':' not in s:
            if page is None:
                page = {'name': s, 'regions': []}; pages.append(page); region = None
            else:
                region = {'name': s}; page['regions'].append(region)
        else:
            key, value = s.split(':', 1)
            if region is not None: region[key] = value.strip()
    return pages


def main():
    p = argparse.ArgumentParser(); p.add_argument('input'); p.add_argument('--output', default='rpg-assets')
    args = p.parse_args(); root = Path(args.output)
    if root.exists(): raise SystemExit('Output exists; choose a fresh directory (no overwrites).')
    root.mkdir(parents=True)
    for d in ['sources', 'metadata', 'catalog', 'previews']: (root/d).mkdir()
    env = UnityPy.Environment(); bundles = []; records = []; files = []; errors = []
    with zipfile.ZipFile(args.input) as z:
        for name in z.namelist():
            if not name.endswith('.bundle'): continue
            raw = z.read(name); filename = Path(name).name
            group = filename.split('_assets_')[0].split('_scenes_')[0]
            if group.startswith('be9'): group = 'unity-' + ('scripts' if 'monoscripts' in name else 'builtin')
            dest = root/'sources'/filename; dest.write_bytes(raw)
            loaded = env.load_file(raw, name=filename)
            bundles.append((filename, safe(group), list(loaded.get_objects())))
            print('LOADED', filename, flush=True)
    source_summary = []
    for bundle, group, objects in bundles:
        source_summary.append({'bundle': bundle, 'sha256': sha(root/'sources'/bundle), 'objects': len(objects), 'types': dict(collections.Counter(o.type.name for o in objects))})
        archives = {}; image_lookup = {}; texts = []; group_records = []
        for index, obj in enumerate(objects):
            kind = obj.type.name; pid = str(obj.path_id); cab = obj.assets_file.name
            key = f'{bundle}:{cab}:{pid}'
            rec = {'id': key, 'bundle': bundle, 'serialized_file': cab, 'path_id': pid, 'type': kind, 'name': '', 'files': [], 'status': 'metadata_only'}
            tree_error = None
            try:
                tree = obj.read_typetree(); rec['name'] = str(tree.get('m_Name', ''))
            except Exception as exc:
                tree = None; tree_error = f'{type(exc).__name__}: {exc}'
            try:
                if kind in ('Texture2D', 'Sprite', 'TextAsset', 'Mesh', 'Font', 'Cubemap'):
                    data = obj.read(); name = str(getattr(data, 'm_Name', '') or kind); rec['name'] = name
                    folder = root/category(group, name)
                    if group == 'model': folder /= safe(name.removesuffix('.atlas'))
                    folder.mkdir(parents=True, exist_ok=True)
                    stem = safe(name) + '__' + safe(cab)[-8:] + '_' + pid
                    if kind == 'Texture2D' and (data.m_Width == 0 or data.m_Height == 0):
                        dest=None; rec.update(status='empty_runtime_texture',reason='Zero-sized texture; no source pixels to extract')
                    elif kind == 'Cubemap':
                        from UnityPy.export.Texture2DConverter import parse_image_data
                        raw=data.get_image_data(); stride=data.m_CompleteImageSize
                        if stride*data.m_ImageCount != len(raw): raise ValueError('Cubemap face layout mismatch')
                        for face in range(data.m_ImageCount):
                            face_dest=folder/(stem+f'.face-{face}.png')
                            im=parse_image_data(raw[face*stride:(face+1)*stride],data.m_Width,data.m_Height,data.m_TextureFormat,obj.version,obj.platform,getattr(data,'m_PlatformBlob',None),True)
                            im.save(face_dest)
                            rec['files'].append(face_dest.relative_to(root).as_posix())
                            files.append({'path':rec['files'][-1], 'sha256':sha(face_dest),'bytes':face_dest.stat().st_size,'object_id':key,'type':kind,'name':name+f' face {face}'})
                        rec.update(width=data.m_Width,height=data.m_Height,status='extracted',faces=data.m_ImageCount)
                        dest=None
                    elif kind in ('Texture2D', 'Sprite'):
                        dest = folder/(stem + ('.sprite' if kind == 'Sprite' else '') + '.png')
                        im = data.image; im.save(dest)
                        rec.update(width=im.width, height=im.height, status='extracted')
                        image_lookup[name] = dest
                    elif kind == 'TextAsset':
                        payload = text_bytes(data)
                        try: json.loads(payload); ext = '.json'
                        except Exception: ext = '' if Path(name).suffix else '.txt'
                        dest = folder/(stem + ext); dest.write_bytes(payload)
                        texts.append((name, dest, payload, rec)); rec['status'] = 'extracted'
                    elif kind == 'Mesh':
                        dest = root/'geometry'/group/(stem+'.obj'); dest.parent.mkdir(parents=True, exist_ok=True)
                        dest.write_text(data.export(), encoding='utf-8'); rec['status']='extracted'
                    else:
                        payload = bytes(data.m_FontData)
                        dest = folder/(stem+'.font'); dest.write_bytes(payload); rec['status']='extracted'
                    if dest is not None:
                        rec['files'].append(dest.relative_to(root).as_posix())
                        files.append({'path': rec['files'][-1], 'sha256': sha(dest), 'bytes': dest.stat().st_size, 'object_id': key, 'type':kind, 'name': name})
            except Exception as exc:
                rec['status']='export_failed'; rec['error']=f'{type(exc).__name__}: {exc}'; errors.append({'id':key,'stage':'export','error':rec['error']})
            # Preserve each Unity object's metadata independently inside type archives.
            # Binary payloads already live in source bundles, do not duplicate texture data in JSON.
            if tree is not None:
                for field in ('image data', 'm_ImageData', 'm_Script', 'm_FontData'):
                    if field in tree and kind in ('Texture2D','TextAsset','Font'):
                        value=tree[field]; tree[field]={'$source_payload':key, 'length':len(value), 'exported_files':rec['files']}
            archive_key = kind
            if archive_key not in archives:
                dest=root/'metadata'/group/(kind+'.zip'); dest.parent.mkdir(parents=True,exist_ok=True)
                archives[archive_key]=zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)
            member=safe(cab)+'/'+pid+'.json'
            rec['metadata']={'archive': f'metadata/{group}/{kind}.zip', 'member':member}
            metadata={'identity':dict(rec), 'externals':[{'file_id':i+1,'path':v.path} for i,v in enumerate(obj.assets_file.externals)], 'tree':tree}
            if tree_error:
                metadata['tree_error']=tree_error
                metadata['raw_base64']=base64.b64encode(obj.get_raw_data()).decode()
                rec['metadata_fallback']='raw_binary'; errors.append({'id':key,'stage':'typetree','error':tree_error})
            archives[archive_key].writestr(member,dump(metadata))
            records.append(rec); group_records.append(rec)
            if index % 10000 == 0: print('OBJECTS',group,index,'/',len(objects),flush=True)
        for archive in archives.values(): archive.close()
        (root/'catalog'/(group+'.jsonl')).write_text('\n'.join(dump(r) for r in group_records)+'\n')
        # Spine pages are copied to their exact atlas-declared names. Atlas stays byte-for-byte original.
        for name, path, payload, rec in texts:
            if not name.endswith('.atlas'): continue
            base=name[:-6]; folder=root/category(group,base)/safe(base)
            folder.mkdir(parents=True,exist_ok=True)
            atlas_dest=folder/(safe(base)+'.atlas'); atlas_dest.write_bytes(payload)
            skeleton=next((t for t in texts if t[0]==base),None)
            spine={'name':base,'source_object':rec['id'],'atlas':atlas_dest.name,'pages':[],'parts':[],'errors':[]}
            if skeleton:
                skdest=folder/(safe(base)+'.json'); skdest.write_bytes(skeleton[2]); sk=json.loads(skeleton[2])
                spine.update(skeleton=skdest.name,spine_version=sk.get('skeleton',{}).get('spine'),skins=[s['name'] for s in sk.get('skins',[])],animations=list(sk.get('animations',{})))
            for page in atlas_regions(payload.decode('utf-8-sig')):
                page_name=page['name']; texture=image_lookup.get(Path(page_name).stem)
                if not texture:
                    spine['errors'].append('Missing page: '+page_name); continue
                dest=folder/safe(page_name); dest.write_bytes(texture.read_bytes()); spine['pages'].append(dest.name)
                im=Image.open(texture).convert('RGBA')
                for reg in page['regions']:
                    try:
                        if 'bounds' in reg: x,y,w,h=map(int,reg['bounds'].split(','))
                        else:
                            x,y=map(int,reg['xy'].split(',')); w,h=map(int,reg['size'].split(','))
                        rot=reg.get('rotate','0'); degrees=90 if rot=='true' else 0 if rot=='false' else int(rot)
                        if degrees not in (0,90,180,270): raise ValueError('Unsupported rotation '+rot)
                        cw,ch=(h,w) if degrees in (90,270) else (w,h)
                        if x<0 or y<0 or x+cw>im.width or y+ch>im.height: raise ValueError('Atlas bounds outside page')
                        crop=im.crop((x,y,x+cw,y+ch))
                        if degrees: crop=crop.rotate(-degrees,expand=True)
                        ox=oy=0; ow,oh=w,h
                        if 'offsets' in reg: ox,oy,ow,oh=map(int,reg['offsets'].split(','))
                        elif 'orig' in reg:
                            ow,oh=map(int,reg['orig'].split(',')); ox,oy=map(int,reg.get('offset','0,0').split(','))
                        restored=Image.new('RGBA',(ow,oh)); restored.paste(crop,(ox,oh-oy-h))
                        # A hash prevents sanitized region-name collisions and preserves the exact name in JSON.
                        part=folder/'parts'/(safe(reg['name'])+'__'+hashlib.sha256(reg['name'].encode()).hexdigest()[:8]+'.png')
                        part.parent.mkdir(exist_ok=True); restored.save(part)
                        spine['parts'].append({'name':reg['name'],'file':part.relative_to(folder).as_posix(),'page':page_name,'bounds':[x,y,w,h],'rotation':degrees,'offset':[ox,oy],'original_size':[ow,oh]})
                    except Exception as exc: spine['errors'].append(reg['name']+': '+str(exc))
            (folder/'spine-manifest.json').write_text(json.dumps(spine,ensure_ascii=False,indent=2))
            if spine['errors']: errors.append({'id':rec['id'],'stage':'spine','errors':spine['errors']})
        print('EXPORTED',group,len(objects),'objects',flush=True)
    (root/'catalog/sources.json').write_text(json.dumps(source_summary,indent=2))
    (root/'catalog/assets.json').write_text(json.dumps(files,ensure_ascii=True,indent=2))
    (root/'catalog/errors.json').write_text(json.dumps(errors,ensure_ascii=True,indent=2))
    with (root/'catalog/assets.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['name','type','path','bytes','sha256','object_id']);w.writeheader();w.writerows(files)
    summary={'source_zip_sha256':sha(Path(args.input)),'bundles':len(bundles),'unity_objects':len(records),'exports':len(files),'statuses':dict(collections.Counter(r['status'] for r in records)),'errors':len(errors)}
    (root/'catalog/summary.json').write_text(json.dumps(summary,indent=2))
    print(dump(summary),flush=True)

if __name__=='__main__': main()
