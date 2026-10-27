import unittest,tempfile,csv,json
from pathlib import Path
from collect_map_graph import identity,reference_key
from recover_scene_links import audit
class SceneLinkTests(unittest.TestCase):
 def test_identical_pathids_stay_distinct_across_serialized_files(self):
  a=identity('maps','sceneA',42);b=identity('maps','sceneB',42)
  self.assertNotEqual(a['id'],b['id']);self.assertEqual(reference_key(a,{'m_FileID':0,'m_PathID':42},{}),a)
 def test_external_refs_do_not_fall_back_to_local_pathid(self):
  a=identity('maps','sceneA',1)
  with self.assertRaises(ValueError):reference_key(a,{'m_FileID':1,'m_PathID':42},{})
  self.assertEqual(reference_key(a,{'m_FileID':1,'m_PathID':42},{('maps','sceneA',1):('maps','sceneB')})['serialized_file'],'sceneB')
 def test_null_reference(self):self.assertIsNone(reference_key(identity('x','y',1),{'m_FileID':9,'m_PathID':0},{}))
 def test_legacy_collisions_never_produce_runtime_ready_waves(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'objects').mkdir();bundle='map_scenes_x.bundle'
   with (root/'objects_index.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['bundle','path_id']);w.writeheader();w.writerows([{'bundle':bundle,'path_id':'3'}]*2)
   (root/'objects'/(bundle+'__3__mono.json')).write_text(json.dumps(dict(_waveNo=1,_spawnDelay=0,_repeat=0,_repeatCount=0,_repeatInterval=0,_spawnReactors=[{'m_FileID':0,'m_PathID':3}])))
   (root/'ActorData.json').write_text('{"ActorDatas":[]}');r=audit(root,root/'ActorData.json',root/'out')
   self.assertEqual(r['collidingBundlePathIds'],1);self.assertEqual(r['runtimeReadyWaves'],0)
   wave=json.loads((root/'out/wave-candidates.json').read_text())[0];self.assertTrue(wave['identityAmbiguous']);self.assertEqual(wave['spawns'][0]['resolution'],'AMBIGUOUS_SERIALIZED_FILE')
if __name__=='__main__':unittest.main()
