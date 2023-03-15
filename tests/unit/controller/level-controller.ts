import LevelController from '../../../src/controller/level-controller';
import HlsMock from '../../mocks/hls.mock';
import { Events } from '../../../src/events';
import { ErrorDetails, ErrorTypes } from '../../../src/errors';
import { Level } from '../../../src/types/level';
import { AttrList } from '../../../src/utils/attr-list';
import {
  PlaylistLevelType,
  PlaylistLoaderContext,
} from '../../../src/types/loader';
import M3U8Parser, {
  ParsedMultivariantPlaylist,
} from '../../../src/loader/m3u8-parser';
import type { LevelDetails } from '../../../src/loader/level-details';
import type {
  ManifestLoadedData,
  ManifestParsedData,
} from '../../../src/types/events';
import type { LevelParsed } from '../../../src/types/level';
import type {
  MediaAttributes,
  MediaPlaylist,
  MediaPlaylistType,
} from '../../../src/types/media-playlist';
import type { Fragment } from '../../../src/loader/fragment';

import sinon from 'sinon';
import chai from 'chai';
import sinonChai from 'sinon-chai';

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
    }
  ) => void;
  switchParams: (
    playlistUri: string,
    previous: LevelDetails | undefined
  ) => void;
  redundantFailover: (levelIndex: number) => void;
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
    attrs: new AttrList({}) as MediaAttributes,
    autoselect: false,
    default: false,
    forced: false,
    groupId: 'audio',
    id: 0,
    type: 'AUDIO' as MediaPlaylistType,
  });
  return Object.assign(track, options);
}

describe('LevelController', function () {
  const sandbox = sinon.createSandbox();
  let hls: HlsMock;
  let levelController: LevelControllerTestable;

  beforeEach(function () {
    hls = new HlsMock({});
    levelController = new LevelController(
      hls as any,
      null
    ) as unknown as LevelControllerTestable;
    levelController.onParsedComplete = () => {};
    hls.levelController = levelController;
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
    expect(hls.trigger).to.have.been.calledWith(Events.LEVEL_SWITCHING, {
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
        parsedData
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

  describe('Redundant Streams', function () {
    it('groups redundant failure fallback variants in Level url array`', function () {
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
        'http://example.com/main.m3u8'
      );
      expect(parsedLevels).to.have.lengthOf(4, 'MANIFEST_LOADED levels');
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, {
        levels: parsedLevels,
      });
      const {
        name,
        payload: { levels },
      } = hls.getEventData(0) as { name: string; payload: ManifestParsedData };
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(levels).to.have.lengthOf(2, 'MANIFEST_PARSED levels');
      expect(levels[0].url).to.have.lengthOf(2);
      expect(levels[0].urlId).to.equal(0);
      expect(levels[0].uri).to.equal(
        'http://foo.example.com/lo/prog_index.m3u8'
      );
      expect(levels[1].url).to.have.lengthOf(2);
      expect(levels[1].urlId).to.equal(0);
      expect(levels[1].uri).to.equal(
        'http://foo.example.com/md/prog_index.m3u8'
      );
      expect(levelController.level).to.equal(-1);
      levels[0].details = {} as any;
      levels[1].details = {} as any;
      levelController.level = 0;
      levels[0].urlId++;
      levels[1].urlId++;
      expect(levels[0].uri).to.equal(
        'http://bar.example.com/lo/prog_index.m3u8'
      );
      expect(levels[1].uri).to.equal(
        'http://bar.example.com/md/prog_index.m3u8'
      );
      expect(levelController.level).to.equal(0);
      expect(levels[0].details, 'Resets LevelDetails').to.be.undefined;
      expect(levels[1].details, 'Resets LevelDetails').to.be.undefined;
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
        'http://example.com/main.m3u8'
      );
      const parsedMediaOptions = M3U8Parser.parseMasterPlaylistMedia(
        multivariantPlaylist,
        'http://example.com/main.m3u8',
        parsedMultivariant
      );
      const { levels: parsedLevels } = parsedMultivariant;
      const { AUDIO: parsedAudio, SUBTITLES: parsedSubs } = parsedMediaOptions;
      expect(parsedLevels).to.have.lengthOf(3, 'MANIFEST_LOADED levels');
      expect(parsedAudio).to.have.lengthOf(1, 'MANIFEST_LOADED audioTracks');
      expect(parsedSubs).to.be.undefined;
      levelController.onManifestLoaded(Events.MANIFEST_LOADED, {
        levels: parsedLevels,
      });
      const {
        name,
        payload: { levels },
      } = hls.getEventData(0) as { name: string; payload: ManifestParsedData };
      expect(name).to.equal(Events.MANIFEST_PARSED);
      expect(levels).to.have.lengthOf(2, 'MANIFEST_PARSED levels');
      expect(levels[0].url).to.have.lengthOf(1);
      expect(levels[0].urlId).to.equal(0);
      expect(levels[0].uri).to.equal(
        'http://foo.example.com/lo/prog_index.m3u8'
      );

      expect(levels[0]).to.have.property('audioGroupIds').which.has.lengthOf(1);
      expect(levels[1]).to.have.property('audioGroupIds').which.has.lengthOf(2);
      expect(levels[0]).to.have.property('textGroupIds').which.is.undefined;
      expect(levels[0].url).to.deep.equal([
        'http://foo.example.com/lo/prog_index.m3u8',
      ]);
      expect(levels[0].audioGroupIds).to.deep.equal(['aac']);
      expect(levels[1].audioGroupIds).to.deep.equal(['aac', 'aac']);
      expect(levels[1].audioGroupIds?.[levels[1].urlId]).to.equal('aac');
      expect(levels[1].url).to.have.lengthOf(2);
      expect(levels[1].urlId).to.equal(0);
      expect(levels[1].uri).to.equal(
        'http://foo.example.com/md/prog_index.m3u8'
      );
      expect(levelController.level).to.equal(-1);
      levels[0].urlId++;
      levels[1].urlId++;
      expect(levels[0].uri).to.equal(
        'http://foo.example.com/lo/prog_index.m3u8'
      );
      expect(levels[1].uri).to.equal(
        'http://bar.example.com/md/prog_index.m3u8'
      );
    });

    describe('with Media Playlists', function () {
      let parsedMultivariant: ParsedMultivariantPlaylist;
      let parsedMediaOptions;
      beforeEach(function () {
        parsedMultivariant = M3U8Parser.parseMasterPlaylist(
          multivariantPlaylistWithRedundantFallbacks,
          'http://example.com/main.m3u8'
        );
        parsedMediaOptions = M3U8Parser.parseMasterPlaylistMedia(
          multivariantPlaylistWithRedundantFallbacks,
          'http://example.com/main.m3u8',
          parsedMultivariant
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
        expect(levels).to.have.lengthOf(10, 'MANIFEST_PARSED levels');
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
          'MANIFEST_PARSED subtitleTracks'
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
        expect(levels[0].url).to.have.lengthOf(3);
        expect(levels[0])
          .to.have.property('audioGroupIds')
          .which.has.lengthOf(3);
        expect(levels[0])
          .to.have.property('textGroupIds')
          .which.has.lengthOf(3);
        expect(levels[0].url).to.deep.equal([
          'http://www.foo.com/tier6.m3u8',
          'http://www.bar.com/tier6.m3u8',
          'http://www.baz.com/tier6.m3u8',
        ]);
        expect(levels[0].audioGroupIds).to.deep.equal([
          'AAC-foo',
          'AAC-bar',
          'AAC-baz',
        ]);
        expect(levels[9].audioGroupIds).to.deep.equal([
          'EC3-foo',
          'EC3-bar',
          'EC3-baz',
        ]);
        expect(levels[0].textGroupIds).to.deep.equal([
          'subs-foo',
          'subs-bar',
          'subs-baz',
        ]);
        expect(levels[9].textGroupIds).to.deep.equal([
          'subs-foo',
          'subs-bar',
          'subs-baz',
        ]);
        expect(levels[0].uri).to.equal('http://www.foo.com/tier6.m3u8');
        expect(levels[9].audioGroupIds?.[levels[9].urlId]).to.equal('EC3-foo');

        levels[0].urlId++;
        levels[9].urlId++;
        expect(levels[0].uri).to.equal('http://www.bar.com/tier6.m3u8');
        expect(levels[9].uri).to.equal('http://www.bar.com/tier18.m3u8');
        expect(levels[9].audioGroupIds?.[levels[9].urlId]).to.equal('EC3-bar');
        levels[0].urlId++;
        levels[9].urlId++;
        expect(levels[0].uri).to.equal('http://www.baz.com/tier6.m3u8');
        expect(levels[9].uri).to.equal('http://www.baz.com/tier18.m3u8');
        expect(levels[9].audioGroupIds?.[levels[9].urlId]).to.equal('EC3-baz');
      });

      it('switches to fallback variants when audio group is switched', function () {
        const { levels: parsedLevels } = parsedMultivariant;
        const { AUDIO: parsedAudioTracks, SUBTITLES: parsedSubtitles } =
          parsedMediaOptions;
        levelController.onManifestLoaded(Events.MANIFEST_LOADED, {
          levels: parsedLevels,
          audioTracks: parsedAudioTracks,
          subtitles: parsedSubtitles,
        });
        const { payload } = hls.getEventData(0) as {
          name: string;
          payload: ManifestParsedData;
        };
        const { levels, audioTracks, subtitleTracks } = payload;
        hls.audioTracks = audioTracks;
        hls.subtitleTracks = subtitleTracks;
        levelController.level = 0;
        expect(levels[0].uri).to.equal('http://www.foo.com/tier6.m3u8');
        levelController.onAudioTrackSwitched(Events.AUDIO_TRACK_SWITCHED, {
          id: 2,
        });
        expect(levels[0].uri).to.equal('http://www.bar.com/tier6.m3u8');
      });
    });
  });

  describe('Content Steering Pathways', function () {
    let parsedMultivariant: ParsedMultivariantPlaylist;
    let parsedMediaOptions;
    beforeEach(function () {
      parsedMultivariant = M3U8Parser.parseMasterPlaylist(
        multivariantPlaylistWithPathways,
        'http://example.com/main.m3u8'
      );
      parsedMediaOptions = M3U8Parser.parseMasterPlaylistMedia(
        multivariantPlaylistWithPathways,
        'http://example.com/main.m3u8',
        parsedMultivariant
      );
    });

    it('does not group variants with pathway-ids for conten-steering', function () {
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
        'MANIFEST_PARSED subtitleTracks'
      ); // 3 subtitle groups * 2 subtitle tracks per group

      expect(levelController.level).to.equal(-1);
      expect(levels[0].url).to.have.lengthOf(1);
      expect(levels[0]).to.have.property('audioGroupIds').which.has.lengthOf(1);
      expect(levels[0]).to.have.property('textGroupIds').which.has.lengthOf(1);
      expect(levels[0].url).to.deep.equal(['http://www.foo.com/tier6.m3u8']);
      expect(levels[0].audioGroupIds).to.deep.equal(['AAC-foo']);
      expect(levels[29].audioGroupIds).to.deep.equal(['EC3-baz']);
      expect(levels[0].textGroupIds).to.deep.equal(['subs-foo']);
      expect(levels[29].textGroupIds).to.deep.equal(['subs-baz']);
      expect(levels[0].uri).to.equal('http://www.foo.com/tier6.m3u8');
    });
  });
});

export const multivariantPlaylistWithPathways = `#EXTM3U
#EXT-X-CONTENT-STEERING:SERVER-URI="http://example.com/manifest.json",PATHWAY-ID="Bar"
#EXT-X-MEDIA:TYPE=SUBTITLES,PATHWAY-ID="Foo",STABLE-RENDITION-ID="subs-foo1",GROUP-ID="subs-foo",LANGUAGE="en",NAME="English ",AUTOSELECT=YES,URI="http://www.foo.com/subs-en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,PATHWAY-ID="Foo",STABLE-RENDITION-ID="subs-foo2",GROUP-ID="subs-foo",LANGUAGE="it",NAME="Italiano",AUTOSELECT=YES,URI="http://www.foo.com/subs-it.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,PATHWAY-ID="Bar",STABLE-RENDITION-ID="subs-bar1",GROUP-ID="subs-bar",LANGUAGE="en",NAME="English ",AUTOSELECT=YES,URI="http://www.bar.com/subs-en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,PATHWAY-ID="Bar",STABLE-RENDITION-ID="subs-bar2",GROUP-ID="subs-bar",LANGUAGE="it",NAME="Italiano",AUTOSELECT=YES,URI="http://www.bar.com/subs-it.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,PATHWAY-ID="Baz",STABLE-RENDITION-ID="subs-baz1",GROUP-ID="subs-baz",LANGUAGE="en",NAME="English ",AUTOSELECT=YES,URI="http://www.baz.com/subs-en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,PATHWAY-ID="Baz",STABLE-RENDITION-ID="subs-baz2",GROUP-ID="subs-baz",LANGUAGE="it",NAME="Italiano",AUTOSELECT=YES,URI="http://www.baz.com/subs-it.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,PATHWAY-ID="Foo",STABLE-RENDITION-ID="audio-foo1",GROUP-ID="AAC-foo",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="http://www.foo.com/audio_aac.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,PATHWAY-ID="Foo",STABLE-RENDITION-ID="audio-foo2",GROUP-ID="EC3-foo",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="6",URI="http://www.foo.com/audio_ec3.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,PATHWAY-ID="Bar",STABLE-RENDITION-ID="audio-bar1",GROUP-ID="AAC-bar",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="http://www.bar.com/audio_aac.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,PATHWAY-ID="Bar",STABLE-RENDITION-ID="audio-bar2",GROUP-ID="EC3-bar",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="6",URI="http://www.bar.com/audio_ec3.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,PATHWAY-ID="Baz",STABLE-RENDITION-ID="audio-baz1",GROUP-ID="AAC-baz",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="http://www.baz.com/audio_aac.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,PATHWAY-ID="Baz",STABLE-RENDITION-ID="audio-baz2",GROUP-ID="EC3-baz",LANGUAGE="en-US",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="6",URI="http://www.baz.com/audio_ec3.m3u8"
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="foo1",AUDIO="AAC-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.foo.com/tier6.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="foo3",AUDIO="AAC-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.foo.com/tier10.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="foo5",AUDIO="AAC-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.foo.com/tier14.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="foo7",AUDIO="AAC-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.foo.com/tier16.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="foo9",AUDIO="AAC-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.foo.com/tier18.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="foo2",AUDIO="EC3-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,ec-3",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.foo.com/tier6.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="foo4",AUDIO="EC3-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,ec-3",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.foo.com/tier10.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="foo6",AUDIO="EC3-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,ec-3",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.foo.com/tier14.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="foo8",AUDIO="EC3-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.foo.com/tier16.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Foo",STABLE-VARIANT-ID="foo10",AUDIO="EC3-foo",SUBTITLES="subs-foo",AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.foo.com/tier18.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="bar1",AUDIO="AAC-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.bar.com/tier6.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="bar3",AUDIO="AAC-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.bar.com/tier10.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="bar5",AUDIO="AAC-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.bar.com/tier14.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="bar7",AUDIO="AAC-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.bar.com/tier16.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="bar9",AUDIO="AAC-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.bar.com/tier18.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="bar2",AUDIO="EC3-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,ec-3",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.bar.com/tier6.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="bar4",AUDIO="EC3-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,ec-3",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.bar.com/tier10.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="bar6",AUDIO="EC3-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,ec-3",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.bar.com/tier14.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="bar8",AUDIO="EC3-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.bar.com/tier16.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Bar",STABLE-VARIANT-ID="bar10",AUDIO="EC3-bar",SUBTITLES="subs-bar",AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.bar.com/tier18.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="baz1",AUDIO="AAC-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.baz.com/tier6.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="baz3",AUDIO="AAC-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.baz.com/tier10.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="baz5",AUDIO="AAC-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.baz.com/tier14.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="baz7",AUDIO="AAC-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.baz.com/tier16.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="baz9",AUDIO="AAC-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.baz.com/tier18.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="baz2",AUDIO="EC3-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=254512,BANDWIDTH=410540,CODECS="avc1.64001f,ec-3",RESOLUTION=480x270,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.baz.com/tier6.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="baz4",AUDIO="EC3-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=1098229,BANDWIDTH=1771920,CODECS="avc1.64001f,ec-3",RESOLUTION=768x432,HDCP-LEVEL=NONE,FRAME-RATE=24
http://www.baz.com/tier10.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="baz6",AUDIO="EC3-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=3827162,BANDWIDTH=6080788,CODECS="avc1.64001f,ec-3",RESOLUTION=1280x720,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.baz.com/tier14.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="baz8",AUDIO="EC3-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=4957795,BANDWIDTH=7679463,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
http://www.baz.com/tier16.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="Baz",STABLE-VARIANT-ID="baz10",AUDIO="EC3-baz",SUBTITLES="subs-baz",AVERAGE-BANDWIDTH=9782853,BANDWIDTH=14440256,CODECS="avc1.640028,ec-3",RESOLUTION=1920x1080,HDCP-LEVEL=TYPE-0,FRAME-RATE=24
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
