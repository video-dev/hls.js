import chai from 'chai';
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
import type { Fragment } from '../../../src/loader/fragment';
import type { LevelDetails } from '../../../src/loader/level-details';
import type {
  AudioTrackLoadedData,
  AudioTrackSwitchingData,
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
  'levels' | 'mainDetails' | 'onAudioTrackSwitching' | 'onAudioTrackLoaded'
> & {
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
  const tracks: Level[] = audioTracks.map((parsedLevel) => {
    const level = new Level(parsedLevel);
    return level;
  });

  let hls: Hls;
  let fragmentTracker: FragmentTracker;
  let keyLoader: KeyLoader;
  let audioStreamController: AudioStreamControllerTestable;

  beforeEach(function () {
    hls = new Hls();
    fragmentTracker = new FragmentTracker(hls);
    keyLoader = new KeyLoader(hlsDefaultConfig);
    audioStreamController = new AudioStreamController(
      hls,
      fragmentTracker,
      keyLoader,
    ) as unknown as AudioStreamControllerTestable;
  });

  afterEach(function () {
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
    it('should update the level details from the event data', function () {
      const trackLoadedData: AudioTrackLoadedData = {
        id: 0,
        groupId: 'audio',
        stats: new LoadStats(),
        deliveryDirectives: null,
        networkDetails: {},
        details: {
          live: false,
          get fragments() {
            const frags: Fragment[] = [];
            for (let i = 0; i < this.endSN; i++) {
              frags.push({ sn: i, type: 'main' } as unknown as Fragment);
            }
            return frags;
          },
          targetduration: 100,
        } as unknown as LevelDetails,
      };

      audioStreamController.levels = tracks;
      audioStreamController.mainDetails = trackLoadedData.details;
      audioStreamController.tick = () => {};

      audioStreamController.onAudioTrackLoaded(
        Events.AUDIO_TRACK_LOADED,
        trackLoadedData,
      );

      expect(audioStreamController.levels[0].details).to.equal(
        trackLoadedData.details,
      );
    });
  });
});
