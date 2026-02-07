import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { hlsDefaultConfig } from '../../../src/config';
import AudioStreamController from '../../../src/controller/audio-stream-controller';
import BaseStreamController, {
  State,
} from '../../../src/controller/base-stream-controller';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { Fragment } from '../../../src/loader/fragment';
import KeyLoader from '../../../src/loader/key-loader';
import { LevelDetails } from '../../../src/loader/level-details';
import { LoadStats } from '../../../src/loader/load-stats';
import { Level } from '../../../src/types/level';
import { PlaylistLevelType } from '../../../src/types/loader';
import { AttrList } from '../../../src/utils/attr-list';
import { adjustSlidingStart } from '../../../src/utils/discontinuities';
import type { MediaFragment } from '../../../src/loader/fragment';
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

use(sinonChai);

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

  function cloneLevelDetails(options: Partial<LevelDetails> & { url: string }) {
    return Object.assign(new LevelDetails(options.url), {
      ...options,
    });
  }

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
      const fragments: MediaFragment[] = Array.from(
        new Array(endSN - startSN),
      ).map((u, i) => {
        const frag = new Fragment(type, '') as MediaFragment;
        frag.sn = i + startSN;
        frag.cc = Math.floor((i + startSN) / 10);
        frag.setStart(i * targetduration);
        frag.duration = targetduration;
        return frag;
      });
      const details: LevelDetails = new LevelDetails('');
      details.live = live;
      details.advanced = true;
      details.updated = true;
      details.fragments = fragments;
      details.targetduration = targetduration;
      details.totalduration = targetduration * fragments.length;
      details.startSN = startSN;
      details.endSN = endSN;
      Object.defineProperty(details, 'startCC', {
        get: () => fragments[0].cc,
      });
      Object.defineProperty(details, 'endCC', {
        get: () => fragments[fragments.length - 1].cc,
      });
      return {
        details,
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
      audioStreamController.mainDetails = cloneLevelDetails(
        mainLoadedData.details,
      );

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
      audioStreamController.mainDetails = cloneLevelDetails(
        mainLoadedData.details,
      );

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
      audioStreamController.mainDetails = cloneLevelDetails({
        ...mainLoadedData.details,
        advancedDateTime: 1, // expired date time (must be > 0)
      });

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

      audioStreamController.mainDetails = mainLoadedData.details;

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

  describe('checkFragmentChanged', function () {
    beforeEach(function () {
      sandbox.stub(
        Object.getPrototypeOf(audioStreamController),
        'cleanupBackBuffer',
      );
    });

    it('should return false when super.checkFragmentChanged returns false', function () {
      sandbox
        .stub(BaseStreamController.prototype as any, 'checkFragmentChanged')
        .returns(false);
      expect((audioStreamController as any).checkFragmentChanged()).to.be.false;
    });

    it('should cleanup back buffer and complete audio switch when level changes', function () {
      const mockFrag = { level: 1, sn: 1 } as any;
      const previousFrag = { level: 0, sn: 0 } as any;
      const mockSwitchingTrack = { id: 1, name: 'Test' } as any;

      (audioStreamController as any).fragPlaying = previousFrag;
      (audioStreamController as any).switchingTrack = mockSwitchingTrack;

      sandbox
        .stub(BaseStreamController.prototype as any, 'checkFragmentChanged')
        .callsFake(function (this: any) {
          this.fragPlaying = mockFrag;
          return true;
        });

      sandbox.stub(audioStreamController.hls, 'trigger');

      const result = (audioStreamController as any).checkFragmentChanged();

      expect(result).to.be.true;
      expect((audioStreamController as any).cleanupBackBuffer).to.have.been
        .called;
      expect(audioStreamController.hls.trigger).to.have.been.calledWith(
        Events.AUDIO_TRACK_SWITCHED,
      );
    });

    it('should not complete audio switch when level has not changed', function () {
      const mockFrag = { level: 0, sn: 1 } as any;
      const previousFrag = { level: 0, sn: 0 } as any;
      const mockSwitchingTrack = { id: 0, name: 'Test' } as any;

      (audioStreamController as any).fragPlaying = previousFrag;
      (audioStreamController as any).switchingTrack = mockSwitchingTrack;

      sandbox
        .stub(BaseStreamController.prototype as any, 'checkFragmentChanged')
        .callsFake(function (this: any) {
          this.fragPlaying = mockFrag;
          return true;
        });

      sandbox.stub(audioStreamController.hls, 'trigger');

      const result = (audioStreamController as any).checkFragmentChanged();

      expect(result).to.be.true;
      expect(audioStreamController.hls.trigger).to.not.have.been.called;
    });
  });

  describe('audio track switching with flushImmediate flag', function () {
    beforeEach(function () {
      audioStreamController.levels = tracks;
      sandbox.stub(audioStreamController, 'nextLevelSwitch');
    });

    it('should call nextLevelSwitch when flushImmediate is false', function () {
      const trackData = {
        ...audioTracks[0],
        flushImmediate: false,
      };
      (audioStreamController as any).nextTrackId = -1;

      audioStreamController.onAudioTrackSwitching(
        Events.AUDIO_TRACK_SWITCHING,
        trackData,
      );

      expect((audioStreamController as any).nextTrackId).to.equal(0);
      expect(audioStreamController.nextLevelSwitch).to.have.been.called;
    });

    it('should not call nextLevelSwitch when flushImmediate is true', function () {
      const trackData = {
        ...audioTracks[0],
        flushImmediate: true,
      };

      audioStreamController.onAudioTrackSwitching(
        Events.AUDIO_TRACK_SWITCHING,
        trackData,
      );

      expect(audioStreamController.nextLevelSwitch).to.not.have.been.called;
    });
  });

  describe('getLoadPosition with flushImmediate', function () {
    beforeEach(function () {
      (audioStreamController as any).startFragRequested = false;
      (audioStreamController as any).nextLoadPosition = 10;
    });

    it('should return nextLoadPosition when flushImmediate is not false', function () {
      (audioStreamController as any).switchingTrack = {
        flushImmediate: true,
      };
      expect((audioStreamController as any).getLoadPosition()).to.equal(10);
    });

    it('should call super.getLoadPosition when flushImmediate is false', function () {
      (audioStreamController as any).switchingTrack = {
        flushImmediate: false,
      };
      sandbox
        .stub(Object.getPrototypeOf(audioStreamController), 'getLoadPosition')
        .returns(5);
      expect((audioStreamController as any).getLoadPosition()).to.equal(5);
    });
  });
});
