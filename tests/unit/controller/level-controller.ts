import LevelController from '../../../src/controller/level-controller';
import HlsMock from '../../mocks/hls.mock';
import { Events } from '../../../src/events';
import { ErrorDetails, ErrorTypes } from '../../../src/errors';
import { Level } from '../../../src/types/level';
import { AttrList } from '../../../src/utils/attr-list';
import { PlaylistLevelType } from '../../../src/types/loader';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import type { LevelDetails } from '../../../src/loader/level-details';
import type {
  ManifestLoadedData,
  ManifestParsedData,
} from '../../../src/types/events';
import type { LevelParsed } from '../../../src/types/level';
import type {
  MediaPlaylist,
  MediaPlaylistType,
} from '../../../src/types/media-playlist';

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;

type LevelControllerTestable = Omit<LevelController, 'onManifestLoaded'> & {
  onManifestLoaded: (event: string, data: Partial<ManifestLoadedData>) => void;
  switchParams: (
    playlistUri: string,
    previous: LevelDetails | undefined
  ) => void;
};

function parsedLevel(
  options: Partial<LevelParsed> & { bitrate: number }
): LevelParsed {
  const level: LevelParsed = {
    attrs: new AttrList(''),
    bitrate: options.bitrate,
    name: '',
    url: '',
  };
  return Object.assign(level, options);
}

function mediaPlaylist(options: Partial<MediaPlaylist>): MediaPlaylist {
  const level: LevelParsed = parsedLevel({ bitrate: 50000 });
  const track: MediaPlaylist = Object.assign(level, {
    autoselect: false,
    default: false,
    forced: false,
    id: 0,
    type: 'AUDIO' as MediaPlaylistType,
  });
  return Object.assign(track, options);
}

describe('LevelController', function () {
  const sandbox = sinon.createSandbox();
  let hls;
  let levelController: LevelControllerTestable;
  let triggerSpy;

  beforeEach(function () {
    hls = new HlsMock({}, sandbox);
    levelController = new LevelController(
      hls
    ) as unknown as LevelControllerTestable;
    levelController.onParsedComplete = () => {};
    triggerSpy = hls.trigger;
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('should trigger level switch when level is manually set', function () {
    const data: ManifestLoadedData = {
      audioTracks: [],
      levels: [
        parsedLevel({
          id: 1,
          bitrate: 105000,
          name: '144',
        }),
        parsedLevel({
          id: 2,
          bitrate: 246440,
          name: '240',
        }),
        parsedLevel({
          id: 3,
          bitrate: 460560,
          name: '380',
        }),
        parsedLevel({
          id: 4,
          bitrate: 836280,
          name: '480',
        }),
        parsedLevel({
          id: 5,
          bitrate: 2149280,
          name: '720',
        }),
        parsedLevel({
          id: 6,
          bitrate: 6221600,
          name: '1080',
        }),
      ],
      networkDetails: '',
      sessionData: null,
      sessionKeys: null,
      contentSteering: null,
      startTimeOffset: null,
      variableList: null,
      stats: {} as any,
      subtitles: [],
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    };

    const nextLevel = 1;

    levelController.onManifestLoaded(Events.MANIFEST_LOADED, data);
    // First triggers "hlsManifestParsed"
    levelController.level = nextLevel;
    // Then triggers "levelSwitching"
    expect(triggerSpy).to.have.been.calledWith(Events.LEVEL_SWITCHING, {
      attrs: data.levels[1].attrs,
      audioCodec: undefined,
      audioGroupIds: undefined,
      bitrate: 246440,
      codecSet: '',
      details: undefined,
      fragmentError: 0,
      height: 0,
      id: 2,
      level: 1,
      loadError: 0,
      loaded: undefined,
      maxBitrate: 246440,
      name: '240',
      realBitrate: 0,
      textGroupIds: undefined,
      unknownCodecs: undefined,
      uri: '',
      url: [''],
      urlId: 0,
      videoCodec: undefined,
      width: 0,
    });
  });

  describe('onManifestLoaded handler', function () {
    it('should trigger an error when no levels are found in the manifest', function () {
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, {
        audioTracks: [],
        levels: [],
        networkDetails: '',
        subtitles: [],
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      });

      expect(triggerSpy).to.have.been.calledWith(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
        fatal: true,
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        reason: 'no level with compatible codecs found in manifest',
      });
    });

    it('should trigger hlsManifestParsed when levels are found in the manifest', function () {
      const data: ManifestLoadedData = {
        audioTracks: [],
        levels: [
          parsedLevel({
            bitrate: 105000,
            name: '144',
          }),
          parsedLevel({
            bitrate: 246440,
            name: '240',
          }),
          parsedLevel({
            bitrate: 460560,
            name: '380',
          }),
          parsedLevel({
            bitrate: 836280,
            name: '480',
          }),
          parsedLevel({
            bitrate: 2149280,
            name: '720',
          }),
          parsedLevel({
            bitrate: 6221600,
            name: '1080',
          }),
        ],
        networkDetails: '',
        subtitles: [],
        sessionData: null,
        sessionKeys: null,
        contentSteering: null,
        startTimeOffset: null,
        variableList: null,
        stats: {} as any,
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      };

      levelController.onManifestLoaded(Events.MANIFEST_LOADED, data);

      expect(triggerSpy).to.have.been.calledWith(Events.MANIFEST_PARSED, {
        levels: data.levels.map((levelParsed) => new Level(levelParsed)),
        audioTracks: [],
        subtitleTracks: [],
        sessionData: null,
        sessionKeys: null,
        firstLevel: 0,
        stats: {},
        audio: false,
        video: false,
        altAudio: false,
      });
    });

    it('should signal altAudio if present in the manifest without codec attributes', function () {
      const data: ManifestLoadedData = {
        audioTracks: [
          mediaPlaylist({
            audioCodec: 'mp4a.40.5',
            url: 'audio-track.m3u8',
          }),
        ],
        levels: [
          parsedLevel({
            bitrate: 105000,
            name: '144',
          }),
        ],
        networkDetails: '',
        subtitles: [],
        sessionData: null,
        sessionKeys: null,
        contentSteering: null,
        startTimeOffset: null,
        variableList: null,
        stats: {} as any,
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      };

      const parsedData: ManifestParsedData = {
        levels: data.levels.map((levelParsed) => new Level(levelParsed)),
        audioTracks: data.audioTracks,
        subtitleTracks: [],
        sessionData: null,
        sessionKeys: null,
        firstLevel: 0,
        stats: {} as any,
        audio: false,
        video: false,
        altAudio: true,
      };

      levelController.onManifestLoaded(Events.MANIFEST_LOADED, data);
      expect(triggerSpy).to.have.been.calledWith(
        Events.MANIFEST_PARSED,
        parsedData
      );
    });

    it('should signal altAudio if present in the manifest with codec attributes', function () {
      const data: ManifestLoadedData = {
        audioTracks: [
          mediaPlaylist({ audioCodec: 'mp4a.40.5', url: 'audio-track.m3u8' }),
        ],
        levels: [
          parsedLevel({
            bitrate: 105000,
            name: '144',
            videoCodec: 'avc1.42001e',
            audioCodec: 'mp4a.40.2',
          }),
        ],
        networkDetails: '',
        subtitles: [],
        sessionData: null,
        sessionKeys: null,
        contentSteering: null,
        startTimeOffset: null,
        variableList: null,
        stats: {} as any,
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      };

      levelController.onManifestLoaded(Events.MANIFEST_LOADED, data);
      expect(triggerSpy).to.have.been.calledWith(Events.MANIFEST_PARSED, {
        levels: data.levels.map((levelParsed) => new Level(levelParsed)),
        audioTracks: data.audioTracks,
        subtitleTracks: [],
        sessionData: null,
        sessionKeys: null,
        firstLevel: 0,
        stats: {},
        audio: true,
        video: true,
        altAudio: true,
      });
    });

    it('should not signal altAudio in audio-only streams', function () {
      const data: ManifestLoadedData = {
        audioTracks: [
          mediaPlaylist({ audioCodec: 'mp4a.40.5', name: 'main' }),
          mediaPlaylist({ audioCodec: 'mp4a.40.5', url: 'audio-track.m3u8' }),
        ],
        levels: [
          parsedLevel({
            bitrate: 105000,
            name: 'audio-only',
            audioCodec: 'mp4a.40.2',
          }),
        ],
        networkDetails: '',
        subtitles: [],
        sessionData: null,
        sessionKeys: null,
        contentSteering: null,
        startTimeOffset: null,
        variableList: null,
        stats: {} as any,
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      };

      levelController.onManifestLoaded(Events.MANIFEST_LOADED, data);
      expect(triggerSpy).to.have.been.calledWith(Events.MANIFEST_PARSED, {
        levels: data.levels.map((levelParsed) => new Level(levelParsed)),
        audioTracks: data.audioTracks,
        subtitleTracks: [],
        sessionData: null,
        sessionKeys: null,
        firstLevel: 0,
        stats: {},
        audio: true,
        video: false,
        altAudio: false,
      });
    });
  });

  describe('manifest parsing', function () {
    let data: ManifestLoadedData;
    beforeEach(function () {
      data = {
        audioTracks: [],
        levels: [
          parsedLevel({
            bitrate: 105000,
            name: '144',
          }),
        ],
        networkDetails: '',
        subtitles: [],
        sessionData: null,
        sessionKeys: null,
        contentSteering: null,
        startTimeOffset: null,
        variableList: null,
        stats: {} as any,
        url: 'foo',
      };
    });

    it('signals video if there is a videoCodec signaled', function () {
      data.levels[0].videoCodec = 'avc1.42e01e';
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, data);

      const { name, payload } = hls.getEventData(0);
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(payload.video).to.equal(true);
      expect(payload.audio).to.equal(false);
      expect(payload.altAudio).to.equal(false);
    });

    it('signals audio if there is an audioCodec signaled', function () {
      data.levels[0].audioCodec = 'mp4a.40.5';
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, data);

      const { name, payload } = hls.getEventData(0);
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(payload.video).to.equal(false);
      expect(payload.audio).to.equal(true);
      expect(payload.altAudio).to.equal(false);
    });

    it('signals altAudio if there are audioTracks containing URIs', function () {
      data.levels[0].videoCodec = 'avc1.42e01e';
      data.audioTracks = [
        mediaPlaylist({
          groupId: 'audio',
          name: 'Audio',
          type: 'AUDIO',
          default: true,
          autoselect: true,
          forced: false,
          url: 'https://d35u71x3nb8v2y.cloudfront.net/4b711b97-513c-4d36-ad29-298ab23a2e5e/05845f51-c319-41ca-8e84-b84299925a0c/playlist.m3u8',
          id: 0,
        }),
        mediaPlaylist({
          groupId: 'audio',
          name: 'Audio',
          type: 'AUDIO',
          default: true,
          autoselect: true,
          forced: false,
          id: 0,
        }),
      ];

      levelController.onManifestLoaded(Events.MANIFEST_LOADED, data);

      const { name, payload } = hls.getEventData(0);
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(payload.video).to.equal(true);
      expect(payload.audio).to.equal(false);
      expect(payload.altAudio).to.equal(true);
    });

    it('does not signal altAudio if the audioTracks do no not contain any URIs', function () {
      data.levels[0].videoCodec = 'avc1.42e01e';
      data.audioTracks = [
        mediaPlaylist({
          groupId: 'audio',
          name: 'Audio',
          type: 'AUDIO',
          default: true,
          autoselect: true,
          forced: false,
          id: 0,
        }),
        mediaPlaylist({
          groupId: 'audio',
          name: 'Audio',
          type: 'AUDIO',
          default: true,
          autoselect: true,
          forced: false,
          id: 0,
        }),
      ];

      levelController.onManifestLoaded(Events.MANIFEST_LOADED, data);

      const { name, payload } = hls.getEventData(0);
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(payload.video).to.equal(true);
      expect(payload.audio).to.equal(false);
      expect(payload.altAudio).to.equal(false);
    });
  });

  describe('switchParams', function () {
    const mediaPlaylist = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=3.000000
#EXT-X-PART-INF:PART-TARGET=1.000000
#EXT-X-TARGETDURATION:3
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PROGRAM-DATE-TIME:2023-01-20T08:21:50.887Z
#EXTINF:3.000000,
vfrag2500.stream_3153718435_1674202910887_4_0_1.m4v?type=hls&bitrate=193521&filetype=.m4v
#EXT-X-PART:DURATION=1.000000,URI="vfrag2500.stream_1351418703_1674202913887_7_0_2_0.m4v?type=hls&mode=cmaf&filetype=.m4v",INDEPENDENT=YES
#EXT-X-PART:DURATION=1.000000,URI="vfrag2500.stream_1351418703_1674202913887_7_0_2_1.m4v?type=hls&mode=cmaf&filetype=.m4v",INDEPENDENT=YES
#EXT-X-PART:DURATION=1.000000,URI="vfrag2500.stream_1351418703_1674202913887_7_0_2_2.m4v?type=hls&mode=cmaf&filetype=.m4v",INDEPENDENT=YES
#EXTINF:3.000000,
vfrag2500.stream_1351418703_1674202913887_7_0_2.m4v?type=hls&bitrate=209021&filetype=.m4v
#EXT-X-PART:DURATION=1.000000,URI="vfrag2500.stream_1875648429_1674202916887_10_0_3_0.m4v?type=hls&mode=cmaf&filetype=.m4v",INDEPENDENT=YES
#EXT-X-PART:DURATION=1.000000,URI="vfrag2500.stream_1875648429_1674202916887_10_0_3_1.m4v?type=hls&mode=cmaf&filetype=.m4v",INDEPENDENT=YES
#EXT-X-PART:DURATION=1.000000,URI="vfrag2500.stream_1875648429_1674202916887_10_0_3_2.m4v?type=hls&mode=cmaf&filetype=.m4v",INDEPENDENT=YES
#EXTINF:3.000000,
vfrag2500.stream_1875648429_1674202916887_10_0_3.m4v?type=hls&bitrate=200661&filetype=.m4v
#EXT-X-PART:DURATION=1.000000,URI="vfrag2500.stream_3900694400_1674202919887_13_0_4_0.m4v?type=hls&mode=cmaf&filetype=.m4v",INDEPENDENT=YES
#EXT-X-PART:DURATION=1.000000,URI="vfrag2500.stream_3900694400_1674202919887_13_0_4_1.m4v?type=hls&mode=cmaf&filetype=.m4v",INDEPENDENT=YES
#EXT-X-PRELOAD-HINT:TYPE=PART,URI="vfrag2500.stream_3900694400_1674202919887_13_0_4_2.m4v?type=hls&mode=cmaf&filetype=.m4v"
#EXT-X-RENDITION-REPORT:URI="chunklist_vfrag1500.m3u8",LAST-MSN=4,LAST-PART=1
#EXT-X-RENDITION-REPORT:URI="chunklist_vfrag400.m3u8",LAST-MSN=4,LAST-PART=1
#EXT-X-RENDITION-REPORT:URI="chunklist_vfrag100.m3u8",LAST-MSN=4,LAST-PART=1`;

    it('returns RENDITION-REPORT query values for the selected playlist URI', function () {
      const levelDetails = M3U8Parser.parseLevelPlaylist(
        mediaPlaylist,
        'http://example.com/playlist.m3u8?abc=deg',
        0,
        PlaylistLevelType.MAIN,
        0,
        {}
      );
      const selectedUri = 'http://example.com/chunklist_vfrag1500.m3u8';
      const hlsUrlParameters = levelController.switchParams(
        selectedUri,
        levelDetails
      );
      expect(hlsUrlParameters).to.have.property('msn').which.equals(4);
      expect(hlsUrlParameters).to.have.property('part').which.equals(1);
      expect(hlsUrlParameters).to.have.property('skip').which.equals('');
    });

    it('returns RENDITION-REPORT query values for the selected playlist URI with additional query params', function () {
      const levelDetails = M3U8Parser.parseLevelPlaylist(
        mediaPlaylist,
        'http://example.com/playlist.m3u8?abc=deg',
        0,
        PlaylistLevelType.MAIN,
        0,
        {}
      );
      const selectedUriWithQuery =
        'http://example.com/chunklist_vfrag1500.m3u8?abc=123';
      const hlsUrlParameters = levelController.switchParams(
        selectedUriWithQuery,
        levelDetails
      );
      expect(hlsUrlParameters).to.not.be.undefined;
      expect(hlsUrlParameters).to.have.property('msn').which.equals(4);
      expect(hlsUrlParameters).to.have.property('part').which.equals(1);
      expect(hlsUrlParameters).to.have.property('skip').which.equals('');
    });

    it('returns RENDITION-REPORT exact URI match over partial match for playlist URIs with additional query params', function () {
      const levelDetails = M3U8Parser.parseLevelPlaylist(
        `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES
#EXT-X-TARGETDURATION:3
#EXTINF:3.0,
#EXTINF:3.0,
#EXTINF:3.0,
#EXT-X-RENDITION-REPORT:URI="chunklist.m3u8?token=1234",LAST-MSN=4
#EXT-X-RENDITION-REPORT:URI="chunklist.m3u8?token=1",LAST-MSN=5
#EXT-X-RENDITION-REPORT:URI="chunklist.m3u8?token=123",LAST-MSN=6
#EXT-X-RENDITION-REPORT:URI="chunklist.m3u8?token=foo",LAST-MSN=7
#EXT-X-RENDITION-REPORT:URI="chunklist.m3u8",LAST-MSN=8`,
        'http://example.com/playlist.m3u8?abc=deg',
        0,
        PlaylistLevelType.MAIN,
        0,
        {}
      );
      const selectedUriWithQuery =
        'http://example.com/chunklist.m3u8?token=123';
      const hlsUrlParameters = levelController.switchParams(
        selectedUriWithQuery,
        levelDetails
      );
      expect(hlsUrlParameters).to.not.be.undefined;
      expect(hlsUrlParameters).to.have.property('msn').which.equals(6);
    });
  });
});
