import { expect } from 'chai';
import ExpGolomb from '../../../src/demux/video/exp-golomb';

describe('Exp-Golomb reader', function () {
  const testBuffer = new Uint8Array([
    0b00000111, 0b01000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000,
    0b00000000, 0b00000000, 0b00000000, 0b00001101, 0b11011101, 0b10000000,
    0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b11111111, 0b11111111,
    0b11111111, 0b11111111, 0b11111111, 0b11111111, 0b11111111, 0b11111111,
    0b10101010,
  ]);
  const reader = new ExpGolomb(testBuffer);

  it('should return 29 (0b 1110 1)', function () {
    reader.skipBits(5);
    expect(reader.readBits(5)).to.equal(0b11101);
  });

  it('should return 7099 (0b 1101 1101 1101 1)', function () {
    reader.skipBits(6 + 56 + 4);
    expect(reader.readBits(13)).to.equal(0b1101110111011);
  });

  it('should return UINT_MAX(4294967295) twice', function () {
    reader.skipBits(39);
    expect(reader.readBits(32)).to.equal(4294967295); //0b 11111111 11111111 11111111 11111111
    expect(reader.readBits(32)).to.equal(4294967295); //0b 11111111 11111111 11111111 11111111
  });

  it('should throw error if can no longer buffer be skip', function () {
    expect(reader.readBits(4)).to.equal(0b1010);
    expect(function () {
      reader.skipBits(16);
    }).to.throw('no bytes available');
  });

  it('should throw error if can no longer buffer be read', function () {
    expect(function () {
      reader.readBits(16);
    }).to.throw('no bits available');
  });
});
