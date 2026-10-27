import argparse,base64,contextlib,importlib.util,io,json,tempfile,threading,unittest
from http.server import BaseHTTPRequestHandler,HTTPServer
from pathlib import Path
from generate_hong import graph,validate_graph,request,run

def args(base):return argparse.Namespace(base=base,server='',prompt='Hong standing',prompt_file=None,width=512,height=768,seed=42,steps=8,timeout=5,download_vae=False,check_only=False)
def schema(g):
 out={}
 for n in g.values():
  fields={k:[('LATENT' if isinstance(v,list) else 'INT' if isinstance(v,int) else 'FLOAT' if isinstance(v,float) else 'STRING'),{}] for k,v in n['inputs'].items()}
  out[n['class_type']]={'input':{'required':fields}}
 return out
class Tests(unittest.TestCase):
 def test_text_only_graph(self):
  g=graph(args(Path('.')));self.assertEqual(g['8']['inputs']['denoise'],1);self.assertEqual(g['8']['inputs']['cfg'],1)
  self.assertEqual(g['6']['inputs']['vae_name'],'ae.safetensors');self.assertNotIn('LoadImage',[n['class_type'] for n in g.values()])
  for n in g.values():
   for v in n['inputs'].values():
    if isinstance(v,list):self.assertIn(v[0],g)
 def test_missing_node(self):
  with self.assertRaisesRegex(RuntimeError,'Missing built-in'):validate_graph(graph(args(Path('.'))),{})
 def test_missing_model(self):
  g=graph(args(Path('.')));s=schema(g);s['VAELoader']['input']['required']['vae_name']=[['taef1'],{}]
  with self.assertRaisesRegex(RuntimeError,'not available'):validate_graph(g,s)
 def test_version_default(self):
  g=graph(args(Path('.')));s=schema(g);s['ModelSamplingAuraFlow']['input']['required']['sampling']=[['flow','other'],{}];validate_graph(g,s)
  self.assertEqual(g['2']['inputs']['sampling'],'flow')
 def test_request_submit_and_result(self):
  with tempfile.TemporaryDirectory() as directory:
   a=args(Path(directory));vae=a.base/'ComfyUI/models/vae/ae.safetensors';vae.parent.mkdir(parents=True);vae.write_bytes(b'0'*(1048576+1))
   g=graph(a);objects=schema(g);posted=[]
   png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
   class Handler(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def do_GET(self):
     if self.path=='/object_info':data=json.dumps(objects).encode()
     elif self.path.startswith('/history/'):
      data=json.dumps({'test-id':{'status':{'completed':True},'outputs':{'10':{'images':[{'filename':'hong.png','subfolder':'hong_prompt','type':'output'}]}}}}).encode()
     elif self.path.startswith('/view?'):data=png
     else:self.send_error(404);return
     self.send_response(200);self.end_headers();self.wfile.write(data)
    def do_POST(self):
     posted.append(json.loads(self.rfile.read(int(self.headers['Content-Length']))));self.send_response(200);self.end_headers();self.wfile.write(b'{"prompt_id":"test-id","node_errors":{}}')
   server=HTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();a.server=f'http://127.0.0.1:{server.server_port}'
   try:
    with contextlib.redirect_stdout(io.StringIO()):run(a)
    self.assertEqual(len(posted),1);self.assertEqual(posted[0]['prompt']['8']['inputs']['seed'],42)
    self.assertEqual(next((a.base/'hong_jobs').glob('*/result-1.png')).read_bytes(),png)
   finally:server.shutdown();server.server_close();thread.join()
if __name__=='__main__':unittest.main()
