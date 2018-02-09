const assert = require('assert');

import SubtitleTrackController from '../../../src/controller/subtitle-track-controller';
import Hls from '../../../src/hls';

describe('SubtitleTrackController', () => {

  let subtitleTrackController;
  let videoElement;

  beforeEach(() => {
    const hls = new Hls();

    videoElement = document.createElement('video');
    subtitleTrackController = new SubtitleTrackController(hls);

    subtitleTrackController.media = videoElement;
    subtitleTrackController.tracks = [{ id: 0 }, { id: 1 }];

    const textTrack1 = videoElement.addTextTrack('subtitles', 'English', 'en');
    const textTrack2 = videoElement.addTextTrack('subtitles', 'Swedish', 'se');

    textTrack1.mode = 'disabled';
    textTrack2.mode = 'disabled';
  });

  describe('onTextTrackChanged', () => {
    it('should set subtitleTrack to -1 if disabled', () => {
      assert.strictEqual(subtitleTrackController.subtitleTrack, -1);

      videoElement.textTracks[0].mode = 'disabled';
      subtitleTrackController._onTextTracksChanged();

      assert.strictEqual(subtitleTrackController.subtitleTrack, -1);
    });

    it('should set subtitleTrack to 0 if hidden', () => {
      assert.strictEqual(subtitleTrackController.subtitleTrack, -1);

      videoElement.textTracks[0].mode = 'hidden';
      subtitleTrackController._onTextTracksChanged();

      assert.strictEqual(subtitleTrackController.subtitleTrack, 0);
    });

    it('should set subtitleTrack to 0 if showing', () => {
      assert.strictEqual(subtitleTrackController.subtitleTrack, -1);

      videoElement.textTracks[0].mode = 'showing';
      subtitleTrackController._onTextTracksChanged();

      assert.strictEqual(subtitleTrackController.subtitleTrack, 0);
    });
  });

  describe('setSubtitleTrackInternal', () => {
    it('should set active text track mode to showing', () => {
      videoElement.textTracks[0].mode = 'disabled';

      subtitleTrackController.subtitleDisplay = true;
      subtitleTrackController.subtitleTrack = 0;

      assert.strictEqual(videoElement.textTracks[0].mode, 'showing');
    });

    it('should set active text track mode to hidden', () => {
      videoElement.textTracks[0].mode = 'disabled';

      subtitleTrackController.subtitleDisplay = false;
      subtitleTrackController.subtitleTrack = 0;

      assert.strictEqual(videoElement.textTracks[0].mode, 'hidden');
    });

    it('should disable previous track', () => {
      // Change active track without triggering setSubtitleTrackInternal
      subtitleTrackController.trackId = 0;

      // Change active track and trigger setSubtitleTrackInternal
      subtitleTrackController.subtitleTrack = 1;

      assert.strictEqual(videoElement.textTracks[0].mode, 'disabled');
    });
  });
});
