import json,tempfile,unittest,zipfile
from pathlib import Path
from unittest.mock import patch
from reference_stage_flow import Wave,receive_wave_message,advance_wave,finish_wave
from collect_map_graph import collect_apk

class StageFlowTests(unittest.TestCase):
 def test_start_message_and_retrigger_guard(self):
  w=Wave(3,spawn_delay=1);self.assertEqual(receive_wave_message(w,1),(w,[]));w,cmd=receive_wave_message(w,3,True)
  self.assertEqual(cmd,[('start-wave',3)]);self.assertTrue(w.trigger_on_start);self.assertEqual(receive_wave_message(w,3),(w,[]))
 def test_delay_overshoot_spawns_on_next_update(self):
  w,_=receive_wave_message(Wave(1,spawn_delay=.1),3);w,cmd=advance_wave(w,2);self.assertEqual(w.timer,0);self.assertEqual(cmd,[])
  w,cmd=advance_wave(w,.01);self.assertEqual(cmd,[('spawn-group',1,False)]);self.assertEqual(w.timer,-1)
  w,cmd=advance_wave(w,.01);self.assertEqual(cmd,[('check-group-deaths',1)])
 def test_repeat_count_is_total_not_additional_repeats(self):
  w,_=receive_wave_message(Wave(1,repeat=True,repeat_count=3),3);events=[]
  for _ in range(6):w,cmd=advance_wave(w,1);events+=cmd
  self.assertEqual(sum(c[0]=='spawn-group' for c in events),3)
 def test_zero_limit_can_repeat_but_never_catches_up_in_a_tight_loop(self):
  w,_=receive_wave_message(Wave(2,repeat=True,repeat_interval=.1,repeat_count=0),3)
  w,cmd=advance_wave(w,100);self.assertEqual(len(cmd),1);w,cmd=advance_wave(w,100);self.assertEqual(cmd,[])
  w,cmd=advance_wave(w,100);self.assertEqual(len(cmd),1)
 def test_only_actors_from_the_wave_group_block_completion(self):
  w,_=receive_wave_message(Wave(7),3);self.assertEqual(finish_wave(w,[False,True]),(w,[]));w,cmd=finish_wave(w,[False,False]);self.assertTrue(w.ended);self.assertEqual(cmd,[('end-wave',7)]);self.assertEqual(advance_wave(w,10),(w,[]))
 def test_not_started_never_completes_or_spawns(self):
  w=Wave(1);self.assertEqual(finish_wave(w,[]),(w,[]));self.assertEqual(advance_wave(w,1),(w,[]))

class ApkCollectorTests(unittest.TestCase):
 def test_split_apk_extracts_only_map_bundle_and_records_provenance(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);apk=root/'split_UnityDataAssetPack.apk';out=root/'graph'
   with zipfile.ZipFile(apk,'w') as z:z.writestr('assets/aa/Android/map_scenes_test.bundle',b'original-bundle');z.writestr('../ignored.txt','do not extract')
   def fake_collect(bundle,output):
    self.assertEqual(bundle.name,'map_scenes_test.bundle');self.assertEqual(bundle.read_bytes(),b'original-bundle');output.mkdir();(output/'manifest.json').write_text('{}');return {'objects':1}
   with patch('collect_map_graph.collect',side_effect=fake_collect):self.assertEqual(collect_apk(apk,out),{'objects':1})
   manifest=json.loads((out/'manifest.json').read_text());self.assertEqual(manifest['sourceApk']['member'],'assets/aa/Android/map_scenes_test.bundle');self.assertEqual(len(manifest['sourceApk']['sha256']),64);self.assertFalse((root/'ignored.txt').exists())
 def test_duplicate_serialized_names_do_not_overwrite_objects(self):
  from types import SimpleNamespace
  from collect_map_graph import collect
  files=[SimpleNamespace(name='level0',externals=[]),SimpleNamespace(name='level0',externals=[])]
  objects=[SimpleNamespace(assets_file=f,type=SimpleNamespace(name='MonoBehaviour'),path_id=42,read_typetree=lambda:{'_waveNo':1}) for f in files]
  env=SimpleNamespace(objects=objects,container={'a':objects[0],'b':objects[1]})
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);bundle=root/'map_scenes_test.bundle';bundle.write_bytes(b'original')
   with patch.dict('sys.modules',{'UnityPy':SimpleNamespace(load=lambda path:env)}):result=collect(bundle,root/'graph')
   self.assertEqual(result['objects'],2);self.assertEqual(result['errors'],0);self.assertEqual(result['serializedFiles'],2)
   manifest=json.loads((root/'graph/manifest.json').read_text());self.assertNotEqual(manifest['objects'][0]['identity']['id'],manifest['objects'][1]['identity']['id']);self.assertEqual({r['serializedFile'] for r in manifest['containers']},{'0:level0','1:level0'})
 def test_absent_or_multiple_versions_do_not_pick_arbitrary_map(self):
  for count in [0,2]:
   with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp);apk=root/'input.apk'
    with zipfile.ZipFile(apk,'w') as z:
     for i in range(count):z.writestr(f'map_scenes_{i}.bundle',b'x')
    with self.assertRaises(ValueError):collect_apk(apk,root/'graph')

if __name__=='__main__':unittest.main()
