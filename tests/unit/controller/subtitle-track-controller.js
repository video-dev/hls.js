import SubtitleTrackController from '../../../src/controller/subtitle-track-controller';
import Hls from '../../../src/hls';

describe('SubtitleTrackController', function () {
  let subtitleTrackController;
  let videoElement;

  beforeEach(function () {
    const hls = new Hls({
      renderNatively: true
    });

    videoElement = document.createElement('video');
    subtitleTrackController = new SubtitleTrackController(hls);

    subtitleTrackController.media = videoElement;
    subtitleTrackController.tracks = [{ id: 0, url: 'baz', details: { live: false } }, { id: 1, url: 'bar' }, { id: 2, details: { live: true }, url: 'foo' }];

    const textTrack1 = videoElement.addTextTrack('subtitles', 'English', 'en');
    const textTrack2 = videoElement.addTextTrack('subtitles', 'Swedish', 'se');

    textTrack1.mode = 'disabled';
    textTrack2.mode = 'disabled';
  });

  describe('onTextTrackChanged', function () {
    it('should set subtitleTrack to -1 if disabled', function () {
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

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
      const triggerSpy = sinon.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 1;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.firstCall).to.have.been.calledWith('hlsSubtitleTrackSwitch', { id: 1 });
    });

    it('should trigger SUBTITLE_TRACK_LOADING if the track has no details', function () {
      const triggerSpy = sinon.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 1;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.secondCall).to.have.been.calledWith('hlsSubtitleTrackLoading', { url: 'bar', id: 1 });
    });

    it('should not trigger SUBTITLE_TRACK_LOADING if the track has details and is not live', function () {
      const triggerSpy = sinon.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 1;
      subtitleTrackController.subtitleTrack = 0;

      expect(triggerSpy).to.have.been.calledOnce;
      expect(triggerSpy.firstCall).to.have.been.calledWith('hlsSubtitleTrackSwitch', { id: 0 });
    });

    it('should trigger SUBTITLE_TRACK_SWITCH if passed -1', function () {
      const stopTimerSpy = sinon.spy(subtitleTrackController, '_stopTimer');
      const triggerSpy = sinon.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = -1;

      expect(stopTimerSpy).to.have.been.calledOnce;
      expect(triggerSpy.firstCall).to.have.been.calledWith('hlsSubtitleTrackSwitch', { id: -1 });
    });

    it('should trigger SUBTITLE_TRACK_LOADING if the track is live, even if it has details', function () {
      const triggerSpy = sinon.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 2;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.secondCall).to.have.been.calledWith('hlsSubtitleTrackLoading', { url: 'foo', id: 2 });
    });

    it('should do nothing if called with out of bound indicies', function () {
      const stopTimerSpy = sinon.spy(subtitleTrackController, '_stopTimer');
      subtitleTrackController.subtitleTrack = 5;
      subtitleTrackController.subtitleTrack = -2;

      expect(stopTimerSpy).to.have.not.been.called;
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
  });
});
