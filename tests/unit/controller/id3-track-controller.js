import { expect } from 'chai';
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

  describe('cue retention', function () {
    // GC of cue wrappers cannot be simulated; assert the controller holds a
    // strong reference to every cue it adds, and releases them correctly.
    function parse(pts) {
      const data = new Uint8Array([
        0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0e, 0x54, 0x58,
        0x58, 0x58, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x61, 0x00, 0x00,
      ]);
      id3TrackController.onFragParsingMetadata(Events.FRAG_PARSING_METADATA, {
        samples: [{ type: 'org.id3', pts, dts: pts, duration: 1, data }],
      });
    }

    it('retains cues added to the track', function () {
      parse(1);
      const track = id3TrackController.id3Track.track;
      expect(track.cues.length).to.equal(1);
      expect(id3TrackController.id3Cues.size).to.equal(1);
      expect(id3TrackController.id3Cues.has(track.cues[0])).to.be.true;
    });

    it('releases cues removed by onBufferFlushing()', function () {
      parse(1);
      id3TrackController.onBufferFlushing(Events.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: 10,
        type: 'audio',
      });
      expect(id3TrackController.id3Track.track.cues.length).to.equal(0);
      expect(id3TrackController.id3Cues.size).to.equal(0);
    });

    it('releases cues in onMediaDetaching()', function () {
      parse(1);
      id3TrackController.onMediaDetaching(Events.MEDIA_DETACHING, {});
      expect(id3TrackController.id3Cues.size).to.equal(0);
    });
  });
});
