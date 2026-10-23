"""Regression tests for bounds and ISIL extraction. No runtime/package dependencies."""
import struct
import unittest
from trace_combat_chain import Buffer, parse_schema


class TraceTests(unittest.TestCase):
    def test_accessor_uses_isil_not_disassembly(self):
        schema = parse_schema('''Type: BalanceData.ActionMotionData
Method: System.Single get_StartTime()
Disassembly:
 MOV W1, 88
ISIL:
 001 Move W1, 4
 002 Move X2, X31
 003 Move X19, X0
 004 Call Table.__offset, X0, X1
 005 Call ByteBuffer.GetFloat, X0, X1
Method: System.String get_AnimationName()
ISIL:
 001 Move W1, 6
 002 Call Table.__offset, X0, X1
 003 Call Table.__string, X0, X1
''')
        self.assertEqual(schema[1], [{'name': 'StartTime', 'slot': 4, 'kind': 'f'},
                                     {'name': 'AnimationName', 'slot': 6, 'kind': 'str'}])

    def test_signed_forward_vtable_and_absent(self):
        # Table at 4, shared vtable at 16; scalar at 8.
        raw = bytearray(24)
        struct.pack_into('<Iif', raw, 0, 4, -12, 0.75)
        struct.pack_into('<HHHH', raw, 16, 8, 8, 4, 0)
        buf = Buffer(raw)
        self.assertEqual(buf.value(4, 4, 'f'), 0.75)
        self.assertIsNone(buf.value(4, 6, 'f'))

    def test_truncated_and_overlong_inputs(self):
        for raw in [b'', b'\xff'*8]:
            with self.assertRaises(ValueError):
                Buffer(raw).records()
        with self.assertRaises(ValueError):
            Buffer(b'\0'*8).read('I', -1)


if __name__ == '__main__':
    unittest.main()
