import argparse,contextlib,hashlib,importlib.util,io,json,subprocess,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('combat_spine',ROOT/'build_combat_spine.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory();cls.out=Path(cls.tmp.name)/'work'
  cls.a=argparse.Namespace(out=cls.out,source=b.SOURCE,config=ROOT/'hong_combat_parts.json',alpha_mask=None,part='torso',seed=42,denoise=.55,prompt='',base=Path(cls.tmp.name),download_vae=False,server='',timeout=5)
  with contextlib.redirect_stdout(io.StringIO()):b.prepare(cls.a)
 @classmethod
 def tearDownClass(cls):cls.tmp.cleanup()
 def test_original_checkpoint_unchanged_and_geometry_uses_combat_scale(self):
  self.assertEqual(b.b.sha(b.SOURCE),b.SOURCE_SHA);self.assertEqual(b.b.load(self.out/'parts_config.json')['width'],256)
  with Image.open(self.out/'reference.png') as im:self.assertEqual(im.size,(256,256))
  self.assertEqual(b.b.load(self.out/'combat_source.json')['originalSha256'],b.SOURCE_SHA)
 def test_matte_has_alpha_and_preserves_rgb_and_enclosed_black(self):
  src=Image.open(b.SOURCE).convert('RGB');matte=Image.open(self.out/'reference.png');self.assertEqual(matte.convert('RGB').tobytes(),src.tobytes());self.assertEqual(matte.getchannel('A').getextrema(),(0,255))
  im=Image.new('RGB',(5,5));im.putpixel((2,1),(255,255,255));im.putpixel((1,2),(255,255,255));im.putpixel((3,2),(255,255,255));im.putpixel((2,3),(255,255,255));a=b.border_matte(im);self.assertEqual(a.getpixel((2,2)),255);self.assertEqual(a.getpixel((0,0)),0)
 def test_face_is_locked_and_occluded_surface_stays_explicitly_empty(self):
  cfg=b.b.load(self.out/'parts_config.json');self.assertTrue(next(p for p in cfg['parts'] if p['name']=='head')['locked']);self.assertIsNone(Image.open(self.out/'parts/back-upper-arm.png').getchannel('A').getbbox())
 def test_no_ghost_residual_attached_to_export_and_readiness_remains_draft(self):
  sk=b.b.load(self.out/'spine/hong.json');self.assertNotIn('unassigned-source',[s['name'] for s in sk['slots']]);self.assertNotIn('unassigned-source',sk['skins'][0]['attachments']);self.assertEqual(len(sk['bones']),19)
  self.assertEqual(set(sk['animations']),{'setup','idle-preview'});r=b.b.load(self.out/'readiness.json');self.assertFalse(r['residualIncludedInRig']);self.assertIn('DRAFT',r['status'])
 def test_existing_folder_and_old_tall_geometry_are_rejected(self):
  with self.assertRaises(FileExistsError):b.prepare(self.a)
  a=argparse.Namespace(**vars(self.a));a.out=Path(self.tmp.name)/'different';a.config=ROOT.parent/'spine-draft/hong_parts.json'
  with self.assertRaisesRegex(ValueError,'256px'):b.prepare(a)
 def test_atlas_matches_compact_page_and_uses_pixel_filter(self):
  with Image.open(self.out/'spine/hong.png') as im:self.assertEqual(im.size,(512,512))
  text=(self.out/'spine/hong.atlas.txt').read_text();self.assertIn('filter:Nearest,Nearest',text);self.assertNotIn('unassigned-source',text)
 def test_bootstrap_hashes_and_portable_import(self):
  text=(ROOT.parent/'next_hong_spine.ps1').read_text(encoding='utf-8-sig');manifest=json.loads(text.split("$manifest=ConvertFrom-Json @'\n",1)[1].split("\n'@",1)[0])
  for name,sha in manifest.items():self.assertEqual(hashlib.sha256((ROOT.parent/name).read_bytes()).hexdigest(),sha)
  r=subprocess.run([sys.executable,'-I',str(ROOT/'build_combat_spine.py'),'--help'],capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr)
if __name__=='__main__':unittest.main()
