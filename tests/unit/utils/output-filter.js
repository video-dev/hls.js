const assert = require('assert');
import OutputFilter from '../../../src/utils/output-filter';

describe('OutputFilter', () => {
  let createMockTimelineController = () => {
    let callCount = 0;
    let lastCueArguments = null;
    let captionsTrackCalled = false;
    return {
      addCues: (trackName, startTime, endTime, screen) => {
        lastCueArguments = { trackName, startTime, endTime, screen };
        callCount++;
      },
      createCaptionsTrack: (track) => { 
        captionsTrackCalled = true;
      },
      getCallCount: () => callCount,
      getLastCueAdded: () => lastCueArguments,
      didCaptionsTrackInvoke: () => captionsTrackCalled,
    }
  }

  let timelineController, outputFilter;

  beforeEach(function() {
    timelineController = createMockTimelineController();
    outputFilter = new OutputFilter(timelineController, 1);
  });

  it('handles new cue without dispatching', () => {
    outputFilter.newCue(0, 1, {});
    let lastCueAdded = timelineController.getLastCueAdded();
    assert.strictEqual(lastCueAdded, null);
    assert.strictEqual(timelineController.getCallCount(), 0);
    assert.strictEqual(timelineController.didCaptionsTrackInvoke(), true);
  });

  it('handles single cue and dispatch', () => {
    let lastScreen = {};
    outputFilter.newCue(0, 1, lastScreen);
    outputFilter.dispatchCue();
    let lastCueAdded = timelineController.getLastCueAdded();
    assert.strictEqual(lastCueAdded.screen, lastScreen);
    assert.strictEqual(timelineController.getCallCount(), 1);
  });

  it('handles multiple cues and dispatch', () => {
    outputFilter.newCue(0, 1, {});
    outputFilter.newCue(1, 2, {});
    let lastScreen = {};
    outputFilter.newCue(3, 4, lastScreen);
    outputFilter.dispatchCue();
    let lastCueAdded = timelineController.getLastCueAdded();
    assert.strictEqual(timelineController.getCallCount(), 1);
    assert.strictEqual(lastCueAdded.startTime, 0);
    assert.strictEqual(lastCueAdded.endTime, 4);
    assert.strictEqual(lastCueAdded.screen, lastScreen);
  });

  it('does not dispatch empty cues', () => {
    outputFilter.newCue(0, 1, {});
    assert.strictEqual(timelineController.getCallCount(), 0);
    outputFilter.dispatchCue();
    assert.strictEqual(timelineController.getCallCount(), 1);
    outputFilter.dispatchCue();
    assert.strictEqual(timelineController.getCallCount(), 1);
  });
});
