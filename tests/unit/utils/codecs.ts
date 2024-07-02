import { expect } from 'chai';
import { convertAVC1ToAVCOTI } from '../../../src/utils/codecs';

describe('codecs', function () {
  it('convert codec string from AVC1 to AVCOTI', function () {
    expect(convertAVC1ToAVCOTI('avc1.66.30')).to.equal('avc1.42001e');
  });

  it('convert list of codecs string from AVC1 to AVCOTI', function () {
    expect(convertAVC1ToAVCOTI('avc1.77.30,avc1.66.30')).to.equal(
      'avc1.4d001e,avc1.42001e',
    );
  });

  it('does not convert string if it is already converted', function () {
    expect(convertAVC1ToAVCOTI('avc1.64001E')).to.equal('avc1.64001E');
  });

  it('does not convert list of codecs string if it is already converted', function () {
    expect(convertAVC1ToAVCOTI('avc1.64001E,avc1.64001f')).to.equal(
      'avc1.64001E,avc1.64001f',
    );
  });
});
