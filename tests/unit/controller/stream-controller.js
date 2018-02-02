import assert from "assert";
import sinon from "sinon";
import Hls from "../../../src/hls";
import Event from "../../../src/events";
import { FragmentTracker } from "../../../src/helper/fragment-tracker";
import StreamController, { State } from "../../../src/controller/stream-controller";

/**
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

describe("StreamController", function() {
  it("initial state should be STOPPED", function() {
    const { streamController } = createStreamController();
    assert.equal(streamController.state, State.STOPPED);
  });
  it("should trigger STREAM_STATE_TRANSITION when state is updated", function() {
    const { hls, streamController } = createStreamController();
    const spy = sinon.spy();
    hls.on(Event.STREAM_STATE_TRANSITION, spy);
    streamController.state = State.ENDED;
    assert.deepEqual(spy.args[0][1], { previousState: State.STOPPED, nextState: State.ENDED });
  });
});
