import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from export_poker_profiles import export_profiles


class PokerProfileExportTests(unittest.TestCase):
    def test_additive_export_keeps_guids_and_local_code_and_backs_up_changed_art(self):
        with tempfile.TemporaryDirectory() as folder:
            project=Path(folder)
            (project/'Assets/Island/Runtime').mkdir(parents=True)
            (project/'Packages').mkdir()
            (project/'Packages/manifest.json').write_text('{"dependencies":{"local":"keep"}}')
            local=project/'Assets/Island/Runtime/IslandApp.cs'
            local.write_text('LOCAL UGUI')
            target=project/'Assets/Island/Resources/WebAssets/poker/profiles/hong.png'
            target.parent.mkdir(parents=True)
            target.write_bytes(b'previous picture')
            meta=target.with_suffix('.png.meta');meta.write_text('LOCAL GUID')
            rows=export_profiles(project)
            self.assertEqual(len(rows),11)
            self.assertEqual(local.read_text(),'LOCAL UGUI')
            self.assertEqual(meta.read_text(),'LOCAL GUID')
            self.assertEqual(json.loads((project/'Packages/manifest.json').read_text()),{'dependencies':{'local':'keep'}})
            saved=list((project/'.island-backups').rglob('hong.png'))
            self.assertEqual(len(saved),1);self.assertEqual(saved[0].read_bytes(),b'previous picture')
            for row in rows:
                data=(project/'Assets/Island/Resources'/row['destination']).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(),row['sha256'])
            before=target.stat().st_mtime_ns
            export_profiles(project)
            self.assertEqual(target.stat().st_mtime_ns,before)
            self.assertEqual(len(list((project/'.island-backups').rglob('hong.png'))),1)


if __name__=='__main__':unittest.main()
