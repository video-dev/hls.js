import OutputFilter from '../../../src/utils/output-filter';

describe('OutputFilter', function () {
  const sandbox = sinon.createSandbox();

  let createMockTimelineController = function () {
    return {
      addCues: sandbox.spy(),
      createCaptionsTrack: sandbox.spy()
    };
  };

  let timelineController, outputFilter;

  beforeEach(function () {
    timelineController = createMockTimelineController();
    outputFilter = new OutputFilter(timelineController, 1);
  });

  it('handles new cue without dispatching', function () {
    outputFilter.newCue(0, 1, {});
    expect(timelineController.addCues).to.not.have.been.called;
    expect(timelineController.createCaptionsTrack).to.have.been.called;
  });

  it('handles single cue and dispatch', function () {
    let lastScreen = {};
    outputFilter.newCue(0, 1, lastScreen);
    outputFilter.dispatchCue();
    expect(timelineController.addCues).to.have.been.calledOnce;
    expect(timelineController.addCues).to.have.been.calledWith(1, 0, 1, lastScreen);
  });

  it('handles multiple cues and dispatch', function () {
    outputFilter.newCue(0, 1, {});
    outputFilter.newCue(1, 2, {});
    let lastScreen = {};
    outputFilter.newCue(3, 4, lastScreen);
    outputFilter.dispatchCue();
    expect(timelineController.addCues).to.have.been.calledOnce;
    expect(timelineController.addCues).to.have.been.calledWith(1, 0, 4, lastScreen);
  });

  it('does not dispatch empty cues', function () {
    outputFilter.newCue(0, 1, {});
    expect(timelineController.addCues).to.not.have.been.called;
    outputFilter.dispatchCue();
    expect(timelineController.addCues).to.have.been.calledOnce;
    outputFilter.dispatchCue();
    expect(timelineController.addCues).to.have.been.calledOnce;
  });
});
