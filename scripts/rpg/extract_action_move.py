"""Extract qualified traversal links; do not join legacy scene-local PathIDs by themselves."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
from restore_map_graph import Graph, load_zip, legacy_labels


def extract(source, legacy, output):
    manifest, objects = load_zip(source)
    graph = Graph(manifest, objects)
    labels, _ = legacy_labels(legacy)
    scenes = {o['identity']['serialized_file']: labels.get(str(o['tree']['_mapSceneConfig']['m_PathID']), {}).get('name')
              for o in objects if '_mapSceneConfig' in o['tree']}
    links = []
    for obj in objects:
        tree = obj['tree']
        if '_actionMoveType1' not in tree:
            continue
        origin = graph.describe(obj)
        for slot in (1, 2):
            kind = tree['_actionMoveType' + str(slot)]
            if not kind:
                continue
            target = graph.resolve(obj['identity']['serialized_file'], tree['_linkedReactor' + str(slot)])
            if target is None:
                continue
            end = graph.describe(target)
            start_xyz = [origin['worldMatrix'][i][3] for i in range(3)]
            end_xyz = [end['worldMatrix'][i][3] for i in range(3)]
            links.append(dict(type=kind, slot=slot, fromXYZ=start_xyz, toXYZ=end_xyz,
                              delta=[round(end_xyz[i]-start_xyz[i], 4) for i in range(3)],
                              source=origin, target=end, sceneLabel=scenes.get(obj['identity']['serialized_file'])))
    active = [r for r in links if r['source']['activeInHierarchy'] and not r['source']['deactivated']]
    examples = {}
    for name, kind, rise in [('jump-gap', 2, 0), ('jump-down', 2, -8), ('jump-up', 2, 4), ('jump-climb', 3, 8), ('slide', 1, 0)]:
        examples[name] = next(r for r in active if r['type'] == kind and r['delta'][1] == rise and r['delta'][2] > 0)
    result = dict(sourceZipSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                  bundleSha256=manifest['sha256'], linkedDirections=len(links),
                  byType=dict(collections.Counter(r['type'] for r in links)),
                  activeByType=dict(collections.Counter(r['type'] for r in active)), examples=examples,
                  scope='Qualified serialized-file links and composed world transforms. Scene names use legacy config labels only. Active does not imply triggered in every stage. Web arena order, ledges, and corridor width are adapters, not a restored original scene.')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('ACTION_LINKS_WRITTEN', len(links), len(examples))


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--graph-zip', type=Path, required=True)
    p.add_argument('--legacy-audit', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    extract(a.graph_zip, a.legacy_audit, a.output)
