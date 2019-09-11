import ID3, { utf8ArrayToStr } from '../../../src/demux/id3.js';

describe('ID3 tests', function () {
  it('utf8ArrayToStr', function () {
    const aB = new Uint8Array([97, 98]);
    const aNullBNullC = new Uint8Array([97, 0, 98, 0, 99]);

    expect(utf8ArrayToStr(aB)).to.equal('ab');
    expect(utf8ArrayToStr(aNullBNullC)).to.equal('abc');
    expect(utf8ArrayToStr(aNullBNullC, true)).to.equal('a');
  });

  it('should decode a TXXX frame', function () {
    const frame = {
      type: 'TXXX',
      data: new Uint8Array([0, 102, 111, 111, 0, 97, 98, 99])
    };
    const result = ID3._decodeTextFrame(frame);
    expect(result.key).to.equal('TXXX');
    expect(result.info).to.equal('foo');
    expect(result.data).to.equal('abc');
  });
});
