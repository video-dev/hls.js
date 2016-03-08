const assert = require('assert');

import StreamController from '../../../src/controller/stream-controller';
import Hls from '../../../src/hls';


describe('StreamController', () => {
  var controller;
  
  beforeEach(() => controller = new StreamController(new Hls()));

  it('should generate the buffer info for a single buffered segment', () => {
    controller.media = {
      readyState: 1,
      playbackRate: 1,
      buffered: {
        length: 1,
        start: (i) => 0,
        end: (i) => 1
      },
      duration: 10,
      currentTime: 1,
    };
    var bufferInfo = controller.bufferInfo(0, 0);
    assert.deepEqual(bufferInfo, {
      len: 1, start: 0, end: 1, nextStart: undefined
    });
  });

  it('should handle stuck playhead', () => {
    controller.media = {
      readyState: 3,
      playbackRate: 1,
      buffered: {
        length: 3,
        start: (i) => 10.0 * (i + 1),
        end: (i) => 10.0 * (i + 2) - 0.01,
      },
      duration: 30
    };

    // simulate stuck (no movement during tick)
    controller.lastCurrentTime = 19.9;
    controller.media.currentTime = 19.9;

    controller.doTick();

    // it should advance to start of next segment
    assert.deepEqual(controller.media.currentTime, 20);
  });
});
