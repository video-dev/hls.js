const assert = require('assert');

import Hls from '../../../src/hls';
import Event from '../../../src/events';
import { FragmentTracker, FragmentState } from '../../../src/controller/fragment-tracker';
import PlaylistLoader from '../../../src/loader/playlist-loader';

const LevelType = PlaylistLoader.LevelType;

function createMockBuffer (buffered) {
  return {
    start: i => (buffered.length > i) ? buffered[i].startPTS : null,
    end: i => (buffered.length > i) ? buffered[i].endPTS : null,
    length: buffered.length
  };
}

function createMockFragment (data, types) {
  data._elementaryStreams = new Set(types);
  data.hasElementaryStream = (type) => {
    return data._elementaryStreams.has(type) === true;
  };
  return data;
}

/**
 * load fragment as `buffered: false`
 * @param {Hls} hls
 * @param {Fragment} fragment
 */
function loadFragment (hls, fragment) {
  hls.trigger(Event.FRAG_LOADED, { frag: fragment });
}

/**
 * Load fragment to `buffered: true`
 * @param {Hls} hls
 * @param {Fragment} fragment
 */
function loadFragmentAndBuffered (hls, fragment) {
  loadFragment(hls, fragment);
  hls.trigger(Event.FRAG_BUFFERED, { frag: fragment });
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
      }
    ]);

    timeRanges = {};
    timeRanges['video'] = buffered;
    timeRanges['audio'] = buffered;
    hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

    hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id: 'main', frag: fragment });

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
        }
      ]);

      timeRanges = {};
      timeRanges['video'] = buffered;
      timeRanges['audio'] = buffered;
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id: 'main', frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.OK);
    });

    it('detects partial fragments', () => {
      addFragment();
      buffered = createMockBuffer([
        {
          startPTS: 0.5,
          endPTS: 2
        }
      ]);
      timeRanges = {};
      timeRanges['video'] = buffered;
      timeRanges['audio'] = buffered;
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id: 'main', frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.PARTIAL);
    });

    it('removes evicted partial fragments', () => {
      addFragment();
      buffered = createMockBuffer([
        {
          startPTS: 0.5,
          endPTS: 2
        }
      ]);
      timeRanges = {};
      timeRanges['video'] = buffered;
      timeRanges['audio'] = buffered;
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id: 'main', frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.PARTIAL);

      // Trim the buffer
      buffered = createMockBuffer([
        {
          startPTS: 0.75,
          endPTS: 2
        }
      ]);
      timeRanges = {};
      timeRanges['video'] = buffered;
      timeRanges['audio'] = buffered;
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.NOT_LOADED);
    });
  });

  describe('getBufferedFrag', function () {
    let hls;
    /** @type {FragmentTracker} */
    let fragmentTracker;
    beforeEach(() => {
      hls = new Hls({});
      fragmentTracker = new FragmentTracker(hls);
    });
    it('should return buffered fragment if found it', function () {
      const fragments = [
        // 0-1
        createMockFragment({
          startPTS: 0,
          endPTS: 1,
          sn: 1,
          level: 1,
          type: 'main'
        }, ['audio', 'video']),
        // 1-2
        createMockFragment({
          startPTS: 1,
          endPTS: 2,
          sn: 2,
          level: 1,
          type: 'main'
        }, ['audio', 'video']),
        // 2-3
        createMockFragment({
          startPTS: 2,
          endPTS: 3,
          sn: 3,
          level: 1,
          type: 'main'
        }, ['audio', 'video'])
      ];
      // load fragments to buffered
      fragments.forEach(fragment => {
        loadFragmentAndBuffered(hls, fragment);
      });
      assert.deepEqual(fragmentTracker.getBufferedFrag(0.0, LevelType.MAIN), fragments[0]);
      assert.deepEqual(fragmentTracker.getBufferedFrag(0.1, LevelType.MAIN), fragments[0]);
      assert.deepEqual(fragmentTracker.getBufferedFrag(1.0, LevelType.MAIN), fragments[1]);
      assert.deepEqual(fragmentTracker.getBufferedFrag(1.1, LevelType.MAIN), fragments[1]);
      assert.deepEqual(fragmentTracker.getBufferedFrag(2.0, LevelType.MAIN), fragments[2]);
      assert.deepEqual(fragmentTracker.getBufferedFrag(2.1, LevelType.MAIN), fragments[2]);
      assert.deepEqual(fragmentTracker.getBufferedFrag(2.9, LevelType.MAIN), fragments[2]);
      assert.deepEqual(fragmentTracker.getBufferedFrag(3.0, LevelType.MAIN), fragments[2]);
    });
    it('should return null if found it, but it is not buffered', function () {
      const fragments = [
        // 0-1
        createMockFragment({
          startPTS: 0,
          endPTS: 1,
          sn: 1,
          level: 1,
          type: 'main'
        }, ['audio', 'video']),
        // 1-2
        createMockFragment({
          startPTS: 1,
          endPTS: 2,
          sn: 2,
          level: 1,
          type: 'main'
        }, ['audio', 'video']),
        // 2-3
        createMockFragment({
          startPTS: 2,
          endPTS: 3,
          sn: 3,
          level: 1,
          type: 'main'
        }, ['audio', 'video'])
      ];
      // load fragments, but it is not buffered
      fragments.forEach(fragment => {
        loadFragment(hls, fragment);
      });
      assert.strictEqual(fragmentTracker.getBufferedFrag(0, LevelType.MAIN), null);
      assert.strictEqual(fragmentTracker.getBufferedFrag(1, LevelType.MAIN), null);
      assert.strictEqual(fragmentTracker.getBufferedFrag(2, LevelType.MAIN), null);
      assert.strictEqual(fragmentTracker.getBufferedFrag(3, LevelType.MAIN), null);
    });
    it('should return null if anyone does not match the position', function () {
      loadFragmentAndBuffered(hls, createMockFragment({
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 1,
        type: 'main'
      }, ['audio', 'video']));
      // not found
      assert.strictEqual(fragmentTracker.getBufferedFrag(1.1, LevelType.MAIN), null);
    });
    it('should return null if fragmentTracker not have any fragments', function () {
      assert.strictEqual(fragmentTracker.getBufferedFrag(0, LevelType.MAIN), null);
    });
    it('should return null if not found match levelType', function () {
      loadFragmentAndBuffered(hls, createMockFragment({
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 1,
        type: LevelType.AUDIO // <= level type is not "main"
      }, ['audio', 'video']));

      assert.strictEqual(fragmentTracker.getBufferedFrag(0, LevelType.MAIN), null);
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
        }
      ]);
      timeRanges['audio'] = createMockBuffer([
        {
          startPTS: 0.5,
          endPTS: 2
        }
      ]);
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id: 'main', frag: fragment });

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
        }
      ]);
      timeRanges['audio'] = createMockBuffer([
        {
          startPTS: 0,
          endPTS: 2
        }
      ]);
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id: 'main', frag: fragment });

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
        }
      ]);
      timeRanges['audio'] = createMockBuffer([
        {
          startPTS: 0,
          endPTS: 2
        }
      ]);
      hls.trigger(Event.BUFFER_APPENDED, { timeRanges });

      hls.trigger(Event.FRAG_BUFFERED, { stats: { aborted: true }, id: 'main', frag: fragment });

      assert.strictEqual(fragmentTracker.getState(fragment), FragmentState.OK);
    });
  });

  describe('removeFragment', () => {
    /** @type {Hls} */
    let hls;
    /** @type {FragmentTracker} */
    let fragmentTracker;
    beforeEach(() => {
      hls = new Hls({});
      fragmentTracker = new FragmentTracker(hls);
    });
    it('should remove fragment', () => {
      const fragment = createMockFragment({
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 1,
        type: 'main'
      }, ['audio', 'video']);
      // load fragments to buffered
      loadFragmentAndBuffered(hls, fragment);
      assert.strictEqual(fragmentTracker.hasFragment(fragment), true);
      // Remove the fragment
      fragmentTracker.removeFragment(fragment);
      // Check
      assert.strictEqual(fragmentTracker.hasFragment(fragment), false);
    });
  });
  describe('removeAllFragments', () => {
    /** @type {Hls} */
    let hls;
    /** @type {FragmentTracker} */
    let fragmentTracker;
    beforeEach(() => {
      hls = new Hls({});
      fragmentTracker = new FragmentTracker(hls);
    });
    it('should remove all fragments', () => {
      const fragments = [
        // 0-1
        createMockFragment({
          startPTS: 0,
          endPTS: 1,
          sn: 1,
          level: 1,
          type: 'main'
        }, ['audio', 'video']),
        // 1-2
        createMockFragment({
          startPTS: 1,
          endPTS: 2,
          sn: 2,
          level: 1,
          type: 'main'
        }, ['audio', 'video']),
        // 2-3
        createMockFragment({
          startPTS: 2,
          endPTS: 3,
          sn: 3,
          level: 1,
          type: 'main'
        }, ['audio', 'video'])
      ];
      // load fragments to buffered
      fragments.forEach(fragment => {
        loadFragmentAndBuffered(hls, fragment);
      });
      // before
      fragments.forEach(fragment => {
        assert.strictEqual(fragmentTracker.hasFragment(fragment), true);
      });
      // Remove all fragments
      fragmentTracker.removeAllFragments();
      // after
      fragments.forEach(fragment => {
        assert.strictEqual(fragmentTracker.hasFragment(fragment), false);
      });
    });
  });
});
