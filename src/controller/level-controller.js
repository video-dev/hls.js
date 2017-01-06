/*
 * Level Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';
import {ErrorTypes, ErrorDetails} from '../errors';
import BufferHelper from '../helper/buffer-helper';

class LevelController extends EventHandler {

  constructor(hls) {
    super(hls,
      Event.MANIFEST_LOADED,
      Event.LEVEL_LOADED,
      Event.FRAG_LOADED,
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
    let levels = this._levels;
    // clean up live level details to force reload them, and reset load errors
    if(levels) {
      levels.forEach(level => {
        level.loadError = 0;
        const levelDetails = level.details;
        if (levelDetails && levelDetails.live) {
          level.details = undefined;
        }
      });
    }
    // speed up live playlist refresh if timer exists
    if (this.timer) {
      this.tick();
    }
  }

  stopLoad() {
    this.canload = false;
  }

  onManifestLoaded(data) {
    var levels0 = [],
        levels = [],
        bitrateStart,
        bitrateSet = {},
        videoCodecFound = false,
        audioCodecFound = false,
        hls = this.hls,
        brokenmp4inmp3 = /chrome|firefox/.test(navigator.userAgent.toLowerCase()),
        checkSupported = function(type,codec) { return MediaSource.isTypeSupported(`${type}/mp4;codecs=${codec}`);};

    // regroup redundant level together
    data.levels.forEach(level => {
      if(level.videoCodec) {
        videoCodecFound = true;
      }
      // erase audio codec info if browser does not support mp4a.40.34. demuxer will autodetect codec and fallback to mpeg/audio
      if(brokenmp4inmp3 && level.audioCodec && level.audioCodec.indexOf('mp4a.40.34') !== -1) {
        level.audioCodec = undefined;
      }
      if(level.audioCodec || (level.attrs && level.attrs.AUDIO)) {
        audioCodecFound = true;
      }
      let redundantLevelId = bitrateSet[level.bitrate];
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
    let audioCodec = level.audioCodec, videoCodec = level.videoCodec;
      return (!audioCodec || checkSupported('audio',audioCodec)) &&
             (!videoCodec || checkSupported('video',videoCodec));
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
      for (let i = 0; i < levels.length; i++) {
        if (levels[i].bitrate === bitrateStart) {
          this._firstLevel = i;
          logger.log(`manifest loaded,${levels.length} level(s) found, first bitrate:${bitrateStart}`);
          break;
        }
      }
      hls.trigger(Event.MANIFEST_PARSED, {levels: levels, firstLevel: this._firstLevel, stats: data.stats, audio : audioCodecFound, video : videoCodecFound, altAudio : data.audioTracks.length > 0});
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
      if (this._level !== newLevel) {
        logger.log(`switching to level ${newLevel}`);
        this._level = newLevel;
        this.hls.trigger(Event.LEVEL_SWITCH, {level: newLevel});
      }
      var level = levels[newLevel], levelDetails = level.details;
       // check if we need to load playlist for this level
      if (!levelDetails || levelDetails.live === true) {
        // level not retrieved yet, or live playlist we need to (re)load it
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
    // hls.startLevel takes precedence over config.startLevel
    // if none of these values are defined, fallback on this._firstLevel (first quality level appearing in variant manifest)
    if (this._startLevel === undefined) {
      let configStartLevel = this.hls.config.startLevel;
      if (configStartLevel !== undefined) {
        return configStartLevel;
      } else {
        return this._firstLevel;
      }
    } else {
      return this._startLevel;
    }
  }

  set startLevel(newLevel) {
    // if not in autostart level, ensure startLevel is greater than minAutoLevel
    if (newLevel !== -1) {
      newLevel = Math.max(newLevel, this.hls.abrController.minAutoLevel);
    }
    this._startLevel = newLevel;
  }

  onError(data) {
    if(data.fatal) {
      return;
    }

    let details = data.details, hls = this.hls, levelId, level, levelError = false, abrController = hls.abrController, minAutoLevel = abrController.minAutoLevel;
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
      case ErrorDetails.REMUX_ALLOC_ERROR:
        levelId = data.level;
        break;
      default:
        break;
    }
    /* try to switch to a redundant stream if any available.
     * if no redundant stream available, emergency switch down (if in auto mode and current level not 0)
     * otherwise, we cannot recover this network error ...
     */
    if (levelId !== undefined) {
      level = this._levels[levelId];
      if(!level.loadError) {
        level.loadError = 1;
      } else {
        level.loadError++;
      }
      // if any redundant streams available and if we haven't try them all (level.loadError is reseted on successful frag/level load.
      // if level.loadError reaches nbRedundantLevel it means that we tried them all, no hope  => let's switch down
      const nbRedundantLevel = level.url.length;
     if (nbRedundantLevel > 1 && level.loadError < nbRedundantLevel) {
        level.urlId = (level.urlId + 1) % nbRedundantLevel;
        level.details = undefined;
        logger.warn(`level controller,${details} for level ${levelId}: switching to redundant stream id ${level.urlId}`);
      } else {
        // we could try to recover if in auto mode and current level not lowest level (0)
        let recoverable = ((this._manualLevel === -1) && levelId);
        if (recoverable) {
          logger.warn(`level controller,${details}: switch-down for next fragment`);
          abrController.nextAutoLevel = Math.max(minAutoLevel,levelId-1);
        } else if(level && level.details && level.details.live) {
          logger.warn(`level controller,${details} on live stream, discard`);
          if (levelError) {
            // reset this._level so that another call to set level() will retrigger a frag load
            this._level = undefined;
          }
          // other errors are handled by stream controller
        } else if (details === ErrorDetails.LEVEL_LOAD_ERROR ||
                   details === ErrorDetails.LEVEL_LOAD_TIMEOUT) {
          let media = hls.media,
            // 0.5 : tolerance needed as some browsers stalls playback before reaching buffered end
              mediaBuffered = media && BufferHelper.isBuffered(media,media.currentTime) && BufferHelper.isBuffered(media,media.currentTime+0.5);
          if (mediaBuffered) {
            let retryDelay = hls.config.levelLoadingRetryDelay;
            logger.warn(`level controller,${details}, but media buffered, retry in ${retryDelay}ms`);
            this.timer = setTimeout(this.ontick,retryDelay);
          } else {
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
  }

  // reset level load error counter on successful frag loaded
  onFragLoaded(data) {
    const fragLoaded = data.frag;
    if (fragLoaded && fragLoaded.type === 'main') {
      const level = this._levels[fragLoaded.level];
      if (level) {
        level.loadError = 0;
      }
    }
  }

  onLevelLoaded(data) {
    const levelId = data.level;
     // only process level loaded events matching with expected level
    if (levelId === this._level) {
      let curLevel = this._levels[levelId];
      // reset level load error counter on successful level loaded
      curLevel.loadError = 0;
      let newDetails = data.details;
      // if current playlist is a live playlist, arm a timer to reload it
      if (newDetails.live) {
        let reloadInterval = 1000*( newDetails.averagetargetduration ? newDetails.averagetargetduration : newDetails.targetduration),
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

