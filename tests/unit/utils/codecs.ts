import { expect } from 'chai';
import {
  convertAVC1ToAVCOTI,
  fillInMissingAV01Params,
} from '../../../src/utils/codecs';

describe('codecs', function () {
  describe('convertAVC1ToAVCOTI', function () {
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

  describe('fillInMissingAV01Params', function () {
    it('fills in incomplete AV1 CODECS strings 6-10', function () {
      expect(fillInMissingAV01Params('av01.0.08M.10.0')).to.equal(
        'av01.0.08M.10.0.111.01.01.01.0',
      );
    });

    it('fills in incomplete AV1 CODECS strings 7-10', function () {
      expect(fillInMissingAV01Params('av01.0.08M.10.0.111')).to.equal(
        'av01.0.08M.10.0.111.01.01.01.0',
      );
    });

    it('fills in incomplete AV1 CODECS strings 8-10', function () {
      expect(fillInMissingAV01Params('av01.0.08M.10.0.111.01')).to.equal(
        'av01.0.08M.10.0.111.01.01.01.0',
      );
    });

    it('fills in incomplete AV1 CODECS strings 9-10', function () {
      expect(fillInMissingAV01Params('av01.0.08M.10.0.111.01.01')).to.equal(
        'av01.0.08M.10.0.111.01.01.01.0',
      );
    });

    it('fills in incomplete AV1 CODECS strings 10', function () {
      expect(fillInMissingAV01Params('av01.0.08M.10.0.111.01.01.01')).to.equal(
        'av01.0.08M.10.0.111.01.01.01.0',
      );
    });

    it('does not modify four part AV1 CODECS', function () {
      expect(fillInMissingAV01Params('av01.0.08M.10')).to.equal(
        'av01.0.08M.10',
      );
    });

    it('does not modify invalid AV1 CODECS with less than four parts', function () {
      expect(fillInMissingAV01Params('av01.0.08M')).to.equal('av01.0.08M');
    });

    it('does not modify complete AV1 CODECS', function () {
      expect(
        fillInMissingAV01Params('av01.0.08M.10.0.112.09.09.09.0'),
      ).to.equal('av01.0.08M.10.0.112.09.09.09.0');
    });

    it('does not modify other CODECS', function () {
      expect(fillInMissingAV01Params('hvc1.2.20000000.L93.B0')).to.equal(
        'hvc1.2.20000000.L93.B0',
      );
      expect(fillInMissingAV01Params('avc1.4d001e')).to.equal('avc1.4d001e');
      expect(fillInMissingAV01Params('mp4a.40.2')).to.equal('mp4a.40.2');
    });
  });
});
