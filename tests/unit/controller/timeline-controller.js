const assert = require('assert');

import TimelineController from '../../../src/controller/timeline-controller';
import Hls from '../../../src/hls';

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
});
