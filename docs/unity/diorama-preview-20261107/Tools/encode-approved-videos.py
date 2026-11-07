from pathlib import Path
import json,subprocess
import imageio_ffmpeg
p=Path(__file__).parent/'evidence/movement-approved'
for shot in ['ForestSide','BossQuarter','DarkArea']:
 folder=p/shot;times=json.loads((folder/'timestamps.json').read_text())
 lines=[]
 for i,t in enumerate(times):
  lines += [f"file '{i:04d}.png'",f'duration {(times[i+1]-t) if i+1<len(times) else .12:.6f}']
 lines += [f"file '{len(times)-1:04d}.png'"]
 (folder/'frames.txt').write_text('\n'.join(lines),encoding='utf-8')
 subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(folder/'frames.txt'),'-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-fps_mode','vfr','-movflags','+faststart',str(p/f'{shot}-ApprovedNilo.mp4')],check=True)
 print(shot,len(times),'frames',round(times[-1],2),'seconds')
