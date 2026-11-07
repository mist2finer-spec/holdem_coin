from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=Path(__file__).parent/'evidence/comparison'
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',23)
for shot in ['ForestSide','BossQuarter','DarkArea']:
 sheet=Image.new('RGB',(1080,686),'#14232b');draw=ImageDraw.Draw(sheet)
 for i,(surface,label) in enumerate([('BuiltInBaseline','Original materials'),('UrpLit','URP Lit + lighting'),('SoftNilo','Modified Nilo')]):
  image=Image.open(p/f'{shot}-{surface}.png').convert('RGB');image.thumbnail((360,640));sheet.paste(image,(i*360,46));draw.text((i*360+10,12),label,font=font,fill='#e6e4d8')
 sheet.save(p/f'{shot}-comparison.jpg',quality=92)
