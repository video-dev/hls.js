import { utf8ArrayToStr } from '@svta/common-media-library/utils/utf8ArrayToStr';
import { expect } from 'chai';

describe('UTF8 tests', function () {
  it('utf8ArrayToStr', function (done) {
    const aB = new Uint8Array([97, 98]);
    const aNullBNullC = new Uint8Array([97, 0, 98, 0, 99]);

    expect(utf8ArrayToStr(aB)).to.equal('ab');
    expect(utf8ArrayToStr(aNullBNullC)).to.equal('abc');
    expect(utf8ArrayToStr(aNullBNullC, true)).to.equal('a');

    done();
  });
});
