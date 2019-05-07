import { CaptionScreen } from './cea-608-parser';

export default class OutputFilter {
  timelineController: any;
  trackName: string;
  startTime: number;
  endTime: number | null;
  screen: CaptionScreen | null;

  // TODO(typescript-timelineController)
  constructor (timelineController: any, trackName: string) {
    this.timelineController = timelineController;
    this.trackName = trackName;
    this.startTime = -1;
    this.endTime = null;
    this.screen = null;
  }

  dispatchCue () {
    if (this.startTime === -1) {
      return;
    }

    this.timelineController.addCues(this.trackName, this.startTime, this.endTime, this.screen);
    this.startTime = -1;
  }

  newCue (startTime: number, endTime: number, screen: CaptionScreen) {
    if (this.startTime === -1 || this.startTime > startTime) {
      this.startTime = startTime;
    }

    this.endTime = endTime;
    this.screen = screen;
    this.timelineController.createCaptionsTrack(this.trackName);
  }
}
