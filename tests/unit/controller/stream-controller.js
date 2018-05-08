import assert from 'assert';
import sinon from 'sinon';
import Hls from '../../../src/hls';
import Event from '../../../src/events';
import { FragmentTracker, FragmentState } from '../../../src/controller/fragment-tracker';
import StreamController, { State } from '../../../src/controller/stream-controller';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { mockFragments } from '../../mocks/data';
import Fragment from '../../../src/loader/fragment';

describe('StreamController tests', function () {
  let hls;
  let fragmentTracker;
  let streamController;
  beforeEach(function () {
    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);
    streamController = new StreamController(hls, fragmentTracker);
  });

  /**
   * Assert: streamController should be started
   * @param {StreamController} streamController
   */
  const assertStreamControllerStarted = (streamController) => {
    assert.equal(streamController.hasInterval(), true, 'StreamController should start interval');
    assert.notDeepEqual(streamController.state, State.STOPPED, 'StreamController\'s state should not be STOPPED');
  };

  /**
   * Assert: streamController should be stopped
   * @param {StreamController} streamController
   */
  const assertStreamControllerStopped = (streamController) => {
    assert.equal(streamController.hasInterval(), false, 'StreamController should stop interval');
    assert.equal(streamController.state, State.STOPPED, 'StreamController\'s state should be STOPPED');
  };

  describe('StreamController', function () {
    it('should be STOPPED when it is initialized', function () {
      assertStreamControllerStopped(streamController);
    });

    it('should trigger STREAM_STATE_TRANSITION when state is updated', function () {
      const spy = sinon.spy();
      hls.on(Event.STREAM_STATE_TRANSITION, spy);
      streamController.state = State.ENDED;
      assert.deepEqual(spy.args[0][1], { previousState: State.STOPPED, nextState: State.ENDED });
    });

    it('should not trigger STREAM_STATE_TRANSITION when state is not updated', function () {
      const spy = sinon.spy();
      hls.on(Event.STREAM_STATE_TRANSITION, spy);
      // no update
      streamController.state = State.STOPPED;
      assert.equal(spy.called, false);
    });

    it('should not start when controller have not levels data', function () {
      streamController.startLoad(1);
      assertStreamControllerStopped(streamController);
    });

    it('should start when controller have levels data', function () {
      const manifest = `#EXTM3U
  #EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,RESOLUTION=848x360,NAME="480"
  http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;
      const levels = M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
      // load levels data
      streamController.onManifestParsed({
        levels
      });
      streamController.startLoad(1);
      assertStreamControllerStarted(streamController);
      streamController.stopLoad();
      assertStreamControllerStopped(streamController);
    });
  });

  describe('PDT vs SN tests for discontinuities with PDT', function () {
    let PDT = 'Fri Sep 15 2017 12:11:01:523 GMT-0700 (Pacific Daylight Time)';
    let fragPrevious = {
      pdt: 1505502671523,
      endPdt: 1505502676523,
      duration: 5.000,
      level: 1,
      start: 10.000,
      sn: 2, // Fragment with PDT 1505502671523 in level 1 does not have the same sn as in level 2 where cc is 1
      cc: 0
    };

    let fragLen = mockFragments.length;
    let levelDetails = {
      startSN: mockFragments[0].sn,
      endSN: mockFragments[mockFragments.length - 1].sn,
      programDateTime: null // If this field is null SN search is used by default, if set is PDT
    };
    let bufferEnd = fragPrevious.start + fragPrevious.duration;
    let end = mockFragments[mockFragments.length - 1].start + mockFragments[mockFragments.length - 1].duration;

    it('SN search choosing wrong fragment (3 instead of 2) after level loaded', function () {
      levelDetails.programDateTime = null;

      let foundFragment = streamController._findFragment(0, fragPrevious, fragLen, mockFragments, bufferEnd, end, levelDetails);
      let resultSN = foundFragment ? foundFragment.sn : -1;
      assert.equal(foundFragment, mockFragments[3], 'Expected sn 3, found sn segment ' + resultSN);
    });

    // TODO: This test fails if using a real instance of Hls
    it('SN search choosing the right segment if fragPrevious is not available', function () {
      levelDetails.programDateTime = null;

      let foundFragment = streamController._findFragment(0, null, fragLen, mockFragments, bufferEnd, end, levelDetails);
      let resultSN = foundFragment ? foundFragment.sn : -1;
      assert.equal(foundFragment, mockFragments[3], 'Expected sn 2, found sn segment ' + resultSN);
    });

    it('PDT search choosing fragment after level loaded', function () {
      levelDetails.programDateTime = PDT;// If programDateTime contains a date then PDT is used

      let foundFragment = streamController._findFragment(0, fragPrevious, fragLen, mockFragments, bufferEnd, end, levelDetails);
      let resultSN = foundFragment ? foundFragment.sn : -1;
      assert.equal(foundFragment, mockFragments[3], 'Expected sn 3, found sn segment ' + resultSN);
    });

    it('PDT search choosing fragment after starting/seeking to a new position (bufferEnd used)', function () {
      levelDetails.programDateTime = PDT;// If programDateTime contains a date then PDT is used
      let mediaSeekingTime = 17.00;

      let foundFragment = streamController._findFragment(0, null, fragLen, mockFragments, mediaSeekingTime, end, levelDetails);
      let resultSN = foundFragment ? foundFragment.sn : -1;
      assert.equal(foundFragment, mockFragments[3], 'Expected sn 3, found sn segment ' + resultSN);
    });

    it('PDT serch hitting empty discontinuity', function () {
      levelDetails.programDateTime = PDT;// If programDateTime contains a date then PDT is used
      let discontinuityPDTHit = 6.00;

      let foundFragment = streamController._findFragment(0, null, fragLen, mockFragments, discontinuityPDTHit, end, levelDetails);
      let resultSN = foundFragment ? foundFragment.sn : -1;
      assert.equal(foundFragment, mockFragments[1], 'Expected sn 1, found sn segment ' + resultSN);
    });

    it('finds the next fragment by SN if finding by PDT returns a frag out of tolerance', function () {
      levelDetails.programDateTime = PDT;
      const fragments = [mockFragments[0], mockFragments[0], mockFragments[1]];
      const bufferEnd = fragments[1].start + fragments[1].duration;
      const end = fragments[2].start + fragments[2].duration;

      const expected = fragments[2];
      const actual = streamController._findFragment(0, fragments[1], fragments.length, fragments, bufferEnd, end, levelDetails);
      assert.strictEqual(expected, actual);
    });
  });

  describe('fragment loading', function () {
    function fragStateStub (state) {
      return sinon.stub(fragmentTracker, 'getState').callsFake(() => state);
    }

    let triggerSpy;
    let frag;
    beforeEach(function () {
      triggerSpy = sinon.spy(hls, 'trigger');
      frag = new Fragment();
    });

    function assertLoadingState (frag) {
      assert(triggerSpy.calledWith(Event.FRAG_LOADING, { frag }),
        `Was expecting trigger to be called with FRAG_LOADING, but received ${triggerSpy.notCalled ? 'no calls' : triggerSpy.getCalls()}`);
      assert.strictEqual(streamController.state, State.FRAG_LOADING);
    }

    function assertNotLoadingState () {
      assert(triggerSpy.notCalled);
      assert(hls.state !== State.FRAG_LOADING);
    }

    it('should load a complete fragment which has not been previously appended', function () {
      fragStateStub(FragmentState.NOT_LOADED);
      streamController._loadFragment(frag);
      assertLoadingState(frag);
    });

    it('should load a partial fragment', function () {
      fragStateStub(FragmentState.PARTIAL);
      streamController._loadFragment(frag);
      assertLoadingState(frag);
    });

    it('should load a frag which has backtracked', function () {
      fragStateStub(FragmentState.OK);
      frag.backtracked = true;
      streamController._loadFragment(frag);
      assertLoadingState(frag);
    });

    it('should not load a fragment which has completely & successfully loaded', function () {
      fragStateStub(FragmentState.OK);
      streamController._loadFragment(frag);
      assertNotLoadingState();
    });

    it('should not load a fragment while it is appending', function () {
      fragStateStub(FragmentState.APPENDING);
      streamController._loadFragment(frag);
      assertNotLoadingState();
    });
  });
});
