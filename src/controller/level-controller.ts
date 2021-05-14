/*
 * Level Controller
 */

import {
  ManifestLoadedData,
  ManifestParsedData,
  LevelLoadedData,
  TrackSwitchedData,
  FragLoadedData,
  ErrorData,
  LevelSwitchingData,
} from '../types/events';
import { Level } from '../types/level';
import { Events } from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';
import { isCodecSupportedInMp4 } from '../utils/codecs';
import { addGroupId, assignTrackIdsByGroup } from './level-helper';
import BasePlaylistController from './base-playlist-controller';
import { PlaylistContextType, PlaylistLevelType } from '../types/loader';
import type Hls from '../hls';
import type { HlsUrlParameters, LevelParsed } from '../types/level';
import type { MediaPlaylist } from '../types/media-playlist';

const chromeOrFirefox: boolean = /chrome|firefox/.test(
  navigator.userAgent.toLowerCase()
);

export default class LevelController extends BasePlaylistController {
  private _levels: Level[] = [];
  private _firstLevel: number = -1;
  private _startLevel?: number;
  private currentLevelIndex: number = -1;
  private manualLevelIndex: number = -1;

  public onParsedComplete!: Function;

  constructor(hls: Hls) {
    super(hls, '[level-controller]');
    this._registerListeners();
  }

  private _registerListeners() {
    const { hls } = this;
    hls.on(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.on(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.on(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.on(Events.ERROR, this.onError, this);
  }

  private _unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.off(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.off(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.off(Events.ERROR, this.onError, this);
  }

  public destroy() {
    this._unregisterListeners();
    this.manualLevelIndex = -1;
    this._levels.length = 0;
    super.destroy();
  }

  public startLoad(): void {
    const levels = this._levels;

    // clean up live level details to force reload them, and reset load errors
    levels.forEach((level) => {
      level.loadError = 0;
    });

    super.startLoad();
  }

  protected onManifestLoaded(
    event: Events.MANIFEST_LOADED,
    data: ManifestLoadedData
  ): void {
    let levels: Level[] = [];
    let audioTracks: MediaPlaylist[] = [];
    let subtitleTracks: MediaPlaylist[] = [];
    let bitrateStart: number | undefined;
    const levelSet: { [key: string]: Level } = {};
    let levelFromSet: Level;
    let resolutionFound = false;
    let videoCodecFound = false;
    let audioCodecFound = false;

    // regroup redundant levels together
    data.levels.forEach((levelParsed: LevelParsed) => {
      const attributes = levelParsed.attrs;

      resolutionFound =
        resolutionFound || !!(levelParsed.width && levelParsed.height);
      videoCodecFound = videoCodecFound || !!levelParsed.videoCodec;
      audioCodecFound = audioCodecFound || !!levelParsed.audioCodec;

      // erase audio codec info if browser does not support mp4a.40.34.
      // demuxer will autodetect codec and fallback to mpeg/audio
      if (
        chromeOrFirefox &&
        levelParsed.audioCodec &&
        levelParsed.audioCodec.indexOf('mp4a.40.34') !== -1
      ) {
        levelParsed.audioCodec = undefined;
      }

      const levelKey = `${levelParsed.bitrate}-${levelParsed.attrs.RESOLUTION}-${levelParsed.attrs.CODECS}`;
      levelFromSet = levelSet[levelKey];

      if (!levelFromSet) {
        levelFromSet = new Level(levelParsed);
        levelSet[levelKey] = levelFromSet;
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

    // remove audio-only level if we also have levels with video codecs or RESOLUTION signalled
    if ((resolutionFound || videoCodecFound) && audioCodecFound) {
      levels = levels.filter(
        ({ videoCodec, width, height }) => !!videoCodec || !!(width && height)
      );
    }

    // only keep levels with supported audio/video codecs
    levels = levels.filter(({ audioCodec, videoCodec }) => {
      return (
        (!audioCodec || isCodecSupportedInMp4(audioCodec, 'audio')) &&
        (!videoCodec || isCodecSupportedInMp4(videoCodec, 'video'))
      );
    });

    if (data.audioTracks) {
      audioTracks = data.audioTracks.filter(
        (track) =>
          !track.audioCodec || isCodecSupportedInMp4(track.audioCodec, 'audio')
      );
      // Assign ids after filtering as array indices by group-id
      assignTrackIdsByGroup(audioTracks);
    }

    if (data.subtitles) {
      subtitleTracks = data.subtitles;
      assignTrackIdsByGroup(subtitleTracks);
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
          this.log(
            `manifest loaded, ${levels.length} level(s) found, first bitrate: ${bitrateStart}`
          );
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
        altAudio: !audioOnly && audioTracks.some((t) => !!t.url),
      };
      this.hls.trigger(Events.MANIFEST_PARSED, edata);

      // Initiate loading after all controllers have received MANIFEST_PARSED
      if (this.hls.config.autoStartLoad || this.hls.forceStartLoad) {
        this.hls.startLoad(this.hls.config.startPosition);
      }
    } else {
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
        fatal: true,
        url: data.url,
        reason: 'no level with compatible codecs found in manifest',
      });
    }
  }

  get levels(): Level[] | null {
    if (this._levels.length === 0) {
      return null;
    }
    return this._levels;
  }

  get level(): number {
    return this.currentLevelIndex;
  }

  set level(newLevel: number) {
    const levels = this._levels;
    if (levels.length === 0) {
      return;
    }
    if (this.currentLevelIndex === newLevel && levels[newLevel]?.details) {
      return;
    }
    // check if level idx is valid
    if (newLevel < 0 || newLevel >= levels.length) {
      // invalid level id given, trigger error
      const fatal = newLevel < 0;
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.OTHER_ERROR,
        details: ErrorDetails.LEVEL_SWITCH_ERROR,
        level: newLevel,
        fatal,
        reason: 'invalid level idx',
      });
      if (fatal) {
        return;
      }
      newLevel = Math.min(newLevel, levels.length - 1);
    }

    // stopping live reloading timer if any
    this.clearTimer();

    const lastLevelIndex = this.currentLevelIndex;
    const lastLevel = levels[lastLevelIndex];
    const level = levels[newLevel];
    this.log(`switching to level ${newLevel} from ${lastLevelIndex}`);
    this.currentLevelIndex = newLevel;

    const levelSwitchingData: LevelSwitchingData = Object.assign({}, level, {
      level: newLevel,
      maxBitrate: level.maxBitrate,
      uri: level.uri,
      urlId: level.urlId,
    });
    // @ts-ignore
    delete levelSwitchingData._urlId;
    this.hls.trigger(Events.LEVEL_SWITCHING, levelSwitchingData);
    // check if we need to load playlist for this level
    const levelDetails = level.details;
    if (!levelDetails || levelDetails.live) {
      // level not retrieved yet, or live playlist we need to (re)load it
      const hlsUrlParameters = this.switchParams(level.uri, lastLevel?.details);
      this.loadPlaylist(hlsUrlParameters);
    }
  }

  get manualLevel(): number {
    return this.manualLevelIndex;
  }

  set manualLevel(newLevel) {
    this.manualLevelIndex = newLevel;
    if (this._startLevel === undefined) {
      this._startLevel = newLevel;
    }

    if (newLevel !== -1) {
      this.level = newLevel;
    }
  }

  get firstLevel(): number {
    return this._firstLevel;
  }

  set firstLevel(newLevel) {
    this._firstLevel = newLevel;
  }

  get startLevel() {
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

  set startLevel(newLevel) {
    this._startLevel = newLevel;
  }

  protected onError(event: Events.ERROR, data: ErrorData) {
    super.onError(event, data);
    if (data.fatal) {
      return;
    }

    // Switch to redundant level when track fails to load
    const context = data.context;
    const level = this._levels[this.currentLevelIndex];
    if (
      context &&
      ((context.type === PlaylistContextType.AUDIO_TRACK &&
        level.audioGroupIds &&
        context.groupId === level.audioGroupIds[level.urlId]) ||
        (context.type === PlaylistContextType.SUBTITLE_TRACK &&
          level.textGroupIds &&
          context.groupId === level.textGroupIds[level.urlId]))
    ) {
      this.redundantFailover(this.currentLevelIndex);
      return;
    }

    let levelError = false;
    let levelSwitch = true;
    let levelIndex;

    // try to recover not fatal errors
    switch (data.details) {
      case ErrorDetails.FRAG_LOAD_ERROR:
      case ErrorDetails.FRAG_LOAD_TIMEOUT:
      case ErrorDetails.KEY_LOAD_ERROR:
      case ErrorDetails.KEY_LOAD_TIMEOUT:
        if (data.frag) {
          const level = this._levels[data.frag.level];
          // Set levelIndex when we're out of fragment retries
          if (level) {
            level.fragmentError++;
            if (level.fragmentError > this.hls.config.fragLoadingMaxRetry) {
              levelIndex = data.frag.level;
            }
          } else {
            levelIndex = data.frag.level;
          }
        }
        break;
      case ErrorDetails.LEVEL_LOAD_ERROR:
      case ErrorDetails.LEVEL_LOAD_TIMEOUT:
        // Do not perform level switch if an error occurred using delivery directives
        // Attempt to reload level without directives first
        if (context) {
          if (context.deliveryDirectives) {
            levelSwitch = false;
          }
          levelIndex = context.level;
        }
        levelError = true;
        break;
      case ErrorDetails.REMUX_ALLOC_ERROR:
        levelIndex = data.level;
        levelError = true;
        break;
    }

    if (levelIndex !== undefined) {
      this.recoverLevel(data, levelIndex, levelError, levelSwitch);
    }
  }

  /**
   * Switch to a redundant stream if any available.
   * If redundant stream is not available, emergency switch down if ABR mode is enabled.
   */
  private recoverLevel(
    errorEvent: ErrorData,
    levelIndex: number,
    levelError: boolean,
    levelSwitch: boolean
  ): void {
    const { details: errorDetails } = errorEvent;
    const level = this._levels[levelIndex];

    level.loadError++;

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

    if (levelSwitch) {
      const redundantLevels = level.url.length;
      // Try redundant fail-over until level.loadError reaches redundantLevels
      if (redundantLevels > 1 && level.loadError < redundantLevels) {
        errorEvent.levelRetry = true;
        this.redundantFailover(levelIndex);
      } else if (this.manualLevelIndex === -1) {
        // Search for available level in auto level selection mode, cycling from highest to lowest bitrate
        const nextLevel =
          levelIndex === 0 ? this._levels.length - 1 : levelIndex - 1;
        if (
          this.currentLevelIndex !== nextLevel &&
          this._levels[nextLevel].loadError === 0
        ) {
          this.warn(`${errorDetails}: switch to ${nextLevel}`);
          errorEvent.levelRetry = true;
          this.hls.nextAutoLevel = nextLevel;
        }
      }
    }
  }

  private redundantFailover(levelIndex: number) {
    const level = this._levels[levelIndex];
    const redundantLevels = level.url.length;
    if (redundantLevels > 1) {
      // Update the url id of all levels so that we stay on the same set of variants when level switching
      const newUrlId = (level.urlId + 1) % redundantLevels;
      this.warn(`Switching to redundant URL-id ${newUrlId}`);
      this._levels.forEach((level) => {
        level.urlId = newUrlId;
      });
      this.level = levelIndex;
    }
  }

  // reset errors on the successful load of a fragment
  protected onFragLoaded(event: Events.FRAG_LOADED, { frag }: FragLoadedData) {
    if (frag !== undefined && frag.type === PlaylistLevelType.MAIN) {
      const level = this._levels[frag.level];
      if (level !== undefined) {
        level.fragmentError = 0;
        level.loadError = 0;
      }
    }
  }

  protected onLevelLoaded(event: Events.LEVEL_LOADED, data: LevelLoadedData) {
    const { level, details } = data;
    const curLevel = this._levels[level];

    if (!curLevel) {
      this.warn(`Invalid level index ${level}`);
      if (data.deliveryDirectives?.skip) {
        details.deltaUpdateFailed = true;
      }
      return;
    }

    // only process level loaded events matching with expected level
    if (level === this.currentLevelIndex) {
      // reset level load error counter on successful level loaded only if there is no issues with fragments
      if (curLevel.fragmentError === 0) {
        curLevel.loadError = 0;
        this.retryCount = 0;
      }
      this.playlistLoaded(level, data, curLevel.details);
    } else if (data.deliveryDirectives?.skip) {
      // received a delta playlist update that cannot be merged
      details.deltaUpdateFailed = true;
    }
  }

  protected onAudioTrackSwitched(
    event: Events.AUDIO_TRACK_SWITCHED,
    data: TrackSwitchedData
  ) {
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

  protected loadPlaylist(hlsUrlParameters?: HlsUrlParameters) {
    const level = this.currentLevelIndex;
    const currentLevel = this._levels[level];

    if (this.canLoad && currentLevel && currentLevel.url.length > 0) {
      const id = currentLevel.urlId;
      let url = currentLevel.url[id];
      if (hlsUrlParameters) {
        try {
          url = hlsUrlParameters.addDirectives(url);
        } catch (error) {
          this.warn(
            `Could not construct new URL with HLS Delivery Directives: ${error}`
          );
        }
      }

      this.log(
        `Attempt loading level index ${level}${
          hlsUrlParameters
            ? ' at sn ' +
              hlsUrlParameters.msn +
              ' part ' +
              hlsUrlParameters.part
            : ''
        } with URL-id ${id} ${url}`
      );

      // console.log('Current audio track group ID:', this.hls.audioTracks[this.hls.audioTrack].groupId);
      // console.log('New video quality level audio group id:', levelObject.attrs.AUDIO, level);
      this.clearTimer();
      this.hls.trigger(Events.LEVEL_LOADING, {
        url,
        level,
        id,
        deliveryDirectives: hlsUrlParameters || null,
      });
    }
  }

  get nextLoadLevel() {
    if (this.manualLevelIndex !== -1) {
      return this.manualLevelIndex;
    } else {
      return this.hls.nextAutoLevel;
    }
  }

  set nextLoadLevel(nextLevel) {
    this.level = nextLevel;
    if (this.manualLevelIndex === -1) {
      this.hls.nextAutoLevel = nextLevel;
    }
  }

  removeLevel(levelIndex, urlId) {
    const filterLevelAndGroupByIdIndex = (url, id) => id !== urlId;
    const levels = this._levels
      .filter((level, index) => {
        if (index !== levelIndex) {
          return true;
        }

        if (level.url.length > 1 && urlId !== undefined) {
          level.url = level.url.filter(filterLevelAndGroupByIdIndex);
          if (level.audioGroupIds) {
            level.audioGroupIds = level.audioGroupIds.filter(
              filterLevelAndGroupByIdIndex
            );
          }
          if (level.textGroupIds) {
            level.textGroupIds = level.textGroupIds.filter(
              filterLevelAndGroupByIdIndex
            );
          }
          level.urlId = 0;
          return true;
        }
        return false;
      })
      .map((level, index) => {
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
