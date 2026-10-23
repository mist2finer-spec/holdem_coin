import argparse, importlib.util, json, tempfile, threading, unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('bridge',Path(__file__).with_name('comfyui_assets.py'))
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class API(BaseHTTPRequestHandler):
 submitted=None
 def log_message(self,*args):pass
 def do_POST(self):
  payload=self.rfile.read(int(self.headers['Content-Length']))
  if self.path=='/upload/image':result={'name':'reference.png','subfolder':'','type':'input'}
  else:API.submitted=json.loads(payload);result={'prompt_id':'mock-job','node_errors':{}}
  self.send_response(200);self.end_headers();self.wfile.write(json.dumps(result).encode())
 def do_GET(self):
  self.send_response(200);self.end_headers()
  if self.path.startswith('/history/'):
   result={'mock-job':{'status':{'completed':True,'status_str':'success'},'outputs':{'9':{'images':[{'filename':'candidate.png','subfolder':'','type':'output'}]}}}}
  elif self.path=='/object_info':
   graph=b.read(b.ROOT/'workflows/comfyui/img2img.api.json');result={v['class_type']:{} for v in graph.values()};result['CheckpointLoaderSimple']={'input':{'required':{'ckpt_name':[['test.safetensors']]}}}
  elif self.path=='/system_stats':result={'devices':[{'type':'mock'}]}
  else:self.wfile.write((b.ROOT/'public/rpg/characters/hong/rig/preview.png').read_bytes());return
  self.wfile.write(json.dumps(result).encode())
class BridgeTests(unittest.TestCase):
 def test_actual_http_job_lifecycle_preserves_public_assets(self):
  server=ThreadingHTTPServer(('127.0.0.1',0),API);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  url=f'http://127.0.0.1:{server.server_port}'
  try:
   b.doctor(url)
   with tempfile.TemporaryDirectory() as tmp:
    job=Path(tmp)/'job.json';args=argparse.Namespace(character='hong',checkpoint='test.safetensors',seed=42,denoise=.25,prompt='same outfit',job=str(job))
    b.prepare(args);before=(b.ROOT/'public/rpg/characters/hong/rig/preview.png').read_bytes()
    # Redirect the review directory to a temporary root; copy only the reference.
    original=b.ROOT;root=Path(tmp);asset=root/'public/rpg/characters/hong/rig/preview.png';asset.parent.mkdir(parents=True);asset.write_bytes(before)
    with patch.object(b,'ROOT',root):b.run(argparse.Namespace(job=str(job),url=url,timeout=5))
    self.assertEqual(API.submitted['prompt']['10']['inputs']['image'],'reference.png')
    outputs=list((root/'data/comfyui/review').rglob('*.png'));self.assertEqual(len(outputs),1)
    self.assertEqual((original/'public/rpg/characters/hong/rig/preview.png').read_bytes(),before)
    self.assertTrue(outputs[0].with_name('provenance.json').is_file())
  finally:server.shutdown();server.server_close();thread.join()
 def test_modified_reference_is_rejected_before_upload(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);p=root/'public/rpg/characters/hong/rig/preview.png';p.parent.mkdir(parents=True);p.write_bytes(b'changed')
   job=root/'job.json';b.save(job,{'reference':str(p.relative_to(root)),'referenceSha256':'wrong'})
   with patch.object(b,'ROOT',root),self.assertRaisesRegex(ValueError,'Reference changed'):b.run(argparse.Namespace(job=str(job),url='http://127.0.0.1:1',timeout=1))
if __name__=='__main__':unittest.main()
