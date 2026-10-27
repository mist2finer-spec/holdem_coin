import argparse,hashlib,importlib.util,json,subprocess,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('resume_hong',ROOT/'resume_hong.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

def objects():
 args=module.options(Path('/tmp/fake'),'http://localhost:8188');g=module.combat.graph(args,'ref.png')
 info={node['class_type']:{'input':{'required':{}}} for node in g.values()}
 for typ,(field,name) in module.MODELS.items():info[typ]['input']['required'][field]=[[name]]
 return info
class ResumeTests(unittest.TestCase):
 def test_check_is_read_only_and_reports_busy_queue(self):
  info=objects();calls=[]
  def request(server,path):
   calls.append(path);return {'/object_info':info,'/system_stats':{'devices':[{'name':'GTX 1650'}]},'/queue':{'queue_running':[1],'queue_pending':[]}}[path]
  with patch.object(module.client,'request',side_effect=request):d=module.doctor(module.options(Path('/tmp/fake'),'http://localhost:8188'))
  self.assertEqual(d['status'],'CHECK_PASSED');self.assertEqual(d['queueRunning'],1);self.assertEqual(calls,['/object_info','/system_stats','/queue'])
 def test_generate_busy_never_calls_upload_or_generator(self):
  with patch.object(module,'doctor',return_value={'queueRunning':1,'queuePending':0}),patch.object(module.combat,'main') as main:
   with self.assertRaisesRegex(RuntimeError,'queue is busy'):module.generate(module.options(Path('/tmp/fake'),'http://localhost:8188'))
   main.assert_not_called()
 def test_missing_model_stops_before_generation(self):
  info=objects();info['VAELoader']['input']['required']['vae_name']=[['taesd']]
  with patch.object(module.client,'request',side_effect=[info,{},{}]):
   with self.assertRaisesRegex(RuntimeError,'ae.safetensors'):module.doctor(module.options(Path('/tmp/fake'),'http://localhost:8188'))
 def test_report_preserves_original_and_flags_empty_limbs(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);p=root/'readiness.json';body=json.dumps({'empty':['back-hand'],'needsCompletion':['torso'],'unassignedSourcePixels':12});p.write_text(body)
   d=module.report(root);self.assertEqual(d['emptyParts'],['back-hand']);self.assertEqual(p.read_text(),body)
 def test_successful_generation_records_identity_without_promoting_assets(self):
  with tempfile.TemporaryDirectory() as tmp:
   base=Path(tmp);args=module.options(base,'http://localhost:8188')
   checked={'queueRunning':0,'queuePending':0,'referenceSha256':'abc','models':{}}
   with patch.object(module,'doctor',return_value=checked),patch.object(module.combat,'main') as main:module.generate(args)
   main.assert_called_once();record=json.loads(next((base/'hong_resume_records').glob('*/resume.json')).read_text());self.assertFalse(record['productionModified']);self.assertFalse(record['faceComposite'])
 def test_bootstrap_manifest_matches_every_download_and_portable_import(self):
  text=(ROOT.parent/'resume_hong.ps1').read_text(encoding='utf-8-sig');manifest=json.loads(text.split("$manifest=ConvertFrom-Json @'\n",1)[1].split("\n'@",1)[0])
  self.assertEqual(len(manifest),4)
  for name,expected in manifest.items():self.assertEqual(hashlib.sha256((ROOT.parent/name).read_bytes()).hexdigest(),expected)
  result=subprocess.run([sys.executable,'-I',str(ROOT/'resume_hong.py'),'--help'],capture_output=True,text=True);self.assertEqual(result.returncode,0,result.stderr)
if __name__=='__main__':unittest.main()
