from pathlib import Path
import subprocess,json,sys,time
W=Path(__file__).parent;E=W/'evidence';ADB='G:/Unity/6000.0.62f1/Editor/Data/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb.exe';PKG='com.mist2finer.islandgame.dev';ACT=PKG+'/com.unity3d.player.UnityPlayerGameActivity'
def adb(*args,binary=False,timeout=60):
 r=subprocess.run([ADB,'-s','emulator-5554',*args],capture_output=True,timeout=timeout)
 if r.returncode:raise RuntimeError(r.stderr.decode(errors='replace'))
 return r.stdout if binary else r.stdout.decode(errors='replace')
def shot(name):
 p=E/(name+'.png');p.write_bytes(adb('exec-out','screencap','-p',binary=True));return str(p)
def report(name='android-current'):
 raw=adb('shell','cat','/sdcard/Android/data/'+PKG+'/files/mount-report.json')
 j=json.loads(raw);(E/(name+'.json')).write_text(json.dumps(j,indent=2));print(json.dumps({k:j.get(k)for k in ['age','status','room','kills','steady','transition','ScenePeak','GraphPeak','GroundSamples','GroundMisses','MaxGroundGap','Errors']}));return j
if __name__=='__main__':
 if sys.argv[1]=='install':
  print(adb('install','-r','G:/new_project/IslandGame/Builds/Android/IslandGame-MountSunday-20261108.apk',timeout=180));print(adb('reverse','tcp:18108','tcp:18108'))
 elif sys.argv[1]=='start':
  adb('shell','am','force-stop',PKG);print(adb('shell','am','start','-n',ACT,'--es','mount_probe','1','--es','mount_server','http://127.0.0.1:18108'))
 elif sys.argv[1]=='shot':print(shot(sys.argv[2]))
 elif sys.argv[1]=='report':report(sys.argv[2]if len(sys.argv)>2 else 'android-current')
 elif sys.argv[1]=='mem':
  data=adb('shell','dumpsys','meminfo',PKG);(E/(sys.argv[2]+'.txt')).write_text(data);print('\n'.join(x for x in data.splitlines()if 'TOTAL' in x or 'Native Heap' in x or 'Graphics' in x))
