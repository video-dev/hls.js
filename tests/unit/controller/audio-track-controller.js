import AudioTrackController from '../../../src/controller/audio-track-controller';
import Hls from '../../../src/hls';

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

      audioTrackController.onManifestParsed({
        audioTracks: tracks
      });
    });

    it('should set the audioTracks contained in the event data (nullable) to an empty array and trigger AUDIO_TRACKS_UPDATED', function (done) {
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
        expect(data.audioTracks).to.be.empty;
        expect(audioTrackController.tracks).to.be.empty;
        done();
      });

      audioTrackController.onManifestParsed({
        audioTracks: null
      });
    });
  });

  describe('_needsTrackLoading', function () {
    it('should not need loading because the audioTrack is embedded in the main playlist', function () {
      expect(audioTrackController._needsTrackLoading({ details: { live: true } })).to.be.false;
      expect(audioTrackController._needsTrackLoading({ details: null })).to.be.false;
    });

    it('should need loading because the track has not been loaded yet', function () {
      expect(audioTrackController._needsTrackLoading({ details: { live: true }, url: 'http://example.com/manifest.m3u8' })).to.be.true;
      expect(audioTrackController._needsTrackLoading({ details: null, url: 'http://example.com/manifest.m3u8' })).to.be.true;
    });
  });

  describe('onAudioTrackLoaded', function () {
    it('should set the track details from the event data but not set the interval for a non-live track', function () {
      const details = {
        live: false,
        targetduration: 100
      };

      audioTrackController.tracks = tracks;

      audioTrackController.onAudioTrackLoaded({
        id: 0,
        details
      });

      expect(audioTrackController.tracks[0].details).to.equal(details);
      expect(audioTrackController.hasInterval()).to.be.false;
    });

    it('should set the track details from the event data and set the interval for a live track', function () {
      const details = {
        live: true,
        targetduration: 100
      };

      audioTrackController.tracks = tracks;

      audioTrackController.onAudioTrackLoaded({
        id: 0,
        details
      });

      expect(audioTrackController.tracks[0].details).to.equal(details);
      expect(audioTrackController.hasInterval()).to.be.true;
    });
  });

  describe('onAudioTrackSwitched', function () {
    it('should update the current audioGroupId', function () {
      audioTrackController.tracks = tracks;
      audioTrackController.audioGroupId = '2';
      audioTrackController.onAudioTrackSwitched({
        id: 1
      });

      expect(audioTrackController.audioGroupId).to.equal('1');
    });
  });

  describe('onLevelLoaded', function () {
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

      audioTrackController.onLevelLoaded(levelLoadedEvent);

      // group has switched
      expect(audioTrackController.audioGroupId).to.equal(newGroupId);
      // name is still the same
      expect(tracks[audioTrackController.audioTrack].name).to.equal(audioTrackName);
    });

    it('should load audio tracks with a url', function () {
      const needsTrackLoading = sinon.spy(audioTrackController, '_needsTrackLoading');
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

      audioTrackController.onLevelLoaded({
        level: 0
      });

      expect(needsTrackLoading).to.have.been.calledOnce;
      expect(needsTrackLoading).to.have.been.calledWith(trackWithUrl);
      expect(needsTrackLoading.firstCall.returnValue).to.be.true;
      expect(audioTrackLoadingCallback).to.have.been.calledOnce;
    });

    it('should not attempt to load audio tracks without a url', function () {
      const needsTrackLoading = sinon.spy(audioTrackController, '_needsTrackLoading');
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

      audioTrackController.onLevelLoaded({
        level: 0
      });

      expect(needsTrackLoading).to.have.been.calledOnce;
      expect(needsTrackLoading).to.have.been.calledWith(trackWithOutUrl);
      expect(needsTrackLoading.firstCall.returnValue).to.be.false;
      expect(audioTrackLoadingCallback).to.not.have.been.called;
    });

    it('should load audio tracks with a url', function () {
      const needsTrackLoading = sinon.spy(audioTrackController, '_needsTrackLoading');
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

      audioTrackController.onLevelLoaded({
        level: 0
      });

      expect(needsTrackLoading).to.have.been.calledOnce;
      expect(needsTrackLoading).to.have.been.calledWith(trackWithUrl);
      expect(needsTrackLoading.firstCall.returnValue, true, 'expected _needsTrackLoading to return true');

      expect(audioTrackLoadingCallback).to.have.been.calledOnce;
    });

    it('should not attempt to load audio tracks without a url', function () {
      const needsTrackLoading = sinon.spy(audioTrackController, '_needsTrackLoading');
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

      audioTrackController.onLevelLoaded({
        level: 0
      });

      expect(needsTrackLoading).to.have.been.calledOnce;
      expect(needsTrackLoading).to.have.been.calledWith(trackWithOutUrl);
      expect(needsTrackLoading.firstCall.returnValue).to.be.false;

      expect(audioTrackLoadingCallback).to.not.have.been.called;
    });
  });

  describe('onError', function () {
    it('should clear interval (only) on fatal network errors', function () {
      audioTrackController.setInterval(1000);

      audioTrackController.onError({
        type: Hls.ErrorTypes.MEDIA_ERROR
      });

      expect(audioTrackController.hasInterval()).to.be.true;
      audioTrackController.onError({
        type: Hls.ErrorTypes.MEDIA_ERROR,
        fatal: true
      });

      expect(audioTrackController.hasInterval()).to.be.true;
      audioTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: false
      });

      expect(audioTrackController.hasInterval()).to.be.true;
      audioTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: true
      });

      // fatal network error clears interval
      expect(audioTrackController.hasInterval()).to.be.false;
    });

    it('should blacklist current track on fatal network error, and find a backup track (fallback mechanism)', function () {
      const currentTrackId = 4;
      audioTrackController._trackId = currentTrackId;
      audioTrackController.tracks = tracks;
      audioTrackController.onError({
        type: Hls.ErrorTypes.MEDIA_ERROR,
        fatal: true
      });

      expect(!!audioTrackController.trackIdBlacklist[currentTrackId]).to.be.false;
      audioTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: true
      });

      expect(!!audioTrackController.trackIdBlacklist[currentTrackId]).to.be.false;
      audioTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        details: Hls.ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
        fatal: true,
        context: {
          id: 'foobarLoaderContextId'
        }
      });

      expect(!!audioTrackController.trackIdBlacklist[currentTrackId]).to.be.true;
      expect(audioTrackController.audioTrack).to.equal(1);
    });
  });
});
