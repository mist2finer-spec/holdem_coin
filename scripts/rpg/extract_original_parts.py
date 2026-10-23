"""Deterministic cutouts from supplied character design boards; never redraw identities.
Requires Pillow, numpy, scipy. Coordinates use a 2048x1143 reference canvas.
The JPEG background matte is estimated; original layered/alpha sources remain preferable.
"""
import json,hashlib
from pathlib import Path
import numpy as np
from scipy import ndimage
from PIL import Image
from build_character_assets import ROSTER
from build_spine_characters import PARTS
ROOT=Path(__file__).resolve().parents[2]
# head, torso, skirt/hips, upper arms, forearms, hands, legs, shoes, rear hair.
SPECS={
1:dict(head=(1031,220,1179,379),torso=(1171,382,1342,578),pelvis=(1120,587,1394,971),arms=[(1073,403,1157,544),(1357,404,1440,544)],fore=[(1044,547,1132,655),(1381,547,1470,655)],hands=[(1043,656,1100,739),(1413,656,1471,737)],legs=[(1163,729,1247,1016),(1275,733,1349,1016)],feet=[(1154,983,1236,1056),(1278,983,1359,1056)],hair=(1213,220,1350,346)),
2:dict(head=(1036,150,1213,306),torso=(1110,347,1252,577),pelvis=(1083,614,1275,699),arms=[(1350,377,1454,557)]*2,fore=[(1311,604,1385,736)]*2,hands=[(1325,732,1385,791),(1424,719,1479,778)],legs=[(1083,684,1178,896),(1181,684,1275,896)],feet=[(1055,924,1158,1014),(1201,924,1304,1014)],hair=(1231,163,1389,279)),
3:dict(head=(1031,117,1195,275),torso=(1194,279,1329,448),pelvis=(1137,450,1376,723),arms=[(1077,326,1147,465),(1379,321,1449,460)],fore=[(1068,477,1117,609),(1409,476,1458,608)],hands=[(1054,615,1116,702),(1409,615,1472,702)],legs=[(1161,727,1249,1018),(1273,731,1351,1018)],feet=[(1170,1024,1249,1090),(1282,1024,1385,1088)],hair=(1200,117,1370,275)),
4:dict(head=(1042,219,1172,373),torso=(1163,371,1353,626),pelvis=(1175,631,1340,740),arms=[(1080,414,1146,549),(1368,414,1435,549)],fore=[(1058,560,1121,656),(1394,559,1457,656)],hands=[(1044,656,1100,737),(1415,656,1470,737)],legs=[(1168,746,1248,974),(1267,746,1347,973)],feet=[(1146,984,1237,1057),(1279,981,1374,1053)],hair=(1201,218,1363,346)),
5:dict(head=(1122,92,1296,277),torso=(1178,388,1337,588),pelvis=(1188,609,1345,714),arms=[(1058,415,1136,544),(1380,414,1454,538)],fore=[(1051,557,1109,658),(1413,556,1477,658)],hands=[(1051,654,1109,739),(1413,654,1477,739)],legs=[(1159,734,1263,1000),(1273,732,1397,1000)],feet=[(1159,994,1263,1110),(1273,994,1397,1110)],hair=(1122,92,1296,388)),
6:dict(head=(1145,90,1299,259),torso=(1194,451,1325,560),pelvis=(1162,580,1354,715),arms=[(1059,433,1128,543),(1386,433,1453,539)],fore=[(1051,557,1109,658),(1413,556,1478,658)],hands=[(1051,654,1109,739),(1413,654,1478,739)],legs=[(1158,735,1256,1000),(1275,735,1398,1000)],feet=[(1158,994,1256,1110),(1275,994,1398,1110)],hair=(1035,90,1139,400)),
7:dict(head=(1100,95,1302,277),torso=(1194,438,1329,556),pelvis=(1162,581,1355,715),arms=[(1060,451,1128,544),(1387,433,1454,539)],fore=[(1051,557,1108,658),(1413,556,1466,659)],hands=[(1051,654,1108,740),(1419,656,1477,740)],legs=[(1158,735,1256,1000),(1276,734,1397,1000)],feet=[(1158,994,1256,1110),(1276,994,1397,1110)],hair=(1100,95,1302,426)),
8:dict(head=(1031,214,1188,384),torso=(1171,392,1339,568),pelvis=(1163,582,1349,736),arms=[(1074,434,1133,553),(1373,434,1432,553)],fore=[(1044,563,1119,665),(1387,563,1462,665)],hands=[(1044,659,1119,729),(1387,659,1462,729)],legs=[(1166,747,1240,973),(1271,748,1346,973)],feet=[(1150,981,1240,1056),(1276,979,1369,1052)],hair=(1196,214,1362,384)),
9:dict(head=(1042,95,1176,276),torso=(1183,299,1342,493),pelvis=(1166,514,1351,706),arms=[(1081,343,1154,467),(1367,343,1441,467)],fore=[(1064,476,1124,612),(1401,476,1462,611)],hands=[(1054,616,1116,702),(1410,615,1471,702)],legs=[(1162,726,1251,1017),(1273,730,1354,1017)],feet=[(1171,1026,1243,1091),(1282,1026,1377,1086)],hair=(1345,95,1484,276))}
def board(n):
 p=ROOT/f'public/island/chr_{n}.jpg';im=Image.open(p).convert('RGB').resize((2048,1143),Image.Resampling.NEAREST)
 rgb=np.asarray(im).astype(float)
 # Clear column boundary strips sample the actual JPEG gradient, not black ink.
 left=ndimage.median_filter(np.median(rgb[:,1033:1040],axis=1),size=(41,1))
 right=ndimage.median_filter(np.median(rgb[:,1492:1500],axis=1),size=(41,1))
 t=np.clip((np.arange(2048)-1036)/460,0,1)[None,:,None]
 bg=left[:,None,:]*(1-t)+right[:,None,:]*t
 mask=np.sqrt(np.mean((rgb-bg)**2,axis=2))>10
 return im,mask
BOARDS={n:board(n) for n in range(1,10)}
def cut(n,box):
 im,mask=BOARDS[n];x,y,r,b=box;m=mask[y:b,x:r]
 m=ndimage.binary_fill_holes(ndimage.binary_closing(m,iterations=1))
 labels,count=ndimage.label(m);sizes=np.bincount(labels.ravel());keep=sizes>=24;keep[0]=False;m=keep[labels]
 out=im.crop(box).convert('RGBA');out.putalpha(Image.fromarray((m*255).astype('uint8')))
 return out

def main():
 inputs={}
 for key,label,n in ROSTER:
  s=SPECS[n];parts={p:cut(n,s[p]) for p in ['head','torso','pelvis']}
  parts['hair-back']=cut(n,s['hair'])
  if n in (5,7):
   # Original head includes the long rear hair: isolate face/head, reuse full
   # original silhouette behind the body. No new face or clothing is generated.
   pass
  if n==6:
   # Original twin tails are detached. Keep both tails in a common secondary layer.
   rear=Image.new('RGBA',(360,330));rear.alpha_composite(cut(n,(1035,90,1139,400)),(0,0));rear.alpha_composite(cut(n,(1405,90,1492,430)),(270,0));parts['hair-back']=rear
  for side,idx in [('front',1),('back',0)]:
   parts[f'{side}-upper-arm']=cut(n,s['arms'][idx]);parts[f'{side}-forearm']=cut(n,s['fore'][idx]);parts[f'{side}-hand']=cut(n,s['hands'][idx])
   leg=cut(3 if n==1 else n,s['legs'][idx]);mid=round(leg.height*.5)
   parts[f'{side}-thigh']=leg.crop((0,0,leg.width,mid+6));parts[f'{side}-shin']=leg.crop((0,mid-6,leg.width,leg.height));parts[f'{side}-foot']=cut(n,s['feet'][idx])
  atlas=Image.new('RGBA',(1024,1024))
  for i,p in enumerate(PARTS):
   cell=parts[p];cell.thumbnail((220,220),Image.Resampling.NEAREST)
   atlas.alpha_composite(cell,(i%4*256+(256-cell.width)//2,i//4*256+(256-cell.height)//2))
  dest=ROOT/'public/rpg/characters'/key/'rig';path=dest/'original-parts.png';temp=path.with_suffix('.tmp.png');atlas.save(temp,optimize=True);temp.replace(path);inputs[key]=str(path)
  audit={'source':f'public/island/chr_{n}.jpg','sourceSha256':hashlib.sha256((ROOT/f'public/island/chr_{n}.jpg').read_bytes()).hexdigest(),'referenceCanvas':[2048,1143],'rectangles':s,'method':'Original third-column JPEG cutouts, background matte estimation, leg segments split at knee; no generative redraw.','supplements':['Gold dress hidden legs borrowed from chr_3 beneath full-length skirt.'] if n==1 else [],'limitations':['JPEG edge alpha is estimated, not original layered art.','Backside and occluded joint interiors are not recovered.']}
  (dest/'original-art.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
 (ROOT/'scripts/rpg/original-parts-inputs.json').write_text(json.dumps({k:str(Path(v).relative_to(ROOT)) for k,v in inputs.items()},indent=2)+'\n')
if __name__=='__main__':main()
