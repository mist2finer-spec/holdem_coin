import struct
import unittest

from decode_vardian_db import Decoder, RecoveryBuffer, parse_type, integer_default


def fixture(value=42):
    raw = bytearray(20)
    struct.pack_into('<IHHH', raw, 0, 12, 6, 8, 4)
    struct.pack_into('<ii', raw, 12, 8, value)
    return bytes(raw)


class DecoderTests(unittest.TestCase):
    def schema(self, **overrides):
        field = dict(name='Value', slot=4, kind='scalar', fmt='i', vector=False, boolean=False)
        field.update(overrides)
        return {'Example': {'fields': [field]}}

    def test_signed_scalar(self):
        self.assertEqual(Decoder(fixture(-7), self.schema()).table(12, 'Example')['Value'], -7)

    def test_boolean_only_when_declared(self):
        self.assertIs(Decoder(fixture(1), self.schema(boolean=True)).table(12, 'Example')['Value'], True)
        self.assertIs(type(Decoder(fixture(1), self.schema()).table(12, 'Example')['Value']), int)

    def test_absent_default_is_not_guessed(self):
        d = Decoder(fixture(), self.schema(slot=6)).table(12, 'Example')
        self.assertNotIn('Value', d)
        self.assertEqual(d['_absentDefaultsUnresolved'], ['Value'])

    def test_malformed_table_rejected(self):
        with self.assertRaises(ValueError):
            Decoder(fixture()[:15], self.schema()).table(12, 'Example')

    def test_vector_span_is_checked(self):
        raw = bytearray(fixture(4))
        raw.extend(struct.pack('<I', 13241))
        with self.assertRaises(ValueError):
            RecoveryBuffer(raw).vector(12, 4, 'i')

    def test_isil_reader_over_disassembly(self):
        result = parse_type('Type: BalanceData.Example\nMethod: System.Double get_Value()\n'
            'Disassembly: GetInt\nISIL:\nMove W1, 4\nCall Table.__offset\nCall ByteBuffer.GetDouble\n')
        self.assertEqual(result[1]['fields'][0]['fmt'], 'd')

    def test_integer_default_requires_proven_return_path(self):
        text = '007 Compare W0, 0\n008 JumpIfEqual {20}\n020 Move X30, [X31+16]\n021 Return X0\n'
        self.assertEqual(integer_default(text)['value'], 0)
        self.assertIsNone(integer_default(text.replace('Move X30, [X31+16]', 'Call Unknown')))
        self.assertIsNone(integer_default(text.replace('Move X30, [X31+16]', 'NotImplemented MOVI')))

    def test_tangent_infinity_preserved_but_nan_rejected(self):
        schema = {'KeyFrameData': {'fields': [dict(name='InTangent', slot=4,
            kind='scalar', fmt='f', vector=False, boolean=False)]}}
        d = Decoder(fixture(0x7f800000), schema).table(12, 'KeyFrameData')
        self.assertEqual(d['InTangent']['rawLittleEndianHex'], '0000807f')
        with self.assertRaises(ValueError):
            Decoder(fixture(0x7fc00000), schema).table(12, 'KeyFrameData')

    def test_proven_default_is_marked(self):
        schema = self.schema(slot=6, provenDefault={'value':0})
        d = Decoder(fixture(), schema).table(12, 'Example')
        self.assertEqual(d['Value'], 0)
        self.assertEqual(d['_resolvedAbsentDefaults'], ['Value'])


if __name__ == '__main__':
    unittest.main()
