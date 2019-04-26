export default class OutputFilter {
  constructor (timelineController, trackName) {
    this.timelineController = timelineController;
    this.trackName = trackName;
    this.startTime = null;
    this.endTime = null;
    this.screen = null;
  }

  dispatchCue () {
    if (this.startTime === null) {
      return;
    }

    this.timelineController.addCues(this.trackName, this.startTime, this.endTime, this.screen);
    this.startTime = null;
  }

  newCue (startTime, endTime, screen) {
    if (this.startTime === null || this.startTime > startTime) {
      this.startTime = startTime;
    }

    this.endTime = endTime;
    this.screen = screen;
    this.timelineController.createCaptionsTrack(this.trackName);
  }
}
