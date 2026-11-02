"""Execute the additive installer against disposable projects, never a user's project.

POWERSHELL_EXE can point to Windows PowerShell or PowerShell Core. A missing
runtime is an explicit skip, not an installation success.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('install_boss_trials.ps1')
PWSH = os.environ.get('POWERSHELL_EXE') or shutil.which('pwsh') or shutil.which('powershell')


@unittest.skipUnless(PWSH, 'PowerShell runtime unavailable; installer execution NOT verified')
class BossInstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='boss install test ')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.source = self.base/'source checkout'
        self.target = self.base/'local project'
        self.payload = self.source/'unity/IslandGame/Assets/Island'
        self.local = self.target/'Assets/Island'
        self.write(self.payload/'Resources/BossTrials/map-contract.json', '{"schema":1}')
        self.write(self.payload/'Runtime/BossTrials/BossTrialController.cs', 'NEW CONTROLLER')
        self.write(self.payload/'Runtime/BossTrials/BossTrialModel.cs', 'INCOMING MODEL')
        self.write(self.payload/'Editor/BossTrialTestMenu.cs', 'NEW MENU')
        self.write(self.payload/'Runtime/UnityDisplayNames.cs', 'NEW NAME HELPER')
        self.write(self.payload/'Runtime/IslandApp.cs', 'UPSTREAM APP')
        self.write(self.payload/'Runtime/NativeBattle.cs', 'UPSTREAM NULL FIX')
        self.write(self.payload/'Runtime/IslandRpgPresentation.cs', 'UPSTREAM PRESENTATION')
        self.write(self.payload/'Resources/RpgCatalog.json', '{"upstream":true}')
        self.write(self.payload/'Resources/BossTrials/BossTrialRecoveredMap.shader', 'SHADER')
        self.write(self.local/'Runtime/IslandApp.cs', 'LOCAL UGUI APP')
        self.write(self.local/'Runtime/BossTrials/BossTrialModel.cs', 'LOCAL MODEL EDIT')
        self.write(self.local/'Runtime/BossTrials/BossTrialModel.cs.meta', 'LOCAL GUID')
        self.write(self.local/'Resources/RpgCatalog.json', '{"local":true}')
        self.dependencies = {'com.unity.ugui':'2.0.0', 'com.esotericsoftware.spine.spine-unity':'file:local-runtime'}
        self.write(self.target/'Packages/manifest.json', json.dumps({'dependencies':self.dependencies, 'scopedRegistries':[]}))

    @staticmethod
    def write(path, content):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)

    def run_install(self):
        return subprocess.run([str(PWSH), '-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass',
                               '-File', str(SCRIPT), '-ProjectPath', str(self.target),
                               '-SourceRepo', str(self.source)], capture_output=True, text=True, timeout=45)

    def test_preserves_local_edits_stages_conflicts_and_merges_only_physics(self):
        result = self.run_install()
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        self.assertEqual((self.local/'Runtime/IslandApp.cs').read_text(), 'LOCAL UGUI APP')
        self.assertEqual((self.local/'Runtime/BossTrials/BossTrialModel.cs').read_text(), 'LOCAL MODEL EDIT')
        self.assertEqual((self.local/'Runtime/BossTrials/BossTrialModel.cs.meta').read_text(), 'LOCAL GUID')
        self.assertEqual(json.loads((self.local/'Resources/RpgCatalog.json').read_text()), {'local':True})
        self.assertFalse((self.local/'Runtime/IslandRpgPresentation.cs').exists())
        self.assertFalse((self.local/'Runtime/NativeBattle.cs').exists())
        self.assertEqual((self.local/'Runtime/BossTrials/BossTrialController.cs').read_text(), 'NEW CONTROLLER')
        self.assertTrue((self.local/'Editor/BossTrialTestMenu.cs').exists())
        self.assertTrue((self.local/'Resources/BossTrials/BossTrialRecoveredMap.shader').exists())
        manifest = json.loads((self.target/'Packages/manifest.json').read_text())
        self.assertEqual(manifest['dependencies'], {**self.dependencies, 'com.unity.modules.physics':'1.0.0'})
        backup = next((self.target/'.island-backups').rglob('manifest.json'))
        self.assertEqual(json.loads(backup.read_text())['dependencies'], self.dependencies)
        report = next((self.target/'.island-incoming').rglob('install-report.json'))
        rows = json.loads(report.read_text(encoding='utf-8-sig'))
        statuses = {r['path'].replace('\\','/'):r['status'] for r in rows}
        self.assertEqual(statuses['Runtime/IslandApp.cs'], 'manual-merge')
        self.assertEqual(statuses['Runtime/NativeBattle.cs'], 'manual-merge')
        self.assertEqual(statuses['Runtime/IslandRpgPresentation.cs'], 'manual-merge')
        self.assertEqual(statuses['Runtime/BossTrials/BossTrialModel.cs'], 'staged-conflict')
        self.assertEqual(self.run_install().returncode, 0)
        self.assertEqual((self.local/'Runtime/IslandApp.cs').read_text(), 'LOCAL UGUI APP')

    def test_invalid_manifest_does_not_copy_runtime(self):
        self.write(self.target/'Packages/manifest.json', '{"noDependencies":true}')
        result = self.run_install()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.local/'Runtime/BossTrials/BossTrialController.cs').exists())
        self.assertEqual(json.loads((self.target/'Packages/manifest.json').read_text()), {'noDependencies':True})

    def test_existing_physics_pin_preserved(self):
        self.write(self.target/'Packages/manifest.json', json.dumps({'dependencies':{**self.dependencies,'com.unity.modules.physics':'1.0.0'}}))
        before = (self.target/'Packages/manifest.json').read_bytes()
        result = self.run_install()
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        self.assertEqual((self.target/'Packages/manifest.json').read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
