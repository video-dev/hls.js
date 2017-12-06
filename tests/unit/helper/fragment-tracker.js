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

describe('FragmentTracker', () => {
  describe('getPartialFragment', () => {
    let hls, fragmentTracker, fragment, buffered, partialFragment;

    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);

    fragment = {
      startPTS: 0,
      endPTS: 1,
      sn: 1,
      level: 1,
      type: 'main'
    };
    hls.trigger(Event.FRAG_LOADED, { frag: fragment });

    buffered = createMockBuffer([
      {
        startPTS: 0,
        endPTS: 0.5
      },
    ]);

    hls.trigger(Event.BUFFER_APPENDED, {
      timeRanges: {
        video: buffered,
        audio: buffered
      }
    });

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
    let hls, fragmentTracker, fragment, buffered;

    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);

    fragment = {
      startPTS: 0,
      endPTS: 1,
      sn: 1,
      level: 1,
      type: 'main'
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
      hls.trigger(Event.BUFFER_APPENDED, {
        timeRanges: {
          video: buffered,
          audio: buffered
        }
      });

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
      hls.trigger(Event.BUFFER_APPENDED, {
        timeRanges: {
          video: buffered,
          audio: buffered
        }
      });

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
      hls.trigger(Event.BUFFER_APPENDED, {
        timeRanges: {
          video: buffered,
          audio: buffered
        }
      });
      hls.trigger(Event.FRAG_BUFFERED, { frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentTrackerState.PARTIAL);

      // Trim the buffer
      buffered = createMockBuffer([
        {
          startPTS: 0.75,
          endPTS: 2
        },
      ]);
      hls.trigger(Event.BUFFER_APPENDED, {
        timeRanges: {
          video: buffered,
          audio: buffered
        }
      });
      assert.strictEqual(fragmentTracker.getState(fragment), FragmentTrackerState.NONE);
    });
  });

  describe('onFragBuffered', () => {
    let hls, fragmentTracker, fragment;

    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);

    it('supports audio buffer', () => {
      fragment = {
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 1,
        type: 'main'
      };
      hls.trigger(Event.FRAG_LOADED, { frag: fragment });

      hls.trigger(Event.BUFFER_APPENDED, {
        timeRanges: {
          video: createMockBuffer([
            {
              startPTS: 0,
              endPTS: 2
            },
          ]),
          audio: createMockBuffer([
            {
              startPTS: 0.5,
              endPTS: 2
            },
          ])
        }
      });
      hls.trigger(Event.FRAG_BUFFERED, { frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentTrackerState.PARTIAL);
    });

    it('supports video buffer', () => {
      fragment = {
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 1,
        type: 'main'
      };
      hls.trigger(Event.FRAG_LOADED, { frag: fragment });
      hls.trigger(Event.BUFFER_APPENDED, {
        timeRanges: {
          video: createMockBuffer([
            {
              startPTS: 0.5,
              endPTS: 2
            },
          ]),
          audio: createMockBuffer([
            {
              startPTS: 0,
              endPTS: 2
            },
          ])
        }
      });
      hls.trigger(Event.FRAG_BUFFERED, { frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentTrackerState.PARTIAL);
    });

    it('supports audio only buffer', () => {
      fragment = {
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 1,
        type: 'audio'
      };
      hls.trigger(Event.FRAG_LOADED, { frag: fragment });
      hls.trigger(Event.BUFFER_APPENDED, {
        timeRanges: {
          video: createMockBuffer([
            {
              startPTS: 0.5,
              endPTS: 2
            },
          ]),
          audio: createMockBuffer([
            {
              startPTS: 0,
              endPTS: 2
            },
          ])
        }
      });
      hls.trigger(Event.FRAG_BUFFERED, { frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentTrackerState.NONE);
    });
  });
});
