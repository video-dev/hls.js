function() function() function() function() function(import SubtitleTrackController from '../../../src/controller/subtitle-track-controller';
import { Observer } from '../../../src/observer';
import Hls from '../../../src/hls';
import sinon from 'sinon';

describe('SubtitleTrackController', function () {
  let subtitleTrackController;
  let videoElement;
  let sandbox;

  const fakeTracks = [
    { id: 0, url: 'baz', details: { live: false }, groupId: 'B', name: 'Foo' },
    { id: 1, url: 'bar', groupId: 'B', name: 'Bar' },
    { id: 2, details: { live: true }, url: 'foo', groupId: 'A', name: 'Foo' },
    { id: 3, details: { live: true }, url: 'foo', groupId: 'A', name: 'Bar' }
  ];

  beforeEach(() => {
    const hls = new Observer();

    videoElement = document.createElement('video');
    subtitleTrackController = new SubtitleTrackController(hls);
    subtitleTrackController.media = videoElement;
    subtitleTrackController.tracks = fakeTracks;

    const textTrack1 = videoElement.addTextTrack('subtitles', 'English', 'en');
    const textTrack2 = videoElement.addTextTrack('subtitles', 'Swedish', 'se');

    textTrack1.mode = 'disabled';
    textTrack2.mode = 'disabled';
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('constructor', function () {
    it('defaults stopped to true', function () {
      expect(subtitleTrackController.stopped).to.be.true;
    });
  });

  describe('onSubtitleTrackSwitch', () => {
    it('should set subtitleTrack to -1 if disabled', () => {
      assert.strictEqual(subtitleTrackController.subtitleTrack, -1);

      videoElement.textTracks[0].mode = 'disabled';
      subtitleTrackController._onTextTracksChanged();

      expect(subtitleTrackController.subtitleTrack).to.equal(-1);
    });

    it('should set subtitleTrack to 0 if hidden', function () {
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

      videoElement.textTracks[0].mode = 'hidden';
      subtitleTrackController._onTextTracksChanged();

      expect(subtitleTrackController.subtitleTrack).to.equal(0);
    });

    it('should set subtitleTrack to 0 if showing', function () {
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

      videoElement.textTracks[0].mode = 'showing';
      subtitleTrackController._onTextTracksChanged();

      expect(subtitleTrackController.subtitleTrack).to.equal(0);
    });
  });

  describe('set subtitleTrack', function () {
    it('should set active text track mode to showing', function () {
      videoElement.textTracks[0].mode = 'disabled';

      subtitleTrackController.subtitleDisplay = true;
      subtitleTrackController.subtitleTrack = 0;

      expect(videoElement.textTracks[0].mode).to.equal('showing');
    });

    it('should set active text track mode to hidden', function () {
      videoElement.textTracks[0].mode = 'disabled';
      subtitleTrackController.subtitleDisplay = false;
      subtitleTrackController.subtitleTrack = 0;

      expect(videoElement.textTracks[0].mode).to.equal('hidden');
    });

    it('should disable previous track', function () {
      // Change active track without triggering setSubtitleTrackInternal
      subtitleTrackController.trackId = 0;
      // Change active track and trigger setSubtitleTrackInternal
      subtitleTrackController.subtitleTrack = 1;

      expect(videoElement.textTracks[0].mode).to.equal('disabled');
    });

    it('should trigger SUBTITLE_TRACK_SWITCH', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 1;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.firstCall).to.have.been.calledWith('hlsSubtitleTrackSwitch', { id: 1 });
    });

    it('should trigger SUBTITLE_TRACK_LOADING if the track has no details', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 1;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.secondCall).to.have.been.calledWith('hlsSubtitleTrackLoading', { url: 'bar', id: 1 });
    });

    it('should not trigger SUBTITLE_TRACK_LOADING if the track has details and is not live', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 1;
      subtitleTrackController.subtitleTrack = 0;

      expect(triggerSpy).to.have.been.calledOnce;
      expect(triggerSpy.firstCall).to.have.been.calledWith('hlsSubtitleTrackSwitch', { id: 0 });
    });

    it('should trigger SUBTITLE_TRACK_SWITCH if passed -1', function () {
      const stopTimerSpy = sinon.spy(subtitleTrackController, 'clearInterval');
      const triggerSpy = sinon.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = -1;

      expect(triggerSpy.firstCall).to.have.been.calledWith('hlsSubtitleTrackSwitch', { id: -1 });
    });

    it('should trigger SUBTITLE_TRACK_LOADING if the track is live, even if it has details', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 2;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.secondCall).to.have.been.calledWith('hlsSubtitleTrackLoading', { url: 'foo', id: 2 });
    });

    it('should do nothing if called with out of bound indicies', function () {
      const stopTimerSpy = sinon.spy(subtitleTrackController, 'clearInterval');
      subtitleTrackController.subtitleTrack = 5;
      subtitleTrackController.subtitleTrack = -2;

      expect(clearReloadSpy).to.have.not.been.called;
    });

    it('should do nothing if called with a non-number', function () {
      subtitleTrackController.subtitleTrack = undefined;
      subtitleTrackController.subtitleTrack = null;
    });

    describe('_toggleTrackModes', function () {
      // This can be the case when setting the subtitleTrack before Hls.js attaches to the mediaElement
      it('should not throw an exception if trackId is out of the mediaElement text track bounds', function () {
        subtitleTrackController.trackId = 3;
        subtitleTrackController._toggleTrackModes(1);
      });

      it('should disable all textTracks if called with -1', function () {
        [].slice.call(videoElement.textTracks).forEach(t => {
          t.mode = 'showing';
        });
        subtitleTrackController._toggleTrackModes(-1);
        [].slice.call(videoElement.textTracks).forEach(t => {
          expect(t.mode).to.equal('disabled');
        });
      });

      it('should not throw an exception if the mediaElement does not exist', function () {
        subtitleTrackController.media = null;
        subtitleTrackController._toggleTrackModes(1);
      });
    });

    describe('onSubtitleTrackLoaded', function () {
      it('exits early if the loaded track does not match the requested track', function () {
        const tracks = subtitleTrackController.tracks;
        const clearReloadSpy = sandbox.spy(subtitleTrackController, '_clearReloadTimer');
        subtitleTrackController.trackId = 1;

        let mockLoadedEvent = { id: 999, details: { foo: 'bar' } };
        subtitleTrackController.onSubtitleTrackLoaded(mockLoadedEvent);
        expect(subtitleTrackController.timer).to.not.exist;
        expect(clearReloadSpy).to.have.been.calledOnce;

        mockLoadedEvent.id = 0;
        subtitleTrackController.onSubtitleTrackLoaded(mockLoadedEvent);
        expect(subtitleTrackController.timer).to.not.exist;
        expect(clearReloadSpy).to.have.been.calledTwice;

        mockLoadedEvent.id = 1;
        subtitleTrackController.onSubtitleTrackLoaded(mockLoadedEvent);
        tracks[1] = null;
        expect(subtitleTrackController.timer).to.not.exist;
        expect(clearReloadSpy).to.have.been.calledThrice;
      });

      it('does not set the reload timer if the stopped flag is set', function () {
        subtitleTrackController.stopped = true;
        subtitleTrackController.trackId = 1;
        subtitleTrackController.onSubtitleTrackLoaded({ id: 1, details: { live: true, fragments: [] }, stats: {} });
        expect(subtitleTrackController.timer).to.not.exist;
      });

      it('sets the live reload timer if the level is live', function () {
        subtitleTrackController.stopped = false;
        subtitleTrackController.trackId = 1;
        subtitleTrackController.onSubtitleTrackLoaded({ id: 1, details: { live: true, fragments: [] }, stats: {} });
        expect(subtitleTrackController.timer).to.exist;
      });

      it('stops the live reload timer if the level is not live', function () {
        subtitleTrackController.trackId = 1;
        subtitleTrackController.timer = setTimeout(() => {}, 0);
        subtitleTrackController.onSubtitleTrackLoaded({ id: 1, details: { live: false, fragments: [] }, stats: {} });
        expect(subtitleTrackController.timer).to.not.exist;
      });
    });

    describe('stopLoad', function () {
      it('stops loading', function () {
        const clearReloadSpy = sandbox.spy(subtitleTrackController, '_clearReloadTimer');
        subtitleTrackController.stopLoad();
        expect(subtitleTrackController.stopped).to.be.true;
        expect(clearReloadSpy).to.have.been.calledOnce;
      });
    });

    describe('startLoad', function () {
      it('stops loading', function () {
        const loadCurrentTrackSpy = sandbox.spy(subtitleTrackController, '_loadCurrentTrack');
        subtitleTrackController.startLoad();
        expect(subtitleTrackController.stopped).to.be.false;
        expect(loadCurrentTrackSpy).to.have.been.calledOnce;
      });
    });
  });

  describe('onLevelLoaded', () => {
    it('should reselect the current track and trigger SUBTITLE_TRACK_SWITCH eventually', (done) => {
      const hls = new Hls();
      const subtitleTrackController = new SubtitleTrackController(hls);

      subtitleTrackController.tracks = fakeTracks;

      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (event, data) => {
        done();
      });

      const levels = [
        {
          urlId: 1,
          subtitleGroupIds: ['A', 'B']
        }
      ];

      hls.levelController = {
        levels
      };

      const levelLoadedEvent = {
        level: 0
      };

      const newLevelInfo = levels[levelLoadedEvent.level];
      const newGroupId = newLevelInfo.subtitleGroupIds[newLevelInfo.urlId];

      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 2;

      // current track name
      const subtitleTrackName = fakeTracks[subtitleTrackController.subtitleTrack].name;

      subtitleTrackController.onLevelLoaded(levelLoadedEvent);

      // group has switched
      assert.strictEqual(subtitleTrackController.subtitleGroupId, newGroupId);

      // name is still the same
      assert.strictEqual(fakeTracks[subtitleTrackController.subtitleTrack].name, subtitleTrackName);
    });
  });

  describe('onError', () => {
    it('should clear interval (only) on fatal network errors', () => {
      subtitleTrackController.setInterval(1000);

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.MEDIA_ERROR
      });

      assert.strictEqual(subtitleTrackController.hasInterval(), true);

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.MEDIA_ERROR,
        fatal: true
      });

      assert.strictEqual(subtitleTrackController.hasInterval(), true);

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: false
      });

      assert.strictEqual(subtitleTrackController.hasInterval(), true);

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: true
      });

      // fatal network error clears interval
      assert.strictEqual(subtitleTrackController.hasInterval(), false);
    });

    it('should blacklist current track on fatal network error, and find a backup track (fallback mechanism)', () => {
      const currentTrackId = 3;

      subtitleTrackController.tracks = fakeTracks;

      subtitleTrackController.trackId = currentTrackId;

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.MEDIA_ERROR,
        fatal: true
      });

      assert.strictEqual(!!subtitleTrackController.trackIdBlacklist[currentTrackId], false);

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: true
      });

      assert.strictEqual(!!subtitleTrackController.trackIdBlacklist[currentTrackId], false);

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        details: Hls.ErrorDetails.SUBTITLE_TRACK_LOAD_ERROR,
        fatal: true,
        context: {
          id: 'foobarLoaderContextId'
        }
      });

      assert.strictEqual(!!subtitleTrackController.trackIdBlacklist[currentTrackId], true);

      assert.strictEqual(subtitleTrackController.subtitleTrack, 1);
    });
  });
});
) function() function() function() import SubtitleTrackController from '../../../src/controller/subtitle-track-controller';
import { Observer } from '../../../src/observer';
import Hls from '../../../src/hls';
import sinon from 'sinon';

describe('SubtitleTrackController', function () {
  let subtitleTrackController;
  let videoElement;
  let sandbox;

  const fakeTracks = [
    { id: 0, url: 'baz', details: { live: false }, groupId: 'B', name: 'Foo' },
    { id: 1, url: 'bar', groupId: 'B', name: 'Bar' },
    { id: 2, details: { live: true }, url: 'foo', groupId: 'A', name: 'Foo' },
    { id: 3, details: { live: true }, url: 'foo', groupId: 'A', name: 'Bar' }
  ];

  beforeEach(() => {
    const hls = new Observer();

    videoElement = document.createElement('video');
    subtitleTrackController = new SubtitleTrackController(hls);
    subtitleTrackController.media = videoElement;
    subtitleTrackController.tracks = fakeTracks;

    const textTrack1 = videoElement.addTextTrack('subtitles', 'English', 'en');
    const textTrack2 = videoElement.addTextTrack('subtitles', 'Swedish', 'se');

    textTrack1.mode = 'disabled';
    textTrack2.mode = 'disabled';
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('constructor', function () {
    it('defaults stopped to true', function () {
      expect(subtitleTrackController.stopped).to.be.true;
    });
  });

  describe('onSubtitleTrackSwitch', () => {
    it('should set subtitleTrack to -1 if disabled', () => {
      assert.strictEqual(subtitleTrackController.subtitleTrack, -1);

      videoElement.textTracks[0].mode = 'disabled';
      subtitleTrackController._onTextTracksChanged();

      expect(subtitleTrackController.subtitleTrack).to.equal(-1);
    });

    it('should set subtitleTrack to 0 if hidden', function () {
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

      videoElement.textTracks[0].mode = 'hidden';
      subtitleTrackController._onTextTracksChanged();

      expect(subtitleTrackController.subtitleTrack).to.equal(0);
    });

    it('should set subtitleTrack to 0 if showing', function () {
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

      videoElement.textTracks[0].mode = 'showing';
      subtitleTrackController._onTextTracksChanged();

      expect(subtitleTrackController.subtitleTrack).to.equal(0);
    });
  });

  describe('set subtitleTrack', function () {
    it('should set active text track mode to showing', function () {
      videoElement.textTracks[0].mode = 'disabled';

      subtitleTrackController.subtitleDisplay = true;
      subtitleTrackController.subtitleTrack = 0;

      expect(videoElement.textTracks[0].mode).to.equal('showing');
    });

    it('should set active text track mode to hidden', function () {
      videoElement.textTracks[0].mode = 'disabled';
      subtitleTrackController.subtitleDisplay = false;
      subtitleTrackController.subtitleTrack = 0;

      expect(videoElement.textTracks[0].mode).to.equal('hidden');
    });

    it('should disable previous track', function () {
      // Change active track without triggering setSubtitleTrackInternal
      subtitleTrackController.trackId = 0;
      // Change active track and trigger setSubtitleTrackInternal
      subtitleTrackController.subtitleTrack = 1;

      expect(videoElement.textTracks[0].mode).to.equal('disabled');
    });

    it('should trigger SUBTITLE_TRACK_SWITCH', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 1;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.firstCall).to.have.been.calledWith('hlsSubtitleTrackSwitch', { id: 1 });
    });

    it('should trigger SUBTITLE_TRACK_LOADING if the track has no details', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 1;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.secondCall).to.have.been.calledWith('hlsSubtitleTrackLoading', { url: 'bar', id: 1 });
    });

    it('should not trigger SUBTITLE_TRACK_LOADING if the track has details and is not live', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 1;
      subtitleTrackController.subtitleTrack = 0;

      expect(triggerSpy).to.have.been.calledOnce;
      expect(triggerSpy.firstCall).to.have.been.calledWith('hlsSubtitleTrackSwitch', { id: 0 });
    });

    it('should trigger SUBTITLE_TRACK_SWITCH if passed -1', function () {
      const stopTimerSpy = sinon.spy(subtitleTrackController, 'clearInterval');
      const triggerSpy = sinon.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = -1;

      expect(triggerSpy.firstCall).to.have.been.calledWith('hlsSubtitleTrackSwitch', { id: -1 });
    });

    it('should trigger SUBTITLE_TRACK_LOADING if the track is live, even if it has details', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 2;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.secondCall).to.have.been.calledWith('hlsSubtitleTrackLoading', { url: 'foo', id: 2 });
    });

    it('should do nothing if called with out of bound indicies', function () {
      const stopTimerSpy = sinon.spy(subtitleTrackController, 'clearInterval');
      subtitleTrackController.subtitleTrack = 5;
      subtitleTrackController.subtitleTrack = -2;

      expect(clearReloadSpy).to.have.not.been.called;
    });

    it('should do nothing if called with a non-number', function () {
      subtitleTrackController.subtitleTrack = undefined;
      subtitleTrackController.subtitleTrack = null;
    });

    describe('_toggleTrackModes', function () {
      // This can be the case when setting the subtitleTrack before Hls.js attaches to the mediaElement
      it('should not throw an exception if trackId is out of the mediaElement text track bounds', function () {
        subtitleTrackController.trackId = 3;
        subtitleTrackController._toggleTrackModes(1);
      });

      it('should disable all textTracks if called with -1', function () {
        [].slice.call(videoElement.textTracks).forEach(t => {
          t.mode = 'showing';
        });
        subtitleTrackController._toggleTrackModes(-1);
        [].slice.call(videoElement.textTracks).forEach(t => {
          expect(t.mode).to.equal('disabled');
        });
      });

      it('should not throw an exception if the mediaElement does not exist', function () {
        subtitleTrackController.media = null;
        subtitleTrackController._toggleTrackModes(1);
      });
    });

    describe('onSubtitleTrackLoaded', function () {
      it('exits early if the loaded track does not match the requested track', function () {
        const tracks = subtitleTrackController.tracks;
        const clearReloadSpy = sandbox.spy(subtitleTrackController, '_clearReloadTimer');
        subtitleTrackController.trackId = 1;

        let mockLoadedEvent = { id: 999, details: { foo: 'bar' } };
        subtitleTrackController.onSubtitleTrackLoaded(mockLoadedEvent);
        expect(subtitleTrackController.timer).to.not.exist;
        expect(clearReloadSpy).to.have.been.calledOnce;

        mockLoadedEvent.id = 0;
        subtitleTrackController.onSubtitleTrackLoaded(mockLoadedEvent);
        expect(subtitleTrackController.timer).to.not.exist;
        expect(clearReloadSpy).to.have.been.calledTwice;

        mockLoadedEvent.id = 1;
        subtitleTrackController.onSubtitleTrackLoaded(mockLoadedEvent);
        tracks[1] = null;
        expect(subtitleTrackController.timer).to.not.exist;
        expect(clearReloadSpy).to.have.been.calledThrice;
      });

      it('does not set the reload timer if the stopped flag is set', function () {
        subtitleTrackController.stopped = true;
        subtitleTrackController.trackId = 1;
        subtitleTrackController.onSubtitleTrackLoaded({ id: 1, details: { live: true, fragments: [] }, stats: {} });
        expect(subtitleTrackController.timer).to.not.exist;
      });

      it('sets the live reload timer if the level is live', function () {
        subtitleTrackController.stopped = false;
        subtitleTrackController.trackId = 1;
        subtitleTrackController.onSubtitleTrackLoaded({ id: 1, details: { live: true, fragments: [] }, stats: {} });
        expect(subtitleTrackController.timer).to.exist;
      });

      it('stops the live reload timer if the level is not live', function () {
        subtitleTrackController.trackId = 1;
        subtitleTrackController.timer = setTimeout(() => {}, 0);
        subtitleTrackController.onSubtitleTrackLoaded({ id: 1, details: { live: false, fragments: [] }, stats: {} });
        expect(subtitleTrackController.timer).to.not.exist;
      });
    });

    describe('stopLoad', function () {
      it('stops loading', function () {
        const clearReloadSpy = sandbox.spy(subtitleTrackController, '_clearReloadTimer');
        subtitleTrackController.stopLoad();
        expect(subtitleTrackController.stopped).to.be.true;
        expect(clearReloadSpy).to.have.been.calledOnce;
      });
    });

    describe('startLoad', function () {
      it('stops loading', function () {
        const loadCurrentTrackSpy = sandbox.spy(subtitleTrackController, '_loadCurrentTrack');
        subtitleTrackController.startLoad();
        expect(subtitleTrackController.stopped).to.be.false;
        expect(loadCurrentTrackSpy).to.have.been.calledOnce;
      });
    });
  });

  describe('onLevelLoaded', () => {
    it('should reselect the current track and trigger SUBTITLE_TRACK_SWITCH eventually', (done) => {
      const hls = new Hls();
      const subtitleTrackController = new SubtitleTrackController(hls);

      subtitleTrackController.tracks = fakeTracks;

      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (event, data) => {
        done();
      });

      const levels = [
        {
          urlId: 1,
          subtitleGroupIds: ['A', 'B']
        }
      ];

      hls.levelController = {
        levels
      };

      const levelLoadedEvent = {
        level: 0
      };

      const newLevelInfo = levels[levelLoadedEvent.level];
      const newGroupId = newLevelInfo.subtitleGroupIds[newLevelInfo.urlId];

      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 2;

      // current track name
      const subtitleTrackName = fakeTracks[subtitleTrackController.subtitleTrack].name;

      subtitleTrackController.onLevelLoaded(levelLoadedEvent);

      // group has switched
      assert.strictEqual(subtitleTrackController.subtitleGroupId, newGroupId);

      // name is still the same
      assert.strictEqual(fakeTracks[subtitleTrackController.subtitleTrack].name, subtitleTrackName);
    });
  });

  describe('onError', () => {
    it('should clear interval (only) on fatal network errors', () => {
      subtitleTrackController.setInterval(1000);

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.MEDIA_ERROR
      });

      assert.strictEqual(subtitleTrackController.hasInterval(), true);

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.MEDIA_ERROR,
        fatal: true
      });

      assert.strictEqual(subtitleTrackController.hasInterval(), true);

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: false
      });

      assert.strictEqual(subtitleTrackController.hasInterval(), true);

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: true
      });

      // fatal network error clears interval
      assert.strictEqual(subtitleTrackController.hasInterval(), false);
    });

    it('should blacklist current track on fatal network error, and find a backup track (fallback mechanism)', () => {
      const currentTrackId = 3;

      subtitleTrackController.tracks = fakeTracks;

      subtitleTrackController.trackId = currentTrackId;

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.MEDIA_ERROR,
        fatal: true
      });

      assert.strictEqual(!!subtitleTrackController.trackIdBlacklist[currentTrackId], false);

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        fatal: true
      });

      assert.strictEqual(!!subtitleTrackController.trackIdBlacklist[currentTrackId], false);

      subtitleTrackController.onError({
        type: Hls.ErrorTypes.NETWORK_ERROR,
        details: Hls.ErrorDetails.SUBTITLE_TRACK_LOAD_ERROR,
        fatal: true,
        context: {
          id: 'foobarLoaderContextId'
        }
      });

      assert.strictEqual(!!subtitleTrackController.trackIdBlacklist[currentTrackId], true);

      assert.strictEqual(subtitleTrackController.subtitleTrack, 1);
    });
  });
});
