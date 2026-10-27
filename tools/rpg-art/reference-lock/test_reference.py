import argparse,contextlib,io,json,tempfile,threading,unittest
from pathlib import Path
from http.server import BaseHTTPRequestHandler,HTTPServer
import generate_reference as ref

def args(base):return argparse.Namespace(base=base,server='',reference=Path(__file__).parent/'hong_reference.png',prompt=ref.PROMPT,prompt_file=None,width=512,height=768,steps=8,seed=42,denoise=.2,timeout=5,download_vae=False,check_only=False,face_x=.4,face_y=.015,face_width=.28,face_height=.19)
class Tests(unittest.TestCase):
 def test_portable_isolated_python_can_import_local_helper(self):
  import subprocess,sys
  result=subprocess.run([sys.executable,'-I',str(Path(ref.__file__).resolve()),'--help'],capture_output=True,text=True)
  self.assertEqual(result.returncode,0,result.stderr)

 def test_reference_is_used(self):
  g=ref.reference_graph(args(Path('.')),'original.png');self.assertEqual(g['11']['inputs']['image'],'original.png');self.assertEqual(g['7']['class_type'],'VAEEncode');self.assertEqual(g['8']['inputs']['denoise'],.2)
 def test_noise_excludes_face_and_output_restores_original(self):
  g=ref.reference_graph(args(Path('.')),'original.png')
  self.assertEqual(g['18']['inputs']['mask'],['17',0]);self.assertEqual(g['17']['inputs']['mask'],['16',0]);self.assertEqual(g['19']['inputs']['source'],['12',0]);self.assertEqual(g['19']['inputs']['mask'],['16',0]);self.assertEqual(g['10']['inputs']['images'],['19',0])
  self.assertEqual(g['16']['inputs']['x'],204);self.assertEqual(g['16']['inputs']['y'],11)
 def test_all_graph_links_resolve_and_rectangle_is_bounded(self):
  a=args(Path('.'));g=ref.reference_graph(a,'original.png')
  for n in g.values():
   for v in n['inputs'].values():
    if isinstance(v,list):self.assertIn(v[0],g)
  a.face_width=.9
  with self.assertRaises(ValueError):ref.reference_graph(a,'original.png')
 def test_mock_upload_submission_and_download(self):
  with tempfile.TemporaryDirectory() as d:
   a=args(Path(d));vae=a.base/'ComfyUI/models/vae/ae.safetensors';vae.parent.mkdir(parents=True);vae.write_bytes(b'0'*(1048576+1));g=ref.reference_graph(a,'uploaded.png');posted=[]
   schema={n['class_type']:{'input':{'required':{k:['STRING',{}] for k in n['inputs']}}} for n in g.values()}
   class Handler(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def do_GET(self):
     if self.path=='/object_info':data=json.dumps(schema).encode()
     elif self.path.startswith('/history/'):
      data=json.dumps({'v2':{'status':{'completed':True},'outputs':{'10':{'images':[{'filename':'hong.png','subfolder':'hong_reference_lock','type':'output'}]}}}}).encode()
     elif self.path.startswith('/view?'):data=b'PNG-result'
     else:self.send_error(404);return
     self.send_response(200);self.end_headers();self.wfile.write(data)
    def do_POST(self):
     body=self.rfile.read(int(self.headers['Content-Length']))
     if self.path=='/upload/image':
      assert b'\x89PNG\r\n\x1a\n' in body;reply={'name':'uploaded.png','subfolder':'','type':'input'}
     else:posted.append(json.loads(body));reply={'prompt_id':'v2','node_errors':{}}
     self.send_response(200);self.end_headers();self.wfile.write(json.dumps(reply).encode())
   server=HTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();a.server=f'http://127.0.0.1:{server.server_port}'
   try:
    with contextlib.redirect_stdout(io.StringIO()):ref.main(a)
    self.assertEqual(posted[0]['prompt']['11']['inputs']['image'],'uploaded.png')
    self.assertEqual(next((a.base/'hong_jobs').glob('*/result-1.png')).read_bytes(),b'PNG-result')
   finally:server.shutdown();server.server_close();thread.join()
if __name__=='__main__':unittest.main()
