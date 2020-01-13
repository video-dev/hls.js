/*
 * FPS Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';

const { performance } = self;

class FPSController extends EventHandler {
  constructor (hls) {
    super(hls, Event.MEDIA_ATTACHING);
  }

  destroy () {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.isVideoPlaybackQualityAvailable = false;
  }

  onMediaAttaching (data) {
    const config = this.hls.config;
    if (config.capLevelOnFPSDrop) {
      const video = this.video = data.media instanceof self.HTMLVideoElement ? data.media : null;
      if (typeof video.getVideoPlaybackQuality === 'function') {
        this.isVideoPlaybackQualityAvailable = true;
      }

      clearInterval(this.timer);
      this.timer = self.setTimeout(this.checkFPSInterval.bind(this), config.fpsDroppedMonitoringPeriod);
    }
  }

  checkFPS (video, decodedFrames, droppedFrames) {
    const currentTime = performance.now();
    if (decodedFrames) {
      if (this.lastTime) {
        const currentPeriod = currentTime - this.lastTime;
        const currentDropped = droppedFrames - this.lastDroppedFrames;
        const currentDecoded = decodedFrames - this.lastDecodedFrames;
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
              hls.streamController.nextLevelSwitch();
            }
          }
        }
      }
      this.lastTime = currentTime;
      this.lastDroppedFrames = droppedFrames;
      this.lastDecodedFrames = decodedFrames;
    }
  }

  checkFPSInterval () {
    const video = this.video;
    if (video) {
      if (this.isVideoPlaybackQualityAvailable) {
        const videoPlaybackQuality = video.getVideoPlaybackQuality();
        this.checkFPS(video, videoPlaybackQuality.totalVideoFrames, videoPlaybackQuality.droppedVideoFrames);
      } else {
        this.checkFPS(video, video.webkitDecodedFrameCount, video.webkitDroppedFrameCount);
      }
    }
  }
}

export default FPSController;
