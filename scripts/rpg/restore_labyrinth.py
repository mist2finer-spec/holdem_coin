"""Private labyrinth/monster/action/visual reconstruction from audited exports.

GUID adjacency is corroboration, not a proven Addressables key/resource-location
relation. Do not relabel candidate visual links as verified runtime resolutions.
"""
import argparse,collections,csv,hashlib,io,json,re,subprocess,tarfile,zipfile
from pathlib import Path
from reference_monsters import stage_number,monster_abilities,action_timeline

ASSET_REV='fef94dd999990ae7437681f4566eed6d84b4ff91'


def restore(decoded,catalog,asset_index,spine_index,gameobjects,monobehaviours,output,repo,copy_assets=False):
    if output.exists():raise ValueError('Choose a new output directory')
    output.mkdir(parents=True)
    load=lambda n:json.loads((decoded/(n+'.json')).read_text())
    actors={r['ActorType']:r for r in load('ActorData')['ActorDatas']};actions=collections.defaultdict(list)
    for r in load('ActionData')['ActionDatas']:actions[r['SkillType']].append(r)
    combat=load('CombatData');enum_path=decoded.parent/'evidence/metadata-enums.json';enums=json.loads(enum_path.read_text())['enums']
    actor_names={r['value']:r['name'] for r in enums['BalanceData.ActorType']['entries']}
    strings=[r['string'] for r in csv.DictReader(catalog.open(encoding='utf-8-sig'))]
    assets=json.loads(asset_index.read_text());spines=json.loads(spine_index.read_text());enemy_spines=[r for r in spines if r['name'].startswith('Enemy_')]
    by_name={r['name']:r for r in enemy_spines}
    text_objects={r['object_id']:by_name[r['name']] for r in assets if r['type']=='TextAsset' and r['name'] in by_name}
    def zip_objects(path):
        with zipfile.ZipFile(path) as z:return [json.loads(z.read(n)) for n in z.namelist() if n.endswith('.json')]
    gos=zip_objects(gameobjects);gos_by_name=collections.defaultdict(list)
    for r in gos:gos_by_name[r['tree']['m_Name']].append(r)
    mbs={str(r['identity']['path_id']):r for r in zip_objects(monobehaviours)}
    # This input has one serialized file and no colliding path IDs. Refuse to
    # silently cross files if a later extraction changes that assumption.
    assert len(mbs)==len(zip_objects(monobehaviours))
    def local_ref(record,ref):
        assert ref['m_FileID']==0,'External Unity references need an externals table'
        target=mbs.get(str(ref['m_PathID']))
        if target:assert (target['identity']['bundle'],target['identity']['serialized_file'])==(record['identity']['bundle'],record['identity']['serialized_file'])
        return target
    def visual(actor):
        candidates=[]
        for i,s in enumerate(strings[:-1]):
            if s!=actor['AssetGuid']:continue
            found=re.search(r'([^/\\]+)\.prefab',strings[i+1])
            if not found:continue
            for go in gos_by_name.get(found[1],[]):
                for c in go['tree']['m_Component']:
                    comp=local_ref(go,c['component'])
                    if not comp or 'skeletonDataAsset' not in comp['tree']:continue
                    sd=local_ref(comp,comp['tree']['skeletonDataAsset'])
                    if not sd or 'skeletonJSON' not in sd['tree']:continue
                    assert sd['tree']['skeletonJSON']['m_FileID']==0
                    pathid=str(sd['tree']['skeletonJSON']['m_PathID']);identity=sd['identity'];oid=identity['bundle']+':'+identity['serialized_file']+':'+pathid
                    spine=text_objects.get(oid)
                    if spine:candidates.append({'prefab':found[1],'prefabObject':go['identity']['id'],'component':comp['identity']['id'],'skeletonData':sd['identity']['id'],'skeletonObject':oid,'asset':spine['name'],'initialSkin':comp['tree'].get('initialSkinName'),'skeletonImportScale':sd['tree'].get('scale'),'confidence':'GUID_ADJACENCY_CANDIDATE_PREFAB_GRAPH_VERIFIED','runtimeAddressableMappingProven':False})
        return candidates
    monsters=[];missing_actions=[]
    for typ,actor in sorted(actors.items()):
        if typ<1000:continue
        attack_rows=[]
        for skill in actor.get('SkillTypes',[]):
            if not actions[skill]:missing_actions.append({'actorType':typ,'skillType':skill})
            for action in actions[skill]:
                attack_rows.append({**action_timeline(action),'sourceAction':action})
        monsters.append({'actorType':typ,'enumName':actor_names.get(typ),'definition':actor,'visualCandidates':visual(actor),'attacks':attack_rows,
                         'aiConfig':next((r for r in load('MonsterData')['MonsterAIDatas'] if r['Type']==actor['StartAIType']),None),
                         'phaseChanges':{k:actor[k] for k in ['AiChangeCondition1HPPercent','AiChangeType1','AiChangeCondition2HPPercent','AiChangeType2','AiChangeDelaySeconds','Phase2ChangeConditionHPPercent','Phase3ChangeConditionHPPercent','PhaseChangeInvincibleSeconds']}})
    (output/'monster-profiles.json').write_text(json.dumps(monsters,ensure_ascii=False,separators=(',',':')))
    (output/'combat-config.json').write_text(json.dumps(combat,separators=(',',':')))
    (output/'monster-ai-config.json').write_text(json.dumps(load('MonsterData'),separators=(',',':')))
    (output/'combat-enums.json').write_text(json.dumps({k:v for k,v in enums.items() if any(s in k for s in ['ActorAbilityType','Monster','Action','SkillTag','AnimState'])},separators=(',',':')))
    count=0;chapters=set();stage_rows=[];stats_count=0;hero_based=0
    with (output/'labyrinth.jsonl').open('w') as f,(output/'monster-stage-growth.csv').open('w',newline='',encoding='utf-8-sig') as g:
        w=csv.writer(g);w.writerow(['chapter','section','stageId','slot','actorType','boss','bossAppear','attack','hp','valor','mental','tenacity','focus','moveDistPerSec'])
        for line in (decoded/'stages.jsonl').open():
            row=json.loads(line)
            if row['category']!='Labyrinth':continue
            chapter,section=stage_number(row['stageId']);chapters.add(chapter);data=row['data'];slots=[]
            for i,m in enumerate(data.get('MonsterDatas',[])):
                actor=actors.get(m['MonsterType']);flag=m['MonsterFlag'];stats=None
                if actor and not m['HeroAbilityBased']:stats=monster_abilities(data,m,actor,combat)
                elif m['HeroAbilityBased']:hero_based+=1
                slot={'index':i,'actorType':m['MonsterType'],'boss':bool(flag&1024),'bossAppear':bool(flag&512),'stats':stats,'definition':m};slots.append(slot)
                if stats:
                    w.writerow([chapter,section,row['stageId'],i,m['MonsterType'],int(slot['boss']),int(slot['bossAppear']),*(stats.get(a,0) for a in [7,8,9,10,11,12,2])]);stats_count+=1
            out={'chapter':chapter,'section':section,'stageId':row['stageId'],'finalEncounter':'boss' if section==5 else 'midboss','encounterRuleEvidence':'USER_SPECIFICATION','slotsAreSpawnDefinitionsNotWaveOrder':True,'slots':slots,'stageDefinition':data}
            f.write(json.dumps(out,separators=(',',':'))+'\n');count+=1
            stage_rows.append({'chapter':chapter,'section':section,'stageId':row['stageId'],'mapType':data['MapType'],'baseAbilities':data.get('BaseAbilityDatas',[]),'slotTypes':[s['actorType'] for s in slots]})
    labyrinth=load('LabyrinthData');rewards=[]
    for chapter in sorted(chapters):
        rewards.append({'chapter':chapter,'chapterIndex':chapter-1,'baseRewards':{k:v[chapter-1] for k,v in labyrinth.items() if k.startswith('Base') and k.endswith('ByChapter') and isinstance(v,list) and chapter<=len(v)},'progressReward':labyrinth['LabyrinthProgressRewardDatas'][chapter-1]})
    (output/'chapter-rewards.json').write_text(json.dumps(rewards,separators=(',',':')))
    (output/'stage-index.json').write_text(json.dumps(stage_rows,separators=(',',':')))
    (output/'monster-assets.json').write_text(json.dumps(enemy_spines,separators=(',',':')))
    if copy_assets:
        paths=[]
        for s in enemy_spines:
            folder=Path(s['manifest']).parent
            paths.extend(str(Path('rpg-assets')/folder/n) for n in [s['skeleton'],s['atlas'],*s['pages']])
        raw=subprocess.check_output(['git','archive','--format=tar',ASSET_REV,*paths],cwd=repo)
        asset_out=output/'monsters';asset_out.mkdir()
        with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
            for member in tar.getmembers():
                if member.isdir():continue
                if not member.isfile():raise ValueError('Unexpected non-file asset')
                rel=Path(member.name).relative_to('rpg-assets/characters/enemies')
                if rel.is_absolute() or '..' in rel.parts:raise ValueError('Unsafe asset path')
                dest=asset_out/rel;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(tar.extractfile(member).read())
    result={'stages':count,'chapters':len(chapters),'monsterDefinitions':len(monsters),'evaluatedSlots':stats_count,'heroBasedPendingSlots':hero_based,'spinePacks':len(enemy_spines),'visualLinkedCandidates':sum(bool(r['visualCandidates']) for r in monsters),'missingActions':missing_actions,'assetRevision':ASSET_REV,'sourceHashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [decoded/'ActorData.json',decoded/'ActionData.json',decoded/'LabyrinthData.json',decoded/'stages.jsonl',catalog,asset_index,spine_index,gameobjects,monobehaviours]},'limitations':['scene spawn trigger order is not derived from MonsterDatas slot order','GUID adjacency is not a verified Addressables runtime location','full action filters/colliders/effects and HP pipeline not executed']}
    (output/'manifest.json').write_text(json.dumps(result,indent=2));return result

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['decoded','catalog','asset-index','spine-index','gameobjects','monobehaviours','output','repo']:p.add_argument('--'+name,type=Path,required=True)
    p.add_argument('--copy-assets',action='store_true');a=p.parse_args();print(json.dumps(restore(a.decoded,a.catalog,a.asset_index,a.spine_index,a.gameobjects,a.monobehaviours,a.output,a.repo,a.copy_assets)))
