/*
 * FPS Controller
*/

import { Events } from '../events';
import { logger } from '../utils/logger';
import { ComponentAPI } from '../types/component-api';
import Hls from '../hls';
import { MediaAttachingData } from '../types/events';
import StreamController from './stream-controller';

const { performance } = self;

class FPSController implements ComponentAPI {
  private hls: Hls;
  private isVideoPlaybackQualityAvailable: boolean = false;
  private timer?: number;
  private video: HTMLVideoElement | null = null;
  private lastFPSData?: {
    currentTime: number,
    droppedFrames: number,
    decodedFrames: number
  }

  // stream controller must be provided as a dependency!
  private streamController!: StreamController

  constructor (hls: Hls) {
    this.hls = hls;

    this.registerListeners();
  }

  public setStreamController (streamController: StreamController) {
    this.streamController = streamController;
  }

  protected registerListeners () {
    this.hls.on(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
  }

  protected unregisterListeners () {
    this.hls.off(Events.MEDIA_ATTACHING, this.onMediaAttaching);
  }

  destroy () {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.unregisterListeners();
    this.isVideoPlaybackQualityAvailable = false;
  }

  protected onMediaAttaching (event: Events.MEDIA_ATTACHING, data: MediaAttachingData) {
    const config = this.hls.config;
    if (config.capLevelOnFPSDrop) {
      const video = data.media instanceof self.HTMLVideoElement ? data.media : null;
      this.video = video;
      if (video && typeof video.getVideoPlaybackQuality === 'function') {
        this.isVideoPlaybackQualityAvailable = true;
      }

      self.clearInterval(this.timer);
      this.timer = self.setTimeout(this.checkFPSInterval.bind(this), config.fpsDroppedMonitoringPeriod);
    }
  }

  checkFPS (video: HTMLVideoElement, decodedFrames: number, droppedFrames: number) {
    const currentTime = performance.now();
    if (decodedFrames) {
      if (this.lastFPSData) {
        const currentPeriod = currentTime - this.lastFPSData.currentTime;
        const currentDropped = droppedFrames - this.lastFPSData.droppedFrames;
        const currentDecoded = decodedFrames - this.lastFPSData.decodedFrames;
        const droppedFPS = 1000 * currentDropped / currentPeriod;
        const hls = this.hls;
        hls.trigger(Events.FPS_DROP, { currentDropped: currentDropped, currentDecoded: currentDecoded, totalDroppedFrames: droppedFrames });
        if (droppedFPS > 0) {
          // logger.log('checkFPS : droppedFPS/decodedFPS:' + droppedFPS/(1000 * currentDecoded / currentPeriod));
          if (currentDropped > hls.config.fpsDroppedMonitoringThreshold * currentDecoded) {
            let currentLevel = hls.currentLevel;
            logger.warn('drop FPS ratio greater than max allowed value for currentLevel: ' + currentLevel);
            if (currentLevel > 0 && (hls.autoLevelCapping === -1 || hls.autoLevelCapping >= currentLevel)) {
              currentLevel = currentLevel - 1;
              hls.trigger(Events.FPS_DROP_LEVEL_CAPPING, { level: currentLevel, droppedLevel: hls.currentLevel });
              hls.autoLevelCapping = currentLevel;
              this.streamController.nextLevelSwitch();
            }
          }
        }
      }
      this.lastFPSData = { currentTime, droppedFrames, decodedFrames };
    }
  }

  checkFPSInterval () {
    const video = this.video;
    if (video) {
      if (this.isVideoPlaybackQualityAvailable) {
        const videoPlaybackQuality = video.getVideoPlaybackQuality();
        this.checkFPS(video, videoPlaybackQuality.totalVideoFrames, videoPlaybackQuality.droppedVideoFrames);
      } else {
        // HTMLVideoElement doesn't include the webkit types
        this.checkFPS(video, (video as any).webkitDecodedFrameCount as number, (video as any).webkitDroppedFrameCount as number);
      }
    }
  }
}

export default FPSController;
