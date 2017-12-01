import Event from "../../../src/events";

const assert = require('assert');

import FragmentTracker from '../../../src/helper/fragment-tracker';
import Hls from '../../../src/hls';

function createMockBuffer(buffered) {
  return {
    start: i => (buffered.length > i) ? buffered[i].startPTS: null,
    end : i => (buffered.length > i) ? buffered[i].endPTS: null,
    length: buffered.length,
  };
}

describe('FragmentTracker', () => {

  describe('getPartialFragment', () => {
    let hls, fragmentTracker, fragment, segment, buffered, partialFragment;

    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);

    fragment = {
      startPTS: 0,
      endPTS: 1,
      sn: 1,
      level: 1,
    };
    segment = {
      type: 'video',
      updatePTS: true,
      fragment: fragment
    };
    hls.trigger(Event.SOURCE_BUFFER_APPEND, { segment : segment });

    buffered = createMockBuffer([
      {
        startPTS: 0,
        endPTS: 0.5
      },
    ]);

    hls.trigger(Event.BUFFER_APPENDED, {sourceBufferRanges: buffered});
    it('detects fragments that partially loaded', () => {
      // Get the partial fragment at a time
      partialFragment = fragmentTracker.getPartialFragment(0);
      assert.strictEqual(partialFragment, fragment);
      partialFragment = fragmentTracker.getPartialFragment(0.5);
      assert.strictEqual(partialFragment, fragment);
      partialFragment = fragmentTracker.getPartialFragment(1);
      assert.strictEqual(partialFragment, fragment);
    });
    it('returns null when time is not inside partial fragment', () => {
      partialFragment = fragmentTracker.getPartialFragment(1.01);
      assert.strictEqual(partialFragment, null);
    });
  });

  describe('isBadFragment', () => {
    let hls, fragmentTracker, fragment, segment, buffered;

    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);

    fragment = {
      startPTS: 0,
      endPTS: 1,
      sn: 1,
      level: 1,
    };
    segment = {
      type: 'video',
      updatePTS: true,
      fragment: fragment
    };
    hls.trigger(Event.SOURCE_BUFFER_APPEND, { segment : segment });

    it('detects fragments that never loaded', () => {
      hls.trigger(Event.SOURCE_BUFFER_APPEND, { segment : segment });
      assert.strictEqual(fragmentTracker.isBadFragment(fragment), true);
    });

    it('detects fragments that loaded properly', () => {
      hls.trigger(Event.SOURCE_BUFFER_APPEND, { segment : segment });
      buffered = createMockBuffer([
        {
          startPTS: 0,
          endPTS: 1
        },
      ]);
      hls.trigger(Event.BUFFER_APPENDED, { sourceBufferRanges : buffered });
      assert.strictEqual(fragmentTracker.isBadFragment(fragment), false);
    });

    it('detects partial fragments', () => {
      hls.trigger(Event.SOURCE_BUFFER_APPEND, { segment : segment });
      buffered = createMockBuffer([
        {
          startPTS: 0.5,
          endPTS: 2
        },
      ]);
      hls.trigger(Event.BUFFER_APPENDED, { sourceBufferRanges : buffered });
      assert.strictEqual(fragmentTracker.isBadFragment(fragment), true);
    });

    it('removes evicted partial fragments', () => {
      hls.trigger(Event.SOURCE_BUFFER_APPEND, { segment : segment });
      buffered = createMockBuffer([
        {
          startPTS: 0,
          endPTS: 1
        },
      ]);
      hls.trigger(Event.BUFFER_APPENDED, { sourceBufferRanges : buffered });
      assert.strictEqual(fragmentTracker.isBadFragment(fragment), true);

      buffered = createMockBuffer([
        {
          startPTS: 0.75,
          endPTS: 2
        },
      ]);
      hls.trigger(Event.BUFFER_APPENDED, { sourceBufferRanges : buffered });
      assert.strictEqual(fragmentTracker.isBadFragment(fragment), false);
    });
  });
});
