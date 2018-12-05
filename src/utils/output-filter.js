export default class OutputFilter {
  constructor (timelineController, trackName) {
    this.timelineController = timelineController;
    this.trackName = trackName;
    this.startTime = null;
    this.endTime = null;
    this.screen = null;
  }

  dispatchCue (startTime) {
    if (this.startTime === null) {
      return;
    }
    // fall back to initial cue start time for seek, etc
    const cueStartTime = startTime - this.startTime > 5 ? startTime : this.startTime;
    this.timelineController.addCues(this.trackName, cueStartTime, this.endTime, this.screen);
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
