import struct
import tempfile
import unittest
from pathlib import Path
from audit_vardian_db import audit, inspect_file


class DBAuditTests(unittest.TestCase):
    def test_valid_scalar_does_not_turn_into_a_made_up_cost_or_level(self):
        # Root table with one scalar; exact field meaning is unknown.
        raw = struct.pack('<IHHH2xiI', 12, 6, 8, 4, 8, 100)
        with tempfile.TemporaryDirectory() as folder:
            f = Path(folder) / 'TeamData.bytes'
            f.write_bytes(raw)
            r = inspect_file(f)
            self.assertEqual(r['semanticStatus'], 'UNRESOLVED_WITHOUT_MATCHED_SCHEMA')
            self.assertEqual(r['fields'][0]['rawPrefixHex'], '64000000')
            self.assertNotIn('candidateTableVector', r['fields'][0])
            report = audit(Path(folder))
            self.assertNotIn('TeamData.bytes', report['missingPriorityFiles'])
            self.assertIn('MaterialData.bytes', report['missingPriorityFiles'])

    def test_corrupt_files_are_reported_without_crashing_or_reading_outside(self):
        with tempfile.TemporaryDirectory() as folder:
            f = Path(folder) / 'GearData.bytes'
            f.write_bytes(b'\xff\xff\xff\xff')
            r = audit(Path(folder))
            self.assertEqual(r['files'][0]['format'], 'NOT_DECODED')

    def test_missing_directory_is_not_a_successful_empty_recovery(self):
        with self.assertRaises(ValueError):
            audit(Path('/does-not-exist-vardian'))


if __name__ == '__main__':
    unittest.main()
