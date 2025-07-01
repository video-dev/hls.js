import { expect } from 'chai';
import { Level } from '../../../src/types/level';
import { AttrList } from '../../../src/utils/attr-list';
import { getMediaDecodingInfoPromise } from '../../../src/utils/mediacapabilities-helper';
import type {
  MediaAttributes,
  MediaPlaylist,
} from '../../../src/types/media-playlist';

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
    const SUPPORTED_INFO_CACHE = {};
    return getMediaDecodingInfoPromise(
      level,
      emptyAudioTracksByGroup,
      navigator.mediaCapabilities,
      SUPPORTED_INFO_CACHE,
    ).then((mediaDecodingInfo) => {
      const cachedKeys = Object.keys(SUPPORTED_INFO_CACHE);
      expect(cachedKeys.length).to.be.gt(0);
      expect(cachedKeys, JSON.stringify(SUPPORTED_INFO_CACHE)).to.include(
        'hvc1.2.20000000.L93.B0_r1080x1920f30sd_50',
      );
      expect(mediaDecodingInfo).to.have.property('supported');
      expect(mediaDecodingInfo).to.have.property('decodingInfoResults');
      expect(mediaDecodingInfo)
        .to.have.property('configurations')
        .which.has.a.lengthOf(1);
      expect(mediaDecodingInfo.configurations[0]).deep.equals({
        type: 'media-source',
        video: {
          contentType: 'video/mp4;codecs=hvc1.2.20000000.L93.B0',
          width: 1920,
          height: 1080,
          bitrate: 5000000,
          framerate: 30,
        },
      });
    });
  });

  it('combines audio and video into a single query', function () {
    if (!navigator.mediaCapabilities) {
      return;
    }
    const videoCodecs = ['hvc1.2.6.L93.B0'];
    const audioCodecs = ['ec-3'];
    const levelAttr = new AttrList(
      `BANDWIDTH=5000000,CODECS="${videoCodecs.join(',')},${audioCodecs.join(',')}",FRAME-RATE=30,RESOLUTION=1920x1080,VIDEO-RANGE=PQ,AUDIO="ec3"`,
    );
    const level = new Level({
      attrs: levelAttr,
      bitrate: levelAttr.decimalInteger('BANDWIDTH'),
      videoCodec: videoCodecs.join(','),
      audioCodec: audioCodecs.join(','),
      ...levelAttr.decimalResolution('RESOLUTION'),
      name: '',
      url: '',
    });
    const audioAttr = new AttrList(
      `TYPE=AUDIO,LANGUAGE="en",NAME="English",AUTOSELECT=YES,DEFAULT=YES,CHANNELS="16/JOC",GROUP-ID="ec3",URI="a.m3u8"`,
    ) as MediaAttributes;
    const audioOption: MediaPlaylist = {
      attrs: audioAttr,
      groupId: audioAttr['GROUP-ID'] || '',
      name: audioAttr.NAME || audioAttr.LANGUAGE || '',
      default: audioAttr.bool('DEFAULT'),
      autoselect: audioAttr.bool('AUTOSELECT'),
      forced: audioAttr.bool('FORCED'),
      channels: audioAttr.CHANNELS,
      url: audioAttr.URI || '',
      type: 'AUDIO',
      id: 0,
      bitrate: 0,
      audioCodec: 'ec-3',
    };

    expect(level.codecSet).equals('hvc1,ec-3');

    const audioTracksByGroup = {
      hasDefaultAudio: true,
      hasAutoSelectAudio: true,
      groups: {
        ec3: {
          channels: { 16: 1 },
          hasAutoSelect: true,
          hasDefault: true,
          tracks: [audioOption],
        },
      },
    };
    return getMediaDecodingInfoPromise(
      level,
      audioTracksByGroup,
      navigator.mediaCapabilities,
    ).then((mediaDecodingInfo) => {
      expect(mediaDecodingInfo).to.have.property('supported');
      expect(mediaDecodingInfo).to.have.property('decodingInfoResults');
      expect(mediaDecodingInfo)
        .to.have.property('configurations')
        .which.has.a.lengthOf(1);
      expect(mediaDecodingInfo.configurations[0]).deep.equals({
        type: 'media-source',
        video: {
          contentType: 'video/mp4;codecs=hvc1.2.6.L93.B0',
          width: 1920,
          height: 1080,
          bitrate: 4232000,
          framerate: 30,
          transferFunction: 'pq',
        },
        audio: {
          contentType: 'audio/mp4;codecs=ec-3',
          channels: '16',
          bitrate: 768000,
        },
      });
    });
  });
});
