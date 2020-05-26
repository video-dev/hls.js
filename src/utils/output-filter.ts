import { logger } from '../utils/logger';

import type { TimelineController } from '../controller/timeline-controller';
import type { CaptionScreen } from './cea-608-parser';

export default class OutputFilter {
  timelineController: TimelineController;
  trackName: string;
  startTime: number | null;
  endTime: number | null;
  screen: CaptionScreen | null;

  constructor (timelineController: TimelineController, trackName: string) {
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

    if (!this.screen) {
      logger.warn('Called dispatchCue from output filter before newCue.');
      return;
    }

    this.timelineController.addCues(this.trackName, this.startTime, this.endTime as number, this.screen);
    this.startTime = null;
  }

  newCue (startTime: number, endTime: number, screen: CaptionScreen) {
    if (this.startTime === null || this.startTime > startTime) {
      this.startTime = startTime;
    }

    this.endTime = endTime;
    this.screen = screen;
    this.timelineController.createCaptionsTrack(this.trackName);
  }
}
