import struct,unittest
from recover_combat_gaps import compressed_uint,compressed_int,action_parameter
class RecoveryTests(unittest.TestCase):
    def test_unsigned_boundaries(self):
        for raw,expected,width in [(b'\x00',0,1),(b'\x7f',127,1),(b'\x80\x80',128,2),(b'\xbf\xff',16383,2),(bytes.fromhex('c0004000'),16384,4),(bytes.fromhex('dfffffff'),0x1fffffff,4),(bytes.fromhex('f000000080'),0x80000000,5),(b'\xfe',0xfffffffe,1),(b'\xff',0xffffffff,1)]:
            self.assertEqual(compressed_uint(raw),(expected,width))
    def test_signed_zigzag_and_minimum_sentinel(self):
        for raw,value in [(b'\0',0),(b'\2',1),(b'\1',-1),(b'\3',-2),(b'\xff',-2147483648)]:self.assertEqual(compressed_int(raw)[0],value)
    def test_invalid_and_truncated_fail_closed(self):
        for raw in [b'\xe0',b'\x80',b'\xc0\0',b'\xf0\0']:
            with self.assertRaises((ValueError,IndexError)):compressed_uint(raw)
    def test_native_selector_does_not_scale_symbolic_value_by_literal(self):
        self.assertEqual(action_parameter(2,100,[400]*9),400)
        self.assertEqual(action_parameter(3,0,[400,12]+[0]*7),12)
        self.assertEqual(action_parameter(1,100,None),0)
        self.assertIsNone(action_parameter(2,100,None))
        self.assertEqual(action_parameter(0,.1,None),struct.unpack('<f',struct.pack('<f',.1))[0])
if __name__=='__main__':unittest.main()
