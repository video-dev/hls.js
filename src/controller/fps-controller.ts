/*
 * FPS Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';
import Hls from '../hls';
import { MediaAttachingData } from '../types/events';
import StreamController from './stream-controller';

const { performance } = self;

class FPSController extends EventHandler {
  public timer?: number;
  public video?: HTMLVideoElement | null;
  private isVideoPlaybackQualityAvailable: boolean = false;
  private lastFPSData?: {
    currentTime: number,
    droppedFrames: number,
    decodedFrames: number
  }

  private streamController?: StreamController;

  constructor (hls: Hls) {
    super(hls, Event.MEDIA_ATTACHING);
  }

  setStreamController (streamController: StreamController) {
    this.streamController = streamController;
  }

  destroy () {
    if (this.timer) {
      self.clearInterval(this.timer);
    }

    this.isVideoPlaybackQualityAvailable = false;
  }

  onMediaAttaching (data: MediaAttachingData) {
    const config = this.hls.config;
    if (config.capLevelOnFPSDrop) {
      this.video = data.media instanceof self.HTMLVideoElement ? data.media : null;
      if (this.video && typeof this.video.getVideoPlaybackQuality === 'function') {
        this.isVideoPlaybackQualityAvailable = true;
      }
      self.clearInterval(this.timer);
      this.timer = self.setInterval(this.checkFPSInterval.bind(this), config.fpsDroppedMonitoringPeriod);
    }
  }

  checkFPS (decodedFrames: number | undefined, droppedFrames: number | undefined) {
    const currentTime = performance.now();
    if (decodedFrames && droppedFrames) {
      if (this.lastFPSData) {
        const currentPeriod = currentTime - this.lastFPSData.currentTime;
        const currentDropped = droppedFrames - this.lastFPSData.droppedFrames;
        const currentDecoded = decodedFrames - this.lastFPSData.decodedFrames;
        const droppedFPS = 1000 * currentDropped / currentPeriod;
        const hls = this.hls;
        hls.trigger(Event.FPS_DROP, { currentDropped: currentDropped, currentDecoded: currentDecoded, totalDroppedFrames: droppedFrames });
        if (droppedFPS > 0) {
          // logger.log('checkFPS : droppedFPS/decodedFPS:' + droppedFPS/(1000 * currentDecoded / currentPeriod));
          if (currentDropped > hls.config.fpsDroppedMonitoringThreshold * currentDecoded) {
            let currentLevel = hls.currentLevel;
            logger.warn('drop FPS ratio greater than max allowed value for currentLevel: ' + currentLevel);
            if (currentLevel > 0 && (hls.autoLevelCapping === -1 || hls.autoLevelCapping >= currentLevel)) {
              currentLevel = currentLevel - 1;
              hls.trigger(Event.FPS_DROP_LEVEL_CAPPING, { level: currentLevel, droppedLevel: hls.currentLevel });
              hls.autoLevelCapping = currentLevel;
              if (this.streamController) {
                this.streamController.nextLevelSwitch();
              }
            }
          }
        }
      }
      this.lastFPSData = { currentTime, droppedFrames, decodedFrames };
    }
  }

  checkFPSInterval () {
    if (this.video) {
      if (this.isVideoPlaybackQualityAvailable) {
        const videoPlaybackQuality = this.video.getVideoPlaybackQuality();
        this.checkFPS(videoPlaybackQuality.totalVideoFrames, videoPlaybackQuality.droppedVideoFrames);
      } else {
        this.checkFPS((this.video as any).webkitDecodedFrameCount, (this.video as any).webkitDroppedFrameCount);
      }
    }
  }
}

export default FPSController;
