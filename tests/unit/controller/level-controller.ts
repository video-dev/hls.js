import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import LevelController from '../../../src/controller/level-controller';
import { ErrorDetails, ErrorTypes } from '../../../src/errors';
import { Events } from '../../../src/events';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { Level } from '../../../src/types/level';
import { PlaylistLevelType } from '../../../src/types/loader';
import { AttrList } from '../../../src/utils/attr-list';
import { getMediaSource } from '../../../src/utils/mediasource-helper';
import HlsMock from '../../mocks/hls.mock';
import type { Fragment } from '../../../src/loader/fragment';
import type { LevelDetails } from '../../../src/loader/level-details';
import type { ParsedMultivariantPlaylist } from '../../../src/loader/m3u8-parser';
import type {
  ManifestLoadedData,
  ManifestParsedData,
} from '../../../src/types/events';
import type { LevelParsed } from '../../../src/types/level';
import type { PlaylistLoaderContext } from '../../../src/types/loader';
import type {
  MediaAttributes,
  MediaPlaylist,
  MediaPlaylistType,
} from '../../../src/types/media-playlist';

chai.use(sinonChai);
const expect = chai.expect;

type LevelControllerTestable = Omit<LevelController, 'onManifestLoaded'> & {
  onManifestLoaded: (event: string, data: Partial<ManifestLoadedData>) => void;
  onAudioTrackSwitched: (event: string, data: { id: number }) => void;
  onError: (
    event: string,
    data: {
      type: ErrorTypes;
      details: ErrorDetails;
      context?: PlaylistLoaderContext;
      frag?: Fragment;
      level?: number;
    },
  ) => void;
  switchParams: (
    playlistUri: string,
    previous: LevelDetails | undefined,
    current: LevelDetails | undefined,
  ) => void;
  redundantFailover: (levelIndex: number) => void;
};

function parsedLevel(
  options: Partial<LevelParsed> & { bitrate: number },
): LevelParsed {
  const level: LevelParsed = {
    attrs: new AttrList({ BANDWIDTH: options.bitrate }),
    bitrate: options.bitrate,
    name: '',
    url: `${options.bitrate}.m3u8`,
  };
  return Object.assign(level, options);
}

function mediaPlaylist(options: Partial<MediaPlaylist>): MediaPlaylist {
  const track: MediaPlaylist = {
    attrs: new AttrList({}) as MediaAttributes,
    autoselect: false,
    bitrate: 50000,
    default: false,
    forced: false,
    groupId: 'audio',
    id: 0,
    name: '',
    type: 'AUDIO' as MediaPlaylistType,
    url: '',
  };
  return Object.assign(track, options);
}

describe('LevelController', function () {
  const sandbox = sinon.createSandbox();
  let hls: HlsMock;
  let levelController: LevelControllerTestable;

  beforeEach(function () {
    const MediaSource = getMediaSource();
    hls = new HlsMock({});
    levelController = new LevelController(
      hls as any,
      null,
    ) as unknown as LevelControllerTestable;
    levelController.onParsedComplete = () => {};
    hls.levelController = levelController;
    // @ts-ignore
    sandbox.stub(MediaSource, 'isTypeSupported').returns(true);
  });

  afterEach(function () {
    sandbox.restore();
    levelController.destroy();
  });

  it('emits LEVEL_SWITCHING when level is manually set', function () {
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
    expect(hls.trigger).to.have.been.calledTwice;
    const actual = hls.trigger.secondCall.args;
    const expected = {
      attrs: data.levels[1].attrs,
      audioGroups: undefined,
      subtitleGroups: undefined,
      audioCodec: undefined,
      bitrate: 246440,
      codecSet: '',
      details: undefined,
      fragmentError: 0,
      height: 0,
      id: 0,
      level: 1,
      loadError: 0,
      loaded: undefined,
      averageBitrate: 246440,
      maxBitrate: 246440,
      name: '240',
      realBitrate: 0,
      uri: '246440.m3u8',
      url: ['246440.m3u8'],
      urlId: 0,
      videoCodec: undefined,
      width: 0,
      audioGroupIds: undefined,
      textGroupIds: undefined,
    };
    expect(actual[0]).to.equal(Events.LEVEL_SWITCHING);
    const actualProperties = Object.keys(actual[1]);
    const expectedProperties = Object.keys(expected);
    const has = actualProperties.filter((p) => !expectedProperties.includes(p));
    const missing = expectedProperties.filter(
      (p) => !actualProperties.includes(p),
    );
    expect(actualProperties).to.have.members(
      expectedProperties,
      `Actual result${has.length ? ' has ' + has.join(', ') : ''}${
        missing.length ? ' missing ' + missing.join(', ') : ''
      }`,
    );
    expect(hls.trigger.secondCall).to.have.been.calledWith(
      Events.LEVEL_SWITCHING,
      expected,
    );
  });

  describe('Manifest Parsed Levels', function () {
    it('emits MEDIA_ERROR > MANIFEST_INCOMPATIBLE_CODECS_ERROR when no levels are found in the manifest', function () {
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, {
        audioTracks: [],
        levels: [],
        networkDetails: '',
        subtitles: [],
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      });

      return Promise.resolve().then(() => {
        expect(hls.trigger).to.have.been.calledWith(Events.ERROR, {
          type: ErrorTypes.MEDIA_ERROR,
          details: ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
          fatal: true,
          url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          error: hls.trigger.getCall(0).lastArg.error,
          reason: 'no level with compatible codecs found in manifest',
        });
      });
    });

    it('emits MANIFEST_PARSED when levels are found in the manifest', function () {
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

      expect(hls.trigger).to.have.been.calledWith(Events.MANIFEST_PARSED, {
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

    it('filters out audio-only and invalid video-range levels if we also have levels with video codecs or RESOLUTION signalled', function () {
      const { levels: parsedLevels } = M3U8Parser.parseMasterPlaylist(
        `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=200000,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=720x480,VIDEO-RANGE=SDR
http://foo.example.com/sdr/prog_index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=200000,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=360x240
http://foo.example.com/sdr-default/prog_index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=300000,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1920x1080,VIDEO-RANGE=PQ
http://foo.example.com/pq/prog_index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=350000,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1920x1080,VIDEO-RANGE=HLG
http://foo.example.com/hlg/prog_index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=400000,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1920x1080,VIDEO-RANGE=NA
http://bar.example.com/foo/prog_index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=80000,CODECS="mp4a.40.2",RESOLUTION=0x0
http://bar.example.com/audio-only/prog_index.m3u8`,
        'http://example.com/main.m3u8',
      );
      expect(parsedLevels).to.have.lengthOf(6, 'MANIFEST_LOADED levels');
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, {
        levels: parsedLevels,
        audioTracks: [],
      });
      const {
        name,
        payload: { levels },
      } = hls.getEventData(0) as { name: string; payload: ManifestParsedData };
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(levels).to.have.lengthOf(4, 'MANIFEST_PARSED levels');
      expect(levels[0].uri).to.equal(
        'http://foo.example.com/sdr-default/prog_index.m3u8',
      );
      expect(levels[1].uri).to.equal(
        'http://foo.example.com/sdr/prog_index.m3u8',
      );
      expect(levels[2].uri).to.equal(
        'http://foo.example.com/pq/prog_index.m3u8',
      );
      expect(levels[3].uri).to.equal(
        'http://foo.example.com/hlg/prog_index.m3u8',
      );
    });
  });

  describe('Manifest Parsed Alt-Audio', function () {
    it('emits MANIFEST_PARSED with `altAudio = true` when there are no codec attributes in MANIFEST_LOADED', function () {
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
      expect(hls.trigger).to.have.been.calledWith(
        Events.MANIFEST_PARSED,
        parsedData,
      );
    });

    it('emits MANIFEST_PARSED with `altAudio = true` when there are codec attributes in MANIFEST_LOADED', function () {
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
      expect(hls.trigger).to.have.been.calledWith(Events.MANIFEST_PARSED, {
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

    it('emits MANIFEST_PARSED with `altAudio = false` when Variant(s) are audio-only with audio Media Playlists in MANIFEST_LOADED', function () {
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
      expect(hls.trigger).to.have.been.calledWith(Events.MANIFEST_PARSED, {
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

  describe('Manifest Parsed Audio and Video', function () {
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

    it('emits MANIFEST_PARSED with `video = true` when there is a videoCodec in MANIFEST_LOADED', function () {
      data.levels[0].videoCodec = 'avc1.42e01e';
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, data);

      const { name, payload } = hls.getEventData(0) as {
        name: string;
        payload: ManifestParsedData;
      };
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(payload.video).to.equal(true);
      expect(payload.audio).to.equal(false);
      expect(payload.altAudio).to.equal(false);
    });

    it('emits MANIFEST_PARSED with `audio = true` when there is an audioCodec in MANIFEST_LOADED', function () {
      data.levels[0].audioCodec = 'mp4a.40.5';
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, data);

      const { name, payload } = hls.getEventData(0) as {
        name: string;
        payload: ManifestParsedData;
      };
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(payload.video).to.equal(false);
      expect(payload.audio).to.equal(true);
      expect(payload.altAudio).to.equal(false);
    });

    it('emits MANIFEST_PARSED with `altAudio = true` when there are audioTracks containing URIs', function () {
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

      const { name, payload } = hls.getEventData(0) as {
        name: string;
        payload: ManifestParsedData;
      };
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(payload.video).to.equal(true);
      expect(payload.audio).to.equal(false);
      expect(payload.altAudio).to.equal(true);
    });

    it('emits MANIFEST_PARSED with `altAudio = false` when audioTracks in MANIFEST_LOADED do no not contain any URIs (Media Playlists are descriptive)', function () {
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

      const { name, payload } = hls.getEventData(0) as {
        name: string;
        payload: ManifestParsedData;
      };
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(payload.video).to.equal(true);
      expect(payload.audio).to.equal(false);
      expect(payload.altAudio).to.equal(false);
    });
  });

  describe('Rendition Report Delivery Directives', function () {
    const mediaPlaylist = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES
#EXT-X-PART-INF:PART-TARGET=1.000000
#EXT-X-TARGETDURATION:3
#EXTINF:3.000000,
vfrag1.m4v
#EXTINF:3.000000,
vfrag2.m4v
#EXTINF:3.000000,
vfrag3.m4v
#EXT-X-RENDITION-REPORT:URI="chunklist_vfrag1500.m3u8",LAST-MSN=4,LAST-PART=1
#EXT-X-RENDITION-REPORT:URI="chunklist_vfrag400.m3u8",LAST-MSN=4,LAST-PART=1
#EXT-X-RENDITION-REPORT:URI="chunklist_vfrag100.m3u8",LAST-MSN=4,LAST-PART=1`;

    it('returns RENDITION-REPORT query values for the selected playlist URI', function () {
      const previousLevelDetails = M3U8Parser.parseLevelPlaylist(
        mediaPlaylist,
        'http://example.com/playlist.m3u8?abc=deg',
        0,
        PlaylistLevelType.MAIN,
        0,
        {},
      );
      const mockCurrentDetails = undefined;
      const selectedUri = 'http://example.com/chunklist_vfrag1500.m3u8';
      const hlsUrlParameters = levelController.switchParams(
        selectedUri,
        previousLevelDetails,
        mockCurrentDetails,
      );
      expect(hlsUrlParameters).to.have.property('msn').which.equals(4);
      expect(hlsUrlParameters).to.have.property('part').which.equals(1);
      expect(hlsUrlParameters).to.have.property('skip').to.be.undefined;
    });

    it('returns RENDITION-REPORT query values for the selected playlist URI with additional query params', function () {
      const previousDetails = M3U8Parser.parseLevelPlaylist(
        mediaPlaylist,
        'http://example.com/playlist.m3u8?abc=deg',
        0,
        PlaylistLevelType.MAIN,
        0,
        {},
      );
      const mockCurrentDetails = undefined;
      const selectedUriWithQuery =
        'http://example.com/chunklist_vfrag1500.m3u8?abc=123';
      const hlsUrlParameters = levelController.switchParams(
        selectedUriWithQuery,
        previousDetails,
        mockCurrentDetails,
      );
      expect(hlsUrlParameters).to.not.be.undefined;
      expect(hlsUrlParameters).to.have.property('msn').which.equals(4);
      expect(hlsUrlParameters).to.have.property('part').which.equals(1);
      expect(hlsUrlParameters).to.have.property('skip').to.be.undefined;
    });

    it('returns RENDITION-REPORT exact URI match over partial match for playlist URIs with additional query params', function () {
      const previousLevelDetails = M3U8Parser.parseLevelPlaylist(
        `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES
#EXT-X-TARGETDURATION:3
#EXTINF:3.000000,
vfrag1.m4v
#EXTINF:3.000000,
vfrag2.m4v
#EXTINF:3.000000,
vfrag3.m4v
#EXT-X-RENDITION-REPORT:URI="chunklist.m3u8?token=1234",LAST-MSN=4
#EXT-X-RENDITION-REPORT:URI="chunklist.m3u8?token=1",LAST-MSN=5
#EXT-X-RENDITION-REPORT:URI="chunklist.m3u8?token=123",LAST-MSN=6
#EXT-X-RENDITION-REPORT:URI="chunklist.m3u8?token=foo",LAST-MSN=7
#EXT-X-RENDITION-REPORT:URI="chunklist.m3u8",LAST-MSN=8`,
        'http://example.com/playlist.m3u8?abc=deg',
        0,
        PlaylistLevelType.MAIN,
        0,
        {},
      );
      const mockCurrentDetails = undefined;
      const selectedUriWithQuery =
        'http://example.com/chunklist.m3u8?token=123';
      const hlsUrlParameters = levelController.switchParams(
        selectedUriWithQuery,
        previousLevelDetails,
        mockCurrentDetails,
      );
      expect(hlsUrlParameters).to.not.be.undefined;
      expect(hlsUrlParameters).to.have.property('msn').which.equals(6);
    });
  });

  describe('Redundant Streams', function () {
    it('assigns redundant failure fallback variants a Content Steering Pathway ID`', function () {
      const { levels: parsedLevels } = M3U8Parser.parseMasterPlaylist(
        `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=200000,RESOLUTION=720x480
http://foo.example.com/lo/prog_index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=200000,RESOLUTION=720x480
http://bar.example.com/lo/prog_index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=1920x1080
http://foo.example.com/md/prog_index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=1920x1080
http://bar.example.com/md/prog_index.m3u8`,
        'http://example.com/main.m3u8',
      );
      expect(parsedLevels).to.have.lengthOf(4, 'MANIFEST_LOADED levels');
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, {
        levels: parsedLevels,
        audioTracks: [],
      });
      const {
        name,
        payload: { levels },
      } = hls.getEventData(0) as { name: string; payload: ManifestParsedData };
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(levels).to.have.lengthOf(4, 'MANIFEST_PARSED levels');
      expect(levels[0].url).to.have.lengthOf(1);
      expect(levels[0].pathwayId).to.equal('.');
      expect(levels[0].uri).to.equal(
        'http://foo.example.com/lo/prog_index.m3u8',
      );
      expect(levels[1].url).to.have.lengthOf(1);
      expect(levels[1].pathwayId).to.equal('..');
      expect(levels[1].uri).to.equal(
        'http://bar.example.com/lo/prog_index.m3u8',
      );
      expect(levels[2].url).to.have.lengthOf(1);
      expect(levels[2].pathwayId).to.equal('.');
      expect(levels[2].uri).to.equal(
        'http://foo.example.com/md/prog_index.m3u8',
      );
      expect(levels[3].url).to.have.lengthOf(1);
      expect(levels[3].pathwayId).to.equal('..');
      expect(levels[3].uri).to.equal(
        'http://bar.example.com/md/prog_index.m3u8',
      );
    });

    it('accounts for missing redundant failure fallback variants and media groups', function () {
      const multivariantPlaylist = `#EXTM3U
      #EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aac",LANGUAGE="en",NAME="English",URI="http://foo.example.com/audio_aac.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=200000,RESOLUTION=720x480,AUDIO="aac"
http://foo.example.com/lo/prog_index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=1920x1080,AUDIO="aac"
http://foo.example.com/md/prog_index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=1920x1080,AUDIO="aac"
http://bar.example.com/md/prog_index.m3u8`;
      const parsedMultivariant = M3U8Parser.parseMasterPlaylist(
        multivariantPlaylist,
        'http://example.com/main.m3u8',
      );
      const parsedMediaOptions = M3U8Parser.parseMasterPlaylistMedia(
        multivariantPlaylist,
        'http://example.com/main.m3u8',
        parsedMultivariant,
      );
      const { levels: parsedLevels } = parsedMultivariant;
      const { AUDIO: parsedAudio, SUBTITLES: parsedSubs } = parsedMediaOptions;
      expect(parsedLevels).to.have.lengthOf(3, 'MANIFEST_LOADED levels');
      expect(parsedAudio).to.have.lengthOf(1, 'MANIFEST_LOADED audioTracks');
      expect(parsedSubs).to.be.undefined;
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, {
        levels: parsedLevels,
        audioTracks: parsedAudio,
      });
      const {
        name,
        payload: { levels },
      } = hls.getEventData(0) as { name: string; payload: ManifestParsedData };
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(levels).to.have.lengthOf(3, 'MANIFEST_PARSED levels');

      expect(levels[0].url).to.have.lengthOf(1);
      expect(levels[0].pathwayId).to.equal('.');
      expect(levels[0].audioGroups).to.deep.equal(['aac']);
      expect(levels[0].subtitleGroups).to.deep.equal(undefined);
      expect(levels[0].uri).to.equal(
        'http://foo.example.com/lo/prog_index.m3u8',
      );
      expect(levels[1].url).to.have.lengthOf(1);
      expect(levels[1].pathwayId).to.equal('.');
      expect(levels[1].audioGroups).to.deep.equal(['aac']);
      expect(levels[1].uri).to.equal(
        'http://foo.example.com/md/prog_index.m3u8',
      );
      expect(levels[2].url).to.have.lengthOf(1);
      expect(levels[2].pathwayId).to.equal('..');
      expect(levels[2].audioGroups).to.deep.equal(['aac']);
      expect(levels[2].uri).to.equal(
        'http://bar.example.com/md/prog_index.m3u8',
      );
    });

    describe('with Media Playlists', function () {
      let parsedMultivariant: ParsedMultivariantPlaylist;
      let parsedMediaOptions;
      beforeEach(function () {
        parsedMultivariant = M3U8Parser.parseMasterPlaylist(
          multivariantPlaylistWithRedundantFallbacks,
          'http://example.com/main.m3u8',
        );
        parsedMediaOptions = M3U8Parser.parseMasterPlaylistMedia(
          multivariantPlaylistWithRedundantFallbacks,
          'http://example.com/main.m3u8',
          parsedMultivariant,
        );
      });

      it('groups redundant failure fallback variants with audio and subtitle groups', function () {
        const { levels: parsedLevels } = parsedMultivariant;
        const { AUDIO: parsedAudio, SUBTITLES: parsedSubs } =
          parsedMediaOptions;
        expect(parsedLevels).to.have.lengthOf(30, 'MANIFEST_LOADED levels');
        expect(parsedAudio).to.have.lengthOf(6, 'MANIFEST_LOADED audioTracks');
        expect(parsedSubs).to.have.lengthOf(9, 'MANIFEST_LOADED subtitles');
        levelController.onManifestLoaded(Events.MANIFEST_LOADED, {
          levels: parsedLevels,
          audioTracks: parsedAudio,
          subtitles: parsedSubs,
        });
        const { name, payload } = hls.getEventData(0) as {
          name: string;
          payload: ManifestParsedData;
        };
        const { levels, audioTracks, subtitleTracks } = payload;
        hls.audioTracks = audioTracks;
        hls.subtitleTracks = subtitleTracks;

        expect(name).to.equal(Events.MANIFEST_PARSED);
        expect(levels).to.have.lengthOf(30, 'MANIFEST_PARSED levels');
        // Audio and Subtitle tracks are filtered by GroupId on level switch by audio and subtitle track controllers
        expect(audioTracks).to.have.lengthOf(6, 'MANIFEST_PARSED audioTracks'); // 3 audio groups * 2 audio tracks per group
        expect(audioTracks[0]).to.deep.include({
          id: 0,
          name: 'English',
          groupId: 'AAC-foo',
        });
        expect(audioTracks[1]).to.deep.include({
          id: 0,
          name: 'English',
          groupId: 'EC3-foo',
        });
        expect(audioTracks[2]).to.deep.include({
          id: 0,
          name: 'English',
          groupId: 'AAC-bar',
        });
        expect(audioTracks[3]).to.deep.include({
          id: 0,
          name: 'English',
          groupId: 'EC3-bar',
        });
        expect(audioTracks[4]).to.deep.include({
          id: 0,
          name: 'English',
          groupId: 'AAC-baz',
        });
        expect(audioTracks[5]).to.deep.include({
          id: 0,
          name: 'English',
          groupId: 'EC3-baz',
        });
        expect(subtitleTracks).to.have.lengthOf(
          9,
          'MANIFEST_PARSED subtitleTracks',
        ); // 3 subtitle groups * 3 subtitle tracks per group
        expect(subtitleTracks[0]).to.deep.include({
          id: 0,
          name: 'English ',
          groupId: 'subs-foo',
        });
        expect(subtitleTracks[1]).to.deep.include({
          id: 1,
          name: 'Français',
          groupId: 'subs-foo',
        });
        expect(subtitleTracks[2]).to.deep.include({
          id: 2,
          name: 'Italiano',
          groupId: 'subs-foo',
        });
        expect(subtitleTracks[3]).to.deep.include({
          id: 0,
          name: 'English ',
          groupId: 'subs-bar',
        });
        expect(subtitleTracks[4]).to.deep.include({
          id: 1,
          name: 'Français',
          groupId: 'subs-bar',
        });
        expect(subtitleTracks[5]).to.deep.include({
          id: 2,
          name: 'Italiano',
          groupId: 'subs-bar',
        });
        expect(subtitleTracks[6]).to.deep.include({
          id: 0,
          name: 'English ',
          groupId: 'subs-baz',
        });
        expect(subtitleTracks[7]).to.deep.include({
          id: 1,
          name: 'Français',
          groupId: 'subs-baz',
        });
        expect(subtitleTracks[8]).to.deep.include({
          id: 2,
          name: 'Italiano',
          groupId: 'subs-baz',
        });

        expect(levelController.level).to.equal(-1);
        expect(levels[0].url).to.have.lengthOf(1);
        expect(levels[0].uri).to.equal('http://www.foo.com/tier6.m3u8');
        expect(levels[0].audioGroups).to.deep.equal(['AAC-foo']);
        expect(levels[1].audioGroups).to.deep.equal(['EC3-foo']);
        expect(levels[2].audioGroups).to.deep.equal(['AAC-bar']);
        expect(levels[3].audioGroups).to.deep.equal(['EC3-bar']);
        expect(levels[0].subtitleGroups).to.deep.equal(['subs-foo']);
        expect(levels[2].subtitleGroups).to.deep.equal(['subs-bar']);
        expect(levels[4].subtitleGroups).to.deep.equal(['subs-baz']);
        expect(levels[0].pathwayId).to.equal('.');
        expect(levels[3].pathwayId).to.equal('..');
        expect(levels[4].pathwayId).to.equal('...');
      });
    });
  });

  describe('Variant STREAM-INF collapsing with Media Playlists', function () {
    let parsedMultivariant: ParsedMultivariantPlaylist;
    let parsedMediaOptions;
    beforeEach(function () {
      parsedMultivariant = M3U8Parser.parseMasterPlaylist(
        multivariantPlaylistWithMultiGroupVariants,
        'http://example.com/main.m3u8',
      );
      parsedMediaOptions = M3U8Parser.parseMasterPlaylistMedia(
        multivariantPlaylistWithMultiGroupVariants,
        'http://example.com/main.m3u8',
        parsedMultivariant,
      );
    });

    it('groups identical STREAM-INF variants with split audio and subtitle groups', function () {
      const { levels: parsedLevels } = parsedMultivariant;
      const { AUDIO: parsedAudio, SUBTITLES: parsedSubs } = parsedMediaOptions;
      expect(parsedLevels).to.have.lengthOf(12, 'MANIFEST_LOADED levels');
      expect(parsedAudio).to.have.lengthOf(2, 'MANIFEST_LOADED audioTracks');
      expect(parsedSubs).to.have.lengthOf(3, 'MANIFEST_LOADED subtitles');
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, {
        levels: parsedLevels,
        audioTracks: parsedAudio,
        subtitles: parsedSubs,
      });
      const { name, payload } = hls.getEventData(0) as {
        name: string;
        payload: ManifestParsedData;
      };
      const { levels, audioTracks, subtitleTracks } = payload;

      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(levels).to.have.lengthOf(2, 'MANIFEST_PARSED levels');

      // Audio and Subtitle tracks are filtered by GroupId on level switch by audio and subtitle track controllers
      expect(audioTracks).to.have.lengthOf(2, 'MANIFEST_PARSED audioTracks');
      expect(audioTracks[0]).to.deep.include({
        id: 0,
        name: 'English',
        groupId: 'aud-en',
      });
      expect(audioTracks[1]).to.deep.include({
        id: 0, // index is assigned after MANIFEST_LOADED by audio-track-controller
        name: 'Italiano',
        groupId: 'aud-it',
      });
      expect(subtitleTracks).to.have.lengthOf(
        3,
        'MANIFEST_PARSED subtitleTracks',
      ); // 3 subtitle groups * 3 subtitle tracks per group
      expect(subtitleTracks[0]).to.deep.include({
        id: 0,
        name: 'English ',
        groupId: 'subs-en',
      });
      expect(subtitleTracks[1]).to.deep.include({
        id: 0, // index is assigned after MANIFEST_LOADED by audio-track-controller
        name: 'Français',
        groupId: 'subs-fr',
      });
      expect(subtitleTracks[2]).to.deep.include({
        id: 0, // index is assigned after MANIFEST_LOADED by audio-track-controller
        name: 'Italiano',
        groupId: 'subs-it',
      });

      expect(levelController.level).to.equal(-1);
      expect(levels[0].url).to.have.lengthOf(1);
      expect(levels[0].url).to.deep.equal(['http://www.foo.com/tier1.m3u8']);
      expect(levels[1].url).to.deep.equal(['http://www.foo.com/tier2.m3u8']);
      expect(levels[0].audioGroups).to.deep.equal(['aud-en', 'aud-it']);
      expect(levels[1].audioGroups).to.deep.equal(['aud-en', 'aud-it']);
      expect(levels[0].subtitleGroups).to.deep.equal([
        'subs-en',
        'subs-fr',
        'subs-it',
      ]);
      expect(levels[1].subtitleGroups).to.deep.equal([
        'subs-en',
        'subs-fr',
        'subs-it',
      ]);
    });
  });

  describe('Content Steering Pathways', function () {
    let parsedMultivariant: ParsedMultivariantPlaylist;
    let parsedMediaOptions;
    beforeEach(function () {
      parsedMultivariant = M3U8Parser.parseMasterPlaylist(
        multivariantPlaylistWithPathways,
        'http://example.com/main.m3u8',
      );
      parsedMediaOptions = M3U8Parser.parseMasterPlaylistMedia(
        multivariantPlaylistWithPathways,
        'http://example.com/main.m3u8',
        parsedMultivariant,
      );
    });

    it('does not group variants with pathway-ids for content-steering', function () {
      const { levels: parsedLevels } = parsedMultivariant;
      const { AUDIO: parsedAudio, SUBTITLES: parsedSubs } = parsedMediaOptions;
      expect(parsedLevels).to.have.lengthOf(30, 'MANIFEST_LOADED levels');
      expect(parsedAudio).to.have.lengthOf(6, 'MANIFEST_LOADED audioTracks');
      expect(parsedSubs).to.have.lengthOf(6, 'MANIFEST_LOADED subtitles');
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, {
        levels: parsedLevels,
        audioTracks: parsedAudio,
        subtitles: parsedSubs,
      });
      const { name, payload } = hls.getEventData(0) as {
        name: string;
        payload: ManifestParsedData;
      };
      const { levels, audioTracks, subtitleTracks } = payload;
      hls.audioTracks = audioTracks;
      hls.subtitleTracks = subtitleTracks;

      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(levels).to.have.lengthOf(30, 'MANIFEST_PARSED levels');
      // Audio and Subtitle tracks are filtered by GroupId on level switch by audio and subtitle track controllers
      expect(audioTracks).to.have.lengthOf(6, 'MANIFEST_PARSED audioTracks'); // 3 audio groups * 2 audio tracks per group
      expect(subtitleTracks).to.have.lengthOf(
        6,
        'MANIFEST_PARSED subtitleTracks',
      ); // 3 subtitle groups * 2 subtitle tracks per group

      expect(levelController.level).to.equal(-1);
      expect(levels[0].url).to.have.lengthOf(1);
      expect(levels[0].url).to.deep.equal(['http://www.foo.com/tier6.m3u8']);
      expect(levels[0].audioGroups).to.deep.equal(['AAC-foo']);
      expect(levels[0].subtitleGroups).to.deep.equal(['subs-foo']);
      expect(levels[0].uri).to.equal('http://www.foo.com/tier6.m3u8');
      expect(levels[29].audioGroups).to.deep.equal(['EC3-baz']);
      expect(levels[29].subtitleGroups).to.deep.equal(['subs-baz']);
      expect(levels[29].uri).to.equal('http://www.baz.com/tier18.m3u8');
    });
  });
});

export const multivariantPlaylistWithPathways = `#EXTM3U
#EXT-X-CONTENT-STEERING:SERVER-URI="http://example.com/manifest.json",PATHWAY-ID="Bar"
#EXT-X-MEDIA:TYPE=SUBTITLES,PATHWAY-ID="Foo",STABLE-RENDITION-ID="subs-en",GROUP-ID="subs-foo",LANGUAGE="en",NAME="English ",AUTOSELECT=YES,URI="http://www.foo.com/subs-en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,PATHWAY-ID="Foo",STABLE-RENDITION-ID="subs-it",GROUP-ID="subs-foo",LANGUAGE="it",NAME="Italiano",AUTOSELECT=YES,URI="http://www.foo.com/subs-it.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,PATHWAY-ID="Bar",STABLE-RENDITION-ID="subs-en",GROUP-ID="subs-bar",LANGUAGE="en",NAME="English ",AUTOSELECT=YES,URI="http://www.bar.com/subs-en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,PATHWAY-ID="Bar",STABLE-RENDITION-ID="subs-it",GROUP-ID="subs-bar",LANGUAGE="it",NAME="Italiano",AUTOSELECT=YES,URI="http://www.bar.com/subs-it.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,PATHWAY-ID="Baz",STABLE-RENDITION-ID="subs-en",GROUP-ID="subs-baz",LANGUAGE="en",NAME="English ",AUTOSELECT=YES,URI="http://www.baz.com/subs-en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,PATHWAY-ID="Baz",STABLE-RENDITION-ID="subs-it",GROUP-ID="subs-baz",LANGUAGE="it",NAME="Italiano",AUTOSELECT=YES,URI="http://www.baz.com/subs-it.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,PATHWAY-ID="Foo",STABLE-RENDITION-ID="audio_aac",GROUP-ID="AAC-foo",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="http://www.foo.com/audio_aac.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,PATHWAY-ID="Foo",STABLE-RENDITION-ID="audio_ec3",GROUP-ID="EC3-foo",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="6",URI="http://www.foo.com/audio_ec3.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,PATHWAY-ID="Bar",STABLE-RENDITION-ID="audio_aac",GROUP-ID="AAC-bar",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="http://www.bar.com/audio_aac.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,PATHWAY-ID="Bar",STABLE-RENDITION-ID="audio_ec3",GROUP-ID="EC3-bar",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="6",URI="http://www.bar.com/audio_ec3.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,PATHWAY-ID="Baz",STABLE-RENDITION-ID="audio_aac",GROUP-ID="AAC-baz",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="http://www.baz.com/audio_aac.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,PATHWAY-ID="Baz",STABLE-RENDITION-ID="audio_ec3",GROUP-ID="EC3-baz",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="6",URI="http://www.baz.com/audio_ec3.m3u8"
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="tier6",AUDIO="AAC-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.foo.com/tier6.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="tier10",AUDIO="AAC-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.foo.com/tier10.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="tier14",AUDIO="AAC-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.foo.com/tier14.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="tier16",AUDIO="AAC-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.foo.com/tier16.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="tier18",AUDIO="AAC-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.foo.com/tier18.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="tier6",AUDIO="EC3-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,ec-3",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.foo.com/tier6.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="tier10",AUDIO="EC3-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,ec-3",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.foo.com/tier10.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="tier14",AUDIO="EC3-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,ec-3",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.foo.com/tier14.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="tier16",AUDIO="EC3-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.foo.com/tier16.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="tier18",AUDIO="EC3-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.foo.com/tier18.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="tier6",AUDIO="AAC-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.bar.com/tier6.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="tier10",AUDIO="AAC-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.bar.com/tier10.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="tier14",AUDIO="AAC-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.bar.com/tier14.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="tier16",AUDIO="AAC-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.bar.com/tier16.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="tier18",AUDIO="AAC-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.bar.com/tier18.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="tier6",AUDIO="EC3-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,ec-3",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.bar.com/tier6.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="tier10",AUDIO="EC3-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,ec-3",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.bar.com/tier10.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="tier14",AUDIO="EC3-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,ec-3",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.bar.com/tier14.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="tier16",AUDIO="EC3-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.bar.com/tier16.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="tier18",AUDIO="EC3-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.bar.com/tier18.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="tier6",AUDIO="AAC-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.baz.com/tier6.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="tier10",AUDIO="AAC-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.baz.com/tier10.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="tier14",AUDIO="AAC-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.baz.com/tier14.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="tier16",AUDIO="AAC-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.baz.com/tier16.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="tier18",AUDIO="AAC-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.baz.com/tier18.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="tier6",AUDIO="EC3-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,ec-3",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.baz.com/tier6.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="tier10",AUDIO="EC3-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,ec-3",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.baz.com/tier10.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="tier14",AUDIO="EC3-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,ec-3",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.baz.com/tier14.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="tier16",AUDIO="EC3-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.baz.com/tier16.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="tier18",AUDIO="EC3-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.baz.com/tier18.m3u8`;

export const multivariantPlaylistWithRedundantFallbacks = `#EXTM3U
## Subtitles ###
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs-foo",LANGUAGE="en",NAME="English ",AUTOSELECT=YES,URI="http://www.foo.com/subs-en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs-foo",LANGUAGE="fr",NAME="Français",AUTOSELECT=YES,URI="http://www.foo.com/subs-fr.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs-foo",LANGUAGE="it",NAME="Italiano",AUTOSELECT=YES,URI="http://www.foo.com/subs-it.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs-bar",LANGUAGE="en",NAME="English ",AUTOSELECT=YES,URI="http://www.bar.com/subs-en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs-bar",LANGUAGE="fr",NAME="Français",AUTOSELECT=YES,URI="http://www.bar.com/subs-fr.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs-bar",LANGUAGE="it",NAME="Italiano",AUTOSELECT=YES,URI="http://www.bar.com/subs-it.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs-baz",LANGUAGE="en",NAME="English ",AUTOSELECT=YES,URI="http://www.baz.com/subs-en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs-baz",LANGUAGE="fr",NAME="Français",AUTOSELECT=YES,URI="http://www.baz.com/subs-fr.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs-baz",LANGUAGE="it",NAME="Italiano",AUTOSELECT=YES,URI="http://www.baz.com/subs-it.m3u8"

### Audio ###
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="AAC-foo",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="http://www.foo.com/audio_aac.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="EC3-foo",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="6",URI="http://www.foo.com/audio_ec3.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="AAC-bar",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="http://www.bar.com/audio_aac.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="EC3-bar",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="6",URI="http://www.bar.com/audio_ec3.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="AAC-baz",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="http://www.baz.com/audio_aac.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="EC3-baz",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="6",URI="http://www.baz.com/audio_ec3.m3u8"

### AAC FOO ###
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24,AUDIO="AAC-foo",SUBTITLES="subs-foo"
http://www.foo.com/tier6.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24,AUDIO="AAC-foo",SUBTITLES="subs-foo"
http://www.foo.com/tier10.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="AAC-foo",SUBTITLES="subs-foo"
http://www.foo.com/tier14.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="AAC-foo",SUBTITLES="subs-foo"
http://www.foo.com/tier16.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="AAC-foo",SUBTITLES="subs-foo"
http://www.foo.com/tier18.m3u8

### EC3 FOO ###
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,ec-3",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24,AUDIO="EC3-foo",SUBTITLES="subs-foo"
http://www.foo.com/tier6.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,ec-3",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24,AUDIO="EC3-foo",SUBTITLES="subs-foo"
http://www.foo.com/tier10.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,ec-3",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="EC3-foo",SUBTITLES="subs-foo"
http://www.foo.com/tier14.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="EC3-foo",SUBTITLES="subs-foo"
http://www.foo.com/tier16.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="EC3-foo",SUBTITLES="subs-foo"
http://www.foo.com/tier18.m3u8

### AAC BAR ###
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24,AUDIO="AAC-bar",SUBTITLES="subs-bar"
http://www.bar.com/tier6.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24,AUDIO="AAC-bar",SUBTITLES="subs-bar"
http://www.bar.com/tier10.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="AAC-bar",SUBTITLES="subs-bar"
http://www.bar.com/tier14.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="AAC-bar",SUBTITLES="subs-bar"
http://www.bar.com/tier16.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="AAC-bar",SUBTITLES="subs-bar"
http://www.bar.com/tier18.m3u8

### EC3 BAR ###
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,ec-3",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24,AUDIO="EC3-bar",SUBTITLES="subs-bar"
http://www.bar.com/tier6.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,ec-3",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24,AUDIO="EC3-bar",SUBTITLES="subs-bar"
http://www.bar.com/tier10.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,ec-3",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="EC3-bar",SUBTITLES="subs-bar"
http://www.bar.com/tier14.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="EC3-bar",SUBTITLES="subs-bar"
http://www.bar.com/tier16.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="EC3-bar",SUBTITLES="subs-bar"
http://www.bar.com/tier18.m3u8

### AAC BAZ ###
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24,AUDIO="AAC-baz",SUBTITLES="subs-baz"
http://www.baz.com/tier6.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24,AUDIO="AAC-baz",SUBTITLES="subs-baz"
http://www.baz.com/tier10.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="AAC-baz",SUBTITLES="subs-baz"
http://www.baz.com/tier14.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="AAC-baz",SUBTITLES="subs-baz"
http://www.baz.com/tier16.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="AAC-baz",SUBTITLES="subs-baz"
http://www.baz.com/tier18.m3u8

### EC3 BAZ ###
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,ec-3",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24,AUDIO="EC3-baz",SUBTITLES="subs-baz"
http://www.baz.com/tier6.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,ec-3",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24,AUDIO="EC3-baz",SUBTITLES="subs-baz"
http://www.baz.com/tier10.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,ec-3",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="EC3-baz",SUBTITLES="subs-baz"
http://www.baz.com/tier14.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="EC3-baz",SUBTITLES="subs-baz"
http://www.baz.com/tier16.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24,AUDIO="EC3-baz",SUBTITLES="subs-baz"
http://www.baz.com/tier18.m3u8`;

const multivariantPlaylistWithMultiGroupVariants = `#EXTM3U
## Subtitles (These should be a single group, but identical variants with different groups can be collapsed into a single variant that uses those groups) ###
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs-en",LANGUAGE="en",NAME="English ",AUTOSELECT=YES,URI="http://www.foo.com/subs-en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs-fr",LANGUAGE="fr",NAME="Français",AUTOSELECT=YES,URI="http://www.foo.com/subs-fr.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs-it",LANGUAGE="it",NAME="Italiano",AUTOSELECT=YES,URI="http://www.foo.com/subs-it.m3u8"

### Audio (These should be a single group, but identical variants with different groups can be collapsed into a single variant that uses those groups) ###
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud-en",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="http://www.foo.com/audio_en.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud-it",LANGUAGE="it",NAME="Italiano",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="http://www.foo.com/audio_it.m3u8"

#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,AUDIO="aud-en",SUBTITLES="subs-en"
http://www.foo.com/tier1.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,AUDIO="aud-en",SUBTITLES="subs-fr"
http://www.foo.com/tier1.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,AUDIO="aud-en",SUBTITLES="subs-it"
http://www.foo.com/tier1.m3u8

#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,AUDIO="aud-en",SUBTITLES="subs-en"
http://www.foo.com/tier2.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,AUDIO="aud-en",SUBTITLES="subs-fr"
http://www.foo.com/tier2.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,AUDIO="aud-en",SUBTITLES="subs-it"
http://www.foo.com/tier2.m3u8

#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,AUDIO="aud-it",SUBTITLES="subs-en"
http://www.foo.com/tier1.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,AUDIO="aud-it",SUBTITLES="subs-fr"
http://www.foo.com/tier1.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,AUDIO="aud-it",SUBTITLES="subs-it"
http://www.foo.com/tier1.m3u8

#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,AUDIO="aud-it",SUBTITLES="subs-en"
http://www.foo.com/tier2.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,AUDIO="aud-it",SUBTITLES="subs-fr"
http://www.foo.com/tier2.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,AUDIO="aud-it",SUBTITLES="subs-it"
http://www.foo.com/tier2.m3u8`;
