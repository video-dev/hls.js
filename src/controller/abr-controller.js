/*
 * simple ABR Controller
*/

import CappingMode from '../max-level-capping-mode';
import Event from '../events';
import EventHandler from '../event-handler';

class AbrController extends EventHandler {

  constructor(hls) {
    super(hls, Event.FRAG_LOAD_PROGRESS);
    this.lastfetchlevel = 0;
    this._autoLevelCapping = -1;
    this._nextAutoLevel = -1;
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  onFragLoadProgress(data) {
    var stats = data.stats;
    // only update stats if first frag loading
    // if same frag is loaded multiple times, it might be in browser cache, and loaded quickly
    // and leading to wrong bw estimation
    if (stats.aborted === undefined && data.frag.loadCounter === 1) {
      this.lastfetchduration = (performance.now() - stats.trequest) / 1000;
      this.lastfetchlevel = data.frag.level;
      this.lastbw = (stats.loaded * 8) / this.lastfetchduration;
      //console.log(`fetchDuration:${this.lastfetchduration},bw:${(this.lastbw/1000).toFixed(0)}/${stats.aborted}`);
    }
  }

  /** Return the capping/max level value that could be used by automatic level selection algorithm **/
  get autoLevelCapping() {
    return this._autoLevelCapping;
  }

  /** set the capping/max level value that could be used by automatic level selection algorithm **/
  set autoLevelCapping(newLevel) {
    this._autoLevelCapping = newLevel;
  }
  
  get maxLevel() {
    let level = this.hls.levels.length - 1, 
        levelController = this.hls.levelController,
        video = this.hls.media instanceof HTMLVideoElement ? this.hls.media : undefined;
    
    if (this._autoLevelCapping >= 0) {
      level = this._autoLevelCapping;  
    } else if (levelController.capLevelToPlayerSize && video) {
      let maxLevelsCount = levelController.maxUniqueLevels ? levelController.maxUniqueLevels.length : 0;
      if (maxLevelsCount) {
        let maxLevel = levelController.maxUniqueLevels[0],
            maxLevelIdx = maxLevel.index,
            vWidth = video.clientWidth || video.width || video.offsetWidth,
            vHeight = video.clientHeight || video.height || video.offsetHeight,
            lWidth = 0,
            lHeight = 0,
            i = 0;

        try {
            let contentsScaleFactor =  window.devicePixelRatio;
            vWidth *= contentsScaleFactor;
            vHeight *= contentsScaleFactor;
        } catch(e) {}
            
        if (this.hls.config.maxLevelCappingMode === CappingMode.DOWNSCALE) {
          for (i = 0; i < maxLevelsCount; i++) {
            maxLevel = levelController.maxUniqueLevels[i];
            maxLevelIdx = maxLevel.index;
            lWidth = maxLevel.width;
            lHeight = maxLevel.height;
            //console.log('video size: ' + vWidth + 'x' + vHeight + ' ,level' + maxLevelIdx + ' size: ' + lWidth + 'x' + lHeight);
            if (vWidth <= lWidth || vHeight <= lHeight) {
                break;
            }
          } 
        } else {
          for (i = maxLevelsCount - 1; i >= 0; i--) {
            maxLevel = levelController.maxUniqueLevels[i];
            maxLevelIdx = maxLevel.index;
            lWidth = maxLevel.width;
            lHeight = maxLevel.height;
            //console.log('video size: ' + vWidth + 'x' + vHeight + ' ,level' + maxLevelIdx + ' size: ' + lWidth + 'x' + lHeight);
            if (vWidth >= lWidth || vHeight >= lHeight) {
              break;
            }
          }
        } 
        level = maxLevelIdx;      
      }
    }
    return level;  
  }
  
  get nextAutoLevel() {
    var lastbw = this.lastbw, 
        hls = this.hls,
        adjustedbw, 
        i, 
        maxAutoLevel = this.maxLevel; 

    if (this._nextAutoLevel !== -1) {
      var nextLevel = Math.min(this._nextAutoLevel,maxAutoLevel);
      if (nextLevel === this.lastfetchlevel) {
        this._nextAutoLevel = -1;
      } else {
        return nextLevel;
      }
    }

    // follow algorithm captured from stagefright :
    // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
    // Pick the highest bandwidth stream below or equal to estimated bandwidth.
    for (i = 0; i <= maxAutoLevel; i++) {
    // consider only 80% of the available bandwidth, but if we are switching up,
    // be even more conservative (70%) to avoid overestimating and immediately
    // switching back.
      if (i <= this.lastfetchlevel) {
        adjustedbw = 0.8 * lastbw;
      } else {
        adjustedbw = 0.7 * lastbw;
      }
      if (adjustedbw < hls.levels[i].bitrate) {
        return Math.max(0, i - 1);
      }
    }
    return i - 1;
  }

  set nextAutoLevel(nextLevel) {
    this._nextAutoLevel = nextLevel;
  }
}

export default AbrController;

