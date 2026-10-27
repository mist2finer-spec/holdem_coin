import json,tempfile,unittest,zipfile
from pathlib import Path
from restore_map_graph import Graph,load_zip

def obj(file,pid,type,tree):return {'identity':{'bundle':'maps.bundle','serialized_file':file,'path_id':str(pid)},'type':type,'tree':tree}
def ref(pid,fid=0):return {'m_FileID':fid,'m_PathID':pid}
def tr(go,parent=0,pos=None,rotation=None,scale=None):
 return {'m_GameObject':ref(go),'m_Father':ref(parent),'m_LocalPosition':pos or dict(x=0,y=0,z=0),'m_LocalRotation':rotation or dict(x=0,y=0,z=0,w=1),'m_LocalScale':scale or dict(x=1,y=1,z=1)}
def manifest():return {'serializedFiles':{'0:A':{'originalName':'A','externals':[{'path':'archive:/some/B'}]},'1:B':{'originalName':'B','externals':[]}}}
class GraphTests(unittest.TestCase):
 def test_file_id_zero_and_external_do_not_collide(self):
  a=obj('0:A',1,'GameObject',{});b=obj('1:B',1,'GameObject',{});g=Graph(manifest(),[a,b])
  self.assertIs(g.resolve('0:A',ref(1)),a);self.assertIs(g.resolve('0:A',ref(1,1)),b)
 def test_ambiguous_external_never_chooses_first_file(self):
  m=manifest();m['serializedFiles']['2:B']={'originalName':'B','externals':[]};g=Graph(m,[])
  self.assertIsNone(g.resolve_key('0:A',ref(1,1)));self.assertEqual(next(iter(g.unresolved.values()))['reason'],'ambiguous-file')
 def test_invalid_file_index_and_duplicate_identity_fail(self):
  g=Graph(manifest(),[])
  with self.assertRaises(ValueError):g.resolve_key('0:A',ref(1,2))
  o=obj('0:A',1,'GameObject',{})
  with self.assertRaises(ValueError):Graph(manifest(),[o,o])
 def test_world_matrix_includes_parent_scale_rotation_translation(self):
  q=2**-.5
  parent=obj('0:A',1,'Transform',tr(10,pos=dict(x=10,y=2,z=3),rotation=dict(x=0,y=0,z=q,w=q),scale=dict(x=2,y=2,z=2)))
  child=obj('0:A',2,'Transform',tr(20,parent=1,pos=dict(x=1,y=0,z=0)))
  g=Graph(manifest(),[parent,child]);a=g.world(child)
  for actual,want in zip([a[i][3] for i in range(3)],[10,4,3]):self.assertAlmostEqual(actual,want)
 def test_active_hierarchy_and_unexported_components(self):
  root=obj('0:A',10,'GameObject',{'m_Name':'MapEntityRoot5','m_IsActive':False,'m_Component':[{'component':ref(999)},{'component':ref(1)}]})
  child=obj('0:A',20,'GameObject',{'m_Name':'Wave','m_IsActive':True,'m_Component':[{'component':ref(2)}]})
  t1=obj('0:A',1,'Transform',tr(10));t2=obj('0:A',2,'Transform',tr(20,parent=1));w=obj('0:A',3,'MonoBehaviour',{'m_GameObject':ref(20),'m_Enabled':True})
  g=Graph(manifest(),[root,child,t1,t2,w]);d=g.describe(w)
  self.assertFalse(d['activeInHierarchy']);self.assertEqual(d['rootName'],'MapEntityRoot5');self.assertEqual(d['hierarchy'],'MapEntityRoot5/Wave');self.assertEqual(g.unresolved,{})
 def test_transform_cycle_fails(self):
  a=obj('0:A',1,'Transform',tr(10,parent=2));b=obj('0:A',2,'Transform',tr(20,parent=1));g=Graph(manifest(),[a,b])
  with self.assertRaisesRegex(ValueError,'cycle'):g.world(a)
 def test_inspector_dependency_does_not_change_start_trigger(self):
  a=obj('0:A',1,'MonoBehaviour',{'_triggerType1':10,'_waveReactorsToCheck1':[ref(2)],'_selfMessageType1':3})
  b=obj('0:A',2,'MonoBehaviour',{});g=Graph(manifest(),[a,b]);t=g.triggers(a)[0]
  self.assertEqual(t['type'],10);self.assertEqual(t['references']['_waveReactorsToCheck'],[('0:A','2')]);self.assertIn('not unconditional',t['note'])
 def test_action_targets_are_qualified_too(self):
  wave=obj('1:B',5,'MonoBehaviour',{})
  action=obj('0:A',1,'MonoBehaviour',{'_targetsToOn1':[ref(5,1),ref(0)],'_nested':{'target':ref(5,1)}})
  g=Graph(manifest(),[wave,action]);references=g.field_references(action)
  self.assertEqual(len(references),2);self.assertTrue(all(r['target']==('1:B','5') for r in references));self.assertEqual(references[0]['field'],'_targetsToOn1[0]')
 def test_zip_member_escape_rejected_without_extracting(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp)/'graph.zip'
   with zipfile.ZipFile(p,'w') as z:z.writestr('manifest.json',json.dumps({'objects':[{'file':'../evil.json'}]}))
   with self.assertRaisesRegex(ValueError,'Unsafe'):load_zip(p)
if __name__=='__main__':unittest.main()
