import TimelineController from '../../../src/controller/timeline-controller';
import Hls from '../../../src/hls';
const sinon = require('sinon');

const assert = require('assert');

describe('Non-Native TimelineController functions', () => {
  let timelineController;
  let hls;

  beforeEach(() => {
    hls = new Hls();
    hls.config.renderNatively = false;
    hls.config.enableWebVTT = true;
    timelineController = new TimelineController(hls);
    timelineController.media = document.createElement('video');
  });

  it('has the createNonNativeTrack method', function () {
    assert.strictEqual(typeof timelineController.createNonNativeTrack, 'function');
  });

  it('has the createNativeTrack method', function () {
    assert.strictEqual(typeof timelineController.createNativeTrack, 'function');
  });

  it('calls createNonNativeTrack when renderNatively is false', function () {
    const nonNativeSpy = sinon.spy();
    timelineController.createNonNativeTrack = nonNativeSpy;

    timelineController.createCaptionsTrack('foo');
    assert.strictEqual(nonNativeSpy.calledOnce, true);
  });

  it('fires the NON_NATIVE_TEXT_TRACKS_FOUND event', function (done) {
    hls.on(Hls.Events.NON_NATIVE_TEXT_TRACKS_FOUND, (event, data) => {
      const track = data.tracks[0];
      assert.strictEqual(track._id, 'textTrack1');
      assert.strictEqual(track.kind, 'captions');
      assert.strictEqual(track.default, false);
      assert.strictEqual(track.label, timelineController.captionsProperties['textTrack1'].label);
      assert.strictEqual(timelineController.captionsTracks['textTrack1'], track);
      done();
    });

    timelineController.createNonNativeTrack('textTrack1');
  });

  it('does not create a non native track if the track does not have any defined properties', function () {
    const triggerSpy = sinon.spy(hls, 'trigger');
    timelineController.createNonNativeTrack('foo');
    assert.strictEqual(triggerSpy.notCalled, true);
  });
});
