/*
 * Level Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';
import {ErrorTypes, ErrorDetails} from '../errors';

class LevelController extends EventHandler {

  constructor(hls) {
    super(hls,
      Event.MANIFEST_LOADED,
      Event.LEVEL_LOADED,
      Event.ERROR);
    this.ontick = this.tick.bind(this);
    this._manualLevel = this._autoLevelCapping = -1;
  }

  destroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._manualLevel = -1;
  }

  startLoad() {
    this.canload = true;
    // speed up live playlist refresh if timer exists
    if (this.timer) {
      this.tick();
    }
  }

  stopLoad() {
    this.canload = false;
  }

  onManifestLoaded(data) {
    var levels0 = [], levels = [], bitrateStart, i, bitrateSet = {}, videoCodecFound = false, audioCodecFound = false, hls = this.hls;

    // regroup redundant level together
    data.levels.forEach(level => {
      if(level.videoCodec) {
        videoCodecFound = true;
      }
      if(level.audioCodec || (level.attrs && level.attrs.AUDIO)) {
        audioCodecFound = true;
      }
      var redundantLevelId = bitrateSet[level.bitrate];
      if (redundantLevelId === undefined) {
        bitrateSet[level.bitrate] = levels0.length;
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

    // only keep level with supported audio/video codecs
    levels = levels.filter(function(level) {
      var checkSupportedAudio = function(codec) { return MediaSource.isTypeSupported(`audio/mp4;codecs=${codec}`);};
      var checkSupportedVideo = function(codec) { return MediaSource.isTypeSupported(`video/mp4;codecs=${codec}`);};
      var audioCodec = level.audioCodec, videoCodec = level.videoCodec;

      return (!audioCodec || checkSupportedAudio(audioCodec)) &&
             (!videoCodec || checkSupportedVideo(videoCodec));
    });

    if(levels.length) {
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
      hls.trigger(Event.MANIFEST_PARSED, {levels: this._levels, firstLevel: this._firstLevel, stats: data.stats, audio : audioCodecFound, video : videoCodecFound});
    } else {
      hls.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR, fatal: true, url: hls.url, reason: 'no level with compatible codecs found in manifest'});
    }
    return;
  }

  get levels() {
    return this._levels;
  }

  get level() {
    return this._level;
  }

  set level(newLevel) {
    let levels = this._levels;
    if (levels && levels.length > newLevel) {
      if (this._level !== newLevel || levels[newLevel].details === undefined) {
        this.setLevelInternal(newLevel);
      }
    }
  }

 setLevelInternal(newLevel) {
    let levels = this._levels;
    // check if level idx is valid
    if (newLevel >= 0 && newLevel < levels.length) {
      // stopping live reloading timer if any
      if (this.timer) {
       clearTimeout(this.timer);
       this.timer = null;
      }
      this._level = newLevel;
      logger.log(`switching to level ${newLevel}`);
      this.hls.trigger(Event.LEVEL_SWITCH, {level: newLevel});
      var level = levels[newLevel];
       // check if we need to load playlist for this level
      if (level.details === undefined || level.details.live === true) {
        // level not retrieved yet, or live playlist we need to (re)load it
        logger.log(`(re)loading playlist for level ${newLevel}`);
        var urlId = level.urlId;
        this.hls.trigger(Event.LEVEL_LOADING, {url: level.url[urlId], level: newLevel, id: urlId, attrs: level.attrs});
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
    if (this._startLevel === undefined) {
      this._startLevel = newLevel;
    }
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

  onError(data) {
    if(data.fatal) {
      return;
    }

    let details = data.details, hls = this.hls, levelId, level, levelError = false;
    // try to recover not fatal errors
    switch(details) {
      case ErrorDetails.FRAG_LOAD_ERROR:
      case ErrorDetails.FRAG_LOAD_TIMEOUT:
      case ErrorDetails.FRAG_LOOP_LOADING_ERROR:
      case ErrorDetails.KEY_LOAD_ERROR:
      case ErrorDetails.KEY_LOAD_TIMEOUT:
         levelId = data.frag.level;
         break;
      case ErrorDetails.LEVEL_LOAD_ERROR:
      case ErrorDetails.LEVEL_LOAD_TIMEOUT:
        levelId = data.context.level;
        levelError = true;
        break;
      default:
        break;
    }
    /* try to switch to a redundant stream if any available.
     * if no redundant stream available, emergency switch down (if in auto mode and current level not 0)
     * otherwise, we cannot recover this network error ...
     * don't raise FRAG_LOAD_ERROR and FRAG_LOAD_TIMEOUT as fatal, as it is handled by mediaController
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
          if (levelError) {
            // reset this._level so that another call to set level() will retrigger a frag load
            this._level = undefined;
          }
        // FRAG_LOAD_ERROR and FRAG_LOAD_TIMEOUT are handled by mediaController
        } else if (details !== ErrorDetails.FRAG_LOAD_ERROR && details !== ErrorDetails.FRAG_LOAD_TIMEOUT) {
          logger.error(`cannot recover ${details} error`);
          this._level = undefined;
          // stopping live reloading timer if any
          if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
          }
          // redispatch same error but with fatal set to true
          data.fatal = true;
          hls.trigger(Event.ERROR, data);
        }
      }
    }
  }

  onLevelLoaded(data) {
     // only process level loaded events matching with expected level
     if (data.level === this._level) {
      let newDetails = data.details;
      // if current playlist is a live playlist, arm a timer to reload it
      if (newDetails.live) {
        let reloadInterval = 1000*( newDetails.averagetargetduration ? newDetails.averagetargetduration : newDetails.targetduration),
            curLevel = this._levels[data.level],
            curDetails = curLevel.details;
        if (curDetails && newDetails.endSN === curDetails.endSN) {
          // follow HLS Spec, If the client reloads a Playlist file and finds that it has not
          // changed then it MUST wait for a period of one-half the target
          // duration before retrying.
          reloadInterval /=2;
          logger.log(`same live playlist, reload twice faster`);
        }
        // decrement reloadInterval with level loading delay
        reloadInterval -= performance.now() - data.stats.trequest;
        // in any case, don't reload more than every second
        reloadInterval = Math.max(1000,Math.round(reloadInterval));
        logger.log(`live playlist, reload in ${reloadInterval} ms`);
        this.timer = setTimeout(this.ontick,reloadInterval);
      } else {
        this.timer = null;
      }
    }
  }

  tick() {
    var levelId = this._level;
    if (levelId !== undefined && this.canload) {
      var level = this._levels[levelId], urlId = level.urlId;
      this.hls.trigger(Event.LEVEL_LOADING, {url: level.url[urlId], level: levelId, id: urlId});
    }
  }

  get nextLoadLevel() {
    if (this._manualLevel !== -1) {
      return this._manualLevel;
    } else {
     return this.hls.abrController.nextAutoLevel;
    }
  }

  set nextLoadLevel(nextLevel) {
    this.level = nextLevel;
    if (this._manualLevel === -1) {
      this.hls.abrController.nextAutoLevel = nextLevel;
    }
  }
}

export default LevelController;

