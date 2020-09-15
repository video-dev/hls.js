import AudioTrackController from '../../../src/controller/audio-track-controller';
import Hls from '../../../src/hls';
import { Events } from '../../../src/events';

const sinon = require('sinon');

describe('AudioTrackController', function () {
  const tracks = [{
    groupId: '1',
    id: 0,
    default: true,
    name: 'A'
  }, {
    groupId: '1',
    id: 1,
    default: false,
    name: 'B'
  }, {
    groupId: '1',
    id: 2,
    name: 'C'
  }, {
    groupId: '2',
    id: 0,
    default: true,
    name: 'A'
  }, {
    groupId: '2',
    id: 1,
    default: false,
    name: 'B'
  }, {
    groupId: '3',
    id: 2,
    name: 'C'
  }];

  let hls;
  let audioTrackController;

  beforeEach(function () {
    hls = new Hls();
    audioTrackController = new AudioTrackController(hls);
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

  describe('onManifestParsed', function () {
    it('should set the audioTracks contained in the event data and trigger AUDIO_TRACKS_UPDATED', function (done) {
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
        expect(data.audioTracks).to.equal(tracks);
        expect(audioTrackController.tracks).to.equal(tracks);
        done();
      });

      audioTrackController.onManifestParsed(Events.MANIFEST_PARSED, {
        audioTracks: tracks
      });
    });

    it('should set the audioTracks contained in the event data (nullable) to an empty array and trigger AUDIO_TRACKS_UPDATED', function (done) {
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
        expect(data.audioTracks).to.be.empty;
        expect(audioTrackController.tracks).to.be.empty;
        done();
      });

      audioTrackController.onManifestParsed(Events.MANIFEST_PARSED, {
        audioTracks: null
      });
    });
  });

  it('should select audioGroupId and trigger AUDIO_TRACK_SWITCHING', function (done) {
    hls.on(Hls.Events.AUDIO_TRACK_SWITCHING, (event, data) => {
      done();
    });

    const levels = [
      {
        urlId: 1,
        audioGroupIds: ['1', '2']
      }
    ];

    hls.levelController = {
      levels
    };

    const newLevelInfo = levels[0];
    const newGroupId = newLevelInfo.audioGroupIds[newLevelInfo.urlId];

    audioTrackController.audioGroupId = '1';
    audioTrackController.tracks = tracks;
    audioTrackController.audioTrack = 2;

    // current track name
    const audioTrackName = tracks[audioTrackController.audioTrack].name;

    audioTrackController.onManifestParsed({
      audioTracks: tracks
    });

    // group has switched
    expect(audioTrackController.audioGroupId).to.equal(newGroupId);
    // name is still the same
    expect(tracks[audioTrackController.audioTrack].name).to.equal(audioTrackName);
  });

  describe('shouldLoadTrack', function () {
    it('should not need loading because the audioTrack is embedded in the main playlist', function () {
      audioTrackController.canLoad = true;
      expect(audioTrackController.shouldLoadTrack({ details: { live: true } })).to.be.false;
      expect(audioTrackController.shouldLoadTrack({ details: null })).to.be.false;
    });

    it('should need loading because the track has not been loaded yet', function () {
      audioTrackController.canLoad = true;
      expect(audioTrackController.shouldLoadTrack({ details: { live: true }, url: 'http://example.com/manifest.m3u8' }), 1).to.be.true;
      expect(audioTrackController.shouldLoadTrack({ details: null, url: 'http://example.com/manifest.m3u8' }), 2).to.be.true;
    });
  });

  describe('onAudioTrackSwitched', function () {
    it('should update the current audioGroupId', function () {
      audioTrackController.tracks = tracks;
      audioTrackController.audioGroupId = '2';
      audioTrackController.onAudioTrackSwitched(Events.AUDIO_TRACK_SWITCHED, {
        id: 1
      });

      expect(audioTrackController.audioGroupId).to.equal('1');
    });
  });

  describe('onLevelLoading', function () {
    it('should reselect the current track and trigger AUDIO_TRACK_SWITCHING eventually', function (done) {
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHING, (event, data) => {
        done();
      });

      const levels = [
        {
          urlId: 1,
          audioGroupIds: ['1', '2']
        }
      ];

      hls.levelController = {
        levels
      };

      const levelLoadedEvent = {
        level: 0
      };

      const newLevelInfo = levels[levelLoadedEvent.level];
      const newGroupId = newLevelInfo.audioGroupIds[newLevelInfo.urlId];

      audioTrackController.audioGroupId = '1'; // previous group ID
      audioTrackController.tracks = tracks;
      audioTrackController.audioTrack = 2;

      // current track name
      const audioTrackName = tracks[audioTrackController.audioTrack].name;

      audioTrackController.onLevelLoading(Events.LEVEL_LOADING, levelLoadedEvent);

      // group has switched
      expect(audioTrackController.audioGroupId).to.equal(newGroupId);
      // name is still the same
      expect(tracks[audioTrackController.audioTrack].name).to.equal(audioTrackName);
    });

    it('should load audio tracks with a url', function () {
      const shouldLoadTrack = sinon.spy(audioTrackController, 'shouldLoadTrack');
      const audioTrackLoadingCallback = sinon.spy();
      const trackWithUrl = {
        groupId: '1',
        id: 0,
        name: 'A',
        default: true,
        url: './trackA.m3u8'
      };

      hls.on(Hls.Events.AUDIO_TRACK_LOADING, audioTrackLoadingCallback);

      hls.levelController = {
        levels: [{
          urlId: 0,
          audioGroupIds: ['1']
        }]
      };

      audioTrackController.tracks = [trackWithUrl];

      audioTrackController.onLevelLoading(Events.LEVEL_LOADING, {
        level: 0
      });
      audioTrackController.startLoad();

      expect(shouldLoadTrack).to.have.been.calledTwice;
      expect(shouldLoadTrack).to.have.been.calledWith(trackWithUrl);
      expect(shouldLoadTrack.firstCall.returnValue, false,
        'expected shouldLoadTrack to return false before startLoad() is called');
      expect(shouldLoadTrack.secondCall.returnValue, true,
        'expected shouldLoadTrack to return true after startLoad() is called');

      expect(audioTrackLoadingCallback).to.have.been.calledOnce;
    });

    it('should not attempt to load audio tracks without a url', function () {
      const shouldLoadTrack = sinon.spy(audioTrackController, 'shouldLoadTrack');
      const audioTrackLoadingCallback = sinon.spy();
      const trackWithOutUrl = tracks[0];

      hls.on(Hls.Events.AUDIO_TRACK_LOADING, audioTrackLoadingCallback);

      hls.levelController = {
        levels: [{
          urlId: 0,
          audioGroupIds: ['1']
        }]
      };

      audioTrackController.tracks = tracks;

      audioTrackController.onLevelLoading(Events.LEVEL_LOADING, {
        level: 0
      });
      audioTrackController.startLoad();

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
        type: Hls.ErrorTypes.MEDIA_ERROR
      });

      expect(audioTrackController.timer).to.equal(1000);
      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.MEDIA_ERROR,
        fatal: true
      });

      expect(audioTrackController.timer).to.equal(1000);
      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: false
      });

      expect(audioTrackController.timer).to.equal(1000);
      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: true
      });

      // fatal network error clears interval
      expect(audioTrackController.timer).to.equal(-1);
    });

    it('should disable current track on network error, if a backup track is found (fallback mechanism)', function () {
      const currentTrackId = 0;
      audioTrackController.trackId = currentTrackId;
      audioTrackController.tracks = [{
        groupId: '1',
        id: 0,
        default: true,
        name: 'Alt'
      }, {
        groupId: '1',
        id: 1,
        default: false,
        name: 'Alt'
      }, {
        groupId: '1',
        id: 2,
        name: 'Alt'
      }];

      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.MEDIA_ERROR,
        fatal: true
      });
      expect(!!audioTrackController.restrictedTracks[currentTrackId], 'does not disable track after media error').to.be.false;

      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: true
      });
      expect(!!audioTrackController.restrictedTracks[currentTrackId], 'does not disable track misc network error').to.be.false;

      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.NETWORK_ERROR,
        details: Hls.ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
        fatal: false,
        context: { id: 0 }
      });

      const newTrackId = 1;
      expect(audioTrackController.audioTrack, 'track index/id switches from 0 to 1').to.equal(newTrackId);
      expect(!!audioTrackController.restrictedTracks[currentTrackId], 'disables track after audio track loading network error').to.be.true;

      audioTrackController.restrictedTracks[newTrackId] = false;
      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.NETWORK_ERROR,
        details: Hls.ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT,
        fatal: false,
        context: { id: 1 }
      });
      expect(audioTrackController.audioTrack, 'track index/id switches from 1 to 2').to.equal(2);
      expect(!!audioTrackController.restrictedTracks[newTrackId], 'disables track after audio track loading timeout error').to.be.true;
    });

    it('should not disable current track on network error, if a backup track is not found', function () {
      const currentTrackId = 4;
      audioTrackController.trackId = currentTrackId;
      audioTrackController.tracks = tracks;

      audioTrackController.onError(Events.ERROR, {
        type: Hls.ErrorTypes.NETWORK_ERROR,
        details: Hls.ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
        fatal: false,
        context: { id: 0 }
      });
      expect(audioTrackController.audioTrack, 'track index/id is not changed as there is no redundant track to choose from').to.equal(4);
      expect(!!audioTrackController.restrictedTracks[currentTrackId], 'disables track after audio track loading network error').to.be.false;
    });
  });
});
