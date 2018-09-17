import assert from 'assert';
import sinon from 'sinon';
import Hls from '../../../src/hls';
import Event from '../../../src/events';
import { FragmentTracker, FragmentState } from '../../../src/controller/fragment-tracker';
import { SubtitleStreamController, SubtitleStreamControllerState } from '../../../src/controller/subtitle-stream-controller';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { mockFragments } from '../../mocks/data';
import Fragment from '../../../src/loader/fragment';

const State = SubtitleStreamControllerState;

describe.only('SubtitleStreamController', function () {
  let hls;
  let fragmentTracker;
  let streamController;

  beforeEach(function () {
    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);
    streamController = new SubtitleStreamController(hls, fragmentTracker);
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

  it('should be STOPPED when it is initialized', function () {
    assertStreamControllerStopped(streamController);
  });

  it('should not start without tracks data', function () {
    streamController.startLoad(1);
    assertStreamControllerStopped(streamController);
  });
});
