/*
 * Level Controller
*/

import {
  ManifestLoadedData,
  ManifestParsedData,
  LevelLoadedData,
  AudioTrackSwitchedData,
  FragLoadedData,
  ErrorData
} from '../types/events';
import { Level, LevelParsed, PlaylistMedia } from '../types/level';
import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';
import { isCodecSupportedInMp4 } from '../utils/codecs';
import { addGroupId, computeReloadInterval } from './level-helper';
import Fragment from '../loader/fragment';

let chromeOrFirefox: boolean;

export default class LevelController extends EventHandler {
  private _levels: Level[] | null = null;
  private _firstLevel: number = -1;
  private _startLevel?: number;
  private canLoad: boolean = false;
  private currentLevelIndex: number | null = null;
  private levelRetryCount: number = 0;
  private manualLevelIndex: number = -1;
  private timer: number | null = null;

  constructor (hls) {
    super(hls,
      Event.MANIFEST_LOADED,
      Event.LEVEL_LOADED,
      Event.AUDIO_TRACK_SWITCHED,
      Event.FRAG_LOADED,
      Event.ERROR);

    chromeOrFirefox = /chrome|firefox/.test(navigator.userAgent.toLowerCase());
  }

  protected onHandlerDestroying (): void {
    this.clearTimer();
    this.manualLevelIndex = -1;
  }

  private clearTimer (): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public startLoad (): void {
    const levels = this._levels;

    this.canLoad = true;
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

  public stopLoad (): void {
    this.canLoad = false;
    this.clearTimer();
  }

  protected onManifestLoaded (data: ManifestLoadedData): void {
    let levels: Level[] = [];
    let audioTracks: PlaylistMedia[] = [];
    let bitrateStart: number | undefined;
    const levelSet: { [bitrate: number]: Level; } = {};
    let levelFromSet: Level;
    let videoCodecFound = false;
    let audioCodecFound = false;

    // regroup redundant levels together
    data.levels.forEach((levelParsed: LevelParsed) => {
      const attributes = levelParsed.attrs;

      videoCodecFound = videoCodecFound || !!levelParsed.videoCodec;
      audioCodecFound = audioCodecFound || !!levelParsed.audioCodec;

      // erase audio codec info if browser does not support mp4a.40.34.
      // demuxer will autodetect codec and fallback to mpeg/audio
      if (chromeOrFirefox && levelParsed.audioCodec && levelParsed.audioCodec.indexOf('mp4a.40.34') !== -1) {
        levelParsed.audioCodec = undefined;
      }

      levelFromSet = levelSet[levelParsed.bitrate]; // FIXME: we would also have to match the resolution here

      if (!levelFromSet) {
        levelFromSet = new Level(levelParsed);
        levelSet[levelParsed.bitrate] = levelFromSet;
        levels.push(levelFromSet);
      } else {
        levelFromSet.url.push(levelParsed.url);
      }

      if (attributes) {
        if (attributes.AUDIO) {
          audioCodecFound = true;
          addGroupId(levelFromSet, 'audio', attributes.AUDIO);
        }
        if (attributes.SUBTITLES) {
          addGroupId(levelFromSet, 'text', attributes.SUBTITLES);
        }
      }
    });

    // remove audio-only level if we also have levels with audio+video codecs signalled
    if (videoCodecFound && audioCodecFound) {
      levels = levels.filter(({ videoCodec }) => !!videoCodec);
    }

    // only keep levels with supported audio/video codecs
    levels = levels.filter(({ audioCodec, videoCodec }) => {
      return (!audioCodec || isCodecSupportedInMp4(audioCodec, 'audio')) && (!videoCodec || isCodecSupportedInMp4(videoCodec, 'video'));
    });

    if (data.audioTracks) {
      audioTracks = data.audioTracks.filter(track => !track.audioCodec || isCodecSupportedInMp4(track.audioCodec, 'audio'));
      // Reassign id's after filtering since they're used as array indices
      audioTracks.forEach((track, index) => {
        track.id = index;
      });
    }

    if (levels.length > 0) {
      // start bitrate is the first bitrate of the manifest
      bitrateStart = levels[0].bitrate;
      // sort level on bitrate
      levels.sort((a, b) => a.bitrate - b.bitrate);
      this._levels = levels;
      // find index of first level in sorted levels
      for (let i = 0; i < levels.length; i++) {
        if (levels[i].bitrate === bitrateStart) {
          this._firstLevel = i;
          logger.log(`[level-controller]: manifest loaded,${levels.length} level(s) found, first bitrate:${bitrateStart}`);
          break;
        }
      }

      // Audio is only alternate if manifest include a URI along with the audio group tag
      this.hls.trigger(Event.MANIFEST_PARSED, {
        levels,
        audioTracks,
        firstLevel: this._firstLevel,
        stats: data.stats,
        audio: audioCodecFound,
        video: videoCodecFound,
        altAudio: audioTracks.some(t => !!t.url)
      } as ManifestParsedData);
    } else {
      this.hls.trigger(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
        fatal: true,
        url: data.url,
        reason: 'no level with compatible codecs found in manifest'
      });
    }
  }

  get levels (): Level[] | null {
    return this._levels;
  }

  get level (): number {
    return this.currentLevelIndex as number;
  }

  set level (newLevel: number) {
    const levels = this._levels;
    if (levels) {
      newLevel = Math.min(newLevel, levels.length - 1);
      if (this.currentLevelIndex !== newLevel || !levels[newLevel].details) {
        const levels = this._levels as Level[];
        const hls = this.hls;
        // check if level idx is valid
        if (newLevel >= 0 && newLevel < levels.length) {
          // stopping live reloading timer if any
          this.clearTimer();
          if (this.currentLevelIndex !== newLevel) {
            logger.log(`[level-controller]: switching to level ${newLevel}`);
            this.currentLevelIndex = newLevel;
            hls.trigger(Event.LEVEL_SWITCHING, Object.assign({}, levels[newLevel], {
              level: newLevel
            }));
          }
          const level = levels[newLevel];
          const levelDetails = level.details;

          // check if we need to load playlist for this level
          if (!levelDetails || levelDetails.live) {
            // level not retrieved yet, or live playlist we need to (re)load it
            const urlId = level.urlId;
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
    }
  }

  get manualLevel (): number {
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

  get firstLevel (): number {
    return this._firstLevel;
  }

  set firstLevel (newLevel) {
    this._firstLevel = newLevel;
  }

  get startLevel () {
    // hls.startLevel takes precedence over config.startLevel
    // if none of these values are defined, fallback on this._firstLevel (first quality level appearing in variant manifest)
    if (this._startLevel === undefined) {
      const configStartLevel = this.hls.config.startLevel;
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

  protected onError (data: ErrorData) {
    if (data.fatal) {
      if (data.type === ErrorTypes.NETWORK_ERROR) {
        this.clearTimer();
      }

      return;
    }

    let levelError = false;
    let fragmentError = false;
    let levelIndex;

    // try to recover not fatal errors
    switch (data.details) {
    case ErrorDetails.FRAG_LOAD_ERROR:
    case ErrorDetails.FRAG_LOAD_TIMEOUT:
    case ErrorDetails.KEY_LOAD_ERROR:
    case ErrorDetails.KEY_LOAD_TIMEOUT:
      console.assert(data.frag, 'Event has a fragment defined.');
      levelIndex = (data.frag as Fragment).level;
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
   */
  // FIXME Find a better abstraction where fragment/level retry management is well decoupled
  private recoverLevel (errorEvent: ErrorData, levelIndex: number, levelError: boolean, fragmentError: boolean): void {
    // TODO: Handle levels not set rather than throwing (see other parts of this module throwing the same error)
    if (!this._levels) {
      throw new Error('Levels are not set');
    }
    const { config } = this.hls;
    const { details: errorDetails } = errorEvent;
    const level = this._levels[levelIndex];
    let redundantLevels, delay, nextLevel;

    level.loadError++;
    level.fragmentError = fragmentError;

    if (levelError) {
      if ((this.levelRetryCount + 1) <= config.levelLoadingMaxRetry) {
        // exponential backoff capped to max retry timeout
        delay = Math.min(Math.pow(2, this.levelRetryCount) * config.levelLoadingRetryDelay, config.levelLoadingMaxRetryTimeout);
        // Schedule level reload
        this.timer = self.setTimeout(() => this.loadLevel(), delay);
        // boolean used to inform stream controller not to switch back to IDLE on non fatal error
        errorEvent.levelRetry = true;
        this.levelRetryCount++;
        logger.warn(`[level-controller]: ${errorDetails}, retry in ${delay} ms, current retry count is ${this.levelRetryCount}`);
      } else {
        logger.error(`[level-controller]: cannot recover from ${errorDetails} error`);
        this.currentLevelIndex = null;
        // stopping live reloading timer if any
        this.clearTimer();
        // switch error to fatal
        errorEvent.fatal = true;
        return;
      }
    }

    // Try any redundant streams if available for both errors: level and fragment
    // If level.loadError reaches redundantLevels it means that we tried them all, no hope  => let's switch down
    if (levelError || fragmentError) {
      redundantLevels = level.url.length;

      if (redundantLevels > 1 && level.loadError < redundantLevels) {
        level.urlId = (level.urlId + 1) % redundantLevels;
        level.details = undefined;

        logger.warn(`[level-controller]: ${errorDetails} for level ${levelIndex}: switching to redundant URL-id ${level.urlId}`);

        // console.log('Current audio track group ID:', this.hls.audioTracks[this.hls.audioTrack].groupId);
        // console.log('New video quality level audio group id:', level.attrs.AUDIO);
      } else {
        // Search for available level
        if (this.manualLevelIndex === -1) {
          // When lowest level has been reached, let's start hunt from the top
          nextLevel = (levelIndex === 0) ? this._levels.length - 1 : levelIndex - 1;
          logger.warn(`[level-controller]: ${errorDetails}: switch to ${nextLevel}`);
          this.hls.nextAutoLevel = this.currentLevelIndex = nextLevel;
        } else if (fragmentError) {
          // Allow fragment retry as long as configuration allows.
          // reset this._level so that another call to set level() will trigger again a frag load
          logger.warn(`[level-controller]: ${errorDetails}: reload a fragment`);
          this.currentLevelIndex = null;
        }
      }
    }
  }

  // reset errors on the successful load of a fragment
  protected onFragLoaded ({ frag }: FragLoadedData) {
    if (frag !== undefined && frag.type === 'main') {
      if (!this._levels) {
        throw new Error('Levels are not set');
      }
      const level = this._levels[frag.level];
      if (level !== undefined) {
        level.fragmentError = false;
        level.loadError = 0;
        this.levelRetryCount = 0;
      }
    }
  }

  protected onLevelLoaded (data: LevelLoadedData) {
    const { level, details } = data;
    // only process level loaded events matching with expected level
    if (level !== this.currentLevelIndex) {
      return;
    }
    if (!this._levels) {
      throw new Error('Levels are not set');
    }
    const curLevel = this._levels[level];
    // reset level load error counter on successful level loaded only if there is no issues with fragments
    if (!curLevel.fragmentError) {
      curLevel.loadError = 0;
      this.levelRetryCount = 0;
    }
    // if current playlist is a live playlist, arm a timer to reload it
    if (details.live) {
      const curDetails = curLevel.details;
      details.updated = (!curDetails || details.endSN !== curDetails.endSN || details.url !== curDetails.url);
      details.availabilityDelay = curDetails && curDetails.availabilityDelay;
      const reloadInterval = computeReloadInterval(details, data.stats);
      logger.log(`[level-controller]: live playlist ${details.updated ? 'REFRESHED' : 'MISSED'}, reload in ${Math.round(reloadInterval)} ms`);
      this.timer = self.setTimeout(() => this.loadLevel(), reloadInterval);
    } else {
      this.clearTimer();
    }
  }

  protected onAudioTrackSwitched (data: AudioTrackSwitchedData) {
    const audioGroupId = this.hls.audioTracks[data.id].groupId;

    const currentLevel = this.hls.levels[this.currentLevelIndex as number];
    if (!currentLevel) {
      return;
    }

    if (currentLevel.audioGroupIds) {
      let urlId = -1;

      for (let i = 0; i < currentLevel.audioGroupIds.length; i++) {
        if (currentLevel.audioGroupIds[i] === audioGroupId) {
          urlId = i;
          break;
        }
      }

      if (urlId !== currentLevel.urlId) {
        currentLevel.urlId = urlId;
        this.startLoad();
      }
    }
  }

  private loadLevel () {
    logger.log(`[level-controller]: call to loadLevel (canLoad ${this.canLoad})`);

    if (this.currentLevelIndex !== null && this.canLoad) {
      if (!this._levels) {
        throw new Error('Levels are not set');
      }
      const levelObject = this._levels[this.currentLevelIndex];

      if (typeof levelObject === 'object' && levelObject.url.length > 0) {
        const level = this.currentLevelIndex;
        const id = levelObject.urlId;
        const url = levelObject.url[id];

        logger.log(`[level-controller]: Attempt loading level index ${level} with URL-id ${id}`);

        // console.log('Current audio track group ID:', this.hls.audioTracks[this.hls.audioTrack].groupId);
        // console.log('New video quality level audio group id:', levelObject.attrs.AUDIO, level);

        this.hls.trigger(Event.LEVEL_LOADING, { url, level, id });
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

  removeLevel (levelIndex, urlId) {
    if (!this._levels) {
      throw new Error('Levels are not set');
    }
    const levels = this._levels.filter((level, index) => {
      if (index !== levelIndex) {
        return true;
      }

      if (level.url.length > 1 && urlId !== undefined) {
        level.url = level.url.filter((url, id) => id !== urlId);
        level.urlId = 0;
        return true;
      }
      return false;
    }).map((level, index) => {
      const { details } = level;
      if (details && details.fragments) {
        details.fragments.forEach((fragment) => {
          fragment.level = index;
        });
      }
      return level;
    });
    this._levels = levels;

    this.hls.trigger(Event.LEVELS_UPDATED, { levels });
  }
}
