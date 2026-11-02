"""Native geometry/camera, corruption rejection and safe export tests.

Run: python -m unittest discover -s scripts/unity -p 'test_*.py'
No Unity Editor compile or Play Mode coverage is implied.
"""
import contextlib
import copy
import io
import json
from pathlib import Path
import tempfile
import unittest

from map_contract import (CONTRACT_RESOURCE, MAP_RESOURCE, MAP_SOURCE, build_map_contract,
                          clipped_floor, geometry_bounds, read_json, triangle_height,
                          validate_contract, validate_scene)
from prepare_assets import ROOT, ResourceWriter, prepare
from validate_export import validate


class NativeMapContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scene = read_json(ROOT / MAP_SOURCE / 'scene.json')
        cls.monsters = read_json(ROOT / 'unity/IslandGame/Assets/Island/Resources/AssetIndex.json')['monsters']
        cls.contract = build_map_contract(ROOT, cls.monsters)

    def test_original_payload_and_native_coordinate_evidence(self):
        self.assertEqual(validate_scene(self.scene, ROOT / MAP_SOURCE),
                         {'geometry': 33, 'renderers': 108, 'materials': 14, 'textures': 14})
        self.assertEqual(validate_contract(self.scene, self.contract), 40)
        self.assertEqual(self.contract['playable']['startWorld'], [-4, 11, -63])
        self.assertEqual(self.contract['playable']['endWorld'], [-4, 11, 7])
        self.assertEqual(self.contract['camera']['localPosition'], [16, 14.630000114440918, -61.79999923706055])
        self.assertEqual(self.contract['camera']['raw']['m_GateFitMode'], 2)
        self.assertAlmostEqual(self.contract['camera']['raw']['m_LensShift']['y'], -.48)
        self.assertEqual(len(self.contract['unresolved']), 2)

    def test_native_floor_supports_every_arena_without_decorative_colliders(self):
        collider = self.contract['colliders'][0]
        self.assertEqual(len(collider['sourceRendererIds']), 9)
        floor = [[collider['positions'][i] for i in face] for face in collider['triangles']]
        for arena in self.contract['arenas']:
            for z in (arena['minZ'], arena['playerZ'], arena['bossZ'], arena['maxZ']):
                self.assertTrue(any(triangle_height(-4, z, triangle) is not None for triangle in floor))
        self.assertTrue(all(abs(p[1] - 10) < 1e-4 for p in collider['positions']))

    def test_instance_world_is_not_applied_twice(self):
        modified = copy.deepcopy(self.scene)
        for renderer in modified['renderers']:
            renderer['instanceWorld'][0][3] += 1000
        self.assertEqual(geometry_bounds(modified), geometry_bounds(self.scene))
        self.assertEqual(clipped_floor(modified, self.contract['playable']), self.contract['colliders'][0])

    def test_static_baked_vertices_reject_second_world_transform(self):
        scene = copy.deepcopy(self.scene)
        renderer = next(r for r in scene['renderers'] if r['staticBatch'])
        renderer['world'][2][3] = 12
        with self.assertRaisesRegex(AssertionError, 'already baked'):
            validate_scene(scene)

    def test_reject_mesh_index_outside_vertex_bounds(self):
        scene = copy.deepcopy(self.scene)
        geometry = next(iter(scene['geometry'].values()))
        geometry['submeshes'][0][0][0] = len(geometry['positions'])
        with self.assertRaisesRegex(AssertionError, 'triangle bounds'):
            validate_scene(scene)

    def test_reject_uv_count_and_nonfinite_values(self):
        scene = copy.deepcopy(self.scene)
        next(iter(scene['geometry'].values()))['uv2'].pop()
        with self.assertRaisesRegex(AssertionError, 'vertex count'):
            validate_scene(scene)
        scene = copy.deepcopy(self.scene)
        next(iter(scene['geometry'].values()))['uv'][0][1] = float('nan')
        with self.assertRaises(AssertionError):
            validate_scene(scene)

    def test_reject_material_slot_and_submesh_references(self):
        scene = copy.deepcopy(self.scene)
        scene['renderers'][0]['materials'][0] = 'missing-material'
        with self.assertRaisesRegex(AssertionError, 'material reference'):
            validate_scene(scene)
        scene = copy.deepcopy(self.scene)
        scene['renderers'][0]['submeshes'][0] = 999
        with self.assertRaisesRegex(AssertionError, 'submesh bounds'):
            validate_scene(scene)

    def test_reject_lightmap_reference_and_unsafe_texture_path(self):
        scene = copy.deepcopy(self.scene)
        scene['lightmaps'][0] = 'missing-lightmap'
        with self.assertRaisesRegex(AssertionError, 'Lightmap texture'):
            validate_scene(scene)
        scene = copy.deepcopy(self.scene)
        next(iter(scene['textures'].values()))['file'] = '../escape.png'
        with self.assertRaisesRegex(AssertionError, 'unsafe texture'):
            validate_scene(scene)

    def test_reject_camera_evidence_and_local_rotation_changes(self):
        contract = copy.deepcopy(self.contract)
        contract['camera']['raw']['m_FocalLength'] = 20
        with self.assertRaisesRegex(AssertionError, 'Camera evidence'):
            validate_contract(self.scene, contract)
        contract = copy.deepcopy(self.contract)
        contract['camera']['localRotation'] = [0, 0, 0, 1]
        with self.assertRaisesRegex(AssertionError, 'local/world rotation'):
            validate_contract(self.scene, contract)

    def test_reject_floor_gap(self):
        contract = copy.deepcopy(self.contract)
        collider = contract['colliders'][0]
        kept = [(face, source) for face, source in zip(collider['triangles'], collider['triangleSources'])
                if max(collider['positions'][i][2] for i in face) < 0]
        collider['triangles'] = [face for face, _ in kept]
        collider['triangleSources'] = [source for _, source in kept]
        collider['sourceRendererIds'] = sorted({source['renderer'] for _, source in kept})
        with self.assertRaisesRegex(AssertionError, 'Floor gap'):
            validate_contract(self.scene, contract)

    def test_reject_invented_collider_surface(self):
        contract = copy.deepcopy(self.contract)
        collider = contract['colliders'][0]
        collider['positions'][0][2] = -20
        with self.assertRaises(AssertionError):
            validate_contract(self.scene, contract)

    def test_actor_substitutions_are_resolved_and_disclosed(self):
        for actor in self.contract['actorAssets']:
            self.assertTrue(actor['substitute'])
            self.assertEqual(actor['skeleton'], self.monsters[actor['monsterId']]['skeleton'])


class ResourcePreservationTests(unittest.TestCase):
    def test_changed_resources_backed_up_and_unchanged_not_rewritten(self):
        with tempfile.TemporaryDirectory() as temp:
            writer = ResourceWriter(Path(temp), backup_changes=True)
            path = writer.write('sample.json', b'{"local":true}')
            meta = path.with_suffix('.json.meta')
            meta.write_text('guid: local-guid', encoding='utf-8')
            mtime = path.stat().st_mtime_ns
            writer.write('sample.json', path.read_bytes())
            self.assertEqual(path.stat().st_mtime_ns, mtime)
            self.assertFalse(writer.backup.exists())
            writer.write('sample.json', b'{"updated":true}')
            self.assertEqual((writer.backup / 'Assets/Island/Resources/sample.json').read_bytes(), b'{"local":true}')
            self.assertEqual(meta.read_text(), 'guid: local-guid')
            with self.assertRaises(ValueError):
                writer.write('../outside.txt', b'invalid')

    def test_external_preparation_keeps_local_files_and_validates_all_exports(self):
        with tempfile.TemporaryDirectory() as temp, contextlib.redirect_stdout(io.StringIO()):
            project = Path(temp)
            (project / 'Packages').mkdir()
            (project / 'Packages/manifest.json').write_text('{}')
            resources = project / 'Assets/Island/Resources'
            resources.mkdir(parents=True)
            (resources / 'RpgCatalog.json').write_text('{"localEdit":true}')
            (resources / 'RpgCatalog.json.meta').write_text('guid: original-local-guid')
            (resources / 'MyUnpublishedUI.txt').write_text('keep me')
            rows = prepare(checkout=False, project_path=project, skip_catalog=True)
            self.assertEqual(validate(project), len(rows))
            self.assertEqual((resources / 'MyUnpublishedUI.txt').read_text(), 'keep me')
            self.assertEqual((resources / 'RpgCatalog.json.meta').read_text(), 'guid: original-local-guid')
            backups = list(project.glob('IslandUpdateBackups/resources-*/Assets/Island/Resources/RpgCatalog.json'))
            self.assertEqual(len(backups), 1)
            self.assertEqual(json.loads(backups[0].read_text()), {'localEdit': True})
            self.assertIn(MAP_RESOURCE + '/scene.json', {r['destination'] for r in rows})
            self.assertIn(CONTRACT_RESOURCE, {r['destination'] for r in rows})


if __name__ == '__main__':
    unittest.main()
