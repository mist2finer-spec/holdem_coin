from pathlib import Path
import subprocess,json
w=Path(r'C:\Users\SHK\mount-sunday-review-20261107');p=w/'MountSundayReview';u=r'C:\Users\SHK\AppData\Local\Unity\bin\unity.exe'
def call(args):
 r=subprocess.run([u,'command',*args,'--project-path',str(p),'--caller','plugin','--skill','unity-pipeline','--format','json'],capture_output=True,text=True,encoding='utf-8');j=json.loads(r.stdout);assert j['success'],j;return j['data']['result']
shots={'plains':([-700,18.8,350],[-365,40,250]),'bridge':([-388,39.5,262],[-347,37.5,240]),'gate':([-290,58,-237],[-255,59,-235]),'village':([-235,64,-220],[-175,77,-145]),'hall':([-67,101,-25],[-22,112,-12]),'distant':([-300,145,-100],[1200,400,-3000])}

for name,(pos,target) in shots.items():
 v=lambda a:'new UnityEngine.Vector3('+','.join(str(x)+'f' for x in a)+')'
 code='var f=UnityEngine.Object.FindFirstObjectByType<MountSunday.MountSundayFreeFlight>();f.enabled=false;f.GetComponent<UnityEngine.CharacterController>().enabled=false;f.transform.position='+v(pos)+';UnityEngine.Camera.main.transform.position='+v(pos)+';UnityEngine.Camera.main.transform.LookAt('+v(target)+');return UnityEngine.Time.frameCount;'
 file=w/'Shot.cs';file.write_text(code);call(['script','eval_file','--file',str(file)]);r=call(['capture','game_view','--source','screen','--save_path','Evidence/final-'+name+'.png','--width','1280','--height','720']);print(name,r['savedPath'],flush=True)
