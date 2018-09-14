import sinon from 'sinon';
import SubtitleStreamController from '../../../src/controller/subtitle-stream-controller';
import Hls from '../../../src/hls';

const assert = require('assert');

describe('SubtitleStreamController', () => {
  let subtitleStreamController;
  let videoElement;
  let queue;

  beforeEach(() => {
    const hls = new Hls();

    videoElement = document.createElement('video');
    subtitleStreamController = new SubtitleStreamController(hls);

    subtitleStreamController.media = videoElement;
    subtitleStreamController.tracks = [{ id: 0, url: 'baz', details: { live: false } }, { id: 1, url: 'bar' }, { id: 2, details: { live: true }, url: 'foo' }];

    queue = [
      { start: 0, duration: 10 },
      { start: 10, duration: 10 },
      { start: 20, duration: 10 },
      { start: 30, duration: 10 },
      { start: 40, duration: 10 }
    ];
  });

  describe('fragment queue', () => {
    it('should process the webvtt file closest to the media playhead', () => {
      videoElement.currentTime = 8;
      assert.strictEqual(subtitleStreamController.findQueuedFragmentIndexClosestToPlayhead(queue), 0);

      videoElement.currentTime = 25;
      assert.strictEqual(subtitleStreamController.findQueuedFragmentIndexClosestToPlayhead(queue), 2);

      videoElement.currentTime = 100;
      assert.strictEqual(subtitleStreamController.findQueuedFragmentIndexClosestToPlayhead(queue), -1);
    });
  });
});
