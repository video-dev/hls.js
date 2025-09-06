import chai from 'chai';
import sinonChai from 'sinon-chai';
import { TimelineController } from '../../../src/controller/timeline-controller';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';

chai.use(sinonChai);
const expect = chai.expect;

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
    timelineController.config.renderTextTracksNatively = true;
    timelineController.media = videoElement;
  });

  describe('createCaptionsTrack', function () {
    it('should create new TextTrack after calling and remove it when detaching', function () {
      expect(videoElement.textTracks.length).to.equal(0);
      timelineController.createCaptionsTrack('textTrack1');
      expect(videoElement.textTracks.length).to.equal(1);
      timelineController.onMediaDetaching(Events.MEDIA_DETACHING, {});
      expect(videoElement.textTracks.length).to.equal(0);
    });
  });
});
