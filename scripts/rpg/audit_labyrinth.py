"""Audit private stage coverage, finite stats and unchanged original asset bytes."""
import argparse,collections,csv,hashlib,json,math
from pathlib import Path


def audit(root,asset_index):
    manifest=json.loads((root/'manifest.json').read_text())
    by_chapter=collections.defaultdict(set);slots=0
    for line in (root/'labyrinth.jsonl').open():
        row=json.loads(line);by_chapter[row['chapter']].add(row['section'])
        assert row['stageId']==row['chapter']*100+row['section']
        assert row['finalEncounter']==('boss' if row['section']==5 else 'midboss')
        assert row['slotsAreSpawnDefinitionsNotWaveOrder'] is True
        for slot in row['slots']:
            if slot['stats'] is None:continue
            assert all(isinstance(v,(int,float)) and math.isfinite(v) and v>=0 for v in slot['stats'].values())
            slots+=1
    assert set(by_chapter)==set(range(1,manifest['chapters']+1))
    assert all(sections=={1,2,3,4,5} for sections in by_chapter.values())
    assert slots==manifest['evaluatedSlots']
    assets=json.loads(asset_index.read_text());checked=0
    for pack in json.loads((root/'monster-assets.json').read_text()):
        for filename,typ in [(pack['skeleton'],'TextAsset'),(pack['atlas'],'TextAsset'),*((n,'Texture2D') for n in pack['pages'])]:
            name=pack['name']+'.atlas' if filename==pack['atlas'] else pack['name']
            candidates=[a for a in assets if a['type']==typ and a['name']==name]
            digest=hashlib.sha256((root/'monsters'/pack['name']/filename).read_bytes()).hexdigest()
            assert any(a['sha256']==digest for a in candidates),(pack['name'],filename,'original byte hash mismatch')
            checked+=1
    profiles=json.loads((root/'monster-profiles.json').read_text())
    result={'stageRecords':sum(len(v) for v in by_chapter.values()),'chapters':len(by_chapter),'statSlots':slots,'assetFilesHashMatched':checked,
            'actionTimelines':sum(len(p['attacks']) for p in profiles),'unresolvedActionEvents':sum(len(a['pending']) for p in profiles for a in p['attacks']),
            'missingVisualActorTypes':[p['actorType'] for p in profiles if not p['visualCandidates']]}
    (root/'integrity-audit.json').write_text(json.dumps(result,indent=2));return result

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,required=True);p.add_argument('--asset-index',type=Path,required=True)
    args=p.parse_args();print(json.dumps(audit(args.root,args.asset_index)))
