import { expect } from 'chai';
import { Level } from '../../../src/types/level';
import { AttrList } from '../../../src/utils/attr-list';
import {
  getMediaDecodingInfoPromise,
  SUPPORTED_INFO_CACHE,
} from '../../../src/utils/mediacapabilities-helper';

describe('getMediaDecodingInfoPromise', function () {
  it('adds queries to cache', function () {
    if (!navigator.mediaCapabilities) {
      return;
    }
    const attrs = new AttrList(
      'BANDWIDTH=5000000,CODECS="hvc1.2.20000000.L93.B0",FRAME-RATE=30,RESOLUTION=1920x1080',
    );
    const level = new Level({
      attrs,
      bitrate: attrs.decimalInteger('BANDWIDTH'),
      videoCodec: 'hvc1.2.20000000.L93.B0',
      ...attrs.decimalResolution('RESOLUTION'),
      name: '',
      url: '',
    });
    expect(level.codecSet).equals('hvc1');

    const emptyAudioTracksByGroup = {
      hasDefaultAudio: false,
      hasAutoSelectAudio: false,
      groups: {},
    };
    return getMediaDecodingInfoPromise(
      level,
      emptyAudioTracksByGroup,
      navigator.mediaCapabilities,
    ).then((mediaDecodingInfo) => {
      const cachedKeys = Object.keys(SUPPORTED_INFO_CACHE);
      expect(cachedKeys.length).to.be.gt(0);
      expect(cachedKeys, JSON.stringify(SUPPORTED_INFO_CACHE)).to.include(
        'r1080x1920f30sd_hvc1.2.20000000.L93.B0_50',
      );
      expect(mediaDecodingInfo).to.have.property('supported');
      expect(mediaDecodingInfo).to.have.property('decodingInfoResults');
    });
  });
});
