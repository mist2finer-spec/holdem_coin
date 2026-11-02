"""Evidence-backed native map contract for the isolated Unity boss trial.

The original scene payload is copied verbatim. This module only derives the
small playable collider strip and records camera/actor coordinate evidence.
It does not recover the original game's collision or camera-follow scripts.
"""
import gzip
import hashlib
import json
import math
from pathlib import Path

MAP_SOURCE = Path('public/rpg/maps/candle-dungeon')
MAP_RESOURCE = 'WebAssets/rpg/maps/candle-dungeon'
CONTRACT_RESOURCE = 'BossTrials/map-contract.json'
BOSS_ACTORS = (
    ('B01', '1253', 'Pyroth, the Cinder Wyrm'),
    ('B02', '1154', 'Morthane, the Rot Lord'),
    ('B03', '1323', 'Granite Sentinel'),
    ('B04', '1322', 'Sylphid, the Storm Dancer'),
    ('B05', '1104', "Vex'thara, the Shadow Weaver"),
    ('B06', '1105', 'AXIOM-9, Sentinel Prime'),
    ('B07', '1202', 'Swarm Queen Nidra'),
    ('B08', '1252', 'Ravager Drone Array'),
    ('B09', '1032', 'VIRUS-7, Digital Mind'),
    ('B10', '1055', 'TITAN-X, Apocalypse Frame'),
)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def transform_point(matrix, point):
    """Apply row-major Unity affine matrix once, including translation."""
    return [sum(matrix[i][j] * point[j] for j in range(3)) + matrix[i][3]
            for i in range(3)]


def triangle_height(x, z, triangle, tolerance=1e-5):
    a, b, c = triangle
    den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
    if abs(den) < 1e-10:
        return None
    u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den
    if u < -tolerance or v < -tolerance or u + v > 1 + tolerance:
        return None
    return u * a[1] + v * b[1] + (1 - u - v) * c[1]


def _normal_y(triangle):
    a, b, c = triangle
    return (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2])


def _clip_polygon(polygon, axis, bound, keep_above):
    """Sutherland-Hodgman clip, retaining native surface interpolation."""
    if not polygon:
        return []
    result = []
    previous = polygon[-1]
    previous_inside = previous[axis] >= bound if keep_above else previous[axis] <= bound
    for current in polygon:
        inside = current[axis] >= bound if keep_above else current[axis] <= bound
        if inside != previous_inside:
            t = (bound - previous[axis]) / (current[axis] - previous[axis])
            result.append([previous[i] + t * (current[i] - previous[i]) for i in range(3)])
        if inside:
            result.append(current)
        previous, previous_inside = current, inside
    return result


def native_floor_triangles(scene, ground_y):
    """Select actual upward ground surfaces, never walls/rails/candle geometry."""
    for renderer in scene['renderers']:
        geometry = scene['geometry'][renderer['geometry']]
        vertices = [transform_point(renderer['world'], p) for p in geometry['positions']]
        for material_id, submesh in zip(renderer['materials'], renderer['submeshes']):
            if scene['materials'][material_id]['name'] != 'ground_tile01':
                continue
            for number, indices in enumerate(geometry['submeshes'][submesh]):
                triangle = [vertices[i] for i in indices]
                if any(abs(p[1] - ground_y) > 1e-4 for p in triangle) or _normal_y(triangle) <= 1e-8:
                    continue
                yield triangle, {'renderer': renderer['id'], 'geometry': renderer['geometry'],
                                 'submesh': submesh, 'triangle': number}


def clipped_floor(scene, playable):
    positions, triangles, sources, vertex_ids = [], [], [], {}
    for original, source in native_floor_triangles(scene, playable['groundY']):
        polygon = original
        for axis, bound, keep_above in ((0, playable['minX'], True), (0, playable['maxX'], False),
                                        (2, playable['minZ'], True), (2, playable['maxZ'], False)):
            polygon = _clip_polygon(polygon, axis, bound, keep_above)
        for i in range(1, len(polygon) - 1):
            triangle = [polygon[0], polygon[i], polygon[i + 1]]
            if _normal_y(triangle) <= 1e-8:
                continue
            indices = []
            for p in triangle:
                key = tuple(round(v, 9) for v in p)
                if key not in vertex_ids:
                    vertex_ids[key] = len(positions)
                    positions.append(list(key))
                indices.append(vertex_ids[key])
            triangles.append(indices)
            sources.append(source)
    if not triangles:
        raise ValueError('No native ground geometry supports the playable strip')
    return {'id': 'native-floor-strip', 'positions': positions, 'triangles': triangles,
            'triangleSources': sources,
            'sourceRendererIds': sorted({s['renderer'] for s in sources}),
            'worldSpace': True, 'convex': False,
            'derivation': 'Upward native ground_tile01 triangles at Y=10, clipped to the trial strip.'}


def geometry_bounds(scene):
    points = []
    for renderer in scene['renderers']:
        geometry = scene['geometry'][renderer['geometry']]
        ids = {i for submesh in renderer['submeshes'] for face in geometry['submeshes'][submesh] for i in face}
        points.extend(transform_point(renderer['world'], geometry['positions'][i]) for i in ids)
    return {'min': [min(p[i] for p in points) for i in range(3)],
            'max': [max(p[i] for p in points) for i in range(3)]}


def build_map_contract(repo, monsters):
    source_dir = Path(repo) / MAP_SOURCE
    scene = read_json(source_dir / 'scene.json')
    evidence = read_json(source_dir / 'evidence.json')
    source = json.loads(gzip.decompress((source_dir / 'source.json.gz').read_bytes()))
    validate_scene(scene, source_dir)
    camera_node = next(n for n in source['nodes'] if n['name'] == scene['camera']['name'])
    start = next(n for n in source['nodes'] if n['name'] == 'StartPoint' and n['active'])
    end = next(n for n in source['nodes'] if n['name'] == 'EndPoint' and n['active'])
    start_position = [r[3] for r in start['world'][:3]]
    end_position = [r[3] for r in end['world'][:3]]
    if start_position[:2] != end_position[:2]:
        raise ValueError('Native traversal endpoints no longer share the same actor plane')
    playable = {'axis': 'Z', 'minZ': start_position[2], 'maxZ': end_position[2],
                'depthX': start_position[0], 'groundY': 10.0, 'actorOriginY': start_position[1],
                'minX': start_position[0] - 1.0, 'maxX': start_position[0] + 1.0,
                'startNodeId': start['id'], 'endNodeId': end['id'],
                'startWorld': start_position, 'endWorld': end_position,
                'actorOriginOffsetAboveGround': start_position[1] - 10.0,
                'movementMapping': 'Trial lateral input maps directly to native world Z. Node server x is a separate adapter.'}
    local = camera_node['local']
    contract = {
        'schema': 1, 'scene': scene['scene'], 'sceneResource': MAP_RESOURCE + '/scene',
        'textureResourceRoot': MAP_RESOURCE + '/', 'coordinateSystem': scene['coordinateSystem'],
        'sourceFilesSha256': {name: sha256(source_dir / name) for name in ('scene.json', 'source.json.gz', 'evidence.json')},
        'nativeBundleSha256': evidence['sourceSha256'],
        'counts': {key: len(scene[key]) for key in ('geometry', 'renderers', 'materials', 'textures', 'lightmaps', 'flames')},
        'geometryBounds': geometry_bounds(scene),
        'camera': {**scene['camera'], 'sourceNodeId': camera_node['id'], 'parent': camera_node['parent'],
                   'localPosition': [local['m_LocalPosition'][k] for k in ('x', 'y', 'z')],
                   'localRotation': [local['m_LocalRotation'][k] for k in ('x', 'y', 'z', 'w')],
                   'localScale': [local['m_LocalScale'][k] for k in ('x', 'y', 'z')],
                   'originalLocal': local,
                   'projectionPolicy': 'Original physical perspective camera; panorama/layout projection is not the native camera.'},
        'playable': playable, 'defaultArena': 'west',
        'arenas': [{'id': name, 'minZ': lo, 'maxZ': hi, 'playerZ': lo + 5, 'bossZ': hi - 5}
                   for name, lo, hi in (('west', -61.0, -37.0), ('central', -41.0, -17.0), ('east', -19.0, 5.0))],
        'colliders': [clipped_floor(scene, playable)],
        'actorAssets': [{'bossId': boss_id, 'bossName': name, 'monsterId': monster_id,
                         'skeleton': monsters[monster_id]['skeleton'], 'substitute': True,
                         'reason': 'Existing native Spine 4.2 actor used for the test; bespoke design artwork is not supplied.'}
                        for boss_id, monster_id, name in BOSS_ACTORS],
        'unresolved': evidence['unresolved'],
        'renderPolicy': {
            'transform': 'Apply renderer.world once. Static-batch mesh vertices are already baked; never apply instanceWorld again.',
            'submesh': 'Renderer material slot n uses geometry.submeshes[renderer.submeshes[n]].',
            'colliders': 'Only colliders[] is playable collision. Visual renderers do not automatically receive colliders.',
            'lightmaps': 'Preserve original UV2, lightmap index/scale-offset and PNG payload. Recovered HDR/URP shader parity is unverified.',
            'shaders': 'Use an explicit URP 2D-compatible unlit adapter; original shader assets are not reconstructed.',
            'framing': 'Any combat framing is an explicit trial adaptation; retain a raw-camera mode using camera evidence unchanged.',
            'sourceScope': 'Original mesh placements/material inputs/camera data, not a recovery of all native gameplay scripts.'
        },
    }
    validate_contract(scene, contract)
    return contract


def _finite_vector(value, size, context):
    assert isinstance(value, list) and len(value) == size, context
    assert all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) for x in value), context


def _matrix(value, context):
    assert len(value) == 4, context
    for row in value:
        _finite_vector(row, 4, context)
    assert all(abs(value[3][i] - (1 if i == 3 else 0)) < 1e-7 for i in range(4)), context


def _source_key(reference):
    return tuple(reference[k] for k in ('renderer', 'geometry', 'submesh', 'triangle'))


def validate_scene(scene, texture_dir=None):
    """Reject corrupted mesh/UV/material/camera references before Unity import."""
    assert scene['geometry'] and scene['renderers'], 'Empty scene'
    for name, geometry in scene['geometry'].items():
        vertices = geometry['positions']
        assert vertices, name
        for vertex in vertices:
            _finite_vector(vertex, 3, (name, 'position'))
        for channel in ('uv', 'uv2'):
            assert len(geometry[channel]) == len(vertices), (name, channel, 'vertex count')
            for uv in geometry[channel]:
                _finite_vector(uv, 2, (name, channel))
        for submesh in geometry['submeshes']:
            assert submesh, (name, 'empty submesh')
            for face in submesh:
                assert len(face) == 3 and all(type(i) is int and 0 <= i < len(vertices) for i in face), (name, 'triangle bounds')
    ids = set()
    for renderer in scene['renderers']:
        assert renderer['id'] not in ids, 'Duplicate renderer'
        ids.add(renderer['id'])
        assert renderer['geometry'] in scene['geometry'], renderer['id']
        geometry = scene['geometry'][renderer['geometry']]
        assert len(renderer['materials']) == len(renderer['submeshes']) > 0, (renderer['id'], 'material slots')
        assert all(type(i) is int and 0 <= i < len(geometry['submeshes']) for i in renderer['submeshes']), (renderer['id'], 'submesh bounds')
        assert all(m in scene['materials'] for m in renderer['materials']), (renderer['id'], 'material reference')
        _matrix(renderer['world'], renderer['id'])
        _matrix(renderer['instanceWorld'], renderer['id'])
        if renderer['staticBatch']:
            assert all(abs(renderer['world'][i][j] - (1 if i == j else 0)) < 1e-7
                       for i in range(4) for j in range(4)), (renderer['id'], 'Static vertices already baked')
        assert renderer['lightmap'] in (-1, 65535) or 0 <= renderer['lightmap'] < len(scene['lightmaps']), (renderer['id'], 'lightmap')
        assert all(math.isfinite(renderer['lightmapUV'][k]) for k in ('x', 'y', 'z', 'w')), (renderer['id'], 'lightmapUV')
    for name, material in scene['materials'].items():
        assert material['texture'] in scene['textures'], (name, 'texture')
        for field in ('uvScale', 'uvOffset'):
            _finite_vector(material[field], 2, (name, field))
        assert all(math.isfinite(material['color'][k]) for k in ('r', 'g', 'b', 'a')), (name, 'color')
    assert all(t in scene['textures'] for t in scene['lightmaps']), 'Lightmap texture reference'
    for name, texture in scene['textures'].items():
        relative = Path(texture['file'])
        assert not relative.is_absolute() and '..' not in relative.parts and relative.parts[0] == 'textures', (name, 'unsafe texture path')
        assert len(texture['size']) == 2 and all(type(n) is int and n > 0 for n in texture['size']), (name, 'texture dimensions')
        if texture_dir:
            path = Path(texture_dir) / relative
            assert path.is_file() and sha256(path) == texture['sha256'], (name, 'texture sha256')
            # PNG IHDR records exact dimensions without needing Pillow in validation.
            payload = path.read_bytes()
            assert payload[:8] == b'\x89PNG\r\n\x1a\n', (name, 'PNG signature')
            assert [int.from_bytes(payload[16:20], 'big'), int.from_bytes(payload[20:24], 'big')] == texture['size'], (name, 'PNG dimensions')
    camera = scene['camera']
    _matrix(camera['world'], 'camera world')
    raw = camera['raw']
    assert raw['orthographic'] is False and raw['m_projectionMatrixMode'] == 2, 'Native physical perspective camera'
    assert 0 < raw['near clip plane'] < raw['far clip plane'], 'Camera clip planes'
    assert 0 < raw['field of view'] < 180 and raw['m_FocalLength'] > 0, 'Camera projection'
    assert all(math.isfinite(raw['m_LensShift'][k]) for k in ('x', 'y')), 'Camera lens shift'
    assert all(math.isfinite(raw['m_SensorSize'][k]) and raw['m_SensorSize'][k] > 0 for k in ('x', 'y')), 'Camera sensor'
    return {key: len(scene[key]) for key in ('geometry', 'renderers', 'materials', 'textures')}


def validate_contract(scene, contract):
    assert contract['schema'] == 1 and contract['scene'] == scene['scene'], 'Map contract schema'
    assert contract['counts'] == {k: len(scene[k]) for k in contract['counts']}, 'Map counts'
    assert contract['geometryBounds'] == geometry_bounds(scene), 'Map geometry bounds'
    camera = contract['camera']
    assert camera['raw'] == scene['camera']['raw'] and camera['world'] == scene['camera']['world'], 'Camera evidence changed'
    assert camera['parent'] is None and camera['localScale'] == [1, 1, 1], 'Camera parent/scale needs an adapter'
    assert camera['localPosition'] == [r[3] for r in camera['world'][:3]], 'Camera local/world translation'
    _finite_vector(camera['localRotation'], 4, 'Camera quaternion')
    x, y, z, w = camera['localRotation']
    assert abs(x*x + y*y + z*z + w*w - 1) < 1e-6, 'Camera quaternion magnitude'
    rotation = [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]
    assert all(abs(rotation[i][j] - camera['world'][i][j]) < 1e-6 for i in range(3) for j in range(3)), 'Camera local/world rotation'
    playable = contract['playable']
    assert playable['axis'] == 'Z' and playable['minZ'] < playable['maxZ'], 'Native traversal axis'
    assert playable['minX'] < playable['depthX'] < playable['maxX'], 'Actor plane bounds'
    assert playable['groundY'] < playable['actorOriginY'], 'Native actor origin is above foot contact'
    assert contract['defaultArena'] in {a['id'] for a in contract['arenas']}, 'Default arena'
    for arena in contract['arenas']:
        assert playable['minZ'] <= arena['minZ'] < arena['playerZ'] < arena['bossZ'] < arena['maxZ'] <= playable['maxZ'], arena
    source_triangles = {_source_key(reference): triangle for triangle, reference in native_floor_triangles(scene, playable['groundY'])}
    all_triangles = []
    for collider in contract['colliders']:
        assert collider['worldSpace'] is True and collider['convex'] is False, 'Native collider coordinate space'
        assert len(collider['triangles']) == len(collider['triangleSources']) > 0, 'Collider provenance'
        for position in collider['positions']:
            _finite_vector(position, 3, 'Collider position')
            assert playable['minX'] - 1e-6 <= position[0] <= playable['maxX'] + 1e-6, 'Collider depth bound'
            assert playable['minZ'] - 1e-6 <= position[2] <= playable['maxZ'] + 1e-6, 'Collider traversal bound'
            assert abs(position[1] - playable['groundY']) < 1e-4, 'Collider ground height'
        for indices, reference in zip(collider['triangles'], collider['triangleSources']):
            assert len(indices) == 3 and all(type(i) is int and 0 <= i < len(collider['positions']) for i in indices), 'Collider triangle bounds'
            triangle = [collider['positions'][i] for i in indices]
            original = source_triangles[_source_key(reference)]
            assert _normal_y(triangle) > 1e-8, 'Collider upward winding'
            for p in triangle:
                height = triangle_height(p[0], p[2], original)
                assert height is not None and abs(height - p[1]) < 1e-4, 'Collider must lie on its original native triangle'
            all_triangles.append(triangle)
        assert collider['sourceRendererIds'] == sorted({s['renderer'] for s in collider['triangleSources']}), 'Collider source IDs'
    # Detect missing stretches and false continuity, including both strip edges.
    steps = math.ceil((playable['maxZ'] - playable['minZ']) / .25)
    for step in range(steps + 1):
        z = playable['minZ'] + (playable['maxZ'] - playable['minZ']) * step / steps
        for x in (playable['minX'], playable['depthX'], playable['maxX']):
            assert any(triangle_height(x, z, t) is not None for t in all_triangles), ('Floor gap', x, z)
    assert len(contract['actorAssets']) == 10 and len({a['bossId'] for a in contract['actorAssets']}) == 10, 'Boss actor count'
    assert all(a['substitute'] is True for a in contract['actorAssets']), 'Native substitution disclosure'
    return len(all_triangles)
