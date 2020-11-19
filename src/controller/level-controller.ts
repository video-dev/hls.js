/*
 * Level Controller
*/

import {
  ManifestLoadedData,
  ManifestParsedData,
  LevelLoadedData,
  TrackSwitchedData,
  FragLoadedData,
  ErrorData
} from '../types/events';
import { HlsUrlParameters, Level, LevelParsed } from '../types/level';
import { Events } from '../events';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';
import { isCodecSupportedInMp4 } from '../utils/codecs';
import { addGroupId } from './level-helper';
import Fragment from '../loader/fragment';
import { MediaPlaylist } from '../types/media-playlist';
import BasePlaylistController from './base-playlist-controller';
import Hls from '../hls';

const chromeOrFirefox: boolean = /chrome|firefox/.test(navigator.userAgent.toLowerCase());

export default class LevelController extends BasePlaylistController {
  private _levels: Level[] = [];
  private _firstLevel: number = -1;
  private _startLevel?: number;
  private currentLevelIndex: number = -1;
  private manualLevelIndex: number = -1;

  public onParsedComplete!: Function;

  constructor (hls: Hls) {
    super(hls);
    this._registerListeners();
  }

  private _registerListeners () {
    const { hls } = this;
    hls.on(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.on(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.on(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.on(Events.ERROR, this.onError, this);
  }

  private _unregisterListeners () {
    const { hls } = this;
    hls.off(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.off(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.off(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.off(Events.ERROR, this.onError, this);
  }

  public destroy () {
    super.destroy();
    this._unregisterListeners();
    this.manualLevelIndex = -1;
  }

  public startLoad (): void {
    const levels = this._levels;

    // clean up live level details to force reload them, and reset load errors
    levels.forEach(level => {
      level.loadError = 0;
    });

    super.startLoad();
  }

  protected onManifestLoaded (event: Events.MANIFEST_LOADED, data: ManifestLoadedData): void {
    let levels: Level[] = [];
    let audioTracks: MediaPlaylist[] = [];
    let subtitleTracks: MediaPlaylist[] = [];
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

    if (data.subtitles) {
      subtitleTracks = data.subtitles.map((track, index) => Object.assign({ id: index }, track));
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
          logger.log(`[level-controller]: manifest loaded, ${levels.length} level(s) found, first bitrate: ${bitrateStart}`);
          break;
        }
      }

      // Audio is only alternate if manifest include a URI along with the audio group tag,
      // and this is not an audio-only stream where levels contain audio-only
      const audioOnly = audioCodecFound && !videoCodecFound;
      const edata: ManifestParsedData = {
        levels,
        audioTracks,
        subtitleTracks,
        firstLevel: this._firstLevel,
        stats: data.stats,
        audio: audioCodecFound,
        video: videoCodecFound,
        altAudio: !audioOnly && audioTracks.some(t => !!t.url)
      };
      this.hls.trigger(Events.MANIFEST_PARSED, edata);

      this.onParsedComplete();
    } else {
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
        fatal: true,
        url: data.url,
        reason: 'no level with compatible codecs found in manifest'
      });
    }
  }

  get levels (): Level[] | null {
    if (this._levels.length === 0) {
      return null;
    }
    return this._levels;
  }

  get level (): number {
    return this.currentLevelIndex;
  }

  set level (newLevel: number) {
    const levels = this._levels;
    if (this.currentLevelIndex === newLevel && levels[newLevel]?.details) {
      return;
    }
    // check if level idx is valid
    if (newLevel < 0 || newLevel >= levels.length) {
      // invalid level id given, trigger error
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.OTHER_ERROR,
        details: ErrorDetails.LEVEL_SWITCH_ERROR,
        level: newLevel,
        fatal: false,
        reason: 'invalid level idx'
      });
      return;
    }
    // stopping live reloading timer if any
    this.clearTimer();

    const lastLevelIndex = this.currentLevelIndex;
    const lastLevel = levels[lastLevelIndex];
    const level = levels[newLevel];
    logger.log(`[level-controller]: switching to level ${newLevel} from ${lastLevelIndex}`);
    this.currentLevelIndex = newLevel;
    this.hls.trigger(Events.LEVEL_SWITCHING, Object.assign({}, level, {
      level: newLevel
    }));
    // check if we need to load playlist for this level
    const levelDetails = level.details;
    if (!levelDetails || levelDetails.live) {
      // level not retrieved yet, or live playlist we need to (re)load it
      const hlsUrlParameters = this.switchParams(level.uri, lastLevel?.details);
      this.loadPlaylist(hlsUrlParameters);
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

  protected onError (event: Events.ERROR, data: ErrorData) {
    if (data.fatal) {
      if (data.type === ErrorTypes.NETWORK_ERROR) {
        this.clearTimer();
      }
      return;
    }

    let levelError = false;
    let fragmentError = false;
    let levelSwitch = true;
    let levelIndex;

    // try to recover not fatal errors
    switch (data.details) {
    case ErrorDetails.FRAG_LOAD_ERROR:
    case ErrorDetails.FRAG_LOAD_TIMEOUT:
    case ErrorDetails.KEY_LOAD_ERROR:
    case ErrorDetails.KEY_LOAD_TIMEOUT:
      // FIXME: What distinguishes these fragment events from level or track fragments?
      //   We shouldn't recover a level if the fragment or key is for a media track
      console.assert(data.frag, 'Event has a fragment defined.');
      levelIndex = (data.frag as Fragment).level;
      fragmentError = true;
      break;
    case ErrorDetails.LEVEL_LOAD_ERROR:
    case ErrorDetails.LEVEL_LOAD_TIMEOUT:
      // Do not perform level switch if an error occurred using delivery directives
      // Attempt to reload level without directives first
      if (data.context) {
        if (data.context.deliveryDirectives) {
          levelSwitch = false;
        }
        levelIndex = data.context.level;
      }
      levelError = true;
      break;
    case ErrorDetails.REMUX_ALLOC_ERROR:
      levelIndex = data.level;
      levelError = true;
      break;
    }

    if (levelIndex !== undefined) {
      this.recoverLevel(data, levelIndex, levelError, fragmentError, levelSwitch);
    }
  }

  /**
   * Switch to a redundant stream if any available.
   * If redundant stream is not available, emergency switch down if ABR mode is enabled.
   */
  private recoverLevel (errorEvent: ErrorData, levelIndex: number, levelError: boolean, fragmentError: boolean, levelSwitch: boolean): void {
    const { details: errorDetails } = errorEvent;
    const level = this._levels[levelIndex];
    let redundantLevels, nextLevel;

    level.loadError++;
    level.fragmentError = fragmentError;

    if (levelError) {
      const retrying = this.retryLoadingOrFail(errorEvent);
      if (retrying) {
        // boolean used to inform stream controller not to switch back to IDLE on non fatal error
        errorEvent.levelRetry = true;
      } else {
        this.currentLevelIndex = -1;
        return;
      }
    }

    // Try any redundant streams if available for both errors: level and fragment
    // If level.loadError reaches redundantLevels it means that we tried them all, no hope  => let's switch down
    if (levelSwitch && (levelError || fragmentError)) {
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
          if (this.currentLevelIndex !== nextLevel) {
            fragmentError = false;
            logger.warn(`[level-controller]: ${errorDetails}: switch to ${nextLevel}`);
            this.hls.nextAutoLevel = this.currentLevelIndex = nextLevel;
          }
        }
        if (fragmentError) {
          // Allow fragment retry as long as configuration allows.
          // reset this._level so that another call to set level() will trigger again a frag load
          logger.warn(`[level-controller]: ${errorDetails}: reload a fragment`);
          this.currentLevelIndex = -1;
        }
      }
    }
  }

  // reset errors on the successful load of a fragment
  protected onFragLoaded (event: Events.FRAG_LOADED, { frag }: FragLoadedData) {
    if (frag !== undefined && frag.type === 'main') {
      const level = this._levels[frag.level];
      if (level !== undefined) {
        level.fragmentError = false;
        level.loadError = 0;
      }
    }
  }

  protected onLevelLoaded (event: Events.LEVEL_LOADED, data: LevelLoadedData) {
    const { level, details } = data;
    const curLevel = this._levels[level];

    if (!curLevel) {
      logger.warn('[level-controller]: Invalid level index:', level);
      if (data.deliveryDirectives?.skip) {
        details.deltaUpdateFailed = true;
      }
      return;
    }
    logger.log(`[level-controller]: level ${level} loaded [${details.startSN}-${details.endSN}]`);

    // only process level loaded events matching with expected level
    if (level === this.currentLevelIndex) {
      // reset level load error counter on successful level loaded only if there is no issues with fragments
      if (!curLevel.fragmentError) {
        curLevel.loadError = 0;
        this.retryCount = 0;
      }
      this.playlistLoaded(level, data, curLevel.details);
    } else if (data.deliveryDirectives?.skip) {
      // received a delta playlist update that cannot be merged
      details.deltaUpdateFailed = true;
    }
  }

  protected onAudioTrackSwitched (event: Events.AUDIO_TRACK_SWITCHED, data: TrackSwitchedData) {
    const currentLevel = this.hls.levels[this.currentLevelIndex];
    if (!currentLevel) {
      return;
    }

    if (currentLevel.audioGroupIds) {
      let urlId = -1;
      const audioGroupId = this.hls.audioTracks[data.id].groupId;
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

  protected loadPlaylist (hlsUrlParameters?: HlsUrlParameters) {
    const level = this.currentLevelIndex;
    const currentLevel = this._levels[level];

    if (this.canLoad && currentLevel && currentLevel.url.length > 0) {
      const id = currentLevel.urlId;
      let url = currentLevel.url[id];
      if (hlsUrlParameters) {
        try {
          url = hlsUrlParameters.addDirectives(url);
        } catch (error) {
          logger.warn(`[level-controller] Could not construct new URL with HLS Delivery Directives: ${error}`);
        }
      }

      logger.log(`[level-controller]: Attempt loading level index ${level}${
        hlsUrlParameters ? ' at sn ' + hlsUrlParameters.msn + ' part ' + hlsUrlParameters.part : ''
      } with URL-id ${id} ${url}`);

      // console.log('Current audio track group ID:', this.hls.audioTracks[this.hls.audioTrack].groupId);
      // console.log('New video quality level audio group id:', levelObject.attrs.AUDIO, level);
      this.clearTimer();
      this.hls.trigger(Events.LEVEL_LOADING, {
        url,
        level,
        id,
        deliveryDirectives: hlsUrlParameters || null
      });
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
      if (details?.fragments) {
        details.fragments.forEach((fragment) => {
          fragment.level = index;
        });
      }
      return level;
    });
    this._levels = levels;

    this.hls.trigger(Events.LEVELS_UPDATED, { levels });
  }
}
