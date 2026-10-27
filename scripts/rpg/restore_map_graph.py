"""Inspect qualified Unity scene graphs without turning editor defaults into runtime rules.
Input is collect_map_graph ZIP plus optional legacy map-assets index and decoded stages.
Exports evidence, not an executable replacement for the game trigger dispatcher.
"""
import argparse,collections,csv,hashlib,json,re,zipfile
from pathlib import Path,PurePosixPath

class Graph:
 def __init__(self,manifest,objects):
  self.manifest=manifest;self.objects={};self.files=collections.defaultdict(list)
  for key,data in manifest['serializedFiles'].items():self.files[data['originalName'].lower()].append(key)
  for obj in objects:
   ident=obj['identity'];key=(ident['serialized_file'],str(ident['path_id']))
   if key in self.objects:raise ValueError('Duplicate qualified object: '+str(key))
   self.objects[key]=obj
  self.unresolved={};self._world={}
 def resolve_key(self,source,ref,record_missing=True):
  if not ref or not int(ref['m_PathID']):return None
  fid=int(ref['m_FileID']);pid=str(ref['m_PathID']);target=source
  if fid:
   ex=self.manifest['serializedFiles'][source]['externals']
   if fid<1 or fid>len(ex):raise ValueError('Invalid external file index')
   name=ex[fid-1]['path'].replace('\\','/').rsplit('/',1)[-1].lower();candidates=self.files.get(name,[])
   if len(candidates)!=1:
    issue={'source':source,'fileId':fid,'pathId':pid,'external':ex[fid-1]['path'],'reason':'missing-file' if not candidates else 'ambiguous-file'}
    
    if record_missing:self.unresolved[json.dumps(issue,sort_keys=True)]=issue
    return None
   target=candidates[0]
  key=(target,pid)
  if key not in self.objects:
   issue={'source':source,'target':target,'pathId':pid,'reason':'missing-object'}
   if record_missing:self.unresolved[json.dumps(issue,sort_keys=True)]=issue
   return None
  return key
 def resolve(self,source,ref):
  key=self.resolve_key(source,ref);return self.objects.get(key) if key else None
 def gameobject(self,obj):return self.resolve(obj['identity']['serialized_file'],obj['tree']['m_GameObject'])
 def transform(self,go):
  if not go:return None
  f=go['identity']['serialized_file']
  for c in go['tree']['m_Component']:
   key=self.resolve_key(f,c['component'],record_missing=False)
   # Other component types were intentionally not exported. Do not fabricate them.
   obj=self.objects.get(key)
   if obj and obj['type'] in ['Transform','RectTransform']:return obj
  return None
 def ancestry(self,obj):
  go=self.gameobject(obj) if obj['type']!='GameObject' else obj;chain=[];seen=set()
  while go:
   key=(go['identity']['serialized_file'],go['identity']['path_id'])
   if key in seen:raise ValueError('Transform hierarchy cycle')
   seen.add(key);chain.insert(0,go);tr=self.transform(go)
   if not tr:break
   parent=self.resolve(tr['identity']['serialized_file'],tr['tree']['m_Father'])
   go=self.gameobject(parent) if parent else None
  return chain
 def describe(self,obj):
  chain=self.ancestry(obj);tr=self.transform(chain[-1]) if chain else None
  roots=[g for g in chain if re.fullmatch(r'MapEntityRoot\d*',g['tree']['m_Name'])]
  return {'identity':obj['identity'],'hierarchy':'/'.join(g['tree']['m_Name'] for g in chain),
   'rootName':roots[-1]['tree']['m_Name'] if roots else None,
   'activeInHierarchy':all(g['tree'].get('m_IsActive',True) for g in chain) and bool(obj['tree'].get('m_Enabled',True)),
   'deactivated':bool(obj['tree'].get('_deactivate',False)),
   'localPosition':tr['tree'].get('m_LocalPosition') if tr else None,
   'worldMatrix':self.world(tr) if tr else None}
 def world(self,tr,seen=None):
  key=(tr['identity']['serialized_file'],tr['identity']['path_id'])
  if key in self._world:return self._world[key]
  seen=set() if seen is None else set(seen)
  if key in seen:raise ValueError('Transform hierarchy cycle')
  seen.add(key);t=tr['tree'];q=t['m_LocalRotation'];x,y,z,w=[q[k] for k in ['x','y','z','w']];s=t['m_LocalScale'];p=t['m_LocalPosition']
  a=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),p['x']],
     [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),p['y']],
     [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),p['z']],[0,0,0,1]]
  for r in range(3):
   for c,axis in enumerate(['x','y','z']):a[r][c]*=s[axis]
  parent=self.resolve(tr['identity']['serialized_file'],t['m_Father'])
  if parent:
   b=self.world(parent,seen);a=[[sum(b[r][k]*a[k][c] for k in range(4)) for c in range(4)] for r in range(4)]
  self._world[key]=a;return a
 def field_references(self,obj):
  result=[];source=obj['identity']['serialized_file']
  def walk(value,path):
   if isinstance(value,dict):
    if 'm_FileID' in value and 'm_PathID' in value:
     if int(value['m_PathID']):result.append({'field':path,'reference':value,'target':self.resolve_key(source,value)})
    else:
     for key,child in value.items():walk(child,path+'.'+key)
   elif isinstance(value,list):
    for index,child in enumerate(value):walk(child,path+'['+str(index)+']')
  for key,value in obj['tree'].items():
   if key.startswith('_'):walk(value,key)
  return result
 def triggers(self,obj):
  t=obj['tree'];f=obj['identity']['serialized_file'];result=[]
  # Retain inactive inspector fields too: only the native selected trigger type uses them.
  for i in [1,2]:
   if '_triggerType'+str(i) not in t:continue
   refs={}
   for name in ['_waveReactorsToCheck','_spawnReactorsToCheck','_npcChatReactorsToCheck','_npcBattleReactorsToCheck']:
    refs[name]=[self.resolve_key(f,r) for r in t.get(name+str(i),[]) if int(r['m_PathID'])]
   result.append({'type':t['_triggerType'+str(i)],'once':bool(t.get('_triggerOnce'+str(i))),
    'selfMessageType':t.get('_selfMessageType'+str(i)), 'references':refs,
    'note':'Reference lists are inspector fields, not unconditional prerequisites.'})
  return result

def load_zip(path):
 with zipfile.ZipFile(path) as z:
  names=[n for n in z.namelist() if n.endswith('/manifest.json') or n=='manifest.json']
  if len(names)!=1:raise ValueError('Expected exactly one graph manifest')
  prefix=names[0][:-len('manifest.json')];manifest=json.loads(z.read(names[0]));objects=[]
  for row in manifest['objects']:
   relative=PurePosixPath(row['file'].replace('\\','/'))
   if relative.is_absolute() or '..' in relative.parts:raise ValueError('Unsafe object member path')
   objects.append(json.loads(z.read(prefix+str(relative))))
 return manifest,objects

def legacy_labels(root):
 """Unique names are corroborating legacy labels; absent serialized identity stays explicit."""
 if root is None:return {},None
 index=root/'objects_index.csv';candidates=collections.defaultdict(list)
 with index.open(encoding='utf-8-sig',newline='') as stream:
  for r in csv.DictReader(stream):
   if r['bundle'].startswith('map_assets') and r['type']=='MonoBehaviour' and r['name']:
    candidates[r['path_id']].append(r)
 labels={}
 for pid,rr in candidates.items():
  if len(rr)!=1:continue
  r=rr[0];labels[pid]={'name':r['name'],'bundle':r['bundle'],'indexRow':r,
   'confidence':'unique-legacy-index-label; serialized-file identity not exported in that older audit'}
 return labels,hashlib.sha256(index.read_bytes()).hexdigest()

def restore(path,output,legacy=None,stages=None):
 if output.exists():raise FileExistsError('Choose new output directory')
 m,objects=load_zip(path);g=Graph(m,objects);labels,indexhash=legacy_labels(legacy)
 byfile=collections.defaultdict(list)
 for o in objects:byfile[o['identity']['serialized_file']].append(o)
 scenes=[]
 for f,oo in byfile.items():
  helpers=[o for o in oo if '_mapSceneConfig' in o['tree']]
  if not helpers:continue
  if len(helpers)!=1:raise ValueError('Ambiguous map helper in '+f)
  h=helpers[0];t=h['tree'];ref=t['_mapSceneConfig'];label=labels.get(str(ref['m_PathID']))
  label_name=label['name'] if label else None
  label_match=re.fullmatch(r'Map(\d+)_(\d+)_Config',label_name or '')
  scene_paths=[r['assetPath'] for r in m.get('containers',[]) if r.get('serializedFile')==f and r['assetPath'].lower().endswith('.unity')]
  direct=re.fullmatch(r'Map(\d+)_(\d+)\.unity',PurePosixPath(scene_paths[0]).name) if len(scene_paths)==1 else None
  key_match=direct or label_match
  scene={'serializedFile':f,'configReference':ref,'configLabelEvidence':label,'scenePaths':scene_paths,'mapKeyFromLabel':[int(v) for v in key_match.groups()] if key_match else None,'mapKeyEvidence':'qualified-container' if direct else 'legacy-config-label' if label_match else 'unresolved',
   'editorPreview':{k:t[k] for k in ['_stageCategoryType','_stageIdUpper','_stageIdLower','_mapEntityGroupId']},'reactors':[],'waves':[],'spawns':[]}
  # Record unresolved config dependency, rather than confusing its PathID with a scene-local one.
  g.resolve_key(f,ref)
  for o in oo:
   ot=o['tree']
   if o['type']!='MonoBehaviour' or not ('_triggerType1' in ot or '_waveNo' in ot or '_monsterInfoName' in ot):continue
   desc=g.describe(o);desc['triggers']=g.triggers(o);desc['rawFields']=ot;desc['qualifiedReferences']=g.field_references(o);scene['reactors'].append(desc)
   if '_waveNo' in ot:
    refs=ot['_spawnReactors'];spawnkeys=[g.resolve_key(f,r) for r in refs if int(r['m_PathID'])]
    scene['waves'].append({'identity':o['identity'],'rootName':desc['rootName'],'activeInHierarchy':desc['activeInHierarchy'],'deactivated':desc['deactivated'],
     'waveNo':ot['_waveNo'],'spawnSlots':len(refs),'nullSlots':sum(not int(r['m_PathID']) for r in refs),'spawnKeys':spawnkeys,
     'spawnDelay':ot['_spawnDelay'],'repeat':ot['_repeat'],'repeatInterval':ot['_repeatInterval'],'repeatCount':ot['_repeatCount'], 'triggers':desc['triggers']})
   if '_monsterInfoName' in ot:scene['spawns'].append({k:desc[k] for k in ['identity','hierarchy','rootName','activeInHierarchy','deactivated','localPosition','worldMatrix']}|{'monsterInfoName':ot['_monsterInfoName'],'triggers':desc['triggers']})
  scenes.append(scene)
 candidates=[]
 if stages:
  lookup=collections.defaultdict(list)
  for scene in scenes:
   if scene['mapKeyFromLabel']:lookup[tuple(scene['mapKeyFromLabel'])].append(scene)
  for line in stages.open(encoding='utf-8'):
   r=json.loads(line)
   if r['category']!='Labyrinth':continue
   d=r['data'];matches=lookup[(d['MapTheme'],d['MapType'])]
   if len(matches)!=1:
    candidates.append({'stageId':r['stageId'],'status':'unresolved-scene-label','mapKey':[d['MapTheme'],d['MapType']]});continue
   scene=matches[0];rootname='MapEntityRoot'+(str(d['MapEntityGroupId']) if d['MapEntityGroupId'] else '')
   waves=[w for w in scene['waves'] if w['rootName']==rootname];spawns=[s for s in scene['spawns'] if s['rootName']==rootname]
   candidates.append({'stageId':r['stageId'],'status':'label-matched-graph-candidate','mapKey':[d['MapTheme'],d['MapType']],
    'serializedFile':scene['serializedFile'],'rootName':rootname,'waveCount':len(waves),'spawnDefinitionCount':len(spawns),
    'waveKeys':[w['identity'] for w in waves],'monsterInfoNames':dict(collections.Counter(s['monsterInfoName'] for s in spawns)),
    'victory':d['VictoryCondition'],'goal':d['VictoryConditionValue'],'runtimeReady':False})
 summary={'sourceZipSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceApk':m.get('sourceApk'),'bundleSha256':m['sha256'],
  'exportedObjects':len(objects),'serializedFiles':len(m['serializedFiles']),'sceneHelpers':len(scenes),'waves':sum(len(s['waves']) for s in scenes),'spawns':sum(len(s['spawns']) for s in scenes),
  'reactors':sum(len(s['reactors']) for s in scenes),'collectorErrors':m['errors'],'legacyIndexSha256':indexhash,
  'stageCandidates':dict(collections.Counter(c['status'] for c in candidates)),'unresolvedReferences':list(g.unresolved.values()),
  'runtimeReady':False,'limitations':['Legacy config names are corroborating labels, not repaired AssetBundle container mappings.',
   'MapEntityRoot suffix is a candidate runtime group based on native SetScene string-prefix parsing; editor preview selection is not stage selection.',
   'No forced wave ordering by waveNo or object order. OnStart waves can coexist; inactive dependency fields are not prerequisites.',
   'Spawn definitions are not kill counts. Repetition, messages, cutscenes, deactivation, area and action triggers still require execution.',
   'World matrices use original XYZ hierarchy. Projection into current web belt-scroll map is a separate adapter.']}
 output.mkdir(parents=True);(output/'scene-graphs.json').write_text(json.dumps(scenes,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 (output/'stage-candidates.json').write_text(json.dumps(candidates,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 (output/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
 return summary

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--graph-zip',type=Path,required=True);p.add_argument('--legacy-audit',type=Path);p.add_argument('--stages',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 result=restore(a.graph_zip,a.output,a.legacy_audit,a.stages);print(json.dumps({k:v for k,v in result.items() if k not in ['collectorErrors','unresolvedReferences']},ensure_ascii=False))
