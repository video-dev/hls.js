import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { hlsDefaultConfig } from '../../../src/config';
import AudioStreamController from '../../../src/controller/audio-stream-controller';
import { State } from '../../../src/controller/base-stream-controller';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import KeyLoader from '../../../src/loader/key-loader';
import { LoadStats } from '../../../src/loader/load-stats';
import { Level } from '../../../src/types/level';
import { AttrList } from '../../../src/utils/attr-list';
import { adjustSlidingStart } from '../../../src/utils/discontinuities';
import type { Fragment } from '../../../src/loader/fragment';
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
    keyLoader = new KeyLoader(hlsDefaultConfig);
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
      type: 'audio' | 'main',
      live: boolean,
    ) {
      const targetduration = 10;
      const fragments: Fragment[] = Array.from(new Array(endSN - startSN)).map(
        (u, i) =>
          ({
            sn: i + startSN,
            cc: Math.floor((i + startSN) / 10),
            start: i * targetduration,
            duration: targetduration,
            type,
          }) as unknown as Fragment,
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
        networkDetails: {},
        stats: new LoadStats(),
        deliveryDirectives: null,
      };
    };
    const getLevelLoadedData = function (
      startSN: number,
      endSN: number,
      live: boolean = false,
    ): LevelLoadedData {
      const data = getPlaylistData(startSN, endSN, 'main', live);
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
      const data = getPlaylistData(startSN, endSN, 'audio', live);
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
});
