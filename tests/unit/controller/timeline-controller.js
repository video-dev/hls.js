import TimelineController from '../../../src/controller/timeline-controller';
import Hls from '../../../src/hls';

describe('TimelineController', function () {
  let timelineController;
  let hls;

  beforeEach(function () {
    hls = new Hls();
    hls.config.enableWebVTT = true;
    hls.config.renderNatively = true;
    timelineController = new TimelineController(hls);
    timelineController.media = document.createElement('video');
  });

  it('should set default track to showing when displaySubtitles is true', function () {
    hls.subtitleTrackController = { subtitleDisplay: true };

    timelineController.onManifestLoaded({
      subtitles: [{ id: 0 }, { id: 1, default: true }]
    });

    expect(timelineController.textTracks[0].mode).to.equal('disabled');
    expect(timelineController.textTracks[1].mode).to.equal('showing');
  });

  it('should set default track to hidden when displaySubtitles is false', function () {
    hls.subtitleTrackController = { subtitleDisplay: false };

    timelineController.onManifestLoaded({
      subtitles: [{ id: 0 }, { id: 1, default: true }]
    });

    expect(timelineController.textTracks[0].mode).to.equal('disabled');
    expect(timelineController.textTracks[1].mode).to.equal('hidden');
  });
});
