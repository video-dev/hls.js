import { TimelineController } from '../../../src/controller/timeline-controller';
import Hls from '../../../src/hls';
import { Events } from '../../../src/events';
import { createTrackNode } from '../../../src/utils/texttrack-utils';

describe('TimelineController', function () {
  let timelineController;
  let hls;
  let videoElement;

  beforeEach(function () {
    videoElement = document.createElement('video');
    hls = new Hls();
    hls.config.enableWebVTT = true;
    hls.config.renderTextTracksNatively = true;
    timelineController = new TimelineController(hls);
    timelineController.media = videoElement;
  });

  describe('removable TextTracks', function () {
    it('should remove TextTracks in onMediaDetaching and add them again in onMediaAttached', function () {
      const eventData = {
        subtitleTracks: [
          {
            id: 0,
            name: 'en',
            attrs: { LANGUAGE: 'en', NAME: 'en' },
          },
          {
            id: 1,
            name: 'ru',
            attrs: { LANGUAGE: 'ru', NAME: 'ru' },
          },
        ],
      };
      // We have to use Object.defineProperty to set the trackNode property here
      Object.defineProperty(eventData.subtitleTracks[0], 'trackNode', {
        value: createTrackNode(videoElement, 'subtitles', 'en', 'en'),
      });
      Object.defineProperty(eventData.subtitleTracks[1], 'trackNode', {
        value: createTrackNode(videoElement, 'subtitles', 'ru', 'ru'),
      });
      timelineController.onSubtitleTracksUpdated(
        Events.SUBTITLE_TRACKS_UPDATED,
        eventData,
      );

      expect(videoElement.textTracks.length).to.equal(2);
      timelineController.onMediaDetaching(Events.MEDIA_DETACHING, {});
      expect(videoElement.textTracks.length).to.equal(0);
      timelineController.onMediaAttached(Events.MEDIA_ATTACHED, {
        media: videoElement,
      });
      expect(videoElement.textTracks.length).to.equal(2);
    });
  });
});
