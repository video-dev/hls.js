import assert from 'assert';
import sinon from 'sinon';
import Hls from '../../../src/hls';
import Event from '../../../src/events';
import { FragmentTracker } from '../../../src/helper/fragment-tracker';
import StreamController, { State } from '../../../src/controller/stream-controller';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { mockFragments } from '../../mocks/data';

describe('StreamController tests', function () {
  let hls;
  let fragmentTracker;
  let streamController;
  beforeEach(function () {
    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);
    streamController = new StreamController(hls, fragmentTracker);
    streamController.startFragRequested = true;
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

  describe('SN Searching', function () {
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
      endSN: mockFragments[mockFragments.length - 1].sn
    };
    let bufferEnd = fragPrevious.start + fragPrevious.duration;
    let end = mockFragments[mockFragments.length - 1].start + mockFragments[mockFragments.length - 1].duration;

    before(function () {
      levelDetails.hasProgramDateTime = false;
    });

    it('SN search choosing wrong fragment (3 instead of 2) after level loaded', function () {
      let foundFragment = streamController._findFragment(0, fragPrevious, fragLen, mockFragments, bufferEnd, end, levelDetails);
      let resultSN = foundFragment ? foundFragment.sn : -1;
      assert.equal(foundFragment, mockFragments[3], 'Expected sn 3, found sn segment ' + resultSN);
    });

    it('SN search choosing the right segment if fragPrevious is not available', function () {
      let foundFragment = streamController._findFragment(0, null, fragLen, mockFragments, bufferEnd, end, levelDetails);
      let resultSN = foundFragment ? foundFragment.sn : -1;
      assert.equal(foundFragment, mockFragments[3], 'Expected sn 2, found sn segment ' + resultSN);
    });

    it('returns the last fragment if the stream is fully buffered', function () {
      const actual = streamController._findFragment(0, null, mockFragments.length, mockFragments, end, end, levelDetails);
      assert.strictEqual(actual, mockFragments[mockFragments.length - 1]);
    });

    describe('PDT Searching during a live stream', function () {
      before(function () {
        levelDetails.hasProgramDateTime = true;
      });

      it('PDT search choosing fragment after level loaded', function () {
        levelDetails.PTSKnown = false;
        levelDetails.live = true;

        let foundFragment = streamController._ensureFragmentAtLivePoint(levelDetails, bufferEnd, 0, end, fragPrevious, mockFragments, mockFragments.length);
        let resultSN = foundFragment ? foundFragment.sn : -1;
        assert.equal(foundFragment, mockFragments[2], 'Expected sn 2, found sn segment ' + resultSN);
      });

      it('PDT search hitting empty discontinuity', function () {
        let discontinuityPDTHit = 6.00;

        let foundFragment = streamController._ensureFragmentAtLivePoint(levelDetails, discontinuityPDTHit, 0, end, fragPrevious, mockFragments, mockFragments.length);
        let resultSN = foundFragment ? foundFragment.sn : -1;
        assert.equal(foundFragment, mockFragments[2], 'Expected sn 2, found sn segment ' + resultSN);
      });
    });
  });
});
