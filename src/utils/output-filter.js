export default class OutputFilter {

  constructor(timelineController, track) {
    this.timelineController = timelineController;
    this.track = track;
    this.startTime = null;
    this.endTime = null;
    this.screen = null;
  }

  dispatchCue() {
    if (this.startTime === null) {
      return;
    }
    this.timelineController.addCues('textTrack' + this.track, this.startTime, this.endTime, this.screen);
    this.startTime = null;
  }

  newCue(startTime, endTime, screen) {
    if (this.startTime === null || this.startTime > startTime) {
      this.startTime = startTime;
    }
    this.endTime = endTime;
    this.screen = screen;
    this.timelineController.createCaptionsTrack(this.track);
  }
}
