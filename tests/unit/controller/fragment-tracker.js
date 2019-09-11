import Hls from '../../../src/hls';
import Event from '../../../src/events';
import { FragmentTracker, FragmentState } from '../../../src/controller/fragment-tracker';
import { PlaylistLevelType } from '../../../src/types/loader';

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
describe('FragmentTracker', function () {
  describe('getPartialFragment', function () {
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

    it('detects fragments that partially loaded', function () {
      // Get the partial fragment at a time
      partialFragment = fragmentTracker.getPartialFragment(0);
      expect(partialFragment).to.equal(fragment);
      partialFragment = fragmentTracker.getPartialFragment(0.5);
      expect(partialFragment).to.equal(fragment);
      partialFragment = fragmentTracker.getPartialFragment(1);
      expect(partialFragment).to.equal(fragment);
    });
    it('returns null when time is not inside partial fragment', function () {
      partialFragment = fragmentTracker.getPartialFragment(1.5);
      expect(partialFragment).to.not.exist;
    });
  });

  describe('getState', function () {
    let hls, fragmentTracker, fragment, buffered, timeRanges;

    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);

    let addFragment = function () {
      fragment = createMockFragment({
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 0,
        type: 'main'
      }, ['audio', 'video']);
      hls.trigger(Event.FRAG_LOADED, { frag: fragment });
    };

    it('detects fragments that never loaded', function () {
      addFragment();
      expect(fragmentTracker.getState(fragment)).to.equal(FragmentState.APPENDING);
    });

    it('detects fragments that loaded properly', function () {
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

      expect(fragmentTracker.getState(fragment)).to.equal(FragmentState.OK);
    });

    it('detects partial fragments', function () {
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

      expect(fragmentTracker.getState(fragment)).to.equal(FragmentState.PARTIAL);
    });

    it('removes evicted partial fragments', function () {
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

      expect(fragmentTracker.getState(fragment)).to.equal(FragmentState.PARTIAL);

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

      expect(fragmentTracker.getState(fragment)).to.equal(FragmentState.NOT_LOADED);
    });
  });

  describe('getBufferedFrag', function () {
    let hls;
    /** @type {FragmentTracker} */
    let fragmentTracker;
    beforeEach(function () {
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
      expect(fragmentTracker.getBufferedFrag(0.0, PlaylistLevelType.MAIN)).to.equal(fragments[0]);
      expect(fragmentTracker.getBufferedFrag(0.1, PlaylistLevelType.MAIN)).to.equal(fragments[0]);
      expect(fragmentTracker.getBufferedFrag(1.0, PlaylistLevelType.MAIN)).to.equal(fragments[1]);
      expect(fragmentTracker.getBufferedFrag(1.1, PlaylistLevelType.MAIN)).to.equal(fragments[1]);
      expect(fragmentTracker.getBufferedFrag(2.0, PlaylistLevelType.MAIN)).to.equal(fragments[2]);
      expect(fragmentTracker.getBufferedFrag(2.1, PlaylistLevelType.MAIN)).to.equal(fragments[2]);
      expect(fragmentTracker.getBufferedFrag(2.9, PlaylistLevelType.MAIN)).to.equal(fragments[2]);
      expect(fragmentTracker.getBufferedFrag(3.0, PlaylistLevelType.MAIN)).to.equal(fragments[2]);
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
      expect(fragmentTracker.getBufferedFrag(0, PlaylistLevelType.MAIN)).to.not.exist;
      expect(fragmentTracker.getBufferedFrag(1, PlaylistLevelType.MAIN)).to.not.exist;
      expect(fragmentTracker.getBufferedFrag(2, PlaylistLevelType.MAIN)).to.not.exist;
      expect(fragmentTracker.getBufferedFrag(3, PlaylistLevelType.MAIN)).to.not.exist;
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
      expect(fragmentTracker.getBufferedFrag(1.1, PlaylistLevelType.MAIN)).to.not.exist;
    });
    it('should return null if fragmentTracker not have any fragments', function () {
      expect(fragmentTracker.getBufferedFrag(0, PlaylistLevelType.MAIN)).to.not.exist;
    });
    it('should return null if not found match levelType', function () {
      loadFragmentAndBuffered(hls, createMockFragment({
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 1,
        type: PlaylistLevelType.AUDIO // <= level type is not "main"
      }, ['audio', 'video']));

      expect(fragmentTracker.getBufferedFrag(0, PlaylistLevelType.MAIN)).to.not.exist;
    });
  });

  describe('onFragBuffered', function () {
    let hls, fragmentTracker, fragment, timeRanges;

    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);

    it('supports audio buffer', function () {
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

      expect(fragmentTracker.getState(fragment)).to.equal(FragmentState.PARTIAL);
    });

    it('supports video buffer', function () {
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

      expect(fragmentTracker.getState(fragment)).to.equal(FragmentState.PARTIAL);
    });

    it('supports audio only buffer', function () {
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

      expect(fragmentTracker.getState(fragment)).to.equal(FragmentState.OK);
    });
  });

  describe('removeFragment', function () {
    /** @type {Hls} */
    let hls;
    /** @type {FragmentTracker} */
    let fragmentTracker;
    beforeEach(function () {
      hls = new Hls({});
      fragmentTracker = new FragmentTracker(hls);
    });
    it('should remove fragment', function () {
      const fragment = createMockFragment({
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 1,
        type: 'main'
      }, ['audio', 'video']);
      // load fragments to buffered
      loadFragmentAndBuffered(hls, fragment);
      expect(fragmentTracker.hasFragment(fragment)).to.be.true;
      // Remove the fragment
      fragmentTracker.removeFragment(fragment);
      // Check
      expect(fragmentTracker.hasFragment(fragment)).to.be.false;
    });
  });
  describe('removeAllFragments', function () {
    /** @type {Hls} */
    let hls;
    /** @type {FragmentTracker} */
    let fragmentTracker;
    beforeEach(function () {
      hls = new Hls({});
      fragmentTracker = new FragmentTracker(hls);
    });
    it('should remove all fragments', function () {
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
        expect(fragmentTracker.hasFragment(fragment)).to.be.true;
      });
      // Remove all fragments
      fragmentTracker.removeAllFragments();
      // after
      fragments.forEach(fragment => {
        expect(fragmentTracker.hasFragment(fragment)).to.be.false;
      });
    });
  });
});
