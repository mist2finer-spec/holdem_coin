import argparse,contextlib,copy,io,json,subprocess,sys,tempfile,threading,unittest
from pathlib import Path
from PIL import Image,ImageChops
from http.server import HTTPServer,BaseHTTPRequestHandler
import spine_builder as b
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory();cls.out=Path(cls.tmp.name)/'out'
  cls.a=argparse.Namespace(out=cls.out,source=b.ROOT/'hong_reference.png',config=None,part='torso',seed=42,denoise=.65,prompt='',base=Path(cls.tmp.name),download_vae=False,server='',timeout=5)
  with contextlib.redirect_stdout(io.StringIO()):b.prepare(cls.a)
 @classmethod
 def tearDownClass(cls):cls.tmp.cleanup()
 def test_01_source_pixels_preserved_in_setup(self):
  a=Image.open(self.out/'review/reference.png');c=Image.open(self.out/'review/setup_preview.png')
  self.assertTrue(all(hi==0 for lo,hi in ImageChops.difference(a,c).getextrema()))
 def test_02_face_is_original_and_locked(self):
  c=b.config(self.a);self.assertTrue(next(p for p in c['parts'] if p['name']=='head')['locked'])
  a=copy.copy(self.a);a.part='head'
  with self.assertRaisesRegex(ValueError,'locked'):b.repair(a)
 def test_03_occluded_limbs_not_invented(self):
  for name in ['back-upper-arm','back-forearm','back-hand']:self.assertIsNone(Image.open(self.out/'parts'/f'{name}.png').getchannel('A').getbbox())
 def test_04_parent_order_and_offsets(self):
  sk=b.load(self.out/'spine/hong.json');seen=set()
  for bone in sk['bones']:
   if 'parent' in bone:self.assertIn(bone['parent'],seen)
   seen.add(bone['name'])
  self.assertEqual(len(sk['bones']),19);self.assertEqual(sk['skeleton']['spine'],'4.2.43')
 def test_05_both_weapon_mounts_present(self):
  sk=b.load(self.out/'spine/hong.json');self.assertTrue({'weapon-front','weapon-back'}<=set(p['name'] for p in sk['bones']))
 def test_06_invalid_config_rejected(self):
  c=b.config(self.a);c['parts'][0]['polygon'][0][0]=2
  with self.assertRaises(ValueError):b.validate(c)
 def test_07_portable_python_import(self):
  r=subprocess.run([sys.executable,'-I',str(b.ROOT/'spine_builder.py'),'--help'],capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr)
 def test_08_repair_graph_uses_mask_and_original_part(self):
  g=b.make_repair_graph(self.a,'part.png','mask.png','single torso')
  self.assertEqual(g['7']['class_type'],'VAEEncode');self.assertEqual(g['14']['inputs']['mask'],['13',0]);self.assertEqual(g['8']['inputs']['latent_image'],['14',0]);self.assertEqual(g['8']['inputs']['denoise'],.65)
 def test_09_mock_repair_does_not_automatically_replace_part(self):
  a=copy.copy(self.a);a.part='torso';before=b.sha(self.out/'parts/torso.png')
  image=Image.new('RGB',(512,512),(100,80,60));buffer=io.BytesIO();image.save(buffer,format='PNG');png=buffer.getvalue()
  g=b.make_repair_graph(a,'part.png','mask.png','single torso');schema={n['class_type']:{'input':{'required':{k:['STRING',{}] for k in n['inputs']}}} for n in g.values()}
  class Handler(BaseHTTPRequestHandler):
   def log_message(self,*a):pass
   def do_GET(self):
    if self.path=='/object_info':data=json.dumps(schema).encode()
    elif self.path.startswith('/history/'):
     data=json.dumps({'id':{'status':{'completed':True},'outputs':{'10':{'images':[{'filename':'part.png','subfolder':'','type':'output'}]}}}}).encode()
    elif self.path.startswith('/view?'):data=png
    else:self.send_error(404);return
    self.send_response(200);self.end_headers();self.wfile.write(data)
   def do_POST(self):
    self.rfile.read(int(self.headers['Content-Length']));reply={'name':'part.png','subfolder':''} if self.path=='/upload/image' else {'prompt_id':'id'}
    self.send_response(200);self.end_headers();self.wfile.write(json.dumps(reply).encode())
  server=HTTPServer(('127.0.0.1',0),Handler);t=threading.Thread(target=server.serve_forever,daemon=True);t.start();a.server=f'http://127.0.0.1:{server.server_port}'
  old=b.comfy.ensure_vae;b.comfy.ensure_vae=lambda *a:None
  try:
   with contextlib.redirect_stdout(io.StringIO()):b.repair(a)
   self.assertEqual(before,b.sha(self.out/'parts/torso.png'));candidate=next((self.out/'candidates').glob('torso-*/candidate.png'));self.assertEqual(list(Image.open(candidate).size),b.load(self.out/'parts_manifest.json')['parts']['torso']['size'])
  finally:b.comfy.ensure_vae=old;server.shutdown();server.server_close();t.join()
if __name__=='__main__':unittest.main()
