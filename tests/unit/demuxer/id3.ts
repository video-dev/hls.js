import * as ID3 from '../../../src/demux/id3';
import { expect } from 'chai';
import { utf8ArrayToStr } from '../../../src/demux/id3';

describe('ID3 tests', function () {
  const mockID3Header = Uint8Array.from([
    73, 68, 51, 4, 0, 0, 0, 0, 0, 63, 80, 82, 73, 86, 0, 0, 0, 53, 0, 0, 99,
    111, 109, 46, 97, 112, 112, 108, 101, 46, 115, 116, 114, 101, 97, 109, 105,
    110, 103, 46, 116, 114, 97, 110, 115, 112, 111, 114, 116, 83, 116, 114, 101,
    97, 109, 84, 105, 109, 101, 115, 116, 97, 109, 112, 0, 0, 0, 0, 0, 0, 13,
    198, 135,
  ]);
  const mockID3HeaderMissingLeadingByte = mockID3Header.slice(
    8,
    mockID3Header.length
  );
  const mockID3HeaderMissingTrailingByte = mockID3Header.slice(
    0,
    mockID3Header.length - 8
  );

  it('utf8ArrayToStr', function (done) {
    const aB = new Uint8Array([97, 98]);
    const aNullBNullC = new Uint8Array([97, 0, 98, 0, 99]);

    expect(utf8ArrayToStr(aB)).to.equal('ab');
    expect(utf8ArrayToStr(aNullBNullC)).to.equal('abc');
    expect(utf8ArrayToStr(aNullBNullC, true)).to.equal('a');

    done();
  });
  it('Properly parses ID3 Headers', function () {
    expect(ID3.isHeader(mockID3Header, 0)).to.equal(true);
    expect(ID3.isHeader(mockID3HeaderMissingLeadingByte, 0)).to.equal(false);
    expect(ID3.isHeader(mockID3HeaderMissingTrailingByte, 0)).to.equal(true);
  });
  it('Properly parses ID3 Info', function () {
    expect(ID3.canParse(mockID3Header, 0)).to.equal(true);
    expect(ID3.canParse(mockID3HeaderMissingLeadingByte, 0)).to.equal(false);
    expect(ID3.canParse(mockID3HeaderMissingTrailingByte, 0)).to.equal(false);
  });

  it('should decode a TXXX frame', function () {
    const frame = {
      type: 'TXXX',
      data: new Uint8Array([0, 102, 111, 111, 0, 97, 98, 99]),
      size: 2, // required by the _decodeTextFrame function
    };

    const result: ID3.Frame | undefined = ID3.testables.decodeTextFrame(frame);
    expect(result).to.exist;
    expect(result!.key).to.equal('TXXX');
    expect(result!.info).to.equal('foo');
    expect(result!.data).to.equal('abc');
  });
});
