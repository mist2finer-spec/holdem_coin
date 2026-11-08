from pathlib import Path
import json,subprocess,imageio_ffmpeg
w=Path(r'C:\Users\SHK\mount-sunday-review-20261107');folder=w/'evidence/video-final';times=json.loads((folder/'timestamps.json').read_text());assert len(times)>100
lines=[]
for i,t in enumerate(times):
 lines.append("file '%05d.jpg'"%i);lines.append('duration %.6f'%((times[i+1]-t) if i+1<len(times) else 1/15))
lines.append("file '%05d.jpg'"%(len(times)-1));(folder/'frames.txt').write_text('\n'.join(lines))
ff=imageio_ffmpeg.get_ffmpeg_exe();dest=w/'Builds/MountSunday-Exploration-26s.mp4';subprocess.run([ff,'-y','-loglevel','error','-f','concat','-safe','0','-i',str(folder/'frames.txt'),'-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-r','30','-movflags','+faststart',str(dest)],check=True)
print(json.dumps({'framesCaptured':len(times),'lastCaptureSeconds':times[-1],'path':str(dest),'bytes':dest.stat().st_size,'source':'actual Unity GameView; time-based flying tour; encoding FPS not performance'}))
(w/'evidence/video-validation.json').write_text(json.dumps({'framesCaptured':len(times),'lastCaptureSeconds':times[-1],'path':str(dest),'bytes':dest.stat().st_size,'source':'actual Unity GameView; time-based flying tour; encoding FPS not performance'},indent=2))
