import TimelineController from '../../../src/controller/timeline-controller';
import Hls from '../../../src/hls';

const assert = require('assert');

describe('TimelineController', () => {
  let timelineController;
  let hls;

  beforeEach(() => {
    hls = new Hls();
    hls.config.enableWebVTT = true;
    timelineController = new TimelineController(hls);
    timelineController.media = document.createElement('video');
  });

  it('should set default track to showing when displaySubtitles is true', () => {
    hls.subtitleTrackController = { subtitleDisplay: true };

    timelineController.onManifestLoaded({
      subtitles: [{ id: 0 }, { id: 1, default: true }]
    });

    assert.strictEqual(timelineController.textTracks[0].mode, 'disabled');
    assert.strictEqual(timelineController.textTracks[1].mode, 'showing');
  });

  it('should set default track to hidden when displaySubtitles is false', () => {
    hls.subtitleTrackController = { subtitleDisplay: false };

    timelineController.onManifestLoaded({
      subtitles: [{ id: 0 }, { id: 1, default: true }]
    });

    assert.strictEqual(timelineController.textTracks[0].mode, 'disabled');
    assert.strictEqual(timelineController.textTracks[1].mode, 'hidden');
  });

  describe('reuse text track', () => {
    it('should reuse text track when track order is same between manifests', () => {
      hls.subtitleTrackController = { subtitleDisplay: false };

      timelineController.onManifestLoaded({
        subtitles: [{ id: 0, name: 'en' }, { id: 1, name: 'ru' }]
      });

      // text tracks model contain only newly added manifest tracks, in same order as in manifest
      assert.strictEqual(timelineController.textTracks[0].label, 'en');
      assert.strictEqual(timelineController.textTracks[1].label, 'ru');
      assert.strictEqual(timelineController.textTracks.length, 2);
      // text tracks of the media contain the newly added text tracks
      assert.strictEqual(timelineController.media.textTracks[0].label, 'en');
      assert.strictEqual(timelineController.media.textTracks[1].label, 'ru');
      assert.strictEqual(timelineController.media.textTracks.length, 2);

      timelineController.onManifestLoaded({
        subtitles: [{ id: 0, name: 'en' }, { id: 1, name: 'ru' }]
      });

      // text tracks model contain only newly added manifest tracks, in same order
      assert.strictEqual(timelineController.textTracks[0].label, 'en');
      assert.strictEqual(timelineController.textTracks[1].label, 'ru');
      assert.strictEqual(timelineController.textTracks.length, 2);
      // text tracks of the media contain the previously added text tracks, in same order as the manifest order
      assert.strictEqual(timelineController.media.textTracks[0].label, 'en');
      assert.strictEqual(timelineController.media.textTracks[1].label, 'ru');
      assert.strictEqual(timelineController.media.textTracks.length, 2);
    });

    it('should reuse text track when track order is not same between manifests', () => {
      hls.subtitleTrackController = { subtitleDisplay: false };

      timelineController.onManifestLoaded({
        subtitles: [{ id: 0, name: 'en' }, { id: 1, name: 'ru' }]
      });

      // text tracks model contain only newly added manifest tracks, in same order as in manifest
      assert.strictEqual(timelineController.textTracks[0].label, 'en');
      assert.strictEqual(timelineController.textTracks[1].label, 'ru');
      assert.strictEqual(timelineController.textTracks.length, 2);
      // text tracks of the media contain the newly added text tracks
      assert.strictEqual(timelineController.media.textTracks[0].label, 'en');
      assert.strictEqual(timelineController.media.textTracks[1].label, 'ru');
      assert.strictEqual(timelineController.media.textTracks.length, 2);

      timelineController.onManifestLoaded({
        subtitles: [{ id: 0, name: 'ru' }, { id: 1, name: 'en' }]
      });

      // text tracks model contain only newly added manifest tracks, in same order
      assert.strictEqual(timelineController.textTracks[0].label, 'ru');
      assert.strictEqual(timelineController.textTracks[1].label, 'en');
      assert.strictEqual(timelineController.textTracks.length, 2);
      // text tracks of the media contain the previously added text tracks, in opposite order to the manifest order
      assert.strictEqual(timelineController.media.textTracks[0].label, 'en');
      assert.strictEqual(timelineController.media.textTracks[1].label, 'ru');
      assert.strictEqual(timelineController.media.textTracks.length, 2);
    });
  });
});
