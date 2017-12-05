import Event from "../../../src/events";

const assert = require('assert');

import {FragmentTracker, FragmentTrackerState} from '../../../src/helper/fragment-tracker';
import Hls from '../../../src/hls';

function createMockBuffer(buffered) {
  return {
    start: i => (buffered.length > i) ? buffered[i].startPTS: null,
    end : i => (buffered.length > i) ? buffered[i].endPTS: null,
    length: buffered.length,
  };
}

describe.only('FragmentTracker', () => {
  // BUFFER_APPENDED
  // FRAG_BUFFERED
  // FRAG_LOADED
  // detectEvictedFragments(type, timeRange)
  // detectPartialFragments(fragment)
  // getPartialFragment(time)
  // getState(fragment)
  // cancelFragmentLoad(fragment)
  // onFragLoaded(e)
  // onBufferAppended(e)
  // onFragBuffered(e)
  describe('getPartialFragment', () => {
    let hls, fragmentTracker, fragment, buffered, partialFragment;

    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);

    fragment = {
      startPTS: 0,
      endPTS: 1,
      sn: 1,
      level: 1,
    };
    hls.trigger(Event.FRAG_LOADED, { frag: fragment });

    buffered = createMockBuffer([
      {
        startPTS: 0,
        endPTS: 0.5
      },
    ]);

    hls.trigger(Event.BUFFER_APPENDED, {timeRanges: {
        video: buffered,
        audio: buffered
      }});

    hls.trigger(Event.FRAG_BUFFERED, { frag: fragment });

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
      partialFragment = fragmentTracker.getPartialFragment(1.5);
      assert.strictEqual(partialFragment, null);
    });
  });

  describe('getState', () => {
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
      fragment: fragment
    };
    hls.trigger(Event.FRAG_LOADED, { frag: fragment });

    it('detects fragments that never loaded', () => {
      assert.strictEqual(fragmentTracker.getState(fragment), FragmentTrackerState.LOADING_BUFFER);
    });

    it('detects fragments that loaded properly', () => {
      buffered = createMockBuffer([
        {
          startPTS: 0,
          endPTS: 1
        },
      ]);
      hls.trigger(Event.BUFFER_APPENDED, {timeRanges: {
          video: buffered,
          audio: buffered
        }});

      hls.trigger(Event.FRAG_BUFFERED, { frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentTrackerState.NONE);
    });

    it('detects partial fragments', () => {
      buffered = createMockBuffer([
        {
          startPTS: 0.5,
          endPTS: 2
        },
      ]);
      hls.trigger(Event.BUFFER_APPENDED, {timeRanges: {
          video: buffered,
          audio: buffered
        }});

      hls.trigger(Event.FRAG_BUFFERED, { frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentTrackerState.PARTIAL);
    });

    it('removes evicted partial fragments', () => {
      buffered = createMockBuffer([
        {
          startPTS: 0.5,
          endPTS: 2
        },
      ]);
      hls.trigger(Event.BUFFER_APPENDED, {timeRanges: {
          video: buffered,
          audio: buffered
        }});
      hls.trigger(Event.FRAG_BUFFERED, { frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentTrackerState.PARTIAL);

      // Trim the buffer
      buffered = createMockBuffer([
        {
          startPTS: 0.75,
          endPTS: 2
        },
      ]);
      hls.trigger(Event.BUFFER_APPENDED, {timeRanges: {
          video: buffered,
          audio: buffered
        }});
      assert.strictEqual(fragmentTracker.getState(fragment), FragmentTrackerState.NONE);
    });
  });
});
