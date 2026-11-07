from pathlib import Path
import json,subprocess,imageio_ffmpeg,sys
base=Path(__file__).parent/'evidence/videos'
for shot in (sys.argv[1:] or ['SideAction','QuarterAction','AttackTransitions','HitboxHurtbox']):
 folder=base/shot;times=json.loads((folder/'timestamps.json').read_text());lines=[]
 for i,t in enumerate(times):lines.extend([f"file '{i:04d}.jpg'",f"duration {(times[i+1]-t) if i+1<len(times) else .05:.6f}"])
 lines.append(f"file '{len(times)-1:04d}.jpg'");(folder/'frames.txt').write_text('\n'.join(lines))
 subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(folder/'frames.txt'),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-fps_mode','vfr','-movflags','+faststart',str(base/f'{shot}.mp4')],check=True)
 print(shot,len(times),round(times[-1],2),'seconds')
