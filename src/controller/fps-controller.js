/*
 * FPS Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';

class FPSController extends EventHandler {
    constructor(hls) {
        super(hls, Event.MEDIA_ATTACHING);
    }

    destroy() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.isVideoPlaybackQualityAvailable = false;
    }

    onMediaAttaching(data) {
        if (this.hls.config.capLevelOnFPSDrop) {
            this.video =
                data.media instanceof HTMLVideoElement ? data.media : null;
            if (typeof this.video.getVideoPlaybackQuality === 'function') {
                this.isVideoPlaybackQualityAvailable = true;
            }
            clearInterval(this.timer);
            this.timer = setInterval(
                this.checkFPSInterval.bind(this),
                this.hls.config.fpsDroppedMonitoringPeriod
            );
        }
    }

    checkFPS(video, decodedFrames, droppedFrames) {
        let currentTime = performance.now();
        if (decodedFrames) {
            logger.log(
                'checkFPS : decodedFrames:' +
                    decodedFrames +
                    ', droppedFrames: ' +
                    droppedFrames
            );
            if (this.lastTime) {
                let currentPeriod = currentTime - this.lastTime,
                    currentDropped = droppedFrames - this.lastDroppedFrames,
                    currentDecoded = decodedFrames - this.lastDecodedFrames,
                    droppedFPS = 1000 * currentDropped / currentPeriod;
                if (droppedFPS > 0) {
                    logger.log(
                        'checkFPS : droppedFPS/decodedFPS:' +
                            droppedFPS / (1000 * currentDecoded / currentPeriod)
                    );
                    if (
                        currentDropped >
                        this.hls.config.fpsDroppedMonitoringThreshold *
                            currentDecoded
                    ) {
                        let currentLevel = this.hls.currentLevel;
                        logger.warn(
                            'drop FPS ratio greater than max allowed value, currentLevel: ' +
                                currentLevel
                        );
                        this.hls.trigger(Event.FPS_DROP, {
                            currentLevel: currentLevel,
                            currentDropped: currentDropped,
                            currentDecoded: currentDecoded,
                            totalDroppedFrames: droppedFrames
                        });
                        if (
                            currentLevel > 0 &&
                            (this.hls.autoLevelCapping === -1 ||
                                this.hls.autoLevelCapping >= currentLevel)
                        ) {
                            this.hls.autoLevelCapping = currentLevel - 1;
                        }
                    }
                }
            }
            this.lastTime = currentTime;
            this.lastDroppedFrames = droppedFrames;
            this.lastDecodedFrames = decodedFrames;
        }
    }

    checkFPSInterval() {
        if (this.video) {
            if (this.isVideoPlaybackQualityAvailable) {
                let videoPlaybackQuality = this.video.getVideoPlaybackQuality();
                this.checkFPSViaPlaybackQuality(
                    this.video,
                    videoPlaybackQuality.totalVideoFrames,
                    videoPlaybackQuality.droppedVideoFrames
                );
            } else {
                this.checkFPSViaWebkit(
                    this.video,
                    this.video.webkitDecodedFrameCount,
                    this.video.webkitDroppedFrameCount
                );
            }
        }
    }
}

export default FPSController;
