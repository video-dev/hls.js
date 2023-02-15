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
  LevelsUpdatedData,
  ManifestLoadingData,
} from '../types/events';
import { HdcpLevel, HdcpLevels, Level } from '../types/level';
import { Events } from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';
import { isCodecSupportedInMp4 } from '../utils/codecs';
import BasePlaylistController from './base-playlist-controller';
import { PlaylistContextType, PlaylistLevelType } from '../types/loader';
import type Hls from '../hls';
import type { HlsUrlParameters, LevelParsed } from '../types/level';
import type { MediaPlaylist } from '../types/media-playlist';
import ContentSteeringController from './content-steering-controller';

let chromeOrFirefox: boolean;

export default class LevelController extends BasePlaylistController {
  private _levels: Level[] = [];
  private _firstLevel: number = -1;
  private _startLevel?: number;
  private currentLevel: Level | null = null;
  private currentLevelIndex: number = -1;
  private manualLevelIndex: number = -1;
  private steering: ContentSteeringController | null;

  public onParsedComplete!: Function;

  constructor(
    hls: Hls,
    contentSteeringController: ContentSteeringController | null
  ) {
    super(hls, '[level-controller]');
    this.steering = contentSteeringController;
    this._registerListeners();
  }

  private _registerListeners() {
    const { hls } = this;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.on(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
    hls.on(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.on(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.on(Events.ERROR, this.onError, this);
  }

  private _unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.off(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
    hls.off(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.off(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.off(Events.ERROR, this.onError, this);
  }

  public destroy() {
    this._unregisterListeners();
    this.steering = null;
    this.resetLevels();
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

  private resetLevels() {
    this._startLevel = undefined;
    this.manualLevelIndex = -1;
    this.currentLevelIndex = -1;
    this.currentLevel = null;
    this._levels.length = 0;
  }

  private onManifestLoading(
    event: Events.MANIFEST_LOADING,
    data: ManifestLoadingData
  ) {
    this.resetLevels();
  }

  protected onManifestLoaded(
    event: Events.MANIFEST_LOADED,
    data: ManifestLoadedData
  ) {
    const levels: Level[] = [];
    const levelSet: { [key: string]: Level } = {};
    let levelFromSet: Level;

    // regroup redundant levels together
    data.levels.forEach((levelParsed: LevelParsed) => {
      const attributes = levelParsed.attrs;

      // erase audio codec info if browser does not support mp4a.40.34.
      // demuxer will autodetect codec and fallback to mpeg/audio
      if (levelParsed.audioCodec?.indexOf('mp4a.40.34') !== -1) {
        chromeOrFirefox ||= /chrome|firefox/i.test(navigator.userAgent);
        if (chromeOrFirefox) {
          levelParsed.audioCodec = undefined;
        }
      }

      const {
        AUDIO,
        CODECS,
        'FRAME-RATE': FRAMERATE,
        'PATHWAY-ID': PATHWAY,
        RESOLUTION,
        SUBTITLES,
      } = attributes;
      const contentSteeringPrefix = __USE_CONTENT_STEERING__
        ? `${PATHWAY}-`
        : '';
      const levelKey = `${contentSteeringPrefix}${levelParsed.bitrate}-${RESOLUTION}-${FRAMERATE}-${CODECS}`;
      levelFromSet = levelSet[levelKey];

      if (!levelFromSet) {
        levelFromSet = new Level(levelParsed);
        levelSet[levelKey] = levelFromSet;
        levels.push(levelFromSet);
      } else {
        levelFromSet.addFallback(levelParsed);
      }

      addGroupId(levelFromSet, 'audio', AUDIO);
      addGroupId(levelFromSet, 'text', SUBTITLES);
    });

    this.filterAndSortMediaOptions(levels, data);
  }

  private filterAndSortMediaOptions(levels: Level[], data: ManifestLoadedData) {
    let audioTracks: MediaPlaylist[] = [];
    let subtitleTracks: MediaPlaylist[] = [];

    let resolutionFound = false;
    let videoCodecFound = false;
    let audioCodecFound = false;

    // only keep levels with supported audio/video codecs
    levels = levels.filter(({ audioCodec, videoCodec, width, height }) => {
      resolutionFound ||= !!(width && height);
      videoCodecFound ||= !!videoCodec;
      audioCodecFound ||= !!audioCodec;
      return (
        (!audioCodec || isCodecSupportedInMp4(audioCodec, 'audio')) &&
        (!videoCodec || isCodecSupportedInMp4(videoCodec, 'video'))
      );
    });

    // remove audio-only level if we also have levels with video codecs or RESOLUTION signalled
    if ((resolutionFound || videoCodecFound) && audioCodecFound) {
      levels = levels.filter(
        ({ videoCodec, width, height }) => !!videoCodec || !!(width && height)
      );
    }

    if (levels.length === 0) {
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
        fatal: true,
        url: data.url,
        reason: 'no level with compatible codecs found in manifest',
      });
      return;
    }

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
    // start bitrate is the first bitrate of the manifest
    const unsortedLevels = levels.slice(0);
    // sort levels from lowest to highest
    levels.sort((a, b) => {
      if (a.attrs['HDCP-LEVEL'] !== b.attrs['HDCP-LEVEL']) {
        return (a.attrs['HDCP-LEVEL'] || '') > (b.attrs['HDCP-LEVEL'] || '')
          ? 1
          : -1;
      }
      if (a.bitrate !== b.bitrate) {
        return a.bitrate - b.bitrate;
      }
      if (a.attrs['FRAME-RATE'] !== b.attrs['FRAME-RATE']) {
        return (
          a.attrs.decimalFloatingPoint('FRAME-RATE') -
          b.attrs.decimalFloatingPoint('FRAME-RATE')
        );
      }
      if (a.attrs.SCORE !== b.attrs.SCORE) {
        return (
          a.attrs.decimalFloatingPoint('SCORE') -
          b.attrs.decimalFloatingPoint('SCORE')
        );
      }
      if (resolutionFound && a.height !== b.height) {
        return a.height - b.height;
      }
      return 0;
    });

    let firstLevelInPlaylist = unsortedLevels[0];
    if (this.steering) {
      levels = this.steering.filterParsedLevels(levels);
      if (levels.length !== unsortedLevels.length) {
        for (let i = 0; i < unsortedLevels.length; i++) {
          if (unsortedLevels[i].pathwayId === levels[0].pathwayId) {
            firstLevelInPlaylist = unsortedLevels[i];
            break;
          }
        }
      }
    }

    this._levels = levels;

    // find index of first level in sorted levels
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] === firstLevelInPlaylist) {
        this._firstLevel = i;
        this.log(
          `manifest loaded, ${levels.length} level(s) found, first bitrate: ${firstLevelInPlaylist.bitrate}`
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
      sessionData: data.sessionData,
      sessionKeys: data.sessionKeys,
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

    const lastLevelIndex = this.currentLevelIndex;
    const lastLevel = this.currentLevel;
    const lastPathwayId = lastLevel ? lastLevel.attrs['PATHWAY-ID'] : undefined;
    const level = levels[newLevel];
    const pathwayId = level.attrs['PATHWAY-ID'];
    this.currentLevelIndex = newLevel;
    this.currentLevel = level;

    if (
      this.currentLevelIndex === newLevel &&
      level.details &&
      lastLevel &&
      lastPathwayId === pathwayId
    ) {
      return;
    }

    this.log(
      `Switching to level ${newLevel}${
        pathwayId ? ' with Pathway ' + pathwayId : ''
      } from level ${lastLevelIndex}${
        lastPathwayId ? ' with Pathway ' + lastPathwayId : ''
      }`
    );

    const levelSwitchingData: LevelSwitchingData = Object.assign({}, level, {
      level: newLevel,
      maxBitrate: level.maxBitrate,
      attrs: level.attrs,
      uri: level.uri,
      urlId: level.urlId,
    });
    // @ts-ignore
    delete levelSwitchingData._attrs;
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
    const level = this.currentLevel;
    if (
      context &&
      level &&
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
          // Share fragment error count accross media options (main, audio, subs)
          // This allows for level based rendition switching when media option assets fail
          const variantLevelIndex =
            data.frag.type === PlaylistLevelType.MAIN
              ? data.frag.level
              : this.currentLevelIndex;
          const level = this._levels[variantLevelIndex];
          // Set levelIndex when we're out of fragment retries
          if (level) {
            level.fragmentError++;
            if (level.fragmentError > this.hls.config.fragLoadingMaxRetry) {
              levelIndex = variantLevelIndex;
            }
          } else {
            levelIndex = variantLevelIndex;
          }
        }
        break;
      case ErrorDetails.KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED: {
        const restrictedHdcpLevel = level?.attrs['HDCP-LEVEL'];
        if (restrictedHdcpLevel) {
          this.hls.maxHdcpLevel =
            HdcpLevels[
              HdcpLevels.indexOf(restrictedHdcpLevel as HdcpLevel) - 1
            ];
          this.warn(
            `Restricting playback to HDCP-LEVEL of "${this.hls.maxHdcpLevel}" or lower`
          );
        }
      }
      // eslint-disable-next-line no-fallthrough
      case ErrorDetails.LEVEL_PARSING_ERROR:
      case ErrorDetails.FRAG_PARSING_ERROR:
      case ErrorDetails.KEY_SYSTEM_NO_SESSION:
        levelIndex =
          data.frag?.type === PlaylistLevelType.MAIN
            ? data.frag.level
            : this.currentLevelIndex;
        // Do not retry level. Escalate to fatal if switching levels fails.
        data.levelRetry = false;
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
        levelIndex = data.level ?? this.currentLevelIndex;
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
        this.currentLevel = null;
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
        // Search for next level to retry
        let nextLevel = -1;
        const levels = this._levels;
        for (let i = levels.length; i--; ) {
          const candidate = (i + this.currentLevelIndex) % levels.length;
          if (
            candidate !== this.currentLevelIndex &&
            levels[candidate].loadError === 0
          ) {
            nextLevel = candidate;
            break;
          }
        }
        if (nextLevel > -1 && this.currentLevelIndex !== nextLevel) {
          this.warn(`${errorDetails}: switch to ${nextLevel}`);
          errorEvent.levelRetry = true;
          this.hls.nextAutoLevel = nextLevel;
        } else if (errorEvent.levelRetry === false) {
          // No levels to switch to and no more retries
          errorEvent.fatal = true;
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
      this.log(
        `Switching to Redundant Stream ${newUrlId + 1}/${redundantLevels}: "${
          level.url[newUrlId]
        }"`
      );
      this._levels.forEach((lv) => {
        lv.urlId = newUrlId;
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
    const currentLevel = this.currentLevel;
    if (!currentLevel) {
      return;
    }

    const audioGroupId = this.hls.audioTracks[data.id].groupId;
    if (
      currentLevel.audioGroupIds &&
      currentLevel.audioGroupIds[currentLevel.urlId] !== audioGroupId
    ) {
      let urlId = -1;
      for (let i = 0; i < currentLevel.audioGroupIds.length; i++) {
        if (currentLevel.audioGroupIds[i] === audioGroupId) {
          urlId = i;
          break;
        }
      }

      if (urlId !== -1 && urlId !== currentLevel.urlId) {
        currentLevel.urlId = urlId;
        if (this.canLoad) {
          this.startLoad();
        }
      }
    }
  }

  protected loadPlaylist(hlsUrlParameters?: HlsUrlParameters) {
    super.loadPlaylist();
    const currentLevelIndex = this.currentLevelIndex;
    const currentLevel = this.currentLevel;

    if (this.canLoad && currentLevel && currentLevel.url.length > 0) {
      const id = currentLevel.urlId;
      let url = currentLevel.uri;
      if (hlsUrlParameters) {
        try {
          url = hlsUrlParameters.addDirectives(url);
        } catch (error) {
          this.warn(
            `Could not construct new URL with HLS Delivery Directives: ${error}`
          );
        }
      }

      const pathwayId = currentLevel.attrs['PATHWAY-ID'];
      this.log(
        `Loading level index ${currentLevelIndex}${
          hlsUrlParameters?.msn !== undefined
            ? ' at sn ' +
              hlsUrlParameters.msn +
              ' part ' +
              hlsUrlParameters.part
            : ''
        } with${pathwayId ? ' Pathway ' + pathwayId : ''} URI ${id + 1}/${
          currentLevel.url.length
        } ${url}`
      );

      // console.log('Current audio track group ID:', this.hls.audioTracks[this.hls.audioTrack].groupId);
      // console.log('New video quality level audio group id:', levelObject.attrs.AUDIO, level);
      this.clearTimer();
      this.hls.trigger(Events.LEVEL_LOADING, {
        url,
        level: currentLevelIndex,
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
    const levels = this._levels.filter((level, index) => {
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
      if (this.steering) {
        this.steering.removeLevel(level);
      }
      return false;
    });

    this.hls.trigger(Events.LEVELS_UPDATED, { levels });
  }

  private onLevelsUpdated(
    event: Events.LEVELS_UPDATED,
    { levels }: LevelsUpdatedData
  ) {
    levels.forEach((level, index) => {
      const { details } = level;
      if (details?.fragments) {
        details.fragments.forEach((fragment) => {
          fragment.level = index;
        });
      }
    });
    this._levels = levels;
  }
}

export function addGroupId(
  level: Level,
  type: string,
  id: string | undefined
): void {
  if (!id) {
    return;
  }
  if (type === 'audio') {
    if (!level.audioGroupIds) {
      level.audioGroupIds = [];
    }
    level.audioGroupIds[level.url.length - 1] = id;
  } else if (type === 'text') {
    if (!level.textGroupIds) {
      level.textGroupIds = [];
    }
    level.textGroupIds[level.url.length - 1] = id;
  }
}

function assignTrackIdsByGroup(tracks: MediaPlaylist[]): void {
  const groups = {};
  tracks.forEach((track) => {
    const groupId = track.groupId || '';
    track.id = groups[groupId] = groups[groupId] || 0;
    groups[groupId]++;
  });
}
