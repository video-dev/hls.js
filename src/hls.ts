/**
 * @module Hls
 * @class
 * @constructor
 */

import * as URLToolkit from 'url-toolkit';

import {
  ErrorTypes,
  ErrorDetails
} from './errors';

import { isSupported } from './is-supported';
import { logger, enableLogs } from './utils/logger';
import { hlsDefaultConfig } from './config';

import { Events } from './events';
import { Observer } from './observer';

import EventHandler from './event-handler';

import AttrList from './utils/attr-list';
import Fragment from './loader/fragment';

// Core components
import PlaylistLoader from './loader/playlist-loader';
import FragmentLoader from './loader/fragment-loader';
import KeyLoader from './loader/key-loader';
import { FragmentTracker } from './controller/fragment-tracker';
import StreamController from './controller/stream-controller';
import LevelController from './controller/level-controller';
import ID3TrackController from './controller/id3-track-controller';
import AbrController from './controller/abr-controller';
import BufferController from './controller/buffer-controller';
import CapLevelController from './controller/cap-level-controller';
import FPSController from './controller/fps-controller';

// Optional components
import AudioTrackController from './controller/audio-track-controller';
import SubtitleTrackController from './controller/subtitle-track-controller';
import EMEController from './controller/eme-controller';
import AudioStreamController from './controller/audio-stream-controller';
import SubtitleStreamController from './controller/subtitle-stream-controller';
import TimelineController from './controller/timeline-controller';

declare var __VERSION__: string;

const _logger: any = logger;

const _hlsDefaultConfig: any = hlsDefaultConfig;

export type Injectable = any;

export type HlsConfig = {
  autoStartLoad: boolean, // used by stream-controller
  startPosition: number, // used by stream-controller
  defaultAudioCodec: string, // used by stream-controller
  debug: boolean, // used by logger
  capLevelOnFPSDrop: boolean, // used by fps-controller
  capLevelToPlayerSize: boolean, // used by cap-level-controller
  initialLiveManifestSize: number, // used by stream-controller
  maxBufferLength: number, // used by stream-controller
  maxBufferSize: number, // used by stream-controller
  maxBufferHole: number, // used by stream-controller

  lowBufferWatchdogPeriod: number, // used by stream-controller
  highBufferWatchdogPeriod: number, // used by stream-controller
  nudgeOffset: number, // used by stream-controller
  nudgeMaxRetry: number, // used by stream-controller
  maxFragLookUpTolerance: number, // used by stream-controller
  liveSyncDurationCount: number, // used by stream-controller
  liveMaxLatencyDurationCount: number, // used by stream-controller
  liveSyncDuration: number, // used by stream-controller
  liveMaxLatencyDuration: number, // used by stream-controller
  liveDurationInfinity: boolean, // used by buffer-controller
  maxMaxBufferLength: number, // used by stream-controller
  enableWorker: boolean, // used by demuxer
  enableSoftwareAES: boolean, // used by decrypter
  manifestLoadingTimeOut: number, // used by playlist-loader
  manifestLoadingMaxRetry: number, // used by playlist-loader
  manifestLoadingRetryDelay: number, // used by playlist-loader
  manifestLoadingMaxRetryTimeout: number, // used by playlist-loader
  startLevel: number, // used by level-controller
  levelLoadingTimeOut: number, // used by playlist-loader
  levelLoadingMaxRetry: number, // used by playlist-loader
  levelLoadingRetryDelay: number, // used by playlist-loader
  levelLoadingMaxRetryTimeout: number, // used by playlist-loader
  fragLoadingTimeOut: number, // used by fragment-loader
  fragLoadingMaxRetry: number, // used by fragment-loader
  fragLoadingRetryDelay: number, // used by fragment-loader
  fragLoadingMaxRetryTimeout: number, // used by fragment-loader
  startFragPrefetch: boolean, // used by stream-controller
  fpsDroppedMonitoringPeriod: number, // used by fps-controller
  fpsDroppedMonitoringThreshold: number, // used by fps-controller
  appendErrorMaxRetry: number, // used by buffer-controller

  loader: Injectable // IXhrLoader,
  // loader: FetchLoader,
  fLoader: Injectable // IFragmentLoader, // used by fragment-loader
  pLoader: Injectable // IPlaylistLoader, // used by playlist-loader

  xhrSetup: (xhr: XMLHttpRequest) => void, // used by xhr-loader
  licenseXhrSetup: (xhr: XMLHttpRequest) => void, // used by eme-controller

  abrController: Injectable // IAbrController,
  bufferController: Injectable // IBufferController,
  capLevelController: Injectable // ICapLevelController,
  fpsController: Injectable // IFPSController,

  stretchShortVideoTrack: boolean, // used by mp4-remuxer
  maxAudioFramesDrift: number, // used by mp4-remuxer
  forceKeyFrameOnDiscontinuity: boolean, // used by ts-demuxer
  abrEwmaFastLive: number, // used by abr-controller
  abrEwmaSlowLive: number, // used by abr-controller
  abrEwmaFastVoD: number, // used by abr-controller
  abrEwmaSlowVoD: number, // used by abr-controller
  abrEwmaDefaultEstimate: number, // used by abr-controller
  abrBandWidthFactor: number, // used by abr-controller
  abrBandWidthUpFactor: number, // used by abr-controller
  abrMaxWithRealBitrate: boolean, // used by abr-controller
  maxStarvationDelay: number, // used by abr-controller
  maxLoadingDelay: number, // used by abr-controller
  minAutoBitrate: number, // used by hls
  emeEnabled: boolean, // used by eme-controller
  widevineLicenseUrl: string, // used by eme-controller
  requestMediaKeySystemAccessFunc: (keySystem: string, config: MediaKeySystemConfiguration) => Promise<MediaKeySystemAccess> // used by eme-controller

  subtitleStreamController: Injectable // ISubtitleStreamController,
  subtitleTrackController: Injectable // ISubtitleTrackController,
  timelineController: Injectable // ITimelineControllerm,
  cueHandler: Injectable // ICueHandler, // used by timeline-controller

  nableCEA708Captions: true, // used by timeline-controller
  enableWebVTT: true, // used by timeline-controller
  captionsTextTrack1Label: string, // used by timeline-controller
  captionsTextTrack1LanguageCode: string, // used by timeline-controller
  captionsTextTrack2Label: string; // used by timeline-controller
  captionsTextTrack2LanguageCode: string // used by timeline-controller
};

export enum AlternateMediaType {
  AUDIO = 'AUDIO',
  SUBTITLES = 'SUBTITLES'
}

export type MediaVariantDetails = {
  PTSKnown: boolean,
  fragments: Fragment[],
  url: string,
  readonly hasProgramDateTime: boolean,
  live: boolean,
  averagetargetduration: number,
  targetduration: number,
  totalduration: number,
  startCC: number,
  endCC: number,
  startSN: number,
  endSN: number,
  startTimeOffset: number | null,
  tload: number | null,
  type: string | null,
  version: number | null,
  initSegment: Fragment | null
  needSidxRanges: boolean,
};

export type QualityLevel = {
  attrs: AttrList,
  audioCodec: string,
  videoCodec: string,
  unknownCodecs: string[],
  bitrate: number,
  realBitrate?: number,
  fragmentError: boolean,
  height: number,
  width: number,
  name: string,
  url: string[] | string,
  urlId: number,
  audioGroupdIds: string[],
  textGroupdIds: string[],
  details: MediaVariantDetails
};

export type AlternateMediaTrack = {
  id: number,
  groupId: string,
  autoselect: boolean,
  default: boolean,
  forced: boolean,
  lang: string,
  name: string,
  type: AlternateMediaType
  url: string,
  details?: MediaVariantDetails
  audioCodec?: string,
  subtitleCodec?: string
};

export type AudioTrack = AlternateMediaTrack & {

};

export type SubtitleTrack = AlternateMediaTrack & {

};

export default class Hls extends Observer {
  static defaultConfig: HlsConfig;

  /**
   * @type {string}
   */
  static get version (): string {
    return __VERSION__;
  }

  /**
   * @type {boolean}
   */
  static isSupported (): boolean {
    return isSupported();
  }

  /**
   * @type {Events}
   */
  static get Events () {
    return Events;
  }

  /**
   * @type {HlsErrorTypes}
   */
  static get ErrorTypes () {
    return ErrorTypes;
  }

  /**
   * @type {HlsErrorDetails}
   */
  static get ErrorDetails () {
    return ErrorDetails;
  }

  /**
   * @type {HlsConfig}
   */
  static get DefaultConfig (): HlsConfig {
    if (!Hls.defaultConfig) {
      return _hlsDefaultConfig;
    }

    return Hls.defaultConfig;
  }

  /**
   * @type {HlsConfig}
   */
  static set DefaultConfig (defaultConfig: HlsConfig) {
    Hls.defaultConfig = defaultConfig;
  }

  public config: HlsConfig;

  // Fixme: should be in cap-controller
  private _autoLevelCapping: number;

  private abrController: AbrController;
  private bufferController: BufferController;
  private capLevelController: CapLevelController;
  private fpsController: FPSController;
  private playListLoader: PlaylistLoader;
  private fragmentLoader: FragmentLoader;
  private keyLoader: KeyLoader
  private id3TrackController: ID3TrackController;
  private levelController: LevelController;
  private streamController: StreamController;
  private audioTrackController: AudioTrackController;
  private subtitleTrackController: SubtitleTrackController;
  private emeController: EMEController;
  private audioStreamController: AudioStreamController;
  private subtitleStreamController: SubtitleStreamController;
  private timelineController: TimelineController;

  private coreComponents: EventHandler[] = [];

  private url: string;
  private media: HTMLMediaElement;

  /**
   * Creates an instance of an HLS client that can attach to exactly one `HTMLMediaElement`.
   *
   * @constructs Hls
   * @param {HlsConfig} config
   */
  constructor (config: any = {}) {
    super();

    enableLogs(config.debug);

    this.config = config;

    const defaultConfig = Hls.DefaultConfig;

    if ((config.liveSyncDurationCount || config.liveMaxLatencyDurationCount) && (config.liveSyncDuration || config.liveMaxLatencyDuration)) {
      throw new Error('Illegal hls.js config: don\'t mix up liveSyncDurationCount/liveMaxLatencyDurationCount and liveSyncDuration/liveMaxLatencyDuration');
    }

    for (let prop in defaultConfig) {
      if (prop in config) continue;
      config[prop] = defaultConfig[prop];
    }

    if (config.liveMaxLatencyDurationCount !== undefined && config.liveMaxLatencyDurationCount <= config.liveSyncDurationCount) {
      throw new Error('Illegal hls.js config: "liveMaxLatencyDurationCount" must be gt "liveSyncDurationCount"');
    }

    if (config.liveMaxLatencyDuration !== undefined && (config.liveMaxLatencyDuration <= config.liveSyncDuration || config.liveSyncDuration === undefined)) {
      throw new Error('Illegal hls.js config: "liveMaxLatencyDuration" must be gt "liveSyncDuration"');
    }

    this._autoLevelCapping = -1;

    // core controllers and network loaders

    const abrController = this.abrController = new config.abrController(this);

    const bufferController = new config.bufferController(this);
    const capLevelController = new config.capLevelController(this);
    const fpsController = new config.fpsController(this);
    const playListLoader = new PlaylistLoader(this);
    const fragmentLoader = new FragmentLoader(this);
    const keyLoader = new KeyLoader(this);
    const id3TrackController = new ID3TrackController(this);

    const levelController = this.levelController = new LevelController(this);

    // FIXME: FragmentTracker must be defined before StreamController because the order of event handling is important
    const fragmentTracker = new FragmentTracker(this);

    const streamController = this.streamController = new StreamController(this, fragmentTracker);

    // Minimal components
    this.coreComponents.push(
      levelController,
      streamController,
      playListLoader,
      fragmentLoader,
      keyLoader,
      abrController,
      bufferController,
      capLevelController,
      fpsController,
      id3TrackController,
      fragmentTracker
    );

    // optional alternate audio, subtitles and DRM related components
    const coreComponents = this.coreComponents;

    // Audio

    let Controller = config.audioStreamController;
    if (Controller) {
      this.audioStreamController = new Controller(this, fragmentTracker);
      coreComponents.push(this.audioStreamController);
    }

    Controller = config.audioTrackController;
    if (Controller) {
      const audioTrackController = new Controller(this);
      this.audioTrackController = audioTrackController;
      coreComponents.push(audioTrackController);
    }

    // Subs

    Controller = config.subtitleTrackController;
    if (Controller) {
      const subtitleTrackController = new Controller(this);
      this.subtitleTrackController = subtitleTrackController;
      coreComponents.push(subtitleTrackController);
    }

    Controller = config.subtitleStreamController;
    if (Controller) {
      this.subtitleStreamController = new Controller(this);
      coreComponents.push(this.subtitleStreamController);
    }

    Controller = config.timelineController;
    if (Controller) {
      this.timelineController = new Controller(this);
      coreComponents.push(this.timelineController);
    }

    // DRM

    Controller = config.emeController;
    if (Controller) {
      const emeController = new Controller(this);
      this.emeController = emeController;
      coreComponents.push(emeController);
    }
  }

  /**
   * Dispose of the instance
   */
  destroy () {
    _logger.log('destroy');
    this.trigger(Events.DESTROYING);
    this.detachMedia();
    this.coreComponents.forEach(component => {
      component.destroy();
    });
    this.url = null;
    this.removeAllListeners();
    this._autoLevelCapping = -1;
  }

  /**
   * Attach a media element
   * @param {HTMLMediaElement} media
   */
  attachMedia (media: HTMLMediaElement) {
    _logger.log('attachMedia');
    this.media = media;
    this.trigger(Events.MEDIA_ATTACHING, { media: media });
  }

  /**
   * Detach from the media
   */
  detachMedia (): void {
    _logger.log('detachMedia');
    this.trigger(Events.MEDIA_DETACHING);
    this.media = null;
  }

  /**
   * Set the source URL. Can be relative or absolute.
   * @param {string} url
   */
  loadSource (url: string): void {
    url = URLToolkit.buildAbsoluteURL(window.location.href, url, { alwaysNormalize: true });
    _logger.log(`loadSource: ${url}`);
    this.url = url;
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
  startLoad (startPosition: number = -1): void {
    _logger.log(`startLoad(${startPosition})`);

    // FIXME: At least LevelController should be kicked off by an event instead
    //        since it doesn't even take a start-position
    this.levelController.startLoad();

    // FIXME: Shouldn't all of this be kicked off by an event?
    this.streamController.startLoad(startPosition);
    if (this.audioStreamController) {
      this.audioStreamController.startLoad(startPosition);
    }
  }

  /**
   * Stop loading of any stream data.
   */
  stopLoad (): void {
    _logger.log('stopLoad');

    this.levelController.stopLoad();
    this.streamController.stopLoad();
    if (this.audioStreamController) {
      this.audioStreamController.stopLoad();
    }
  }

  /**
   * Swap through possible audio codecs in the stream (for example to switch from stereo to 5.1)
   */
  swapAudioCodec (): void {
    _logger.log('swapAudioCodec');
    this.streamController.swapAudioCodec();
  }

  /**
   * When the media-element fails, this allows to detach and then re-attach it
   * as one call (convenience method).
   *
   * Automatic recovery of media-errors by this process is configurable.
   */
  recoverMediaError (): void {
    _logger.log('recoverMediaError');
    let media = this.media;
    this.detachMedia();
    this.attachMedia(media);
  }

  /**
   * @type {QualityLevel[]}
   */
  get levels (): QualityLevel[] {
    return this.levelController.levels;
  }

  /**
   * Index of quality level currently played
   * @type {number}
   */
  get currentLevel (): number {
    return this.streamController.currentLevel;
  }

  /**
   * Set quality level index immediately .
   * This will flush the current buffer to replace the quality asap.
   * That means playback will interrupt at least shortly to re-buffer and re-sync eventually.
   * @type {number} -1 for automatic level selection
   */
  set currentLevel (newLevel: number) {
    _logger.log(`set currentLevel:${newLevel}`);
    this.loadLevel = newLevel;
    this.streamController.immediateLevelSwitch();
  }

  /**
   * Index of next quality level loaded as scheduled by stream controller.
   * @type {number}
   */
  get nextLevel (): number {
    return this.streamController.nextLevel;
  }

  /**
   * Set quality level index for next loaded data.
   * This will switch the video quality asap, without interrupting playback.
   * May abort current loading of data, and flush parts of buffer (outside currently played fragment region).
   * @type {number} -1 for automatic level selection
   */
  set nextLevel (newLevel: number) {
    _logger.log(`set nextLevel: ${newLevel}`);
    this.levelController.manualLevel = newLevel;
    this.streamController.nextLevelSwitch();
  }

  /**
   * Return the quality level of the currently or last (of none is loaded currently) segment
   * @type {number}
   */
  get loadLevel (): number {
    return this.levelController.level;
  }

  /**
   * Set quality level index for next loaded data in a conservative way.
   * This will switch the quality without flushing, but interrupt current loading.
   * Thus the moment when the quality switch will appear in effect will only be after the already existing buffer.
   * @type {number} newLevel -1 for automatic level selection
   */
  set loadLevel (newLevel: number) {
    _logger.log(`set loadLevel: ${newLevel}`);
    this.levelController.manualLevel = newLevel;
  }

  /**
   * get next quality level loaded
   * @type {number}
   */
  get nextLoadLevel (): number {
    return this.levelController.nextLoadLevel;
  }

  /**
   * Set quality level of next loaded segment in a fully "non-destructive" way.
   * Same as `loadLevel` but will wait for next switch (until current loading is done).
   * @type {number} level
   */
  set nextLoadLevel (level: number) {
    this.levelController.nextLoadLevel = level;
  }

  /**
   * Return "first level": like a default level, if not set,
   * falls back to index of first level referenced in manifest
   * @type {number}
   */
  get firstLevel (): number {
    return Math.max(this.levelController.firstLevel, this.minAutoLevel);
  }

  /**
   * Sets "first-level", see getter.
   * @type {number}
   */
  set firstLevel (newLevel: number) {
    _logger.log(`set firstLevel: ${newLevel}`);
    this.levelController.firstLevel = newLevel;
  }

  /**
   * Return start level (level of first fragment that will be played back)
   * if not overrided by user, first level appearing in manifest will be used as start level
   * if -1 : automatic start level selection, playback will start from level matching download bandwidth
   * (determined from download of first segment)
   * @type {number}
   */
  get startLevel (): number {
    return this.levelController.startLevel;
  }

  /**
   * set  start level (level of first fragment that will be played back)
   * if not overrided by user, first level appearing in manifest will be used as start level
   * if -1 : automatic start level selection, playback will start from level matching download bandwidth
   * (determined from download of first segment)
   * @type {number} newLevel
   */
  set startLevel (newLevel: number) {
    _logger.log(`set startLevel: ${newLevel}`);
    const hls = this;
    // if not in automatic start level detection, ensure startLevel is greater than minAutoLevel
    if (newLevel !== -1) {
      newLevel = Math.max(newLevel, hls.minAutoLevel);
    }

    hls.levelController.startLevel = newLevel;
  }

  /**
   * Capping/max level value that should be used by automatic level selection algorithm (`ABRController`)
   * @type {number}
   */
  get autoLevelCapping (): number {
    return this._autoLevelCapping;
  }

  /**
   * Capping/max level value that should be used by automatic level selection algorithm (`ABRController`)
   * @type {number}
   */
  set autoLevelCapping (newLevel: number) {
    _logger.log(`set autoLevelCapping: ${newLevel}`);
    this._autoLevelCapping = newLevel;
  }

  /**
   * True when automatic level selection enabled
   * @type {boolean}
   */
  get autoLevelEnabled (): boolean {
    return (this.levelController.manualLevel === -1);
  }

  /**
   * Level set manually (if any)
   * @type {number}
   */
  get manualLevel (): number {
    return this.levelController.manualLevel;
  }

  /**
   * min level selectable in auto mode according to config.minAutoBitrate
   * @type {number}
   */
  get minAutoLevel (): number {
    const hls = this;
    const levels = hls.levels;
    const minAutoBitrate = hls.config.minAutoBitrate;
    const len = levels ? levels.length : 0;

    for (let i = 0; i < len; i++) {
      const levelNextBitrate = levels[i].realBitrate ? Math.max(levels[i].realBitrate, levels[i].bitrate) : levels[i].bitrate;
      if (levelNextBitrate > minAutoBitrate) {
        return i;
      }
    }

    return 0;
  }

  /**
   * max level selectable in auto mode according to autoLevelCapping
   * @type {number}
   */
  get maxAutoLevel (): number {
    const hls = this;
    const levels = hls.levels;
    const autoLevelCapping = hls.autoLevelCapping;
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
  get nextAutoLevel (): number {
    const hls = this;
    // ensure next auto level is between  min and max auto level
    return Math.min(Math.max(hls.abrController.nextAutoLevel, hls.minAutoLevel), hls.maxAutoLevel);
  }

  /**
   * this setter is used to force next auto level.
   * this is useful to force a switch down in auto mode:
   * in case of load error on level N, hls.js can set nextAutoLevel to N-1 for example)
   * forced value is valid for one fragment. upon succesful frag loading at forced level,
   * this value will be resetted to -1 by ABR controller.
   * @type {number}
   */
  set nextAutoLevel (nextLevel: number) {
    const hls = this;
    hls.abrController.nextAutoLevel = Math.max(hls.minAutoLevel, nextLevel);
  }

  /**
   * @type {AudioTrack[]}
   */
  get audioTracks (): AudioTrack[] {
    const audioTrackController = this.audioTrackController;
    if (this.audioTrackController) {
      const audioTracks: any = audioTrackController.audioTracks;
      return audioTracks;
    } else {
      return [];
    }
  }

  /**
   * index of the selected audio track (index in audio track lists)
   * @type {number}
   */
  get audioTrack () {
    const audioTrackController = this.audioTrackController;
    return audioTrackController ? audioTrackController.audioTrack : -1;
  }

  /**
   * selects an audio track, based on its index in audio track lists
   * @type {number}
   */
  set audioTrack (audioTrackId) {
    const audioTrackController = this.audioTrackController;
    if (audioTrackController) {
      audioTrackController.audioTrack = audioTrackId;
    }
  }

  /**
   * @type {number} in seconds
   */
  get liveSyncPosition (): number {
    return this.streamController.liveSyncPosition;
  }

  /**
   * get alternate subtitle tracks list from playlist
   * @type {SubtitleTrack[]}
   */
  get subtitleTracks (): SubtitleTrack[] {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController ? subtitleTrackController.subtitleTracks : [];
  }

  /**
   * index of the selected subtitle track (index in subtitle track lists)
   * @type {number}
   */
  get subtitleTrack () {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController ? subtitleTrackController.subtitleTrack : -1;
  }

  /**
   * select an subtitle track, based on its index in subtitle track lists
   * @type {number}
   */
  set subtitleTrack (subtitleTrackId: number) {
    const subtitleTrackController = this.subtitleTrackController;
    if (subtitleTrackController) {
      subtitleTrackController.subtitleTrack = subtitleTrackId;
    }
  }

  /**
   * @type {boolean}
   */
  get subtitleDisplay (): boolean {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController ? subtitleTrackController.subtitleDisplay : false;
  }

  /**
   * Enable/disable subtitle display rendering
   * @type {boolean}
   */
  set subtitleDisplay (value: boolean) {
    const subtitleTrackController = this.subtitleTrackController;
    if (subtitleTrackController) {
      subtitleTrackController.subtitleDisplay = value;
    }
  }
}
