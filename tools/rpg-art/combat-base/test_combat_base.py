import argparse,json,subprocess,sys,unittest
from pathlib import Path
import generate_combat_base as module
class Tests(unittest.TestCase):
 def graph(self):return module.graph(argparse.Namespace(prompt=module.PROMPT,width=512,height=512,seed=42,steps=8,denoise=.4),'combat.png')
 def test_reference_not_empty_latent(self):
  g=self.graph();self.assertEqual(g['7']['class_type'],'VAEEncode');self.assertEqual(g['11']['inputs']['image'],'combat.png');self.assertEqual(g['8']['inputs']['denoise'],.4)
 def test_no_face_paste_or_mask_lock(self):
  self.assertNotIn('ImageCompositeMasked',[n['class_type'] for n in self.graph().values()]);self.assertNotIn('SetLatentNoiseMask',[n['class_type'] for n in self.graph().values()])
 def test_pixel_scale_and_links(self):
  g=self.graph();self.assertEqual(g['12']['inputs']['upscale_method'],'nearest-exact');self.assertEqual(g['13']['inputs']['width'],256)
  for n in g.values():
   for value in n['inputs'].values():
    if isinstance(value,list):self.assertIn(value[0],g)
 def test_embedded_python_import(self):
  r=subprocess.run([sys.executable,'-I',str(Path(module.__file__).resolve()),'--help'],capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr)
if __name__=='__main__':unittest.main()
