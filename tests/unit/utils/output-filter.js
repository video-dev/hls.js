import OutputFilter from '../../../src/utils/output-filter';

describe('OutputFilter', () => {
  const sandbox = sinon.createSandbox();

  let createMockTimelineController = () => {
    return {
      addCues: sandbox.spy(),
      createCaptionsTrack: sandbox.spy(),
    };
  };

  let timelineController, outputFilter;

  beforeEach(function () {
    timelineController = createMockTimelineController();
    outputFilter = new OutputFilter(timelineController, 1);
  });

  it('handles new cue without dispatching', () => {
    outputFilter.newCue(0, 1, {});
    expect(timelineController.addCues).to.not.have.been.called;
    expect(timelineController.createCaptionsTrack).to.have.been.called;
  });

  it('handles single cue and dispatch', () => {
    let lastScreen = {};
    outputFilter.newCue(0, 1, lastScreen);
    outputFilter.dispatchCue();
    expect(timelineController.addCues).to.have.been.calledOnce;
    expect(timelineController.addCues).to.have.been.calledWith(1, 0, 1, lastScreen);
  });

  it('handles multiple cues and dispatch', () => {
    outputFilter.newCue(0, 1, {});
    outputFilter.newCue(1, 2, {});
    let lastScreen = {};
    outputFilter.newCue(3, 4, lastScreen);
    outputFilter.dispatchCue();
    expect(timelineController.addCues).to.have.been.calledOnce;
    expect(timelineController.addCues).to.have.been.calledWith(1, 0, 4, lastScreen);
  });

  it('does not dispatch empty cues', () => {
    outputFilter.newCue(0, 1, {});
    expect(timelineController.addCues).to.not.have.been.called;
    outputFilter.dispatchCue();
    expect(timelineController.addCues).to.have.been.calledOnce;
    outputFilter.dispatchCue();
    expect(timelineController.addCues).to.have.been.calledOnce;
  });
});
