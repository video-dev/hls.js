import assert from "assert";
import sinon from "sinon";
import Hls from "../../../src/hls";
import Event from "../../../src/events";
import { FragmentTracker } from "../../../src/helper/fragment-tracker";
import StreamController, { State } from "../../../src/controller/stream-controller";
import M3U8Parser from "../../../src/loader/m3u8-parser";


describe('StreamController tests', function() {

  /**
   * Create StreamController instance with initial setting
   * @returns {{hls: Hls, streamController: StreamController}}
   */
  const createStreamController = () => {
    const hls = new Hls({});
    const fragmentTracker = new FragmentTracker(hls);
    return {
      hls,
      streamController: new StreamController(hls, fragmentTracker)
    };
  };

  /**
   * Assert: streamController should be started
   * @param {StreamController} streamController
   */
  const assertStreamControllerStarted = (streamController) => {
    assert.equal(streamController.hasInterval(), true, "StreamController should start interval");
    assert.notDeepEqual(streamController.state, State.STOPPED, "StreamController's state should not be STOPPED");
  };

  /**
   * Assert: streamController should be stopped
   * @param {StreamController} streamController
   */
  const assertStreamControllerStopped = (streamController) => {
    assert.equal(streamController.hasInterval(), false, "StreamController should stop interval");
    assert.equal(streamController.state, State.STOPPED, "StreamController's state should be STOPPED");
  };

  describe("StreamController", function() {
    it("should be STOPPED when it is initialized", function() {
      const { streamController } = createStreamController();
      assertStreamControllerStopped(streamController);
    });

    it("should trigger STREAM_STATE_TRANSITION when state is updated", function() {
      const { hls, streamController } = createStreamController();
      const spy = sinon.spy();
      hls.on(Event.STREAM_STATE_TRANSITION, spy);
      streamController.state = State.ENDED;
      assert.deepEqual(spy.args[0][1], { previousState: State.STOPPED, nextState: State.ENDED });
    });

    it("should not trigger STREAM_STATE_TRANSITION when state is not updated", function() {
      const { hls, streamController } = createStreamController();
      const spy = sinon.spy();
      hls.on(Event.STREAM_STATE_TRANSITION, spy);
      // no update
      streamController.state = State.STOPPED;
      assert.equal(spy.called, false);
    });

    it("should not start when controller have not levels data", function() {
      const { streamController } = createStreamController();
      streamController.startLoad(1);
      assertStreamControllerStopped(streamController);
    });

    it("should start when controller have levels data", function() {
      const { streamController } = createStreamController();
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
      assertStreamControllerStopped(streamController)
    });
  });

	describe('PDT vs SN tests for discontinuities with PDT', function() {
		var fragPrevious = {
			pdt : 1505502671523,
			endPdt : 1505502676523,
			duration : 5000,
			level : 1,
			start : 10000,
			sn : 2,
			cc : 0
		}

		var fragments = [
		{
			pdt : 1505502661523,
			endPdt : 1505502666523,
			level : 2,
			duration : 5000,
			start : 0,
			sn : 0,
			cc : 0
		},
		//Discontinuity with PDT 1505502671523
		{
			pdt : 1505502671523,
			endPdt : 1505502676523,
			level : 2,
			duration : 5000,
			start : 5000,
			sn : 2,
			cc : 1
		},
		{
			pdt : 1505502676523,
			endPdt : 1505502681523,
			level : 2,
			duration : 5000,
			start : 10000,
			sn : 3,
			cc : 1
		},
		{
			pdt : 1505502681523,
			endPdt : 1505502686523,
			level : 2,
			duration : 5000,
			start : 15000,
			sn : 4,
			cc : 1
		},
		{
			pdt : 1505502686523,
			endPdt : 1505502691523,
			level : 2,
			duration : 5000,
			start : 20000,
			sn : 5,
			cc : 1
		}
		];

		var fragLen = fragments.length;
		var levelDetails ={
			startSN : fragments[0].sn,
			endSN : fragments[fragments.length - 1].sn,
			programDateTime : undefined //If this field is undefined SN search is used by default
		};
		var bufferEnd = fragPrevious.start + fragPrevious.duration;
		var end = fragments[fragments.length - 1].start + fragments[fragments.length - 1].duration;

	  it('SN search choosing fragment after level loaded', function () {
		var config = {};
		var hls = {
			config : config,
			on : function(){}
		};

		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragment(0, fragPrevious, fragLen, fragments, bufferEnd, end, levelDetails);

		var resultSN = foundFragment ? foundFragment.sn : -1;
		assert.equal(foundFragment, fragments[3], "Expected sn 4, found sn segment " + resultSN);

	  });

	  it('PDT search choosing fragment after level loaded', function () {
		var config = {};
		var hls = {
			config : config,
			on : function(){}
		};
		levelDetails.programDateTime = true;// If programDateTime contains a date then PDT is used (boolean used to mock)

		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragment(0, fragPrevious, fragLen, fragments, bufferEnd, end, levelDetails);

		var resultSN = foundFragment ? foundFragment.sn : -1;
		assert.equal(foundFragment, fragments[2], "Expected sn 3, found sn segment " + resultSN);

	  });

	  it('Unit test _findFragmentBySN', function () {
		var config = { };
		var hls = {
			config : config,
			on : function(){}
		};
		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragmentBySN(fragPrevious, fragments, bufferEnd, end);

		var resultSN = foundFragment ? foundFragment.sn : -1;
		assert.equal(foundFragment, fragments[3], "Expected sn 4, found sn segment " + resultSN);

	  });

	  it('Unit test _findFragmentByPDT usual behaviour', function () {
		var config = { };
		var hls = {
			config : config,
			on : function(){}
		};
		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragmentByPDT(fragments, fragPrevious.endPdt + 1);

		var resultSN = foundFragment ? foundFragment.sn : -1;
		assert.equal(foundFragment, fragments[2], "Expected sn 3, found sn segment " + resultSN);

	  });

	  it('Unit test _findFragmentByPDT beyond limits', function () {
		var config = { };
		var hls = {
			config : config,
			on : function(){}
		};
		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragmentByPDT(fragments, fragments[0].pdt - 1);
		var resultSN = foundFragment ? foundFragment.sn : -1;
		assert.equal(foundFragment, null, "Expected sn -1, found sn segment " + resultSN);

		foundFragment = streamController._findFragmentByPDT(fragments, fragments[fragments.length - 1].endPdt + 1);
		resultSN = foundFragment ? foundFragment.sn : -1;
		assert.equal(foundFragment, null, "Expected sn -1, found sn segment " + resultSN);
	  });

	  it('Unit test _findFragmentByPDT at the beginning', function () {
		var config = { };
		var hls = {
			config : config,
			on : function(){}
		};
		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragmentByPDT(fragments, fragments[0].pdt);

		var resultSN = foundFragment ? foundFragment.sn : -1;
		assert.equal(foundFragment, fragments[0], "Expected sn 1, found sn segment " + resultSN);
	  });

	  it('Unit test _findFragmentByPDT for last segment', function () {
		var config = { };
		var hls = {
			config : config,
			on : function(){}
		};
		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragmentByPDT(fragments, fragments[fragments.length - 1].pdt );

		var resultSN = foundFragment ? foundFragment.sn : -1;
		assert.equal(foundFragment, fragments[4], "Expected sn 5, found sn segment " + resultSN);
	  });
	});

});
