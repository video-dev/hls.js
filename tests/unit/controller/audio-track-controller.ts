import AudioTrackController from '../../../src/controller/audio-track-controller';
import Hls, { MediaPlaylist } from '../../../src/hls';
import { AttrList } from '../../../src/utils/attr-list';
import { LevelDetails } from '../../../src/loader/level-details';
import { Events } from '../../../src/events';

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import { PlaylistContextType } from '../../../src/types/loader';

chai.use(sinonChai);
const expect = chai.expect;

describe('AudioTrackController', function () {
  const tracks: MediaPlaylist[] = [
    {
      attrs: new AttrList({}),
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
      attrs: new AttrList({}),
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
      attrs: new AttrList({}),
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
      attrs: new AttrList({}),
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
      attrs: new AttrList({}),
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
      attrs: new AttrList({}),
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

  let hls; //: Hls;
  let audioTrackController; //: AudioTrackController;

  const levels = [
    {
      urlId: 1,
      audioGroupIds: ['1', '2'],
    },
  ];

  beforeEach(function () {
    hls = new Hls();
    audioTrackController = new AudioTrackController(hls);
    hls.levelController = {
      levels,
    };
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
    it('should set the audioTracks contained in the event data and trigger AUDIO_TRACKS_UPDATED', function () {
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
        }
      );
    });
  });

  it('should select audioGroupId and trigger AUDIO_TRACK_SWITCHING', function (done) {
    hls.on(Hls.Events.AUDIO_TRACK_SWITCHING, (event, data) => {
      done();
    });

    const newLevelInfo = levels[0];
    const newGroupId = newLevelInfo.audioGroupIds[newLevelInfo.urlId];

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
    expect(audioTrackController.groupId).to.equal(newGroupId);
    // name is still the same
    expect(tracks[audioTrackController.audioTrack].name).to.equal(
      audioTrackName
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
      'AUDIO_TRACK_SWITCHING to initial track 0'
    ).to.have.been.calledOnce;

    audioTrackController.onAudioTrackLoaded(Events.AUDIO_TRACK_LOADED, {
      details: new LevelDetails(''),
      id: 0,
      groupId: '1',
      networkDetails: null,
      stats: { loading: {} },
      deliveryDirectives: null,
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
      groupId: '1',
      networkDetails: null,
      stats: { loading: {} },
      deliveryDirectives: null,
    });
    expect(audioTrackController.tracksInGroup[1], 'tracksInGroup[1]')
      .to.have.property('details')
      .which.is.an('object');

    audioTrackController.audioTrack = 0;
    expect(audioTrackSwitchingCallback, 'AUDIO_TRACK_SWITCHING back to track 0')
      .to.have.been.calledThrice;
  });

  describe('shouldLoadTrack', function () {
    it('should not need loading because the audioTrack is embedded in the main playlist', function () {
      audioTrackController.canLoad = true;
      expect(audioTrackController.shouldLoadTrack({ details: { live: true } }))
        .to.be.false;
      expect(audioTrackController.shouldLoadTrack({ details: undefined })).to.be
        .false;
    });

    it('should need loading because the track has not been loaded yet', function () {
      audioTrackController.canLoad = true;
      expect(
        audioTrackController.shouldLoadTrack({
          details: { live: true },
          url: 'http://example.com/manifest.m3u8',
        }),
        'track 1'
      ).to.be.true;

      expect(
        audioTrackController.shouldLoadTrack({
          details: null,
          url: 'http://example.com/manifest.m3u8',
        }),
        'track 2'
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

      const newLevelInfo = levels[levelLoadedEvent.level];
      const newGroupId = newLevelInfo.audioGroupIds[newLevelInfo.urlId];

      audioTrackController.tracks = tracks;
      audioTrackController.onLevelLoading(Events.LEVEL_LOADING, {
        level: 0,
      });
      audioTrackController.audioTrack = 2;

      // current track name
      const audioTrackName = tracks[audioTrackController.audioTrack].name;

      audioTrackController.onLevelLoading(
        Events.LEVEL_LOADING,
        levelLoadedEvent
      );

      // group has switched
      expect(audioTrackController.groupId).to.equal(newGroupId);
      // name is still the same
      expect(tracks[audioTrackController.audioTrack].name).to.equal(
        audioTrackName
      );
    });

    it('should load audio tracks with a url', function () {
      const shouldLoadTrack = sinon.spy(
        audioTrackController,
        'shouldLoadTrack'
      );
      const audioTrackLoadingCallback = sinon.spy();
      const trackWithUrl = {
        groupId: '1',
        id: 0,
        name: 'A',
        default: true,
        url: './trackA.m3u8',
      };

      hls.on(Hls.Events.AUDIO_TRACK_LOADING, audioTrackLoadingCallback);

      hls.levelController = {
        levels: [
          {
            urlId: 0,
            audioGroupIds: ['1'],
          },
        ],
      };

      audioTrackController.tracks = [trackWithUrl];

      audioTrackController.onLevelLoading(Events.LEVEL_LOADING, {
        level: 0,
      });
      audioTrackController.startLoad();

      expect(shouldLoadTrack).to.have.been.calledTwice;
      expect(shouldLoadTrack).to.have.been.calledWith(trackWithUrl);
      expect(
        shouldLoadTrack.firstCall.returnValue,
        'expected shouldLoadTrack to return false before startLoad() is called'
      ).to.be.false;
      expect(
        shouldLoadTrack.secondCall.returnValue,
        'expected shouldLoadTrack to return true after startLoad() is called'
      ).to.be.true;

      expect(audioTrackLoadingCallback).to.have.been.calledOnce;
    });

    it('should not attempt to load audio tracks without a url', function () {
      const shouldLoadTrack = sinon.spy(
        audioTrackController,
        'shouldLoadTrack'
      );
      const audioTrackLoadingCallback = sinon.spy();
      const trackWithOutUrl = tracks[0];

      hls.on(Hls.Events.AUDIO_TRACK_LOADING, audioTrackLoadingCallback);

      hls.levelController = {
        levels: [
          {
            urlId: 0,
            audioGroupIds: ['1'],
          },
        ],
      };

      audioTrackController.tracks = tracks;

      audioTrackController.onLevelLoading(Events.LEVEL_LOADING, {
        level: 0,
      });
      audioTrackController.startLoad(0);

      expect(shouldLoadTrack).to.have.been.calledTwice;
      expect(shouldLoadTrack).to.have.been.calledWith(trackWithOutUrl);
      expect(shouldLoadTrack.firstCall.returnValue).to.be.false;
      expect(shouldLoadTrack.secondCall.returnValue).to.be.false;
      expect(audioTrackLoadingCallback).to.not.have.been.called;
    });
  });

  describe('onError', function () {
    it('should clear interval (only) on fatal network errors', function () {
      audioTrackController.timer = 1000;

      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.MEDIA_ERROR,
      });
      expect(audioTrackController.timer).to.equal(1000);

      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.MEDIA_ERROR,
        fatal: true,
      });
      expect(audioTrackController.timer).to.equal(1000);

      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: false,
      });
      expect(audioTrackController.timer).to.equal(1000);

      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: true,
      });
      expect(audioTrackController.timer).to.equal(-1);
    });

    it('should retry track loading if track has not changed', function () {
      const retryLoadingOrFail = sinon.spy(
        audioTrackController,
        'retryLoadingOrFail'
      );
      const currentTrackId = 4;
      const currentGroupId = 'aac';
      audioTrackController.trackId = currentTrackId;
      audioTrackController.groupId = currentGroupId;
      audioTrackController.tracks = tracks;

      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.NETWORK_ERROR,
        details: Hls.ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
        fatal: false,
        context: {
          type: PlaylistContextType.AUDIO_TRACK,
          id: currentTrackId,
          groupId: currentGroupId,
        },
      });
      expect(
        audioTrackController.audioTrack,
        'track index/id is not changed as there is no redundant track to choose from'
      ).to.equal(4);
      expect(retryLoadingOrFail).to.have.been.calledOnce;
    });
  });
});
