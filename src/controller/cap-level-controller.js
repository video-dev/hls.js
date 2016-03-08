/*
 * cap stream level to media size dimension controller
*/

import Event from '../events';
import EventHandler from '../event-handler';

class CapLevelController extends EventHandler {
    constructor(hls) {
        super(hls, Event.MEDIA_ATTACHING, Event.MANIFEST_PARSED);
        try {
            this.contentsScaleFactor = window.devicePixelRatio;
        } catch (e) {}
        this.autoLevelCapping = Number.POSITIVE_INFINITY;
    }

    destroy() {
        this.media = null;
        this.autoLevelCapping = Number.POSITIVE_INFINITY;
        clearInterval(this.timer);
    }

    onMediaAttaching(data) {
        this.attachMedia(data.media);
    }

    onManifestParsed(data) {
        if (!this.hls.config.capLevelToPlayerSize) {
            return;
        }
        this.levels = data.levels;
        this.hls.firstLevel = this.getMaxLevel(data.firstLevel);
        this.detectPlayerSize();
        clearInterval(this.timer);
        this.timer = setInterval(this.detectPlayerSize.bind(this), 1000);
    }

    attachMedia(media) {
        this.media = media instanceof HTMLVideoElement ? media : null;
    }

    detectPlayerSize() {
        if (this.media) {
            let levelsLength = this.levels ? this.levels.length : 0;
            if (levelsLength) {
                this.hls.autoLevelCapping = this.getMaxLevel(levelsLength - 1);
                if (this.hls.autoLevelCapping > this.autoLevelCapping) {
                    // if auto level capping has a higher value for the previous one, flush the buffer using nextLevelSwitch
                    // usually happen when the user go to the fullscreen mode.
                    this.hls.streamController.nextLevelSwitch();
                }
                this.autoLevelCapping = this.hls.autoLevelCapping;
            }
        }
    }

    /*
  * returns level should be the one with the dimensions equal or greater than the media (player) dimensions (so the video will be downscaled)
  */
    getMaxLevel(capLevelIndex) {
        let result,
            i,
            level,
            mWidth = this.mediaWidth,
            mHeight = this.mediaHeight,
            lWidth = 0,
            lHeight = 0;

        for (i = 0; i <= capLevelIndex; i++) {
            level = this.levels[i];
            result = i;
            lWidth = level.width;
            lHeight = level.height;
            if (mWidth <= lWidth || mHeight <= lHeight) {
                break;
            }
        }
        return result;
    }

    get mediaWidth() {
        let width;
        if (this.media) {
            width =
                this.media.width ||
                this.media.clientWidth ||
                this.media.offsetWidth;
            if (this.contentsScaleFactor) {
                width *= this.contentsScaleFactor;
            }
        }
        return width;
    }

    get mediaHeight() {
        let height;
        if (this.media) {
            height =
                this.media.height ||
                this.media.clientHeight ||
                this.media.offsetHeight;
            if (this.contentsScaleFactor) {
                height *= this.contentsScaleFactor;
            }
        }
        return height;
    }
}

export default CapLevelController;
