import * as URLToolkit from 'url-toolkit';
import PlaylistLoader from './loader/playlist-loader';
import KeyLoader from './loader/key-loader';
import ID3TrackController from './controller/id3-track-controller';
import LatencyController from './controller/latency-controller';
import LevelController from './controller/level-controller';
import { FragmentTracker } from './controller/fragment-tracker';
import StreamController from './controller/stream-controller';
import { isSupported } from './is-supported';
import { logger, enableLogs } from './utils/logger';
import { enableStreamingMode, hlsDefaultConfig, mergeConfig } from './config';
import { EventEmitter } from 'eventemitter3';
import { Events } from './events';
import { ErrorTypes, ErrorDetails } from './errors';
import type { HlsEventEmitter, HlsListeners } from './events';
import type AudioTrackController from './controller/audio-track-controller';
import type AbrController from './controller/abr-controller';
import type BufferController from './controller/buffer-controller';
import type CapLevelController from './controller/cap-level-controller';
import type CMCDController from './controller/cmcd-controller';
import type EMEController from './controller/eme-controller';
import type SubtitleTrackController from './controller/subtitle-track-controller';
import type { ComponentAPI, NetworkComponentAPI } from './types/component-api';
import type { MediaPlaylist } from './types/media-playlist';
import type { HlsConfig } from './config';
import type { Level } from './types/level';
import type { Fragment } from './loader/fragment';

/**
 * @module Hls
 * @class
 * @constructor
 */
export default class Hls implements HlsEventEmitter {
  private static defaultConfig?: HlsConfig;

  public readonly config: HlsConfig;
  public readonly userConfig: Partial<HlsConfig>;

  private coreComponents: ComponentAPI[];
  private networkControllers: NetworkComponentAPI[];

  private _emitter: HlsEventEmitter = new EventEmitter();
  private _autoLevelCapping: number;
  private abrController: AbrController;
  private bufferController: BufferController;
  private capLevelController: CapLevelController;
  private latencyController: LatencyController;
  private levelController: LevelController;
  private streamController: StreamController;
  private audioTrackController: AudioTrackController;
  private subtitleTrackController: SubtitleTrackController;
  private emeController: EMEController;
  private cmcdController: CMCDController;

  private _media: HTMLMediaElement | null = null;
  private url: string | null = null;

  static get version(): string {
    return __VERSION__;
  }

  static isSupported(): boolean {
    return isSupported();
  }

  static get Events() {
    return Events;
  }

  static get ErrorTypes() {
    return ErrorTypes;
  }

  static get ErrorDetails() {
    return ErrorDetails;
  }

  static get DefaultConfig(): HlsConfig {
    if (!Hls.defaultConfig) {
      return hlsDefaultConfig;
    }

    return Hls.defaultConfig;
  }

  /**
   * @type {HlsConfig}
   */
  static set DefaultConfig(defaultConfig: HlsConfig) {
    Hls.defaultConfig = defaultConfig;
  }

  /**
   * Creates an instance of an HLS client that can attach to exactly one `HTMLMediaElement`.
   *
   * @constructs Hls
   * @param {HlsConfig} config
   */
  constructor(userConfig: Partial<HlsConfig> = {}) {
    const config = (this.config = mergeConfig(Hls.DefaultConfig, userConfig));
    this.userConfig = userConfig;
    enableLogs(config.debug);

    this._autoLevelCapping = -1;

    if (config.progressive) {
      enableStreamingMode(config);
    }

    // core controllers and network loaders
    const {
      abrController: ConfigAbrController,
      bufferController: ConfigBufferController,
      capLevelController: ConfigCapLevelController,
      fpsController: ConfigFpsController,
    } = config;
    const abrController = (this.abrController = new ConfigAbrController(this));
    const bufferController = (this.bufferController =
      new ConfigBufferController(this));
    const capLevelController = (this.capLevelController =
      new ConfigCapLevelController(this));

    const fpsController = new ConfigFpsController(this);
    const playListLoader = new PlaylistLoader(this);
    const keyLoader = new KeyLoader(this);
    const id3TrackController = new ID3TrackController(this);

    // network controllers
    const levelController = (this.levelController = new LevelController(this));
    // FragmentTracker must be defined before StreamController because the order of event handling is important
    const fragmentTracker = new FragmentTracker(this);
    const streamController = (this.streamController = new StreamController(
      this,
      fragmentTracker
    ));

    // Cap level controller uses streamController to flush the buffer
    capLevelController.setStreamController(streamController);
    // fpsController uses streamController to switch when frames are being dropped
    fpsController.setStreamController(streamController);

    const networkControllers = [levelController, streamController];

    this.networkControllers = networkControllers;
    const coreComponents = [
      playListLoader,
      keyLoader,
      abrController,
      bufferController,
      capLevelController,
      fpsController,
      id3TrackController,
      fragmentTracker,
    ];

    this.audioTrackController = this.createController(
      config.audioTrackController,
      null,
      networkControllers
    );
    this.createController(
      config.audioStreamController,
      fragmentTracker,
      networkControllers
    );
    // subtitleTrackController must be defined before  because the order of event handling is important
    this.subtitleTrackController = this.createController(
      config.subtitleTrackController,
      null,
      networkControllers
    );
    this.createController(
      config.subtitleStreamController,
      fragmentTracker,
      networkControllers
    );
    this.createController(config.timelineController, null, coreComponents);
    this.emeController = this.createController(
      config.emeController,
      null,
      coreComponents
    );
    this.cmcdController = this.createController(
      config.cmcdController,
      null,
      coreComponents
    );
    this.latencyController = this.createController(
      LatencyController,
      null,
      coreComponents
    );

    this.coreComponents = coreComponents;
  }

  createController(ControllerClass, fragmentTracker, components) {
    if (ControllerClass) {
      const controllerInstance = fragmentTracker
        ? new ControllerClass(this, fragmentTracker)
        : new ControllerClass(this);
      if (components) {
        components.push(controllerInstance);
      }
      return controllerInstance;
    }
    return null;
  }

  // Delegate the EventEmitter through the public API of Hls.js
  on<E extends keyof HlsListeners, Context = undefined>(
    event: E,
    listener: HlsListeners[E],
    context: Context = this as any
  ) {
    this._emitter.on(event, listener, context);
  }

  once<E extends keyof HlsListeners, Context = undefined>(
    event: E,
    listener: HlsListeners[E],
    context: Context = this as any
  ) {
    this._emitter.once(event, listener, context);
  }

  removeAllListeners<E extends keyof HlsListeners>(event?: E | undefined) {
    this._emitter.removeAllListeners(event);
  }

  off<E extends keyof HlsListeners, Context = undefined>(
    event: E,
    listener?: HlsListeners[E] | undefined,
    context: Context = this as any,
    once?: boolean | undefined
  ) {
    this._emitter.off(event, listener, context, once);
  }

  listeners<E extends keyof HlsListeners>(event: E): HlsListeners[E][] {
    return this._emitter.listeners(event);
  }

  emit<E extends keyof HlsListeners>(
    event: E,
    name: E,
    eventObject: Parameters<HlsListeners[E]>[1]
  ): boolean {
    return this._emitter.emit(event, name, eventObject);
  }

  trigger<E extends keyof HlsListeners>(
    event: E,
    eventObject: Parameters<HlsListeners[E]>[1]
  ): boolean {
    if (this.config.debug) {
      return this.emit(event, event, eventObject);
    } else {
      try {
        return this.emit(event, event, eventObject);
      } catch (e) {
        logger.error(
          'An internal error happened while handling event ' +
            event +
            '. Error message: "' +
            e.message +
            '". Here is a stacktrace:',
          e
        );
        this.trigger(Events.ERROR, {
          type: ErrorTypes.OTHER_ERROR,
          details: ErrorDetails.INTERNAL_EXCEPTION,
          fatal: false,
          event: event,
          error: e,
        });
      }
    }
    return false;
  }

  listenerCount<E extends keyof HlsListeners>(event: E): number {
    return this._emitter.listenerCount(event);
  }

  /**
   * Dispose of the instance
   */
  destroy() {
    logger.log('destroy');
    this.trigger(Events.DESTROYING, undefined);
    this.detachMedia();
    this.removeAllListeners();
    this._autoLevelCapping = -1;
    this.url = null;

    this.networkControllers.forEach((component) => component.destroy());
    this.networkControllers.length = 0;

    this.coreComponents.forEach((component) => component.destroy());
    this.coreComponents.length = 0;
  }

  /**
   * Attaches Hls.js to a media element
   * @param {HTMLMediaElement} media
   */
  attachMedia(media: HTMLMediaElement) {
    logger.log('attachMedia');
    this._media = media;
    this.trigger(Events.MEDIA_ATTACHING, { media: media });
  }

  /**
   * Detach Hls.js from the media
   */
  detachMedia() {
    logger.log('detachMedia');
    this.trigger(Events.MEDIA_DETACHING, undefined);
    this._media = null;
  }

  /**
   * Set the source URL. Can be relative or absolute.
   * @param {string} url
   */
  loadSource(url: string) {
    this.stopLoad();
    const media = this.media;
    const loadedSource = this.url;
    const loadingSource = (this.url = URLToolkit.buildAbsoluteURL(
      self.location.href,
      url,
      {
        alwaysNormalize: true,
      }
    ));
    logger.log(`loadSource:${loadingSource}`);
    if (
      media &&
      loadedSource &&
      loadedSource !== loadingSource &&
      this.bufferController.hasSourceTypes()
    ) {
      this.detachMedia();
      this.attachMedia(media);
    }
    // when attaching to a source URL, trigger a playlist load
    this.trigger(Events.MANIFEST_LOADING, { url: url });
  }

  /**
   * Start loading data from the stream source.
   * Depending on default config, client starts loading automatically when a source is set.
   *
   * @param {number} startPosition Set the start position to stream from
   * @default -1 None (from earliest point)
   */
  startLoad(startPosition: number = -1) {
    logger.log(`startLoad(${startPosition})`);
    this.networkControllers.forEach((controller) => {
      controller.startLoad(startPosition);
    });
  }

  /**
   * Stop loading of any stream data.
   */
  stopLoad() {
    logger.log('stopLoad');
    this.networkControllers.forEach((controller) => {
      controller.stopLoad();
    });
  }

  /**
   * Swap through possible audio codecs in the stream (for example to switch from stereo to 5.1)
   */
  swapAudioCodec() {
    logger.log('swapAudioCodec');
    this.streamController.swapAudioCodec();
  }

  /**
   * When the media-element fails, this allows to detach and then re-attach it
   * as one call (convenience method).
   *
   * Automatic recovery of media-errors by this process is configurable.
   */
  recoverMediaError() {
    logger.log('recoverMediaError');
    const media = this._media;
    this.detachMedia();
    if (media) {
      this.attachMedia(media);
    }
  }

  removeLevel(levelIndex, urlId = 0) {
    this.levelController.removeLevel(levelIndex, urlId);
  }

  /**
   * @type {Level[]}
   */
  get levels(): Array<Level> {
    const levels = this.levelController.levels;
    return levels ? levels : [];
  }

  /**
   * Index of quality level currently played
   * @type {number}
   */
  get currentLevel(): number {
    return this.streamController.currentLevel;
  }

  /**
   * Set quality level index immediately .
   * This will flush the current buffer to replace the quality asap.
   * That means playback will interrupt at least shortly to re-buffer and re-sync eventually.
   * @type {number} -1 for automatic level selection
   */
  set currentLevel(newLevel: number) {
    logger.log(`set currentLevel:${newLevel}`);
    this.loadLevel = newLevel;
    this.abrController.clearTimer();
    this.streamController.immediateLevelSwitch();
  }

  /**
   * Index of next quality level loaded as scheduled by stream controller.
   * @type {number}
   */
  get nextLevel(): number {
    return this.streamController.nextLevel;
  }

  /**
   * Set quality level index for next loaded data.
   * This will switch the video quality asap, without interrupting playback.
   * May abort current loading of data, and flush parts of buffer (outside currently played fragment region).
   * @type {number} -1 for automatic level selection
   */
  set nextLevel(newLevel: number) {
    logger.log(`set nextLevel:${newLevel}`);
    this.levelController.manualLevel = newLevel;
    this.streamController.nextLevelSwitch();
  }

  /**
   * Return the quality level of the currently or last (of none is loaded currently) segment
   * @type {number}
   */
  get loadLevel(): number {
    return this.levelController.level;
  }

  /**
   * Set quality level index for next loaded data in a conservative way.
   * This will switch the quality without flushing, but interrupt current loading.
   * Thus the moment when the quality switch will appear in effect will only be after the already existing buffer.
   * @type {number} newLevel -1 for automatic level selection
   */
  set loadLevel(newLevel: number) {
    logger.log(`set loadLevel:${newLevel}`);
    this.levelController.manualLevel = newLevel;
  }

  /**
   * get next quality level loaded
   * @type {number}
   */
  get nextLoadLevel(): number {
    return this.levelController.nextLoadLevel;
  }

  /**
   * Set quality level of next loaded segment in a fully "non-destructive" way.
   * Same as `loadLevel` but will wait for next switch (until current loading is done).
   * @type {number} level
   */
  set nextLoadLevel(level: number) {
    this.levelController.nextLoadLevel = level;
  }

  /**
   * Return "first level": like a default level, if not set,
   * falls back to index of first level referenced in manifest
   * @type {number}
   */
  get firstLevel(): number {
    return Math.max(this.levelController.firstLevel, this.minAutoLevel);
  }

  /**
   * Sets "first-level", see getter.
   * @type {number}
   */
  set firstLevel(newLevel: number) {
    logger.log(`set firstLevel:${newLevel}`);
    this.levelController.firstLevel = newLevel;
  }

  /**
   * Return start level (level of first fragment that will be played back)
   * if not overrided by user, first level appearing in manifest will be used as start level
   * if -1 : automatic start level selection, playback will start from level matching download bandwidth
   * (determined from download of first segment)
   * @type {number}
   */
  get startLevel(): number {
    return this.levelController.startLevel;
  }

  /**
   * set  start level (level of first fragment that will be played back)
   * if not overrided by user, first level appearing in manifest will be used as start level
   * if -1 : automatic start level selection, playback will start from level matching download bandwidth
   * (determined from download of first segment)
   * @type {number} newLevel
   */
  set startLevel(newLevel: number) {
    logger.log(`set startLevel:${newLevel}`);
    // if not in automatic start level detection, ensure startLevel is greater than minAutoLevel
    if (newLevel !== -1) {
      newLevel = Math.max(newLevel, this.minAutoLevel);
    }

    this.levelController.startLevel = newLevel;
  }

  /**
   * Get the current setting for capLevelToPlayerSize
   *
   * @type {boolean}
   */
  get capLevelToPlayerSize(): boolean {
    return this.config.capLevelToPlayerSize;
  }

  /**
   * set  dynamically set capLevelToPlayerSize against (`CapLevelController`)
   *
   * @type {boolean}
   */
  set capLevelToPlayerSize(shouldStartCapping: boolean) {
    const newCapLevelToPlayerSize = !!shouldStartCapping;

    if (newCapLevelToPlayerSize !== this.config.capLevelToPlayerSize) {
      if (newCapLevelToPlayerSize) {
        this.capLevelController.startCapping(); // If capping occurs, nextLevelSwitch will happen based on size.
      } else {
        this.capLevelController.stopCapping();
        this.autoLevelCapping = -1;
        this.streamController.nextLevelSwitch(); // Now we're uncapped, get the next level asap.
      }

      this.config.capLevelToPlayerSize = newCapLevelToPlayerSize;
    }
  }

  /**
   * Capping/max level value that should be used by automatic level selection algorithm (`ABRController`)
   * @type {number}
   */
  get autoLevelCapping(): number {
    return this._autoLevelCapping;
  }

  /**
   * get bandwidth estimate
   * @type {number}
   */
  get bandwidthEstimate(): number {
    const { bwEstimator } = this.abrController;
    if (!bwEstimator) {
      return NaN;
    }
    return bwEstimator.getEstimate();
  }

  /**
   * Capping/max level value that should be used by automatic level selection algorithm (`ABRController`)
   * @type {number}
   */
  set autoLevelCapping(newLevel: number) {
    if (this._autoLevelCapping !== newLevel) {
      logger.log(`set autoLevelCapping:${newLevel}`);
      this._autoLevelCapping = newLevel;
    }
  }

  /**
   * True when automatic level selection enabled
   * @type {boolean}
   */
  get autoLevelEnabled(): boolean {
    return this.levelController.manualLevel === -1;
  }

  /**
   * Level set manually (if any)
   * @type {number}
   */
  get manualLevel(): number {
    return this.levelController.manualLevel;
  }

  /**
   * min level selectable in auto mode according to config.minAutoBitrate
   * @type {number}
   */
  get minAutoLevel(): number {
    const {
      levels,
      config: { minAutoBitrate },
    } = this;
    if (!levels) return 0;

    const len = levels.length;
    for (let i = 0; i < len; i++) {
      if (levels[i].maxBitrate >= minAutoBitrate) {
        return i;
      }
    }

    return 0;
  }

  /**
   * max level selectable in auto mode according to autoLevelCapping
   * @type {number}
   */
  get maxAutoLevel(): number {
    const { levels, autoLevelCapping } = this;

    let maxAutoLevel;
    if (autoLevelCapping === -1 && levels && levels.length) {
      maxAutoLevel = levels.length - 1;
    } else {
      maxAutoLevel = autoLevelCapping;
    }

    return maxAutoLevel;
  }

  /**
   * next automatically selected quality level
   * @type {number}
   */
  get nextAutoLevel(): number {
    // ensure next auto level is between  min and max auto level
    return Math.min(
      Math.max(this.abrController.nextAutoLevel, this.minAutoLevel),
      this.maxAutoLevel
    );
  }

  /**
   * this setter is used to force next auto level.
   * this is useful to force a switch down in auto mode:
   * in case of load error on level N, hls.js can set nextAutoLevel to N-1 for example)
   * forced value is valid for one fragment. upon successful frag loading at forced level,
   * this value will be resetted to -1 by ABR controller.
   * @type {number}
   */
  set nextAutoLevel(nextLevel: number) {
    this.abrController.nextAutoLevel = Math.max(this.minAutoLevel, nextLevel);
  }

  /**
   * @type {AudioTrack[]}
   */
  get audioTracks(): Array<MediaPlaylist> {
    const audioTrackController = this.audioTrackController;
    return audioTrackController ? audioTrackController.audioTracks : [];
  }

  /**
   * index of the selected audio track (index in audio track lists)
   * @type {number}
   */
  get audioTrack(): number {
    const audioTrackController = this.audioTrackController;
    return audioTrackController ? audioTrackController.audioTrack : -1;
  }

  /**
   * selects an audio track, based on its index in audio track lists
   * @type {number}
   */
  set audioTrack(audioTrackId: number) {
    const audioTrackController = this.audioTrackController;
    if (audioTrackController) {
      audioTrackController.audioTrack = audioTrackId;
    }
  }

  /**
   * get alternate subtitle tracks list from playlist
   * @type {MediaPlaylist[]}
   */
  get subtitleTracks(): Array<MediaPlaylist> {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController
      ? subtitleTrackController.subtitleTracks
      : [];
  }

  /**
   * index of the selected subtitle track (index in subtitle track lists)
   * @type {number}
   */
  get subtitleTrack(): number {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController ? subtitleTrackController.subtitleTrack : -1;
  }

  get media() {
    return this._media;
  }

  /**
   * select an subtitle track, based on its index in subtitle track lists
   * @type {number}
   */
  set subtitleTrack(subtitleTrackId: number) {
    const subtitleTrackController = this.subtitleTrackController;
    if (subtitleTrackController) {
      subtitleTrackController.subtitleTrack = subtitleTrackId;
    }
  }

  /**
   * @type {boolean}
   */
  get subtitleDisplay(): boolean {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController
      ? subtitleTrackController.subtitleDisplay
      : false;
  }

  /**
   * Enable/disable subtitle display rendering
   * @type {boolean}
   */
  set subtitleDisplay(value: boolean) {
    const subtitleTrackController = this.subtitleTrackController;
    if (subtitleTrackController) {
      subtitleTrackController.subtitleDisplay = value;
    }
  }

  /**
   * get mode for Low-Latency HLS loading
   * @type {boolean}
   */
  get lowLatencyMode() {
    return this.config.lowLatencyMode;
  }

  /**
   * Enable/disable Low-Latency HLS part playlist and segment loading, and start live streams at playlist PART-HOLD-BACK rather than HOLD-BACK.
   * @type {boolean}
   */
  set lowLatencyMode(mode: boolean) {
    this.config.lowLatencyMode = mode;
  }

  /**
   * position (in seconds) of live sync point (ie edge of live position minus safety delay defined by ```hls.config.liveSyncDuration```)
   * @type {number}
   */
  get liveSyncPosition(): number | null {
    return this.latencyController.liveSyncPosition;
  }

  /**
   * estimated position (in seconds) of live edge (ie edge of live playlist plus time sync playlist advanced)
   * returns 0 before first playlist is loaded
   * @type {number}
   */
  get latency() {
    return this.latencyController.latency;
  }

  /**
   * maximum distance from the edge before the player seeks forward to ```hls.liveSyncPosition```
   * configured using ```liveMaxLatencyDurationCount``` (multiple of target duration) or ```liveMaxLatencyDuration```
   * returns 0 before first playlist is loaded
   * @type {number}
   */
  get maxLatency(): number {
    return this.latencyController.maxLatency;
  }

  /**
   * target distance from the edge as calculated by the latency controller
   * @type {number}
   */
  get targetLatency(): number | null {
    return this.latencyController.targetLatency;
  }

  /**
   * the rate at which the edge of the current live playlist is advancing or 1 if there is none
   * @type {number}
   */
  get drift(): number | null {
    return this.latencyController.drift;
  }

  /**
   * set to true when startLoad is called before MANIFEST_PARSED event
   * @type {boolean}
   */
  get forceStartLoad(): boolean {
    return this.streamController.forceStartLoad;
  }
}

export type {
  MediaPlaylist,
  ErrorDetails,
  ErrorTypes,
  Events,
  Level,
  HlsListeners,
  HlsEventEmitter,
  HlsConfig,
  Fragment,
};

export type {
  ABRControllerConfig,
  BufferControllerConfig,
  CapLevelControllerConfig,
  CMCDControllerConfig,
  EMEControllerConfig,
  DRMSystemOptions,
  FPSControllerConfig,
  FragmentLoaderConfig,
  FragmentLoaderConstructor,
  LevelControllerConfig,
  MP4RemuxerConfig,
  PlaylistLoaderConfig,
  PlaylistLoaderConstructor,
  StreamControllerConfig,
  LatencyControllerConfig,
  TimelineControllerConfig,
  TSDemuxerConfig,
} from './config';
export type { CuesInterface } from './utils/cues';
export type { MediaKeyFunc, KeySystems } from './utils/mediakeys-helper';
export type { LoadStats } from './loader/load-stats';
export type { LevelKey } from './loader/level-key';
export type { LevelDetails } from './loader/level-details';
export type { SourceBufferName } from './types/buffer';
export type { MetadataSample, UserdataSample } from './types/demuxer';
export type {
  LevelParsed,
  LevelAttributes,
  HlsUrlParameters,
  HlsSkip,
} from './types/level';
export type {
  PlaylistLevelType,
  HlsChunkPerformanceTiming,
  HlsPerformanceTiming,
  PlaylistContextType,
  PlaylistLoaderContext,
  FragmentLoaderContext,
  Loader,
  LoaderStats,
  LoaderContext,
  LoaderResponse,
  LoaderConfiguration,
  LoaderCallbacks,
  LoaderOnProgress,
  LoaderOnAbort,
  LoaderOnError,
  LoaderOnSuccess,
  LoaderOnTimeout,
  HlsProgressivePerformanceTiming,
} from './types/loader';
export type {
  MediaPlaylistType,
  MainPlaylistType,
  AudioPlaylistType,
  SubtitlePlaylistType,
} from './types/media-playlist';
export type { Track, TrackSet } from './types/track';
export type { ChunkMetadata } from './types/transmuxer';
export type {
  BaseSegment,
  Part,
  ElementaryStreams,
  ElementaryStreamTypes,
  ElementaryStreamInfo,
} from './loader/fragment';
export type {
  TrackLoadingData,
  TrackLoadedData,
  AudioTrackLoadedData,
  AudioTracksUpdatedData,
  AudioTrackSwitchedData,
  AudioTrackSwitchingData,
  BackBufferData,
  BufferAppendedData,
  BufferAppendingData,
  BufferCodecsData,
  BufferCreatedData,
  BufferEOSData,
  BufferFlushedData,
  BufferFlushingData,
  CuesParsedData,
  ErrorData,
  FPSDropData,
  FPSDropLevelCappingData,
  FragBufferedData,
  FragChangedData,
  FragDecryptedData,
  FragLoadedData,
  FragLoadEmergencyAbortedData,
  FragLoadingData,
  FragParsedData,
  FragParsingInitSegmentData,
  FragParsingMetadataData,
  FragParsingUserdataData,
  InitPTSFoundData,
  KeyLoadedData,
  KeyLoadingData,
  LevelLoadedData,
  LevelLoadingData,
  LevelPTSUpdatedData,
  LevelsUpdatedData,
  LevelSwitchedData,
  LevelSwitchingData,
  LevelUpdatedData,
  LiveBackBufferData,
  ManifestLoadedData,
  ManifestLoadingData,
  ManifestParsedData,
  MediaAttachedData,
  MediaAttachingData,
  NonNativeTextTrack,
  NonNativeTextTracksData,
  SubtitleFragProcessedData,
  SubtitleTrackLoadedData,
  SubtitleTracksUpdatedData,
  SubtitleTrackSwitchData,
} from './types/events';
export type { AttrList } from './utils/attr-list';
