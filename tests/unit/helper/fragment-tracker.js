import Event from "../../../src/events";

const assert = require('assert');

import {FragmentTracker, FragmentState} from '../../../src/helper/fragment-tracker';
import Hls from '../../../src/hls';

function createMockBuffer(buffered) {
  return {
    start: i => (buffered.length > i) ? buffered[i].startPTS: null,
    end : i => (buffered.length > i) ? buffered[i].endPTS: null,
    length: buffered.length,
  };
}

function createMockFragment(data, types) {
  data._elementaryStreams = new Set(types);
  data.hasElementaryStream = (type) => {
    return data._elementaryStreams.has(type) === true;
  }
  return data;
}

describe('FragmentTracker', () => {
  describe('getPartialFragment', () => {
    let hls, fragmentTracker, fragment, buffered, partialFragment, timeRanges;

    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);

    fragment = createMockFragment({
      startPTS: 0,
      endPTS: 1,
      sn: 1,
      level: 1,
      type: 'main'
    }, ['audio', 'video']);

    hls.trigger(Event.FRAG_LOADED, { frag: fragment });

    buffered = createMockBuffer([
      {
        startPTS: 0,
        endPTS: 0.5
      },
    ]);

    timeRanges = {};
    timeRanges['video'] = buffered;
    timeRanges['audio'] = buffered;
    hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

    hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id : 'main', frag: fragment });

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
    let hls, fragmentTracker, fragment, buffered, timeRanges;

    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);


    let addFragment = () => {
      fragment = createMockFragment({
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 0,
        type: 'main'
      }, ['audio', 'video']);
      hls.trigger(Event.FRAG_LOADED, { frag: fragment });
    };

    it('detects fragments that never loaded', () => {
      addFragment();
      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.APPENDING);
    });

    it('detects fragments that loaded properly', () => {
      addFragment();
      buffered = createMockBuffer([
        {
          startPTS: 0,
          endPTS: 1
        },
      ]);

      timeRanges = {};
      timeRanges['video'] = buffered;
      timeRanges['audio'] = buffered;
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id : 'main', frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.OK);
    });

    it('detects partial fragments', () => {
      addFragment();
      buffered = createMockBuffer([
        {
          startPTS: 0.5,
          endPTS: 2
        },
      ]);
      timeRanges = {};
      timeRanges['video'] = buffered;
      timeRanges['audio'] = buffered;
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id : 'main', frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.PARTIAL);
    });

    it('removes evicted partial fragments', () => {
      addFragment();
      buffered = createMockBuffer([
        {
          startPTS: 0.5,
          endPTS: 2
        },
      ]);
      timeRanges = {};
      timeRanges['video'] = buffered;
      timeRanges['audio'] = buffered;
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id : 'main', frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.PARTIAL);

      // Trim the buffer
      buffered = createMockBuffer([
        {
          startPTS: 0.75,
          endPTS: 2
        },
      ]);
      timeRanges = {};
      timeRanges['video'] = buffered;
      timeRanges['audio'] = buffered;
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.NOT_LOADED);
    });
  });

  describe('onFragBuffered', () => {
    let hls, fragmentTracker, fragment, timeRanges;

    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);

    it('supports audio buffer', () => {
      fragment = createMockFragment({
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 1,
        type: 'main'
      }, ['audio', 'video']);
      hls.trigger(Event.FRAG_LOADED, { frag: fragment });

      timeRanges = {};
      timeRanges['video'] = createMockBuffer([
        {
          startPTS: 0,
          endPTS: 2
        },
      ]);
      timeRanges['audio'] = createMockBuffer([
        {
          startPTS: 0.5,
          endPTS: 2
        },
      ]);
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id : 'main', frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.PARTIAL);
    });

    it('supports video buffer', () => {
      fragment = createMockFragment({
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 1,
        type: 'main'
      }, ['audio', 'video']);
      hls.trigger(Event.FRAG_LOADED, { frag: fragment });

      timeRanges = {};
      timeRanges['video'] = createMockBuffer([
        {
          startPTS: 0.5,
          endPTS: 2
        },
      ]);
      timeRanges['audio'] = createMockBuffer([
        {
          startPTS: 0,
          endPTS: 2
        },
      ]);
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id : 'main', frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.PARTIAL);
    });

    it('supports audio only buffer', () => {
      fragment = createMockFragment({
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 1,
        type: 'audio'
      }, ['audio']);
      hls.trigger(Event.FRAG_LOADED, { frag: fragment });

      timeRanges = {};
      timeRanges['video'] = createMockBuffer([
        {
          startPTS: 0.5,
          endPTS: 2
        },
      ]);
      timeRanges['audio'] = createMockBuffer([
        {
          startPTS: 0,
          endPTS: 2
        },
      ]);
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id : 'main', frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.OK);
    });
  });
});
