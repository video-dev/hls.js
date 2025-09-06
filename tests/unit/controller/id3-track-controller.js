import ID3TrackController from '../../../src/controller/id3-track-controller';
import Hls from '../../../src/hls';
import { Events } from '../../../src/events';

describe('TimelineController', function () {
  let id3TrackController;
  let hls;
  let videoElement;

  beforeEach(function () {
    videoElement = document.createElement('video');
    hls = new Hls({ enableID3MetadataCues: true });
    id3TrackController = new ID3TrackController(hls);
    id3TrackController.media = videoElement;
  });

  describe('createCaptionsTrack', function () {
    it('should create new TextTrack in onFragParsingMetadata() and remove it in onMediaDetaching()', function () {
      expect(videoElement.textTracks.length).to.equal(0);
      id3TrackController.onFragParsingMetadata(Events.FRAG_PARSING_METADATA, {
        samples: [],
      });
      expect(videoElement.textTracks.length).to.equal(1);
      id3TrackController.onMediaDetaching(Events.MEDIA_DETACHING, {});
      expect(videoElement.textTracks.length).to.equal(0);
    });
  });
});
