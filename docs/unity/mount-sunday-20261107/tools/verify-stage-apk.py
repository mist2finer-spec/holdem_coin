from pathlib import Path
import subprocess,hashlib,json,zipfile,os
w=Path(r'C:\Users\SHK\mount-sunday-review-20261107');apk=w/'Builds/MountSunday-Exploration-20261107.apk';tools=Path('G:/Unity/6000.0.62f1/Editor/Data/PlaybackEngines/AndroidPlayer/SDK/build-tools/36.0.0')
badging=subprocess.check_output([str(tools/'aapt.exe'),'dump','badging',str(apk)],encoding='utf-8');assert "name='com.mist2finer.mountsunday.review'" in badging;assert "native-code: 'arm64-v8a'" in badging;assert "versionCode='2026110701'" in badging
with zipfile.ZipFile(apk) as z:
 assert z.testzip() is None;assert 'lib/arm64-v8a/libil2cpp.so' in z.namelist()
java='G:/Unity/6000.0.62f1/Editor/Data/PlaybackEngines/AndroidPlayer/OpenJDK/bin/java.exe';sign=subprocess.check_output([java,'-jar',str(tools/'lib/apksigner.jar'),'verify','--verbose',str(apk)],encoding='utf-8')
subprocess.run([str(tools/'zipalign.exe'),'-c','-P','16','4',str(apk)],check=True,capture_output=True)
report={'status':'PASS','apk':str(apk),'bytes':apk.stat().st_size,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'package':'com.mist2finer.mountsunday.review','versionCode':2026110701,'architecture':'arm64-v8a','backend':'IL2CPP','zipIntegrity':True,'signatureVerified':True,'zipAlignment16K':True,'deviceExecution':'EXCLUDED BY USER','cyanFloorResolvedOnDevice':'UNAVAILABLE'}
(w/'evidence/stage-apk-validation.json').write_text(json.dumps(report,indent=2));(w/'evidence/stage-apk-badging.txt').write_text(badging);(w/'evidence/stage-apk-signature.txt').write_text(sign);print(json.dumps(report))

