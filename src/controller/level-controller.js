/*
 * Level Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';
import { isCodecSupportedInMp4 } from '../utils/codecs';

export default class LevelController extends EventHandler {
  constructor (hls) {
    super(hls,
      Event.MANIFEST_LOADED,
      Event.LEVEL_LOADED,
      Event.FRAG_LOADED,
      Event.ERROR);
    this.canload = false;
    this.currentLevelIndex = null;
    this.manualLevelIndex = -1;
    this.timer = null;
  }

  onHandlerDestroying () {
    this.cleanTimer();
    this.manualLevelIndex = -1;
  }

  cleanTimer () {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  startLoad () {
    let levels = this._levels;

    this.canload = true;
    this.levelRetryCount = 0;

    // clean up live level details to force reload them, and reset load errors
    if (levels) {
      levels.forEach(level => {
        level.loadError = 0;
        const levelDetails = level.details;
        if (levelDetails && levelDetails.live) {
          level.details = undefined;
        }
      });
    }
    // speed up live playlist refresh if timer exists
    if (this.timer !== null) {
      this.loadLevel();
    }
  }

  stopLoad () {
    this.canload = false;
  }

  onManifestLoaded (data) {
    let levels = [];
    let bitrateStart;
    let levelSet = {};
    let levelFromSet = null;
    let videoCodecFound = false;
    let audioCodecFound = false;
    let chromeOrFirefox = /chrome|firefox/.test(navigator.userAgent.toLowerCase());
    let audioTracks = [];

    // regroup redundant levels together
    data.levels.forEach(level => {
      level.loadError = 0;
      level.fragmentError = false;

      videoCodecFound = videoCodecFound || !!level.videoCodec;
      audioCodecFound = audioCodecFound || !!level.audioCodec || !!(level.attrs && level.attrs.AUDIO);

      // erase audio codec info if browser does not support mp4a.40.34.
      // demuxer will autodetect codec and fallback to mpeg/audio
      if (chromeOrFirefox === true && level.audioCodec && level.audioCodec.indexOf('mp4a.40.34') !== -1) {
        level.audioCodec = undefined;
      }

      levelFromSet = levelSet[level.bitrate];

      if (levelFromSet === undefined) {
        level.url = [level.url];
        level.urlId = 0;
        levelSet[level.bitrate] = level;
        levels.push(level);
      } else {
        levelFromSet.url.push(level.url);
      }
    });

    // remove audio-only level if we also have levels with audio+video codecs signalled
    if (videoCodecFound === true && audioCodecFound === true) {
      levels = levels.filter(({ videoCodec }) => !!videoCodec);
    }

    // only keep levels with supported audio/video codecs
    levels = levels.filter(({ audioCodec, videoCodec }) => {
      return (!audioCodec || isCodecSupportedInMp4(audioCodec)) && (!videoCodec || isCodecSupportedInMp4(videoCodec));
    });

    if (data.audioTracks) {
      audioTracks = data.audioTracks.filter(track => !track.audioCodec || isCodecSupportedInMp4(track.audioCodec, 'audio'));
    }

    if (levels.length > 0) {
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
      this.hls.trigger(Event.MANIFEST_PARSED, {
        levels,
        audioTracks,
        firstLevel: this._firstLevel,
        stats: data.stats,
        audio: audioCodecFound,
        video: videoCodecFound,
        altAudio: audioTracks.length > 0 && videoCodecFound
      });
    } else {
      this.hls.trigger(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
        fatal: true,
        url: this.hls.url,
        reason: 'no level with compatible codecs found in manifest'
      });
    }
  }

  get levels () {
    return this._levels;
  }

  get level () {
    return this.currentLevelIndex;
  }

  set level (newLevel) {
    let levels = this._levels;
    if (levels) {
      newLevel = Math.min(newLevel, levels.length - 1);
      if (this.currentLevelIndex !== newLevel || levels[newLevel].details === undefined) {
        this.setLevelInternal(newLevel);
      }
    }
  }

  setLevelInternal (newLevel) {
    const levels = this._levels;
    const hls = this.hls;
    // check if level idx is valid
    if (newLevel >= 0 && newLevel < levels.length) {
      // stopping live reloading timer if any
      this.cleanTimer();
      if (this.currentLevelIndex !== newLevel) {
        logger.log(`switching to level ${newLevel}`);
        this.currentLevelIndex = newLevel;
        let levelProperties = levels[newLevel];
        levelProperties.level = newLevel;
        hls.trigger(Event.LEVEL_SWITCHING, levelProperties);
      }
      let level = levels[newLevel], levelDetails = level.details;
      // check if we need to load playlist for this level
      if (!levelDetails || levelDetails.live === true) {
        // level not retrieved yet, or live playlist we need to (re)load it
        let urlId = level.urlId;
        hls.trigger(Event.LEVEL_LOADING, { url: level.url[urlId], level: newLevel, id: urlId });
      }
    } else {
      // invalid level id given, trigger error
      hls.trigger(Event.ERROR, {
        type: ErrorTypes.OTHER_ERROR,
        details: ErrorDetails.LEVEL_SWITCH_ERROR,
        level: newLevel,
        fatal: false,
        reason: 'invalid level idx'
      });
    }
  }

  get manualLevel () {
    return this.manualLevelIndex;
  }

  set manualLevel (newLevel) {
    this.manualLevelIndex = newLevel;
    if (this._startLevel === undefined) {
      this._startLevel = newLevel;
    }

    if (newLevel !== -1) {
      this.level = newLevel;
    }
  }

  get firstLevel () {
    return this._firstLevel;
  }

  set firstLevel (newLevel) {
    this._firstLevel = newLevel;
  }

  get startLevel () {
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

  set startLevel (newLevel) {
    this._startLevel = newLevel;
  }

  onError (data) {
    if (data.fatal === true) {
      if (data.type === ErrorTypes.NETWORK_ERROR) {
        this.cleanTimer();
      }

      return;
    }

    let levelError = false, fragmentError = false;
    let levelIndex;

    // try to recover not fatal errors
    switch (data.details) {
    case ErrorDetails.FRAG_LOAD_ERROR:
    case ErrorDetails.FRAG_LOAD_TIMEOUT:
    case ErrorDetails.KEY_LOAD_ERROR:
    case ErrorDetails.KEY_LOAD_TIMEOUT:
      levelIndex = data.frag.level;
      fragmentError = true;
      break;
    case ErrorDetails.LEVEL_LOAD_ERROR:
    case ErrorDetails.LEVEL_LOAD_TIMEOUT:
      levelIndex = data.context.level;
      levelError = true;
      break;
    case ErrorDetails.REMUX_ALLOC_ERROR:
      levelIndex = data.level;
      levelError = true;
      break;
    }

    if (levelIndex !== undefined) {
      this.recoverLevel(data, levelIndex, levelError, fragmentError);
    }
  }

  /**
   * Switch to a redundant stream if any available.
   * If redundant stream is not available, emergency switch down if ABR mode is enabled.
   *
   * @param {Object} errorEvent
   * @param {Number} levelIndex current level index
   * @param {Boolean} levelError
   * @param {Boolean} fragmentError
   */
  // FIXME Find a better abstraction where fragment/level retry management is well decoupled
  recoverLevel (errorEvent, levelIndex, levelError, fragmentError) {
    let { config } = this.hls;
    let { details: errorDetails } = errorEvent;
    let level = this._levels[levelIndex];
    let redundantLevels, delay, nextLevel;

    level.loadError++;
    level.fragmentError = fragmentError;

    if (levelError === true) {
      if ((this.levelRetryCount + 1) <= config.levelLoadingMaxRetry) {
        // exponential backoff capped to max retry timeout
        delay = Math.min(Math.pow(2, this.levelRetryCount) * config.levelLoadingRetryDelay, config.levelLoadingMaxRetryTimeout);
        // Schedule level reload
        this.timer = setTimeout(() => this.loadLevel(), delay);
        // boolean used to inform stream controller not to switch back to IDLE on non fatal error
        errorEvent.levelRetry = true;
        this.levelRetryCount++;
        logger.warn(`level controller, ${errorDetails}, retry in ${delay} ms, current retry count is ${this.levelRetryCount}`);
      } else {
        logger.error(`level controller, cannot recover from ${errorDetails} error`);
        this.currentLevelIndex = null;
        // stopping live reloading timer if any
        this.cleanTimer();
        // switch error to fatal
        errorEvent.fatal = true;
        return;
      }
    }

    // Try any redundant streams if available for both errors: level and fragment
    // If level.loadError reaches redundantLevels it means that we tried them all, no hope  => let's switch down
    if (levelError === true || fragmentError === true) {
      redundantLevels = level.url.length;

      if (redundantLevels > 1 && level.loadError < redundantLevels) {
        logger.warn(`level controller, ${errorDetails} for level ${levelIndex}: switching to redundant stream id ${level.urlId}`);
        level.urlId = (level.urlId + 1) % redundantLevels;
        level.details = undefined;
      } else {
        // Search for available level
        if (this.manualLevelIndex === -1) {
          // When lowest level has been reached, let's start hunt from the top
          nextLevel = (levelIndex === 0) ? this._levels.length - 1 : levelIndex - 1;
          logger.warn(`level controller, ${errorDetails}: switch to ${nextLevel}`);
          this.hls.nextAutoLevel = this.currentLevelIndex = nextLevel;
        } else if (fragmentError === true) {
          // Allow fragment retry as long as configuration allows.
          // reset this._level so that another call to set level() will trigger again a frag load
          logger.warn(`level controller, ${errorDetails}: reload a fragment`);
          this.currentLevelIndex = null;
        }
      }
    }
  }

  // reset errors on the successful load of a fragment
  onFragLoaded ({ frag }) {
    if (frag !== undefined && frag.type === 'main') {
      const level = this._levels[frag.level];
      if (level !== undefined) {
        level.fragmentError = false;
        level.loadError = 0;
        this.levelRetryCount = 0;
      }
    }
  }

  onLevelLoaded (data) {
    const levelId = data.level;
    // only process level loaded events matching with expected level
    if (levelId === this.currentLevelIndex) {
      let curLevel = this._levels[levelId];
      // reset level load error counter on successful level loaded only if there is no issues with fragments
      if (curLevel.fragmentError === false) {
        curLevel.loadError = 0;
        this.levelRetryCount = 0;
      }
      let newDetails = data.details;
      // if current playlist is a live playlist, arm a timer to reload it
      if (newDetails.live) {
        const targetdurationMs = 1000 * (newDetails.averagetargetduration ? newDetails.averagetargetduration : newDetails.targetduration);
        let reloadInterval = targetdurationMs,
          curDetails = curLevel.details;
        if (curDetails && newDetails.endSN === curDetails.endSN) {
          // follow HLS Spec, If the client reloads a Playlist file and finds that it has not
          // changed then it MUST wait for a period of one-half the target
          // duration before retrying.
          reloadInterval /= 2;
          logger.log('same live playlist, reload twice faster');
        }
        // decrement reloadInterval with level loading delay
        reloadInterval -= performance.now() - data.stats.trequest;
        // in any case, don't reload more than half of target duration
        reloadInterval = Math.max(targetdurationMs / 2, Math.round(reloadInterval));
        logger.log(`live playlist, reload in ${Math.round(reloadInterval)} ms`);
        this.timer = setTimeout(() => this.loadLevel(), reloadInterval);
      } else {
        this.cleanTimer();
      }
    }
  }

  loadLevel () {
    let level, urlIndex;

    if (this.currentLevelIndex !== null && this.canload === true) {
      level = this._levels[this.currentLevelIndex];
      if (level !== undefined && level.url.length > 0) {
        urlIndex = level.urlId;
        this.hls.trigger(Event.LEVEL_LOADING, { url: level.url[urlIndex], level: this.currentLevelIndex, id: urlIndex });
      }
    }
  }

  get nextLoadLevel () {
    if (this.manualLevelIndex !== -1) {
      return this.manualLevelIndex;
    } else {
      return this.hls.nextAutoLevel;
    }
  }

  set nextLoadLevel (nextLevel) {
    this.level = nextLevel;
    if (this.manualLevelIndex === -1) {
      this.hls.nextAutoLevel = nextLevel;
    }
  }
}
