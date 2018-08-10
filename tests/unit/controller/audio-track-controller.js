const assert = require('assert');

import AudioTrackController from '../../../src/controller/audio-track-controller';
import Hls from '../../../src/hls';

describe('AudioTrackController', () => {
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

  beforeEach(() => {
    hls = new Hls();
    audioTrackController = new AudioTrackController(hls);
  });

  afterEach(() => {
    hls.destroy();
  });

  describe('onManifestLoading', () => {
    it('should reset the tracks list and current trackId', () => {
      audioTrackController.tracks = tracks;
      audioTrackController.onManifestLoading();
      assert.strictEqual(audioTrackController.tracks.length, 0);
    });
  });

  describe('onManifestParsed', () => {
    it('should set the audioTracks contained in the event data and trigger AUDIO_TRACKS_UPDATED', (done) => {
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
        assert.strictEqual(data.audioTracks, tracks);
        assert.strictEqual(audioTrackController.tracks, tracks);

        done();
      });

      audioTrackController.onManifestParsed({
        audioTracks: tracks
      });
    });

    it('should set the audioTracks contained in the event data (nullable) to an empty array and trigger AUDIO_TRACKS_UPDATED', (done) => {
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
        assert.strictEqual(data.audioTracks.length, 0);
        assert.strictEqual(audioTrackController.tracks.length, 0);
        done();
      });

      audioTrackController.onManifestParsed({
        audioTracks: null
      });
    });
  });

  describe('onAudioTrackLoaded', () => {
    it('should set the track details from the event data but not set the interval for a non-live track', () => {
      const details = {
        live: false,
        targetduration: 100
      };

      audioTrackController.tracks = tracks;

      audioTrackController.onAudioTrackLoaded({
        id: 0,
        details
      });

      assert.strictEqual(audioTrackController.tracks[0].details, details);
      assert.strictEqual(audioTrackController.hasInterval(), false);
    });

    it('should set the track details from the event data and set the interval for a live track', () => {
      const details = {
        live: true,
        targetduration: 100
      };

      audioTrackController.tracks = tracks;

      audioTrackController.onAudioTrackLoaded({
        id: 0,
        details
      });

      assert.strictEqual(audioTrackController.tracks[0].details, details);
      assert.strictEqual(audioTrackController.hasInterval(), true);
    });
  });

  describe('onAudioTrackSwitched', () => {
    it('should update the current audioGroupId', () => {
      const details = {
        live: true,
        targetduration: 100
      };

      audioTrackController.tracks = tracks;

      audioTrackController.audioGroupId = '2';

      audioTrackController.onAudioTrackSwitched({
        id: 1
      });

      assert.strictEqual(audioTrackController.audioGroupId, '1');
    });
  });

  describe('onLevelLoaded', () => {
    it('should reselect the current track and trigger AUDIO_TRACK_SWITCHING eventually', (done) => {
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
      assert.strictEqual(audioTrackController.audioGroupId, newGroupId);

      // name is still the same
      assert.strictEqual(tracks[audioTrackController.audioTrack].name, audioTrackName);
    });
  });

  describe('onError', () => {
    it('should clear interval (only) on fatal network errors', () => {
      audioTrackController.setInterval(1000);

      audioTrackController.onError({
        type: Hls.ErrorTypes.MEDIA_ERROR
      });

      assert.strictEqual(audioTrackController.hasInterval(), true);

      audioTrackController.onError({
        type: Hls.ErrorTypes.MEDIA_ERROR,
        fatal: true
      });

      assert.strictEqual(audioTrackController.hasInterval(), true);

      audioTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: false
      });

      assert.strictEqual(audioTrackController.hasInterval(), true);

      audioTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: true
      });

      // fatal network error clears interval
      assert.strictEqual(audioTrackController.hasInterval(), false);
    });

    it('should blacklist current track on fatal network error, and find a backup track (fallback mechanism)', () => {
      const currentTrackId = 4;

      audioTrackController._trackId = currentTrackId;

      audioTrackController.tracks = tracks;

      audioTrackController.onError({
        type: Hls.ErrorTypes.MEDIA_ERROR,
        fatal: true
      });

      assert.strictEqual(!!audioTrackController.trackIdBlacklist[currentTrackId], false);

      audioTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: true
      });

      assert.strictEqual(!!audioTrackController.trackIdBlacklist[currentTrackId], false);

      audioTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        details: Hls.ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
        fatal: true,
        context: {
          id: 'foobarLoaderContextId'
        }
      });

      assert.strictEqual(!!audioTrackController.trackIdBlacklist[currentTrackId], true);

      assert.strictEqual(audioTrackController.audioTrack, 1);
    });
  });
});
