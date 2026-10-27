"""Cutout preparation for the confirmed compact Hong source, without diffusion.
Existing visible pixels stay on their assigned parts; joint underpaint is explicit approximation.
"""
import argparse,json,sys,hashlib,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageChops
HERE=Path(__file__).resolve().parent
def read_image(path,mode):
 with Image.open(path) as im:return im.convert(mode)

def main():
 p=argparse.ArgumentParser();p.add_argument('--work',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
 if a.out.exists():raise SystemExit('Choose a NEW output folder; existing work is never overwritten.')
 c=json.loads((a.work/'parts_config.json').read_text());m=json.loads((a.work/'parts_manifest.json').read_text());ref=read_image(a.work/'reference.png','RGBA');a.out.mkdir(parents=True);(a.out/'parts').mkdir();(a.out/'review').mkdir()
 parts={};masks={};owners={};size=ref.size
 # Keep authoritative visible pixel ownership; root-anchored residue is never an attachment.
 for name in c['drawOrder']:
  info=m['parts'][name];im=read_image(a.work/'parts'/f'{name}.png','RGBA');full=Image.new('RGBA',size);full.alpha_composite(im,tuple(info['bounds'][:2]));parts[name]=full
  for y in range(size[1]):
   for x in range(size[0]):
    if full.getpixel((x,y))[3]:owners[(x,y)]=name
 # Assign every otherwise unassigned foreground pixel to its nearest visible cutout.
 # This restores source outline pixels without attaching a static duplicate body.
 seeds=list(owners.items());restored=0
 for y in range(size[1]):
  for x in range(size[0]):
   rgba=ref.getpixel((x,y))
   if not rgba[3] or (x,y) in owners:continue
   _,name=min(seeds,key=lambda kv:(kv[0][0]-x)**2+(kv[0][1]-y)**2)
   parts[name].putpixel((x,y),rgba);restored+=1
 def capsule(im,p0,p1,r,color):
  d=ImageDraw.Draw(im);d.line([p0,p1],fill=color,width=2*r)
  for x,y in [p0,p1]:d.ellipse((x-r,y-r,x+r,y+r),fill=color)
 # Unseen far upper arm: anatomical shoulder->elbow capsule behind torso, not a stretched near arm.
 arm=Image.new('RGBA',size);capsule(arm,(153,84),(172,108),6,(24,23,35,255));capsule(arm,(153,84),(161,94),4,(239,181,153,255));capsule(arm,(162,95),(171,107),4,(49,47,63,255));parts['back-upper-arm']=arm
 # Only hidden surfaces are synthesized: background hair under the head and dark torso under arms.
 for name,color in [('hair-back',(29,29,43,255)),('torso',(37,37,51,255))]:
  part=next(x for x in c['parts'] if x['name']==name);mask=Image.new('L',size);ImageDraw.Draw(mask).polygon([(round(x*256),round(y*256)) for x,y in part['polygon']],fill=255)
  # Stay within the existing source silhouette; do not invent a larger body.
  mask=ImageChops.multiply(mask,ref.getchannel('A'));under=Image.new('RGBA',size,color);under.putalpha(mask);under.alpha_composite(parts[name]);parts[name]=under
 # Add three-pixel overlap at limb joints using each part's own nearest palette pixels.
 # No face/hair pixels are borrowed into sleeves or legs.
 for name in c['drawOrder']:
  if name in ['head','hair-back','torso','pelvis','back-upper-arm']:continue
  im=parts[name];alpha=im.getchannel('A');dilated=alpha.filter(ImageFilter.MaxFilter(7));edge=ImageChops.subtract(dilated,alpha);pts=[(x,y) for y in range(256) for x in range(256) if alpha.getpixel((x,y))]
  if not pts:continue
  p=next(p for p in c['parts'] if p['name']==name);joint=Image.new('L',size);d=ImageDraw.Draw(joint)
  pivots=[p['pivot']]+[q['pivot'] for q in c['parts'] if q['parent']==name]
  for x,y in pivots:d.ellipse((round(x*256)-7,round(y*256)-7,round(x*256)+7,round(y*256)+7),fill=255)
  edge=ImageChops.multiply(edge,joint);under=Image.new('RGBA',size)
  for y in range(256):
   for x in range(256):
    if edge.getpixel((x,y)):
     xx,yy=min(pts,key=lambda q:(q[0]-x)**2+(q[1]-y)**2);under.putpixel((x,y),im.getpixel((xx,yy)))
  under.alpha_composite(im);parts[name]=under
 # Retain existing bone/attachment mapping, recalculate trimmed rectangles after overlap.
 sk=json.loads((a.work/'spine/hong.json').read_text());attachments=sk['skins'][0]['attachments'];slots={x['name']:x for x in sk['slots']};pivots={p['name']:p['pivot'] for p in c['parts']}
 atlas=Image.new('RGBA',(512,512));x=y=4;row=0;lines=['hong.png','size:512,512','format:RGBA8888','filter:Nearest,Nearest','repeat:none','pma:false'];setup=Image.new('RGBA',size)
 for name in c['drawOrder']:
  im=parts[name];bbox=im.getbbox()
  if not bbox:raise ValueError('Empty motion part '+name)
  tile=im.crop(bbox);tile.save(a.out/'parts'/f'{name}.png');slots[name]['attachment']=name;px,py=pivots[name]
  attachments[name]={name:{'type':'region','path':name,'x':round((bbox[0]+bbox[2])/2-px*256,4),'y':round(py*256-(bbox[1]+bbox[3])/2,4),'width':tile.width,'height':tile.height}}
  if x+tile.width+4>512:x=4;y+=row+4;row=0
  if y+tile.height+4>512:raise ValueError('Atlas full')
  atlas.alpha_composite(tile,(x,y));lines.extend([name,f'bounds:{x},{y},{tile.width},{tile.height}']);x+=tile.width+4;row=max(row,tile.height);setup.alpha_composite(im)
 atlas.save(a.out/'hong.png');text='\n'.join(lines)+'\n'
 for n in ['hong.atlas','hong.atlas.txt']:(a.out/n).write_text(text)
 (a.out/'hong.json').write_text(json.dumps(sk,indent=2));setup.save(a.out/'review/setup.png');ref.save(a.out/'review/original-transparent.png')
 proof={'sourceSha256':hashlib.sha256((a.work/'reference.png').read_bytes()).hexdigest(),'restoredUnassignedPixels':restored,'completion':'Explicit anatomical back-upper-arm capsule; nearest-palette 3px joint overlaps; dark hidden hair/torso underpaint. Artist approximations, not recovered original pixels.','faceRegenerated':False,'diffusionUsed':False,'residualRootAttachment':False,'config':c}
 (a.out/'parts-preparation.json').write_text(json.dumps(proof,indent=2));print('MOTION_PARTS_READY',a.out)
if __name__=='__main__':main()
