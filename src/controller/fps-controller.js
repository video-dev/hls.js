/*
 * FPS Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';

class FPSController extends EventHandler{

  constructor(hls) {
    super(hls, Event.MEDIA_ATTACHING);
    this._hls = hls;
  }

  destroy() {
    if (this._timer) {
      clearInterval(this._timer);
    }
    this._isVideoPlaybackQualityAvailable = false;
  }

  onMediaAttaching(data) {
    const config = this._hls.config;
    if (config.capLevelOnFPSDrop) {
      const video = this._video = data.media instanceof HTMLVideoElement ? data.media : null;
      if (typeof video.getVideoPlaybackQuality === 'function') {
        this._isVideoPlaybackQualityAvailable = true;
      }
      clearInterval(this._timer);
      this._timer = setInterval(this._checkFPSInterval.bind(this), config.fpsDroppedMonitoringPeriod);
    }
  }

  _checkFPS(video, decodedFrames, droppedFrames) {
    let currentTime = performance.now();
    if (decodedFrames) {
      if (this._lastTime) {
        let currentPeriod = currentTime - this._lastTime,
            currentDropped = droppedFrames - this._lastDroppedFrames,
            currentDecoded = decodedFrames - this._lastDecodedFrames,
            droppedFPS = 1000 * currentDropped / currentPeriod,
            hls = this._hls;
        hls.trigger(Event.FPS_DROP, {currentDropped: currentDropped, currentDecoded: currentDecoded, totalDroppedFrames: droppedFrames});
        if (droppedFPS > 0) {
          //logger.log('checkFPS : droppedFPS/decodedFPS:' + droppedFPS/(1000 * currentDecoded / currentPeriod));
          if (currentDropped > hls.config.fpsDroppedMonitoringThreshold * currentDecoded) {
            let currentLevel = hls.currentLevel;
            logger.warn('drop FPS ratio greater than max allowed value for currentLevel: ' + currentLevel);
            if (currentLevel > 0 && (hls.autoLevelCapping === -1 || hls.autoLevelCapping >= currentLevel)) {
              currentLevel = currentLevel - 1;
              hls.trigger(Event.FPS_DROP_LEVEL_CAPPING, {level: currentLevel, droppedLevel: hls.currentLevel});
              hls.autoLevelCapping = currentLevel;
              hls.streamController.nextLevelSwitch();
            }
          }
        }
      }
      this._lastTime = currentTime;
      this._lastDroppedFrames = droppedFrames;
      this._lastDecodedFrames = decodedFrames;
    }
  }

  _checkFPSInterval() {
    const video = this._video;
    if (video) {
      if (this._isVideoPlaybackQualityAvailable) {
        let videoPlaybackQuality = video.getVideoPlaybackQuality();
        this._checkFPS(video, videoPlaybackQuality.totalVideoFrames, videoPlaybackQuality.droppedVideoFrames);
      } else {
        this._checkFPS(video, video.webkitDecodedFrameCount, video.webkitDroppedFrameCount);
      }
    }
  }
}

export default FPSController;

