import assert from "assert";
import sinon from "sinon";
import Hls from "../../../src/hls";
import Event from "../../../src/events";
import { FragmentTracker } from "../../../src/helper/fragment-tracker";
import StreamController, { State } from "../../../src/controller/stream-controller";
import M3U8Parser from "../../../src/loader/m3u8-parser";

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
