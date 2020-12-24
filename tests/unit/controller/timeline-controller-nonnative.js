import { TimelineController } from '../../../src/controller/timeline-controller';
import Hls from '../../../src/hls';
const sinon = require('sinon');

describe('Non-Native TimelineController functions', function () {
  let timelineController;
  let hls;

  beforeEach(function () {
    hls = new Hls();
    hls.config.renderTextTracksNatively = false;
    hls.config.enableWebVTT = true;
    timelineController = new TimelineController(hls);
    timelineController.media = document.createElement('video');
  });

  it('has the createNonNativeTrack method', function () {
    expect(timelineController.createNonNativeTrack).to.be.a('function');
  });

  it('has the createNativeTrack method', function () {
    expect(timelineController.createNativeTrack).to.be.a('function');
  });

  it('calls createNonNativeTrack when renderTextTracksNatively is false', function () {
    const nonNativeSpy = sinon.spy();
    timelineController.createNonNativeTrack = nonNativeSpy;

    timelineController.createCaptionsTrack('foo');
    expect(nonNativeSpy).to.have.been.calledOnce;
  });

  it('fires the NON_NATIVE_TEXT_TRACKS_FOUND event', function (done) {
    hls.on(Hls.Events.NON_NATIVE_TEXT_TRACKS_FOUND, (event, data) => {
      const track = data.tracks[0];
      expect(track.kind).to.equal('captions');
      expect(track.default).to.equal(false);
      expect(track.label).to.equal(
        timelineController.captionsProperties.textTrack1.label
      );
      expect(timelineController.nonNativeCaptionsTracks.textTrack1).to.equal(
        track
      );
      done();
    });

    timelineController.createNonNativeTrack('textTrack1');
  });

  it('does not create a non native track if the track does not have any defined properties', function () {
    const triggerSpy = sinon.spy(hls, 'trigger');
    timelineController.createNonNativeTrack('foo');
    expect(triggerSpy).to.have.not.been.called;
  });
});
