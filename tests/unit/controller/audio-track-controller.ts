import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import AudioTrackController from '../../../src/controller/audio-track-controller';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { LevelDetails } from '../../../src/loader/level-details';
import { PlaylistContextType } from '../../../src/types/loader';
import { AttrList } from '../../../src/utils/attr-list';
import type {
  ComponentAPI,
  NetworkComponentAPI,
} from '../../../src/types/component-api';
import type {
  AudioTrackLoadedData,
  ErrorData,
} from '../../../src/types/events';
import type { Level } from '../../../src/types/level';
import type {
  MediaAttributes,
  MediaPlaylist,
} from '../../../src/types/media-playlist';

chai.use(sinonChai);
const expect = chai.expect;

type HlsTestable = Omit<
  Hls,
  'levelController' | 'networkControllers' | 'coreComponents'
> & {
  levelController: {
    levels: Pick<Level, 'audioGroups'>[];
  };
  coreComponents: ComponentAPI[];
  networkControllers: NetworkComponentAPI[];
};

type AudioTrackControllerTestable = Omit<
  AudioTrackController,
  | 'tracks'
  | 'tracksInGroup'
  | 'groupId'
  | 'trackId'
  | 'canLoad'
  | 'shouldLoadPlaylist'
  | 'timer'
  | 'onManifestLoading'
  | 'onManifestParsed'
  | 'onLevelLoading'
  | 'onAudioTrackLoaded'
  | 'onError'
> & {
  tracks: MediaPlaylist[];
  tracksInGroup: MediaPlaylist[];
  groupIds: (string | undefined)[] | null;
  trackId: number;
  canLoad: boolean;
  timer: number;
  shouldLoadPlaylist: (track: Object) => boolean;
  onManifestLoading: () => void;
  onManifestParsed: (
    type: string,
    data: { audioTracks: MediaPlaylist[] },
  ) => void;
  onLevelLoading: (type: string, data: { level: number }) => void;
  onAudioTrackLoaded: (type: string, data: AudioTrackLoadedData) => void;
  onError: (type: string, data: Partial<ErrorData>) => void;
};

describe('AudioTrackController', function () {
  let hls: HlsTestable;
  let audioTrackController: AudioTrackControllerTestable;
  let tracks: MediaPlaylist[];

  beforeEach(function () {
    hls = new Hls() as unknown as HlsTestable;
    hls.networkControllers.forEach((component) => component.destroy());
    hls.networkControllers.length = 0;
    hls.coreComponents.forEach((component) => component.destroy());
    hls.coreComponents.length = 0;
    audioTrackController = new AudioTrackController(
      hls as unknown as Hls,
    ) as unknown as AudioTrackControllerTestable;
    hls.networkControllers.push(audioTrackController);
    hls.levelController = {
      levels: [
        {
          audioGroups: ['2'],
        },
      ],
    };
    tracks = [
      {
        attrs: new AttrList({}) as MediaAttributes,
        bitrate: 0,
        autoselect: false,
        default: true,
        forced: false,
        groupId: '1',
        id: 0,
        name: 'A',
        type: 'AUDIO',
        url: '',
      },
      {
        attrs: new AttrList({}) as MediaAttributes,
        bitrate: 0,
        autoselect: false,
        default: false,
        forced: false,
        groupId: '1',
        id: 1,
        name: 'B',
        type: 'AUDIO',
        url: '',
      },
      {
        attrs: new AttrList({}) as MediaAttributes,
        bitrate: 0,
        autoselect: false,
        default: false,
        forced: false,
        groupId: '1',
        id: 2,
        name: 'C',
        type: 'AUDIO',
        url: '',
      },
      {
        attrs: new AttrList({}) as MediaAttributes,
        bitrate: 0,
        autoselect: false,
        default: true,
        forced: false,
        groupId: '2',
        id: 0,
        name: 'A',
        type: 'AUDIO',
        url: '',
      },
      {
        attrs: new AttrList({}) as MediaAttributes,
        bitrate: 0,
        autoselect: false,
        default: false,
        forced: false,
        groupId: '2',
        id: 1,
        name: 'B',
        type: 'AUDIO',
        url: '',
      },
      {
        attrs: new AttrList({}) as MediaAttributes,
        bitrate: 0,
        autoselect: false,
        default: false,
        forced: false,
        groupId: '2',
        id: 2,
        name: 'C',
        type: 'AUDIO',
        url: '',
      },
    ];
  });

  afterEach(function () {
    hls.destroy();
  });

  describe('onManifestLoading', function () {
    it('should reset the tracks list and current trackId', function () {
      audioTrackController.tracks = tracks;
      audioTrackController.onManifestLoading();
      expect(audioTrackController.tracks).to.be.empty;
    });
  });

  describe('onLevelLoading', function () {
    it('should set the audioTracks to those in the level audio group ("2") and trigger AUDIO_TRACKS_UPDATED', function () {
      const audioTracksUpdatedCallback = sinon.spy();
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, audioTracksUpdatedCallback);

      audioTrackController.onManifestParsed(Events.MANIFEST_PARSED, {
        audioTracks: tracks,
      });
      audioTrackController.onLevelLoading(Events.LEVEL_LOADING, {
        level: 0,
      });

      expect(audioTrackController.tracks).to.equal(tracks);
      expect(audioTracksUpdatedCallback).to.be.calledOnce;
      expect(audioTracksUpdatedCallback).to.be.calledWith(
        Events.AUDIO_TRACKS_UPDATED,
        {
          audioTracks: tracks.slice(3, 6),
        },
      );
    });

    it('should set the audioTracks to those in the level audio groups ("1" and "2") and trigger AUDIO_TRACKS_UPDATED', function () {
      const audioTracksUpdatedCallback = sinon.spy();
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, audioTracksUpdatedCallback);

      const audioGroups = hls.levelController.levels[0].audioGroups as any;
      audioGroups.length = 0;
      audioGroups.push('1', '2');

      audioTrackController.onManifestParsed(Events.MANIFEST_PARSED, {
        audioTracks: tracks,
      });
      audioTrackController.onLevelLoading(Events.LEVEL_LOADING, {
        level: 0,
      });

      expect(audioTrackController.tracks).to.equal(tracks);
      expect(audioTracksUpdatedCallback).to.be.calledOnce;
      expect(audioTracksUpdatedCallback).to.be.calledWith(
        Events.AUDIO_TRACKS_UPDATED,
        {
          audioTracks: tracks.slice(),
        },
      );
    });
  });

  it('should select audioGroupId and trigger AUDIO_TRACK_SWITCHING', function (done) {
    hls.on(Hls.Events.AUDIO_TRACK_SWITCHING, (event, data) => {
      done();
    });

    const newLevelInfo = hls.levels[0];
    const audioGroups = newLevelInfo.audioGroups;

    audioTrackController.tracks = tracks;
    // Update the level to set audioGroupId
    audioTrackController.onLevelLoading(Events.LEVEL_LOADING, {
      level: 0,
    });
    audioTrackController.audioTrack = 2;

    // current track name
    const audioTrackName = tracks[audioTrackController.audioTrack].name;

    audioTrackController.onManifestParsed(Events.MANIFEST_PARSED, {
      audioTracks: tracks,
    });

    // group has switched
    expect(audioGroups).to.include(
      tracks[audioTrackController.audioTrack].groupId,
    );
    // name is still the same
    expect(tracks[audioTrackController.audioTrack].name).to.equal(
      audioTrackName,
    );
  });

  it('should always switch tracks when audioTrack is set to a valid index', function () {
    const audioTracksUpdatedCallback = sinon.spy();
    const audioTrackSwitchingCallback = sinon.spy();
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, audioTracksUpdatedCallback);
    hls.on(Hls.Events.AUDIO_TRACK_SWITCHING, audioTrackSwitchingCallback);

    audioTrackController.onManifestParsed(Events.MANIFEST_PARSED, {
      audioTracks: tracks,
    });
    audioTrackController.onLevelLoading(Events.LEVEL_LOADING, {
      level: 0,
    });
    expect(audioTracksUpdatedCallback, 'AUDIO_TRACKS_UPDATED').to.have.been
      .calledOnce;
    expect(
      audioTrackSwitchingCallback,
      'AUDIO_TRACK_SWITCHING to initial track 0',
    ).to.have.been.calledOnce;

    audioTrackController.onAudioTrackLoaded(Events.AUDIO_TRACK_LOADED, {
      details: new LevelDetails(''),
      id: 0,
      groupId: '2',
      networkDetails: null,
      stats: { loading: {} } as any,
      deliveryDirectives: null,
      track: {} as any,
    });
    expect(audioTrackController.tracksInGroup[0], 'tracksInGroup[0]')
      .to.have.property('details')
      .which.is.an('object');

    audioTrackController.audioTrack = 1;
    expect(audioTrackSwitchingCallback, 'AUDIO_TRACK_SWITCHING to track 1').to
      .have.been.calledTwice;

    audioTrackController.onAudioTrackLoaded(Events.AUDIO_TRACK_LOADED, {
      details: new LevelDetails(''),
      id: 1,
      groupId: '2',
      networkDetails: null,
      stats: { loading: {} } as any,
      deliveryDirectives: null,
      track: {} as any,
    });
    expect(audioTrackController.tracksInGroup[1], 'tracksInGroup[1]')
      .to.have.property('details')
      .which.is.an('object');

    audioTrackController.audioTrack = 0;
    expect(audioTrackSwitchingCallback, 'AUDIO_TRACK_SWITCHING back to track 0')
      .to.have.been.calledThrice;
  });

  describe('shouldLoadPlaylist', function () {
    it('should not need loading because the audioTrack is embedded in the main playlist', function () {
      audioTrackController.canLoad = true;
      expect(
        audioTrackController.shouldLoadPlaylist({ details: { live: true } }),
      ).to.be.false;
      expect(audioTrackController.shouldLoadPlaylist({ details: undefined })).to
        .be.false;
    });

    it('should need loading because the track has not been loaded yet', function () {
      audioTrackController.canLoad = true;
      expect(
        audioTrackController.shouldLoadPlaylist({
          details: { live: true },
          url: 'http://example.com/manifest.m3u8',
        }),
        'track 1',
      ).to.be.true;

      expect(
        audioTrackController.shouldLoadPlaylist({
          details: null,
          url: 'http://example.com/manifest.m3u8',
        }),
        'track 2',
      ).to.be.true;
    });
  });

  describe('onLevelLoading', function () {
    it('should reselect the current track and trigger AUDIO_TRACK_SWITCHING eventually', function (done) {
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHING, (event, data) => {
        done();
      });

      const levelLoadedEvent = {
        level: 0,
      };

      const newLevelInfo = hls.levels[levelLoadedEvent.level];
      const audioGroups = newLevelInfo.audioGroups;

      audioTrackController.tracks = tracks;
      audioTrackController.onLevelLoading(Events.LEVEL_LOADING, {
        level: 0,
      });
      audioTrackController.audioTrack = 2;

      // current track name
      const audioTrackName = tracks[audioTrackController.audioTrack].name;

      audioTrackController.onLevelLoading(
        Events.LEVEL_LOADING,
        levelLoadedEvent,
      );

      // group has switched
      expect(audioGroups).to.include(
        tracks[audioTrackController.audioTrack].groupId,
      );
      // name is still the same
      expect(tracks[audioTrackController.audioTrack].name).to.equal(
        audioTrackName,
      );
    });

    it('should load audio tracks with a url', function () {
      const shouldLoadPlaylist = sinon.spy(
        audioTrackController,
        'shouldLoadPlaylist',
      );
      const audioTrackLoadingCallback = sinon.spy();
      const trackWithUrl: MediaPlaylist = {
        groupId: '1',
        id: 0,
        name: 'A',
        default: true,
        url: './trackA.m3u8',
        attrs: new AttrList({}) as MediaAttributes,
        bitrate: 0,
        autoselect: false,
        forced: false,
        type: 'AUDIO',
      };

      hls.on(Hls.Events.AUDIO_TRACK_LOADING, audioTrackLoadingCallback);

      hls.levelController = {
        levels: [
          {
            audioGroups: ['1'],
          },
        ],
      };

      audioTrackController.tracks = [trackWithUrl];

      audioTrackController.onLevelLoading(Events.LEVEL_LOADING, {
        level: 0,
      });
      audioTrackController.startLoad();

      expect(shouldLoadPlaylist).to.have.been.calledTwice;
      expect(shouldLoadPlaylist).to.have.been.calledWith(trackWithUrl);
      expect(
        shouldLoadPlaylist.firstCall.returnValue,
        'expected shouldLoadPlaylist to return false before startLoad() is called',
      ).to.be.false;
      expect(
        shouldLoadPlaylist.secondCall.returnValue,
        'expected shouldLoadPlaylist to return true after startLoad() is called',
      ).to.be.true;

      expect(audioTrackLoadingCallback).to.have.been.calledOnce;
    });

    it('should not attempt to load audio tracks without a url', function () {
      const shouldLoadPlaylist = sinon.spy(
        audioTrackController,
        'shouldLoadPlaylist',
      );
      const audioTrackLoadingCallback = sinon.spy();
      const trackWithOutUrl = tracks[0];

      hls.on(Hls.Events.AUDIO_TRACK_LOADING, audioTrackLoadingCallback);

      hls.levelController = {
        levels: [
          {
            audioGroups: ['1'],
          },
        ],
      };

      audioTrackController.tracks = tracks;

      audioTrackController.onLevelLoading(Events.LEVEL_LOADING, {
        level: 0,
      });
      audioTrackController.startLoad();

      expect(shouldLoadPlaylist).to.have.been.calledTwice;
      expect(shouldLoadPlaylist).to.have.been.calledWith(trackWithOutUrl);
      expect(shouldLoadPlaylist.firstCall.returnValue).to.be.false;
      expect(shouldLoadPlaylist.secondCall.returnValue).to.be.false;
      expect(audioTrackLoadingCallback).to.not.have.been.called;
    });
  });

  describe('onError', function () {
    it('should retry track loading if track has not changed', function () {
      const checkRetry = sinon.spy(audioTrackController as any, 'checkRetry');
      const currentTrackId = 4;
      const currentGroupId = 'aac';
      audioTrackController.trackId = currentTrackId;
      audioTrackController.groupIds = [currentGroupId];
      audioTrackController.tracks = tracks;

      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.NETWORK_ERROR,
        details: Hls.ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
        fatal: false,
        context: {
          type: PlaylistContextType.AUDIO_TRACK,
          id: currentTrackId,
          groupId: currentGroupId,
        } as any,
      });
      expect(
        audioTrackController.audioTrack,
        'track index/id is not changed as there is no redundant track to choose from',
      ).to.equal(4);
      expect(checkRetry).to.have.been.calledOnce;
    });
  });
});
