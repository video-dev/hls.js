/*
 * cap stream level to media size dimension controller
*/

import Event from '../events';
import EventHandler from '../event-handler';

class CapLevelController extends EventHandler {
	constructor(hls) {
    super(hls,
      Event.FPS_DROP_LEVEL_CAPPING,
      Event.MEDIA_ATTACHING,
      Event.MANIFEST_PARSED);
    this._hls = hls;
	}

	destroy() {
    if (this._hls.config.capLevelToPlayerSize) {
      this._media = this._restrictedLevels = null;
      this._autoLevelCapping = Number.POSITIVE_INFINITY;
      if (this._timer) {
        this._timer = clearInterval(this._timer);
      }
    }
  }

  onFpsDropLevelCapping(data) {
	  // Don't add a restricted level more than once
    if (CapLevelController.isLevelAllowed(data.droppedLevel, this._restrictedLevels)) {
      this._restrictedLevels.push(data.droppedLevel);
    }
  }

	onMediaAttaching(data) {
    this._media = data.media instanceof HTMLVideoElement ? data.media : null;
  }

  onManifestParsed(data) {
    const hls = this._hls;
    this._restrictedLevels = [];
    if (hls.config.capLevelToPlayerSize) {
      this._autoLevelCapping = Number.POSITIVE_INFINITY;
      this._levels = data.levels;
      hls.firstLevel = this._getMaxLevel(data.firstLevel);
      clearInterval(this._timer);
      this._timer = setInterval(this._detectPlayerSize.bind(this), 1000);
      this._detectPlayerSize();
    }
  }

  _detectPlayerSize() {
    if (this._media) {
      let levelsLength = this._levels ? this._levels.length : 0;
      if (levelsLength) {
        const hls = this._hls;
        hls.autoLevelCapping = this._getMaxLevel(levelsLength - 1);
        if (hls.autoLevelCapping > this._autoLevelCapping) {
          // if auto level capping has a higher value for the previous one, flush the buffer using nextLevelSwitch
          // usually happen when the user go to the fullscreen mode.
          hls.streamController.nextLevelSwitch();
        }
        this._autoLevelCapping = hls.autoLevelCapping;
      }
    }
  }

  /*
  * returns level should be the one with the dimensions equal or greater than the media (player) dimensions (so the video will be downscaled)
  */
  _getMaxLevel(capLevelIndex) {
    if (!this._levels) {
      return -1;
    }

    const validLevels = this._levels.filter((level, index) =>
      CapLevelController.isLevelAllowed(index, this._restrictedLevels) && index <= capLevelIndex
    );

    return CapLevelController.getMaxLevelByMediaSize(validLevels, this._getMediaWidth(), this._getMediaHeight());
  }

  _getMediaWidth() {
    let width;
    const media = this._media;
    if (media) {
      width = media.width || media.clientWidth || media.offsetWidth;
      width *= CapLevelController.contentScaleFactor;
    }
    return width;
  }

  _getMediaHeight() {
    let height;
    const media = this._media;
    if (media) {
      height = media.height || media.clientHeight || media.offsetHeight;
      height *= CapLevelController.contentScaleFactor;
    }
    return height;
  }

  static get contentScaleFactor() {
    let pixelRatio = 1;
    try {
      pixelRatio =  window.devicePixelRatio;
    } catch(e) {}
    return pixelRatio;
  }

  static isLevelAllowed(level, restrictedLevels = []) {
    return restrictedLevels.indexOf(level) === -1;
  }

  static getMaxLevelByMediaSize(levels, width, height) {
    if (!levels || (levels && !levels.length)) {
      return -1;
    }

    // Levels can have the same dimensions but differing bandwidths - since levels are ordered, we can look to the next
    // to determine whether we've chosen the greatest bandwidth for the media's dimensions
    const atGreatestBandiwdth = (curLevel, nextLevel) => {
      if (!nextLevel) {
        return true;
      }
      return curLevel.width !== nextLevel.width || curLevel.height !== nextLevel.height;
    };

    // If we run through the loop without breaking, the media's dimensions are greater than every level, so default to
    // the max level
    let maxLevelIndex = levels.length - 1;

    for (let i = 0; i < levels.length; i+= 1) {
      const level = levels[i];
      if ((level.width >= width || level.height >= height) && atGreatestBandiwdth(level, levels[i + 1])) {
        maxLevelIndex = i;
        break;
      }
    }

    return maxLevelIndex;
  }
}

export default CapLevelController;
