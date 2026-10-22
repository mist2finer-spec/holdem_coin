"""Build offline contact sheets and a searchable gallery after export_library.py."""
import collections,html,json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2]/'rpg-assets'

def main():
    groups=collections.defaultdict(list); rows=[]
    for item in json.loads((ROOT/'catalog/assets.json').read_text()):
        if not item['path'].endswith('.png'):continue
        path=Path(item['path']); group='/'.join(path.parts[:2]);groups[group].append(item)
    spine=[]
    for path in sorted(ROOT.rglob('spine-manifest.json')):
        info=json.loads(path.read_text()); info['manifest']=path.relative_to(ROOT).as_posix();spine.append(info)
        group='parts/'+info['name']
        for part in info['parts']:
            groups[group].append({'path':(path.parent/part['file']).relative_to(ROOT).as_posix(),'name':part['name'],'type':'SpineRegion'})
    links=[]; font=ImageFont.load_default()
    for group,items in sorted(groups.items()):
        for start in range(0,len(items),96):
            subset=items[start:start+96]; sheet=Image.new('RGB',(1200,math.ceil(len(subset)/8)*130),(30,35,45));draw=ImageDraw.Draw(sheet)
            for i,item in enumerate(subset):
                im=Image.open(ROOT/item['path']).convert('RGBA')
                if group.startswith('parts/'):
                    scale=min(142/im.width,100/im.height);im=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.NEAREST)
                else:im.thumbnail((142,100))
                x=(i%8)*150;y=(i//8)*130;sheet.paste(im,(x+(150-im.width)//2,y),im)
                draw.text((x+3,y+103),item['name'][:23],font=font,fill='white')
            dest=ROOT/'previews'/group/(str(start//96+1).zfill(3)+'.jpg');dest.parent.mkdir(parents=True,exist_ok=True);sheet.save(dest,quality=84)
            links.append((group,dest.relative_to(ROOT).as_posix(),start+1,min(start+96,len(items))))
        for item in items:rows.append(dict(item,category=group))
    (ROOT/'catalog/gallery.json').write_text(json.dumps(rows,ensure_ascii=True))
    (ROOT/'catalog/spine.json').write_text(json.dumps(spine,ensure_ascii=True,indent=2))
    (ROOT/'PREVIEWS.md').write_text('# 에셋 미리보기\n\n각 시트의 표기명으로 `asset_tool.py find` 또는 `catalog/gallery.json`을 검색하세요.\n\n'+'\n'.join(f'- [{group} · {a}–{b}]({path})' for group,path,a,b in links)+'\n')
    (ROOT/'gallery.html').write_text('''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>RPG Asset Library</title>
<style>body{background:#18202b;color:#eee;font:16px system-ui;margin:24px}input{padding:12px;width:min(80%,600px)}#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}article{background:#293548;padding:12px;overflow-wrap:anywhere}img{width:100%;height:128px;object-fit:contain}a{color:#aee}button{padding:12px;margin:12px}</style>
<h1>RPG 에셋 라이브러리</h1><p>이름·분류 검색 / 200개씩 표시 / 원본 이미지 링크</p><input id="q" placeholder="Hero_Axe01, portrait, ui, parts…"><span id="count"></span><div id="grid"></div><button id="more">더 보기</button>
<script>
let rows=[],visible=200;const q=document.querySelector('#q'),grid=document.querySelector('#grid');
function render(){const term=q.value.toLowerCase(),filtered=rows.filter(r=>(r.name+' '+r.category).toLowerCase().includes(term));grid.replaceChildren();document.querySelector('#count').textContent=' '+filtered.length+' files';for(const r of filtered.slice(0,visible)){const el=document.createElement('article'),a=document.createElement('a'),img=document.createElement('img'),text=document.createElement('p');a.href=r.path;img.src=r.path;img.loading='lazy';a.append(img);text.textContent=r.name+' · '+r.category;el.append(a,text);grid.append(el);}document.querySelector('#more').hidden=visible>=filtered.length;}
q.oninput=()=>{visible=200;render()};document.querySelector('#more').onclick=()=>{visible+=200;render()};fetch('catalog/gallery.json').then(r=>r.json()).then(data=>{rows=data;render()}).catch(()=>{grid.textContent='로컬 서버로 여세요: python -m http.server 8080';});
</script>''')
    print(json.dumps({'gallery_images':len(rows),'spine_groups':len(spine),'contact_sheets':len(links)}))
if __name__=='__main__':main()
