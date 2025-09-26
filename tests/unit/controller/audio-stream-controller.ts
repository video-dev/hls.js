import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { hlsDefaultConfig } from '../../../src/config';
import AudioStreamController from '../../../src/controller/audio-stream-controller';
import { State } from '../../../src/controller/base-stream-controller';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { Fragment } from '../../../src/loader/fragment';
import KeyLoader from '../../../src/loader/key-loader';
import { LoadStats } from '../../../src/loader/load-stats';
import { Level } from '../../../src/types/level';
import { PlaylistLevelType } from '../../../src/types/loader';
import { AttrList } from '../../../src/utils/attr-list';
import { adjustSlidingStart } from '../../../src/utils/discontinuities';
import type { LevelDetails } from '../../../src/loader/level-details';
import type {
  AudioTrackLoadedData,
  AudioTrackSwitchingData,
  LevelLoadedData,
  TrackLoadedData,
} from '../../../src/types/events';
import type {
  MediaAttributes,
  MediaPlaylist,
} from '../../../src/types/media-playlist';

chai.use(sinonChai);
const expect = chai.expect;

type AudioStreamControllerTestable = Omit<
  AudioStreamController,
  | 'hls'
  | 'levels'
  | 'mainDetails'
  | 'onAudioTrackSwitching'
  | 'onAudioTrackLoaded'
  | 'onLevelLoaded'
> & {
  hls: Hls;
  levels: Level[] | null;
  mainDetails: LevelDetails;
  onAudioTrackSwitching: (
    event: Events.AUDIO_TRACK_SWITCHING,
    data: AudioTrackSwitchingData,
  ) => void;
  onAudioTrackLoaded: (
    event: Events.AUDIO_TRACK_LOADED,
    data: TrackLoadedData,
  ) => void;
  onLevelLoaded: (event: Events.LEVEL_LOADED, data: LevelLoadedData) => void;
};

describe('AudioStreamController', function () {
  const audioTracks: MediaPlaylist[] = [
    {
      attrs: new AttrList({}) as MediaAttributes,
      autoselect: true,
      bitrate: 0,
      forced: false,
      type: 'AUDIO',
      url: 'data://',
      groupId: '1',
      id: 0,
      default: true,
      name: 'A',
    },
    {
      attrs: new AttrList({}) as MediaAttributes,
      autoselect: true,
      bitrate: 0,
      forced: false,
      type: 'AUDIO',
      url: 'data://',
      groupId: '1',
      id: 1,
      default: false,
      name: 'B',
    },
    {
      attrs: new AttrList({}) as MediaAttributes,
      autoselect: true,
      bitrate: 0,
      forced: false,
      type: 'AUDIO',
      url: 'data://',
      groupId: '1',
      id: 2,
      default: false,
      name: 'C',
    },
    {
      attrs: new AttrList({}) as MediaAttributes,
      autoselect: true,
      bitrate: 0,
      forced: false,
      type: 'AUDIO',
      url: 'data://',
      groupId: '2',
      id: 0,
      default: true,
      name: 'A',
    },
    {
      attrs: new AttrList({}) as MediaAttributes,
      autoselect: true,
      bitrate: 0,
      forced: false,
      type: 'AUDIO',
      url: 'data://',
      groupId: '2',
      id: 1,
      default: false,
      name: 'B',
    },
    {
      attrs: new AttrList({}) as MediaAttributes,
      autoselect: true,
      bitrate: 0,
      forced: false,
      type: 'AUDIO',
      url: 'data://',
      groupId: '3',
      id: 2,
      default: false,
      name: 'C',
    },
  ];

  let sandbox: sinon.SinonSandbox;
  let hls: Hls;
  let fragmentTracker: FragmentTracker;
  let keyLoader: KeyLoader;
  let audioStreamController: AudioStreamControllerTestable;
  let tracks: Level[];

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    hls = new Hls();
    fragmentTracker = new FragmentTracker(hls);
    keyLoader = new KeyLoader(hlsDefaultConfig, hls.logger);
    audioStreamController = new AudioStreamController(
      hls,
      fragmentTracker,
      keyLoader,
    ) as unknown as AudioStreamControllerTestable;
    tracks = audioTracks.map((mediaPlaylist) => new Level(mediaPlaylist));
  });

  afterEach(function () {
    sandbox.restore();
    hls.destroy();
  });

  describe('onAudioTrackSwitching', function () {
    it('reset the controller state to IDLE when WAITING_TRACK', function () {
      audioStreamController.state = State.WAITING_TRACK;
      audioStreamController.onAudioTrackSwitching(
        Events.AUDIO_TRACK_SWITCHING,
        audioTracks[0],
      );
      expect(audioStreamController.state).to.equal(State.IDLE);
      expect(audioStreamController.hasInterval()).to.be.true;
    });

    it('leaved the controller in the STOPPED state', function () {
      audioStreamController.state = State.STOPPED;
      audioStreamController.onAudioTrackSwitching(
        Events.AUDIO_TRACK_SWITCHING,
        audioTracks[0],
      );
      expect(audioStreamController.state).to.equal(State.STOPPED);
      expect(audioStreamController.hasInterval()).to.be.false;
    });
  });

  describe('onAudioTrackLoaded', function () {
    let mainLoadedData: LevelLoadedData;
    let trackLoadedData: AudioTrackLoadedData;
    const getPlaylistData = function (
      startSN: number,
      endSN: number,
      type: PlaylistLevelType,
      live: boolean,
    ) {
      const targetduration = 10;
      const fragments: Fragment[] = Array.from(new Array(endSN - startSN)).map(
        (u, i) => {
          const frag = new Fragment(type, '');
          frag.sn = i + startSN;
          frag.cc = Math.floor((i + startSN) / 10);
          frag.setStart(i * targetduration);
          frag.duration = targetduration;
          return frag;
        },
      );
      return {
        details: {
          live,
          advanced: true,
          updated: true,
          fragments,
          get endCC(): number {
            return fragments[fragments.length - 1].cc;
          },
          get startCC(): number {
            return fragments[0].cc;
          },
          targetduration,
          startSN,
          endSN,
        } as unknown as LevelDetails,
        id: 0,
        networkDetails: new Response('ok'),
        stats: new LoadStats(),
        deliveryDirectives: null,
      };
    };
    const getLevelLoadedData = function (
      startSN: number,
      endSN: number,
      live: boolean = false,
    ): LevelLoadedData {
      const data = getPlaylistData(
        startSN,
        endSN,
        PlaylistLevelType.MAIN,
        live,
      );
      const levelData: LevelLoadedData = {
        ...data,
        level: 0,
        levelInfo: new Level({ ...audioTracks[0] }),
      };
      return levelData;
    };
    const getTrackLoadedData = function (
      startSN: number,
      endSN: number,
      live: boolean = false,
    ): AudioTrackLoadedData {
      const data = getPlaylistData(
        startSN,
        endSN,
        PlaylistLevelType.AUDIO,
        live,
      );
      const audioTrackData: AudioTrackLoadedData = {
        ...data,
        groupId: 'audio',
        track: { ...audioTracks[0] },
      };
      return audioTrackData;
    };

    beforeEach(function () {
      sandbox.stub(audioStreamController, 'tick');
      sandbox.stub(audioStreamController.hls, 'trigger');
      mainLoadedData = getLevelLoadedData(0, 5);
      trackLoadedData = getTrackLoadedData(0, 5);
    });

    it('should update the audio track LevelDetails from the track loaded data', function () {
      audioStreamController.levels = tracks;
      audioStreamController.mainDetails = mainLoadedData.details;

      audioStreamController.onAudioTrackLoaded(
        Events.AUDIO_TRACK_LOADED,
        trackLoadedData,
      );

      expect(audioStreamController.levels[0].details).to.equal(
        trackLoadedData.details,
      );
      expect(audioStreamController.hls.trigger).to.have.been.calledWith(
        Events.AUDIO_TRACK_UPDATED,
        {
          details: trackLoadedData.details,
          id: 0,
          groupId: 'audio',
        },
      );
      expect(audioStreamController.tick).to.have.been.calledOnce;
    });

    it('waits for main level details before emitting track updated', function () {
      audioStreamController.levels = tracks;

      audioStreamController.onAudioTrackLoaded(
        Events.AUDIO_TRACK_LOADED,
        trackLoadedData,
      );

      expect(audioStreamController.hls.trigger).to.have.not.been.called;
      expect(audioStreamController.tick).to.have.not.been.called;
      expect(audioStreamController.levels[0].details).to.be.undefined;

      audioStreamController.onLevelLoaded(Events.LEVEL_LOADED, mainLoadedData);

      expect(audioStreamController.levels[0].details).to.equal(
        trackLoadedData.details,
      );
      expect(audioStreamController.hls.trigger).to.have.been.calledWith(
        Events.AUDIO_TRACK_UPDATED,
        {
          details: trackLoadedData.details,
          id: 0,
          groupId: 'audio',
        },
      );
      expect(audioStreamController.tick).to.have.been.calledOnce;
    });

    it('waits for main level details discontinuity domain before emitting track updated', function () {
      audioStreamController.levels = tracks;
      // Audio track ends on DISCONTINUITY-SEQUENCE 1 (main ends at 0)
      trackLoadedData = getTrackLoadedData(7, 12, true);
      mainLoadedData = getLevelLoadedData(1, 6, true);
      audioStreamController.mainDetails = {
        ...mainLoadedData.details,
      } as unknown as LevelDetails;

      expect(trackLoadedData.details.endCC).to.equal(1);
      expect(audioStreamController.mainDetails.endCC).to.equal(0);

      audioStreamController.onAudioTrackLoaded(
        Events.AUDIO_TRACK_LOADED,
        trackLoadedData,
      );

      expect(audioStreamController.hls.trigger).to.have.not.been.called;
      expect(audioStreamController.tick).to.have.not.been.called;
      expect(audioStreamController.levels[0].details).to.be.undefined;

      // Main update ending on DISCONTINUITY-SEQUENCE 1
      mainLoadedData = getLevelLoadedData(6, 11, true);

      audioStreamController.onLevelLoaded(Events.LEVEL_LOADED, mainLoadedData);

      expect(audioStreamController.mainDetails.endCC).to.equal(1);
      expect(audioStreamController.levels[0].details).to.equal(
        trackLoadedData.details,
      );
      expect(audioStreamController.hls.trigger).to.have.been.calledWith(
        Events.AUDIO_TRACK_UPDATED,
        {
          details: trackLoadedData.details,
          id: 0,
          groupId: 'audio',
        },
      );
      expect(audioStreamController.tick).to.have.been.calledOnce;
    });

    it('waits for recent live main level details before emitting track updated', function () {
      audioStreamController.levels = tracks;
      trackLoadedData.details.live = mainLoadedData.details.live = true;
      trackLoadedData.details.updated = mainLoadedData.details.updated = true;
      // Main live details are present but expired (see LevelDetails `get expired()` and `get age()`)
      audioStreamController.mainDetails = {
        ...mainLoadedData.details,
        expired: true,
      } as unknown as LevelDetails;

      audioStreamController.onAudioTrackLoaded(
        Events.AUDIO_TRACK_LOADED,
        trackLoadedData,
      );

      expect(audioStreamController.hls.trigger).to.have.not.been.called;
      expect(audioStreamController.tick).to.have.not.been.called;
      expect(audioStreamController.levels[0].details).to.be.undefined;

      // Main update - no longer expired
      audioStreamController.onLevelLoaded(Events.LEVEL_LOADED, mainLoadedData);

      expect(audioStreamController.levels[0].details).to.equal(
        trackLoadedData.details,
      );
      expect(audioStreamController.hls.trigger).to.have.been.calledWith(
        Events.AUDIO_TRACK_UPDATED,
        {
          details: trackLoadedData.details,
          id: 0,
          groupId: 'audio',
        },
      );
      expect(audioStreamController.tick).to.have.been.calledOnce;
    });

    it('aligns track with main level details before emitting track updated', function () {
      audioStreamController.levels = tracks;
      // Audio track ends on DISCONTINUITY-SEQUENCE 1 (main ends at 0)
      trackLoadedData = getTrackLoadedData(7, 12, true);
      mainLoadedData = getLevelLoadedData(1, 6, true);

      audioStreamController.mainDetails = {
        ...mainLoadedData.details,
      } as unknown as LevelDetails;

      expect(trackLoadedData.details.endCC).to.equal(1);
      expect(audioStreamController.mainDetails.endCC).to.equal(0);

      audioStreamController.onAudioTrackLoaded(
        Events.AUDIO_TRACK_LOADED,
        trackLoadedData,
      );

      // Main update - no longer expired, ending on DISCONTINUITY-SEQUENCE 1
      mainLoadedData = getLevelLoadedData(6, 11, true);
      adjustSlidingStart(60, mainLoadedData.details);

      expect(
        mainLoadedData.details.fragments[0].start,
        'main start before sync',
      ).to.equal(60);
      expect(
        trackLoadedData.details.fragments[0].start,
        'audio start before sync',
      ).to.equal(0);

      audioStreamController.onLevelLoaded(Events.LEVEL_LOADED, mainLoadedData);

      expect(
        audioStreamController.levels[0].details?.fragments[0].start,
        'audio start after sync',
      ).to.equal(70);

      expect(audioStreamController.hls.trigger).to.have.been.calledWith(
        Events.AUDIO_TRACK_UPDATED,
        {
          details: trackLoadedData.details,
          id: 0,
          groupId: 'audio',
        },
      );
      expect(audioStreamController.tick).to.have.been.calledOnce;
    });
  });

  describe('safety buffer logic', function () {
    let audioStreamController: AudioStreamController;
    let hls: Hls;
    let media: HTMLMediaElement;

    beforeEach(function () {
      const hlsConfig = { ...hlsDefaultConfig, safetyBufferFactor: 1.5 };
      hls = {
        trigger: sinon.spy(),
        config: hlsConfig,
        on: sinon.spy(),
        off: sinon.spy(),
        logger: {
          warn: sinon.spy(),
          log: sinon.spy(),
          info: sinon.spy(),
          debug: sinon.spy(),
          error: sinon.spy(),
          bind: function (name: string) {
            return {
              warn: sinon.spy(),
              log: sinon.spy(),
              info: sinon.spy(),
              debug: sinon.spy(),
              error: sinon.spy(),
            };
          },
        },
      };
      Object.setPrototypeOf(hls, Hls.prototype);

      const mediaElement: Partial<HTMLMediaElement> = {
        currentTime: 10.0,
      };
      media = mediaElement as HTMLMediaElement;

      const fragmentTracker: Partial<FragmentTracker> = {};
      const keyLoader: Partial<KeyLoader> = {};
      audioStreamController = new AudioStreamController(
        hls,
        fragmentTracker as FragmentTracker,
        keyLoader as KeyLoader,
      );
      (audioStreamController as any).media = media;
      (audioStreamController as any).config = hls.config;
    });

    describe('calculateTargetBufferTime', function () {
      beforeEach(function () {
        // Reset state for each test
        (audioStreamController as any).switchingTrack = null;
        (audioStreamController as any).flushing = false;
      });

      it('should return bufferInfoEnd when not switching tracks', function () {
        const targetTime = (
          audioStreamController as any
        ).calculateTargetBufferTime(15.0, 20.0);
        expect(targetTime).to.equal(20.0);
      });

      it('should return loadPosition when flushing', function () {
        (audioStreamController as any).flushing = true;

        const targetTime = (
          audioStreamController as any
        ).calculateTargetBufferTime(15.0, 20.0);
        expect(targetTime).to.equal(15.0);
      });

      it('should apply safety buffer during seamless track switching', function () {
        // Setup switching track with flushBuffer=false
        (audioStreamController as any).switchingTrack = {
          flushBuffer: false,
          id: 1,
          name: 'Test Track',
        };

        // Mock fragment tracker with recent fragments
        const mockFragments = [
          {
            stats: {
              loading: { start: 1000, end: 1100 },
              parsing: { start: 1100, end: 1120 },
              buffering: { start: 1120, end: 1150 },
            },
          },
          {
            stats: {
              loading: { start: 2000, end: 2200 },
              parsing: { start: 2200, end: 2240 },
              buffering: { start: 2240, end: 2300 },
            },
          },
        ];

        sinon
          .stub(audioStreamController as any, 'getRecentBufferedFrags')
          .returns(mockFragments);

        const targetTime = (
          audioStreamController as any
        ).calculateTargetBufferTime(15.0, 20.0);

        // Expected: avg processing time = (150ms + 300ms) / 2 = 225ms = 0.225s
        // Safety buffer = 0.225 * 1.5 = 0.3375s
        // Min target time = 10.0 + 0.3375 = 10.3375s
        // Result = min(20.0, 10.3375) = 10.3375s
        expect(targetTime).to.be.closeTo(10.3375, 0.01);
      });

      it('should return bufferInfoEnd when no recent fragments available during seamless switching', function () {
        (audioStreamController as any).switchingTrack = {
          flushBuffer: false,
          id: 1,
          name: 'Test Track',
        };

        sinon
          .stub(audioStreamController as any, 'getRecentBufferedFrags')
          .returns([]);

        const targetTime = (
          audioStreamController as any
        ).calculateTargetBufferTime(15.0, 20.0);
        expect(targetTime).to.equal(20.0);
      });

      it('should ignore safety buffer when flushBuffer=true', function () {
        (audioStreamController as any).switchingTrack = {
          flushBuffer: true,
          id: 1,
          name: 'Test Track',
        };

        const targetTime = (
          audioStreamController as any
        ).calculateTargetBufferTime(15.0, 20.0);
        expect(targetTime).to.equal(20.0);
      });
    });

    describe('getRecentBufferedFrags', function () {
      it('should return recent buffered fragments from fragment tracker', function () {
        const mockFragments = [
          { start: 0, end: 2 },
          { start: 2, end: 4 },
          { start: 4, end: 6 },
          { start: 6, end: 8 },
          { start: 8, end: 10 },
        ];

        const fragmentTracker = {
          getFragmentsInRange: sinon.stub().returns(mockFragments),
        };
        (audioStreamController as any).fragmentTracker = fragmentTracker;

        const result = (audioStreamController as any).getRecentBufferedFrags(
          10.0,
          3,
        );

        expect(fragmentTracker.getFragmentsInRange).to.have.been.calledWith(
          0,
          10.0,
          PlaylistLevelType.AUDIO,
        );
        expect(result).to.deep.equal([
          { start: 4, end: 6 },
          { start: 6, end: 8 },
          { start: 8, end: 10 },
        ]);
      });
    });

    describe('calculateAverageProcessingTimeSec', function () {
      it('should return 0 for empty fragments array', function () {
        const avgTime = (
          audioStreamController as any
        ).calculateAverageProcessingTimeSec([]);
        expect(avgTime).to.equal(0);
      });

      it('should calculate average processing time from fragment stats', function () {
        const fragments = [
          {
            stats: {
              loading: { start: 1000, end: 1100 }, // 100ms
              parsing: { start: 1100, end: 1120 }, // 20ms
              buffering: { start: 1120, end: 1150 }, // 30ms
            },
          },
          {
            stats: {
              loading: { start: 2000, end: 2300 }, // 300ms
              parsing: { start: 2300, end: 2350 }, // 50ms
              buffering: { start: 2350, end: 2400 }, // 50ms
            },
          },
        ];

        const avgTime = (
          audioStreamController as any
        ).calculateAverageProcessingTimeSec(fragments);

        // Fragment 1: 100 + 20 + 30 = 150ms
        // Fragment 2: 300 + 50 + 50 = 400ms
        // Average: (150 + 400) / 2 = 275ms = 0.275s
        expect(avgTime).to.equal(0.275);
      });

      it('should skip fragments without stats', function () {
        const fragments = [
          {
            stats: {
              loading: { start: 1000, end: 1200 }, // 200ms
              parsing: { start: 1200, end: 1220 }, // 20ms
              buffering: { start: 1220, end: 1250 }, // 30ms
            },
          },
          {}, // Fragment without stats
        ];

        const avgTime = (
          audioStreamController as any
        ).calculateAverageProcessingTimeSec(fragments);

        // Only first fragment: 200 + 20 + 30 = 250ms, but divided by 2 fragments = 125ms = 0.125s
        expect(avgTime).to.equal(0.125);
      });
    });

    describe('integration with track switching', function () {
      it('should use safety buffer when switchingTrack.flushBuffer is false', function () {
        (audioStreamController as any).switchingTrack = {
          flushBuffer: false,
          id: 1,
        };

        // Mock getRecentBufferedFrags to return fragments with stats
        const mockFragments = [
          {
            stats: {
              loading: { start: 1000, end: 1150 },
              parsing: { start: 1150, end: 1170 },
              buffering: { start: 1170, end: 1200 },
            },
          },
        ];
        sinon
          .stub(audioStreamController as any, 'getRecentBufferedFrags')
          .returns(mockFragments);

        // Call calculateTargetBufferTime directly to test safety buffer integration
        const targetTime = (
          audioStreamController as any
        ).calculateTargetBufferTime(15.0, 20.0);

        // Should apply safety buffer: avg time = 200ms = 0.2s, safety = 0.2 * 1.5 = 0.3s
        // Min target time = 10.0 + 0.3 = 10.3s, result = min(20.0, 10.3) = 10.3s
        expect(targetTime).to.be.closeTo(10.3, 0.01);
      });
    });
  });
});
