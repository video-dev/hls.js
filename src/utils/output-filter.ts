import { CaptionScreen, UNSET_CEA_START_TIME } from './cea-608-parser';

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
    this.startTime = UNSET_CEA_START_TIME;
    this.endTime = null;
    this.screen = null;
  }

  dispatchCue () {
    if (this.startTime === UNSET_CEA_START_TIME) {
      return;
    }

    this.timelineController.addCues(this.trackName, this.startTime, this.endTime, this.screen);
    this.startTime = UNSET_CEA_START_TIME;
  }

  newCue (startTime: number, endTime: number, screen: CaptionScreen) {
    if (this.startTime === UNSET_CEA_START_TIME || this.startTime > startTime) {
      this.startTime = startTime;
    }

    this.endTime = endTime;
    this.screen = screen;
    this.timelineController.createCaptionsTrack(this.trackName);
  }
}
