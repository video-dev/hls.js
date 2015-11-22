/*
 * Level Controller
*/

import Event from '../events';
import {logger} from '../utils/logger';
import {ErrorTypes, ErrorDetails} from '../errors';

class LevelController {

  constructor(hls) {
    this.hls = hls;
    this.onml = this.onManifestLoaded.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.onerr = this.onError.bind(this);
    this.ontick = this.tick.bind(this);
    hls.on(Event.MANIFEST_LOADED, this.onml);
    hls.on(Event.LEVEL_LOADED, this.onll);
    hls.on(Event.ERROR, this.onerr);
    this._manualLevel = this._autoLevelCapping = -1;
  }

  destroy() {
    var hls = this.hls;
    hls.off(Event.MANIFEST_LOADED, this.onml);
    hls.off(Event.LEVEL_LOADED, this.onll);
    hls.off(Event.ERROR, this.onerr);
    if (this.timer) {
     clearInterval(this.timer);
    }
    this._manualLevel = -1;
  }

  onManifestLoaded(event, data) {
    var levels0 = [], levels = [], bitrateStart, i, bitrateSet = {}, videoCodecFound = false, audioCodecFound = false;

    // regroup redundant level together
    data.levels.forEach(level => {
      if(level.videoCodec) {
        videoCodecFound = true;
      }
      if(level.audioCodec) {
        audioCodecFound = true;
      }
      var redundantLevelId = bitrateSet[level.bitrate];
      if (redundantLevelId === undefined) {
        bitrateSet[level.bitrate] = levels.length;
        level.url = [level.url];
        level.urlId = 0;
        levels0.push(level);
      } else {
        levels0[redundantLevelId].url.push(level.url);
      }
    });

    // remove audio-only level if we also have levels with audio+video codecs signalled
    if(videoCodecFound && audioCodecFound) {
      levels0.forEach(level => {
        if(level.videoCodec) {
          levels.push(level);
        }
      });
    } else {
      levels = levels0;
    }

    // start bitrate is the first bitrate of the manifest
    bitrateStart = levels[0].bitrate;
    // sort level on bitrate
    levels.sort(function (a, b) {
      return a.bitrate - b.bitrate;
    });
    this._levels = levels;
    // find index of first level in sorted levels
    for (i = 0; i < levels.length; i++) {
      if (levels[i].bitrate === bitrateStart) {
        this._firstLevel = i;
        logger.log(`manifest loaded,${levels.length} level(s) found, first bitrate:${bitrateStart}`);
        break;
      }
    }
    this.hls.trigger(Event.MANIFEST_PARSED, {levels: this._levels, firstLevel: this._firstLevel, stats: data.stats});
    return;
  }

  get levels() {
    return this._levels;
  }

  get level() {
    return this._level;
  }

  set level(newLevel) {
    if (this._level !== newLevel || this._levels[newLevel].details === undefined) {
      this.setLevelInternal(newLevel);
    }
  }

 setLevelInternal(newLevel) {
    // check if level idx is valid
    if (newLevel >= 0 && newLevel < this._levels.length) {
      // stopping live reloading timer if any
      if (this.timer) {
       clearInterval(this.timer);
       this.timer = null;
      }
      this._level = newLevel;
      logger.log(`switching to level ${newLevel}`);
      this.hls.trigger(Event.LEVEL_SWITCH, {level: newLevel});
      var level = this._levels[newLevel];
       // check if we need to load playlist for this level
      if (level.details === undefined || level.details.live === true) {
        // level not retrieved yet, or live playlist we need to (re)load it
        logger.log(`(re)loading playlist for level ${newLevel}`);
        var urlId = level.urlId;
        this.hls.trigger(Event.LEVEL_LOADING, {url: level.url[urlId], level: newLevel, id: urlId});
      }
    } else {
      // invalid level id given, trigger error
      this.hls.trigger(Event.ERROR, {type : ErrorTypes.OTHER_ERROR, details: ErrorDetails.LEVEL_SWITCH_ERROR, level: newLevel, fatal: false, reason: 'invalid level idx'});
    }
 }

  get manualLevel() {
    return this._manualLevel;
  }

  set manualLevel(newLevel) {
    this._manualLevel = newLevel;
    if (newLevel !== -1) {
      this.level = newLevel;
    }
  }

  get firstLevel() {
    return this._firstLevel;
  }

  set firstLevel(newLevel) {
    this._firstLevel = newLevel;
  }

  get startLevel() {
    if (this._startLevel === undefined) {
      return this._firstLevel;
    } else {
      return this._startLevel;
    }
  }

  set startLevel(newLevel) {
    this._startLevel = newLevel;
  }

  onError(event, data) {
    if(data.fatal) {
      return;
    }

    var details = data.details, hls = this.hls, levelId, level;
    // try to recover not fatal errors
    switch(details) {
      case ErrorDetails.FRAG_LOAD_ERROR:
      case ErrorDetails.FRAG_LOAD_TIMEOUT:
      case ErrorDetails.FRAG_LOOP_LOADING_ERROR:
         levelId = data.frag.level;
         break;
      case ErrorDetails.LEVEL_LOAD_ERROR:
      case ErrorDetails.LEVEL_LOAD_TIMEOUT:
        levelId = data.level;
        break;
      default:
        break;
    }
    /* try to switch to a redundant stream if any available.
     * if no redundant stream available, emergency switch down (if in auto mode and current level not 0)
     * otherwise, we cannot recover this network error ....
     */
    if (levelId !== undefined) {
      level = this._levels[levelId];
      if (level.urlId < (level.url.length - 1)) {
        level.urlId++;
        level.details = undefined;
        logger.warn(`level controller,${details} for level ${levelId}: switching to redundant stream id ${level.urlId}`);
      } else {
        // we could try to recover if in auto mode and current level not lowest level (0)
        let recoverable = ((this._manualLevel === -1) && levelId);
        if (recoverable) {
          logger.warn(`level controller,${details}: emergency switch-down for next fragment`);
          hls.abrController.nextAutoLevel = 0;
        } else if(level && level.details && level.details.live) {
          logger.warn(`level controller,${details} on live stream, discard`);
        } else {
          logger.error(`cannot recover ${details} error`);
          this._level = undefined;
          // stopping live reloading timer if any
          if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
          }
          // redispatch same error but with fatal set to true
          data.fatal = true;
          hls.trigger(event, data);
        }
      }
    }
  }

  onLevelLoaded(event, data) {
    // check if current playlist is a live playlist
    if (data.details.live && !this.timer) {
      // if live playlist we will have to reload it periodically
      // set reload period to playlist target duration
      this.timer = setInterval(this.ontick, 1000 * data.details.targetduration);
    }
    if (!data.details.live && this.timer) {
      // playlist is not live and timer is armed : stopping it
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  tick() {
    var levelId = this._level;
    if (levelId !== undefined) {
      var level = this._levels[levelId], urlId = level.urlId;
      this.hls.trigger(Event.LEVEL_LOADING, {url: level.url[urlId], level: levelId, id: urlId});
    }
  }

  nextLoadLevel() {
    if (this._manualLevel !== -1) {
      return this._manualLevel;
    } else {
     return this.hls.abrController.nextAutoLevel;
    }
  }
}

export default LevelController;

