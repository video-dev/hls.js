import {
  CMCD_HEADERS,
  CMCD_KEYS,
  CMCD_QUERY,
  CMCD_V1,
  CMCD_V1_KEYS,
  CMCD_V2,
  CmcdEventType,
  CmcdObjectType,
  CmcdPlayerState,
  CmcdReporter,
  CmcdStreamingFormat,
  CmcdStreamType,
  isCmcdCustomKey,
  toCmcdValue,
} from '@svta/cml-cmcd';
import { Events } from '../events';
import {
  addEventListener,
  removeEventListener,
} from '../utils/event-listener-helper';
import type {
  CmcdCustomDataInput,
  CmcdValue,
  FragmentLoaderConstructor,
  HlsConfig,
  PlaylistLoaderConstructor,
} from '../config';
import type Hls from '../hls';
import type { Fragment, MediaFragment, Part } from '../loader/fragment';
import type { ComponentAPI } from '../types/component-api';
import type {
  BufferAppendedData,
  BufferFlushedData,
  ErrorData,
  LevelSwitchingData,
  ManifestLoadingData,
  MediaAttachedData,
  MediaEndedData,
} from '../types/events';
import type { Level } from '../types/level';
import type {
  FragmentLoaderContext,
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
  PlaylistLoaderContext,
} from '../types/loader';
import type { Cmcd, CmcdKey } from '@svta/cml-cmcd';

/**
 * Controller to deal with Common Media Client Data (CMCD)
 * @see https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf
 */
export default class CMCDController implements ComponentAPI {
  private hls: Hls;
  private config: HlsConfig;
  private media?: HTMLMediaElement;
  private initialized: boolean = false;
  private starved: boolean = false;
  private buffering: boolean = true;
  private playerState?: CmcdPlayerState;
  private reporter?: CmcdReporter;
  private reporterEnabledKeys: CmcdKey[] = [];
  private customData: CmcdCustomDataInput | undefined;
  private activeCustomKeys = new Set<string>();

  constructor(hls: Hls) {
    this.hls = hls;
    const config = (this.config = hls.config);
    const { cmcd } = config;

    if (cmcd != null) {
      config.pLoader = this.createPlaylistLoader();
      config.fLoader = this.createFragmentLoader();

      this.registerListeners();
    }
  }

  private createReporter() {
    const { cmcd } = this.config;
    if (cmcd == null) {
      return;
    }

    const version = cmcd.version || CMCD_V1;

    // Build enabledKeys as a mutable array we keep a reference to.
    // We add custom keys into it later as they are discovered so that
    // the CML's per-request filter passes them through.
    this.reporterEnabledKeys = cmcd.includeKeys
      ? [...cmcd.includeKeys]
      : [...(version >= CMCD_V2 ? CMCD_KEYS : CMCD_V1_KEYS)];

    this.reporter = new CmcdReporter(
      {
        sid: cmcd.sessionId || this.hls.sessionId,
        cid: cmcd.contentId,
        version,
        transmissionMode: cmcd.useHeaders === true ? CMCD_HEADERS : CMCD_QUERY,
        enabledKeys: this.reporterEnabledKeys,
        eventTargets: (cmcd.eventTargets ?? []).map(
          ({ includeKeys, ...rest }) => ({
            ...rest,
            enabledKeys: includeKeys ?? CMCD_KEYS,
          }),
        ),
      },
      cmcd.loader,
    );

    this.reporter.update({
      sf: CmcdStreamingFormat.HLS,
      sta: this.playerState,
    });

    if (this.customData === undefined && cmcd.customData) {
      this.customData = cmcd.customData;
    }
    if (this.customData && typeof this.customData !== 'function') {
      this.pushCustomDataToReporter(this.customData);
    }

    this.reporter.start();
  }

  setCustomData(data: CmcdCustomDataInput): void {
    this.customData = data;
    if (this.reporter && typeof data !== 'function') {
      this.pushCustomDataToReporter(data);
    }
  }

  getCustomData(): CmcdCustomDataInput | undefined {
    return this.customData;
  }

  recordEvent(
    eventType: CmcdEventType | string,
    data?: Record<string, CmcdValue>,
  ): void {
    if (!this.reporter) return;
    if (this.config.cmcd?.version !== CMCD_V2) {
      this.hls.logger.warn(
        'cmcdRecordEvent: custom events are only meaningful in CMCD v2',
      );
    }
    // The library's per-target filter only allows keys listed in enabledKeys.
    // Custom keys (com.*) passed inline with an event are not known at init
    // time, so we register them now so they survive the filter.
    if (data) {
      const reporterConfig = (this.reporter as any).config;
      const customKeys = Object.keys(data).filter(isCmcdCustomKey);
      if (customKeys.length > 0 && reporterConfig?.eventTargets) {
        reporterConfig.eventTargets.forEach((target: any) => {
          customKeys.forEach((key) => {
            if (!target.enabledKeys.includes(key)) {
              target.enabledKeys.push(key);
            }
          });
        });
      }
    }
    this.reporter.recordEvent(
      eventType as CmcdEventType,
      data as Cmcd | undefined,
    );
  }

  private resolveCustomData(): Record<string, CmcdValue> {
    if (!this.customData) return {};
    if (typeof this.customData === 'function') {
      return this.customData();
    }
    return this.customData;
  }

  // Updates the reporter with the new custom data, clearing any keys that
  // are no longer present so they stop appearing in subsequent requests.
  private pushCustomDataToReporter(data: Record<string, CmcdValue>): void {
    if (!this.reporter) return;
    const newKeys = new Set(Object.keys(data));

    // Build a clear object for keys that were active but are no longer present
    const clearObj: Record<string, undefined> = {};
    // Use forEach (not for...of or [...set]) to avoid Babel loose-mode
    // compiling spread to [].concat(set), which wraps the Set as one element.
    this.activeCustomKeys.forEach((key) => {
      if (!newKeys.has(key)) {
        clearObj[key] = undefined;
      }
    });
    if (Object.keys(clearObj).length) {
      this.reporter.update(clearObj as Cmcd);
    }

    this.activeCustomKeys = newKeys;

    // Add new custom keys to the shared enabledKeys array so the CML's
    // per-request filter passes them through.
    newKeys.forEach((key) => {
      if (!this.reporterEnabledKeys.includes(key as CmcdKey)) {
        this.reporterEnabledKeys.push(key as CmcdKey);
      }
    });

    if (newKeys.size > 0) {
      this.reporter.update(data as Cmcd);
    }
  }

  private registerListeners() {
    const hls = this.hls;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
    hls.on(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    hls.on(Events.MEDIA_ENDED, this.onMediaEnded, this);
    hls.on(Events.ERROR, this.onError, this);
    hls.on(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
    hls.on(Events.BUFFER_APPENDED, this.onBufferInfoChange, this);
    hls.on(Events.BUFFER_FLUSHED, this.onBufferInfoChange, this);
  }

  private unregisterListeners() {
    const hls = this.hls;
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
    hls.off(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    hls.off(Events.MEDIA_ENDED, this.onMediaEnded, this);
    hls.off(Events.ERROR, this.onError, this);
    hls.off(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
    hls.off(Events.BUFFER_APPENDED, this.onBufferInfoChange, this);
    hls.off(Events.BUFFER_FLUSHED, this.onBufferInfoChange, this);
  }

  destroy() {
    this.unregisterListeners();
    this.onMediaDetached();

    if (this.reporter) {
      this.reporter.stop(true);
      this.reporter = undefined;
    }

    // @ts-ignore
    this.hls = this.config = null;
    // @ts-ignore
    this.onWaiting = this.onPlay = this.onPlaying = this.onPause = null;
    // @ts-ignore
    this.onSeeking = this.onSeeked = this.onRateChange = this.media = null;
  }

  private onMediaAttaching(
    event: Events.MEDIA_ATTACHING,
    data: MediaAttachedData,
  ) {
    const media = (this.media = data.media);
    this.setPlayerState(
      this.media.autoplay
        ? CmcdPlayerState.STARTING
        : CmcdPlayerState.PRELOADING,
    );

    addEventListener(media, 'waiting', this.onWaiting);
    addEventListener(media, 'play', this.onPlay);
    addEventListener(media, 'playing', this.onPlaying);
    addEventListener(media, 'pause', this.onPause);
    addEventListener(media, 'seeking', this.onSeeking);
    addEventListener(media, 'seeked', this.onSeeked);
    addEventListener(media, 'ratechange', this.onRateChange);
  }

  private onMediaDetached() {
    const media = this.media;

    if (!media) {
      return;
    }

    removeEventListener(media, 'waiting', this.onWaiting);
    removeEventListener(media, 'play', this.onPlay);
    removeEventListener(media, 'playing', this.onPlaying);
    removeEventListener(media, 'pause', this.onPause);
    removeEventListener(media, 'seeking', this.onSeeking);
    removeEventListener(media, 'seeked', this.onSeeked);
    removeEventListener(media, 'ratechange', this.onRateChange);

    // @ts-ignore
    this.media = null;
  }

  private onWaiting = () => {
    if (this.initialized) {
      this.starved = true;
      this.setPlayerState(CmcdPlayerState.REBUFFERING);
    }

    this.buffering = true;
  };

  private onPlay = () => {
    if (!this.initialized) {
      this.setPlayerState(CmcdPlayerState.STARTING);
    }
  };

  private onPlaying = () => {
    if (!this.initialized) {
      this.initialized = true;
    }

    this.buffering = false;
    this.setPlayerState(CmcdPlayerState.PLAYING);
  };

  private onPause = () => {
    if (this.media && !this.media.ended) {
      this.setPlayerState(CmcdPlayerState.PAUSED);
    }
  };

  private onSeeking = () => {
    if (this.initialized) {
      this.setPlayerState(CmcdPlayerState.SEEKING);
    }
  };

  private onSeeked = () => {
    if (!this.initialized) {
      return;
    }
    if (this.media?.paused) {
      this.setPlayerState(CmcdPlayerState.PAUSED);
    }
  };

  private onRateChange = () => {
    if (this.reporter && this.media) {
      this.reporter.update({ pr: this.media.playbackRate });
    }
  };

  private onMediaEnded(event: Events.MEDIA_ENDED, data: MediaEndedData) {
    this.setPlayerState(CmcdPlayerState.ENDED);
  }

  private onManifestLoading(
    event: Events.MANIFEST_LOADING,
    data: ManifestLoadingData,
  ) {
    this.initialized = false;
    this.starved = false;
    this.buffering = true;

    if (this.reporter) {
      this.reporter.stop(true);
      this.reporter = undefined;
      this.activeCustomKeys = new Set();
    }

    this.createReporter();

    if (!this.media) {
      this.setPlayerState(CmcdPlayerState.PRELOADING);
    }
  }

  private onError(event: Events.ERROR, data: ErrorData) {
    if (data.fatal) {
      this.setPlayerState(CmcdPlayerState.FATAL_ERROR);
      if (this.reporter) {
        this.reporter.recordEvent(CmcdEventType.ERROR, { ec: [data.details] });
      }
    }
  }

  private onLevelSwitching(
    event: Events.LEVEL_SWITCHING,
    data: LevelSwitchingData,
  ) {
    if (!this.reporter) {
      return;
    }

    const eventData: Cmcd = { br: [data.bitrate / 1000] };
    const frag = data.details?.fragments[0];
    if (frag) {
      eventData.ot = this.getObjectType(frag, data);
    }
    this.reporter.recordEvent(CmcdEventType.BITRATE_CHANGE, eventData);
  }

  private setPlayerState(state: CmcdPlayerState) {
    this.playerState = state;
    if (this.reporter) {
      this.reporter.update({ sta: state });
    }
  }

  /**
   * Get the stream type based on level details.
   */
  private getStreamType(): CmcdStreamType | undefined {
    const details = this.hls.latestLevelDetails;

    if (!details) {
      return undefined;
    }

    if (!details.live) {
      return CmcdStreamType.VOD;
    }

    // TODO: Replace with an `isLowLatency` check in #7729
    if (!!details.partList && details.canBlockReload) {
      return CmcdStreamType.LOW_LATENCY;
    }

    return CmcdStreamType.LIVE;
  }

  /**
   * Apply CMCD data to a request using the reporter.
   */
  private apply(context: LoaderContext, data: Cmcd = {}) {
    if (!this.reporter) {
      return;
    }

    // Update persistent data
    this.reporter.update({
      mtp: [this.hls.bandwidthEstimate / 1000],
      pr: this.media?.playbackRate,
      st: this.getStreamType(),
    });

    if (this.customData) {
      try {
        const custom = this.resolveCustomData();
        this.pushCustomDataToReporter(custom);
      } catch (error) {
        this.hls.logger.warn('Could not resolve CMCD custom data.', error);
      }
    }

    const isVideo =
      data.ot === CmcdObjectType.INIT ||
      data.ot === CmcdObjectType.VIDEO ||
      data.ot === CmcdObjectType.MUXED;

    if (this.starved && isVideo) {
      data.bs = true;
      data.su = true;
      this.starved = false;
    }

    if (data.su == null) {
      data.su = this.buffering;
    }

    // TODO: Implement rtp, dl

    const report = this.reporter.createRequestReport(
      { url: context.url, headers: context.headers },
      data,
    );

    context.url = report.url;
    context.headers = report.headers;
  }

  /**
   * Apply CMCD data to a manifest request.
   */
  private applyPlaylistData = (context: PlaylistLoaderContext) => {
    try {
      this.apply(context, {
        ot: CmcdObjectType.MANIFEST,
        su: !this.initialized,
      });
    } catch (error) {
      this.hls.logger.warn('Could not generate manifest CMCD data.', error);
    }
  };

  /**
   * Apply CMCD data to a segment request
   */
  private applyFragmentData = (context: FragmentLoaderContext) => {
    try {
      const { frag, part } = context;
      const level = this.hls.levels[frag.level];
      const ot = this.getObjectType(frag, level);
      const data: Cmcd = { d: (part || frag).duration * 1000, ot };

      if (
        ot === CmcdObjectType.VIDEO ||
        ot === CmcdObjectType.AUDIO ||
        ot === CmcdObjectType.MUXED ||
        (ot == null && (frag.type === 'main' || frag.type === 'audio'))
      ) {
        data.br = [level.bitrate / 1000];
        const tb = this.getTopBandwidth(frag) / 1000;
        if (Number.isFinite(tb)) {
          data.tb = [tb];
        }
        const bl = this.getBufferLength(frag);
        if (Number.isFinite(bl)) {
          data.bl = [bl];
        }
      }

      const next = part ? this.getNextPart(part) : this.getNextFrag(frag);

      if (next?.url && next.url !== frag.url) {
        if (next.byteRange.length > 0) {
          data.nor = [
            toCmcdValue(next.url, {
              r: `${next.byteRange[0]}-${next.byteRange[1]}`,
            }),
          ];
        } else {
          data.nor = [next.url];
        }
      }

      this.apply(context, data);
    } catch (error) {
      this.hls.logger.warn('Could not generate segment CMCD data.', error);
    }
  };

  private getNextFrag(fragment: Fragment): Fragment | undefined {
    const levelDetails = this.hls.levels[fragment.level]?.details;
    if (levelDetails) {
      const index = (fragment.sn as number) - levelDetails.startSN;
      return levelDetails.fragments[index + 1];
    }

    return undefined;
  }

  private getNextPart(part: Part): Part | undefined {
    const { index, fragment } = part;
    const partList = this.hls.levels[fragment.level]?.details?.partList;

    if (partList) {
      const { sn } = fragment;
      for (let i = partList.length - 1; i >= 0; i--) {
        const p = partList[i];
        if (p.index === index && p.fragment.sn === sn) {
          return partList[i + 1];
        }
      }
    }

    return undefined;
  }

  /**
   * The CMCD object type.
   */
  private getObjectType(
    fragment: Fragment | MediaFragment,
    variant?: Level | LevelSwitchingData,
  ): CmcdObjectType | undefined {
    const { type } = fragment;

    if (type === 'subtitle') {
      return CmcdObjectType.TIMED_TEXT;
    }

    if (fragment.sn === 'initSegment') {
      return CmcdObjectType.INIT;
    }

    if (type === 'audio') {
      return CmcdObjectType.AUDIO;
    }

    if (type === 'main') {
      // Parsed elementary streams are ground truth when present.
      if (fragment.hasStreams) {
        const es = fragment.elementaryStreams;
        if (es.audiovideo) {
          return CmcdObjectType.MUXED;
        }
        if (es.video) {
          return CmcdObjectType.VIDEO;
        }
        if (es.audio) {
          return CmcdObjectType.AUDIO;
        }
      }
      // Fall back to variant codec info. STREAM-INF CODECS describes the variant
      // including any alternate renditions it pulls from, so audioCodec only
      // implies the main variant carries audio when no audio media options exist.
      if (variant) {
        const { audioCodec, videoCodec } = variant;
        if (!this.hls.audioTracks.length) {
          if (audioCodec && videoCodec) {
            return CmcdObjectType.MUXED;
          }
          if (audioCodec) {
            return CmcdObjectType.AUDIO;
          }
        }
        if (videoCodec) {
          return CmcdObjectType.VIDEO;
        }
      }
    }

    return undefined;
  }

  /**
   * Get the highest bitrate available for the source backing this fragment.
   * Audio renditions live in hls.audioTracks; everything else (including
   * audio-only main playlists) draws from hls.levels.
   */
  private getTopBandwidth(fragment: Fragment | MediaFragment) {
    let bitrate: number = 0;
    let levels;
    const hls = this.hls;

    if (fragment.type === 'audio') {
      levels = hls.audioTracks;
    } else {
      const max = hls.maxAutoLevel;
      const len = max > -1 ? max + 1 : hls.levels.length;
      levels = hls.levels.slice(0, len);
    }

    levels.forEach((level) => {
      if (level.bitrate > bitrate) {
        bitrate = level.bitrate;
      }
    });

    return bitrate > 0 ? bitrate : NaN;
  }

  /**
   * Get the buffer length in milliseconds for the source backing this fragment.
   */
  private getBufferLength(fragment: Fragment | MediaFragment) {
    if (!this.media) {
      return NaN;
    }

    const info =
      fragment.type === 'audio'
        ? this.hls.audioForwardBufferInfo
        : this.hls.mainForwardBufferInfo;
    return info ? info.len * 1000 : NaN;
  }

  /**
   * Get the buffer length in milliseconds without a specific fragment context.
   * Used to keep `bl` fresh on event reports independent of segment requests.
   * Returns the playback bottleneck: min of main and audio forward buffer
   * lengths when both exist; otherwise whichever is available.
   */
  private getEventBufferLength(): number {
    if (!this.media) {
      return NaN;
    }
    const main = this.hls.mainForwardBufferInfo;
    const audio = this.hls.audioForwardBufferInfo;
    if (main && audio) {
      return Math.min(main.len, audio.len) * 1000;
    }
    const info = main || audio;
    return info ? info.len * 1000 : NaN;
  }

  private onBufferInfoChange(
    event: Events.BUFFER_APPENDED | Events.BUFFER_FLUSHED,
    data: BufferAppendedData | BufferFlushedData,
  ) {
    if (!this.reporter) {
      return;
    }
    const bl = this.getEventBufferLength();
    if (!Number.isFinite(bl)) {
      return;
    }
    this.reporter.update({ bl: [bl] });
  }

  /**
   * Create a playlist loader
   */
  private createPlaylistLoader(): PlaylistLoaderConstructor | undefined {
    const { pLoader } = this.config;
    const apply = this.applyPlaylistData;
    const Ctor = pLoader || (this.config.loader as PlaylistLoaderConstructor);

    return class CmcdPlaylistLoader {
      private loader: Loader<PlaylistLoaderContext>;

      constructor(config: HlsConfig) {
        this.loader = new Ctor(config);
      }

      get stats() {
        return this.loader.stats;
      }

      get context() {
        return this.loader.context;
      }

      destroy() {
        this.loader.destroy();
      }

      abort() {
        this.loader.abort();
      }

      load(
        context: PlaylistLoaderContext,
        config: LoaderConfiguration,
        callbacks: LoaderCallbacks<PlaylistLoaderContext>,
      ) {
        apply(context);
        this.loader.load(context, config, callbacks);
      }
    };
  }

  /**
   * Create a fragment loader
   */
  private createFragmentLoader(): FragmentLoaderConstructor | undefined {
    const { fLoader } = this.config;
    const apply = this.applyFragmentData;
    const Ctor = fLoader || (this.config.loader as FragmentLoaderConstructor);

    return class CmcdFragmentLoader {
      private loader: Loader<FragmentLoaderContext>;

      constructor(config: HlsConfig) {
        this.loader = new Ctor(config);
      }

      get stats() {
        return this.loader.stats;
      }

      get context() {
        return this.loader.context;
      }

      destroy() {
        this.loader.destroy();
      }

      abort() {
        this.loader.abort();
      }

      load(
        context: FragmentLoaderContext,
        config: LoaderConfiguration,
        callbacks: LoaderCallbacks<FragmentLoaderContext>,
      ) {
        apply(context);
        this.loader.load(context, config, callbacks);
      }
    };
  }
}
