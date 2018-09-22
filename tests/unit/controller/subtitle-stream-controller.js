import sinon from 'sinon';
import SubtitleStreamController from '../../../src/controller/subtitle-stream-controller';
import Hls from '../../../src/hls';

const assert = require('assert');

describe('SubtitleStreamController', () => {
  let controller;
  let videoElement;

  beforeEach(() => {
    const hls = new Hls();

    controller = new SubtitleStreamController(hls);

    videoElement = document.createElement('video');
    controller.media = videoElement;

    controller.vttFragQueues = [
      [
        { start: 0, duration: 10 },
        { start: 10, duration: 10 },
        { start: 20, duration: 10 },
        { start: 30, duration: 10 },
        { start: 40, duration: 10 }
      ]
    ];
    controller.currentTrackId = 0;
  });

  describe('fragment queue', () => {
    it('should process the webvtt file closest to the media playhead', () => {
      assert.strictEqual(controller.vttFragQueues[0].length, 5);

      // Skip into the 20-30s fragment
      controller.currentlyProcessing = null;
      videoElement.currentTime = 28;
      controller.nextFrag();
      assert.strictEqual(controller.fragCurrent.start, 20);
      assert.strictEqual(controller.vttFragQueues[0].length, 4);

      // Skip over into the 40-50s fragment
      controller.currentlyProcessing = null;
      videoElement.currentTime = 42;
      controller.nextFrag();
      assert.strictEqual(controller.fragCurrent.start, 40);
      assert.strictEqual(controller.vttFragQueues[0].length, 3);

      // Try a fragment that won't be found; should just resort to processing first one in queue
      controller.currentlyProcessing = null;
      videoElement.currentTime = 100;
      controller.nextFrag();
      assert.strictEqual(controller.fragCurrent.start, 0);
      assert.strictEqual(controller.vttFragQueues[0].length, 2);
    });
  });
});
