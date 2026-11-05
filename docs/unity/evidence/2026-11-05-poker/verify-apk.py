from pathlib import Path
import subprocess,hashlib,json,zipfile,os
w=Path('C:/Users/SHK/island-poker-review'); apk=w/'IslandGame-Test-Poker-20261105.apk'
tools=Path('G:/Unity/6000.0.62f1/Editor/Data/PlaybackEngines/AndroidPlayer/SDK/build-tools/36.0.0')
badging=subprocess.check_output([str(tools/'aapt.exe'),'dump','badging',str(apk)],encoding='utf-8')
(w/'apk-badging.txt').write_text(badging,encoding='utf-8')
assert "name='com.mist2finer.islandgame.dev'" in badging
assert "native-code: 'arm64-v8a'" in badging
assert 'launchable-activity:' in badging
with zipfile.ZipFile(apk) as z:
 assert z.testzip() is None
 names=z.namelist();assert 'lib/arm64-v8a/libil2cpp.so' in names
 assert 'lib/arm64-v8a/libunity.so' in names
 assert any(n.startswith('classes') and n.endswith('.dex') for n in names)
env=dict(os.environ);env['JAVA_HOME']='G:/Unity/6000.0.62f1/Editor/Data/PlaybackEngines/AndroidPlayer/OpenJDK'
jar=tools/'lib/apksigner.jar'
sign=subprocess.check_output([env['JAVA_HOME']+'/bin/java.exe','-jar',str(jar),'verify','--verbose','--print-certs',str(apk)],encoding='utf-8',env=env)
(w/'apk-signature.txt').write_text(sign,encoding='utf-8')
subprocess.run([str(tools/'zipalign.exe'),'-c','-P','16','4',str(apk)],check=True,capture_output=True)
manifest=subprocess.check_output([str(tools/'aapt.exe'),'dump','xmltree',str(apk),'AndroidManifest.xml'],encoding='utf-8')
assert 'android.permission.INTERNET' in manifest
(w/'apk-manifest.txt').write_text(manifest,encoding='utf-8')
report={'status':'PASS','apk':str(apk),'bytes':apk.stat().st_size,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'package':'com.mist2finer.islandgame.dev','architecture':'arm64-v8a','backend':'IL2CPP','zipIntegrity':True,'signatureVerified':True,'zipAlignment16K':True,'internetPermission':True,'deviceExecution':'UNAVAILABLE: no adb device connected','server':'https://holdem-coin-tavern.onrender.com'}
(w/'apk-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
