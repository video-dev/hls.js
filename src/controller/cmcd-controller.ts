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
  toCmcdValue,
} from '@svta/cml-cmcd';
import { Events } from '../events';
import { BufferHelper } from '../utils/buffer-helper';
import type {
  FragmentLoaderConstructor,
  HlsConfig,
  PlaylistLoaderConstructor,
} from '../config';
import type Hls from '../hls';
import type { Fragment, MediaFragment, Part } from '../loader/fragment';
import type { ExtendedSourceBuffer } from '../types/buffer';
import type { ComponentAPI } from '../types/component-api';
import type {
  BufferCreatedData,
  ErrorData,
  LevelSwitchingData,
  MediaAttachedData,
} from '../types/events';
import type {
  FragmentLoaderContext,
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
  PlaylistLoaderContext,
} from '../types/loader';
import type { Cmcd } from '@svta/cml-cmcd';

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
  private playerState: CmcdPlayerState = CmcdPlayerState.STARTING;
  private audioBuffer?: ExtendedSourceBuffer;
  private videoBuffer?: ExtendedSourceBuffer;
  private reporter?: CmcdReporter;

  constructor(hls: Hls) {
    this.hls = hls;
    const config = (this.config = hls.config);
    const { cmcd } = config;

    if (cmcd != null) {
      config.pLoader = this.createPlaylistLoader();
      config.fLoader = this.createFragmentLoader();

      const version = cmcd.version || CMCD_V1;

      this.reporter = new CmcdReporter({
        sid: cmcd.sessionId || hls.sessionId,
        cid: cmcd.contentId,
        version,
        transmissionMode: cmcd.useHeaders === true ? CMCD_HEADERS : CMCD_QUERY,
        enabledKeys: cmcd.includeKeys ?? [
          ...(version >= CMCD_V2 ? CMCD_KEYS : CMCD_V1_KEYS),
        ],
        eventTargets: cmcd.eventTargets ?? [],
      });

      this.reporter.update({ sf: CmcdStreamingFormat.HLS });
      this.reporter.start();
      this.registerListeners();
    }
  }

  private registerListeners() {
    const hls = this.hls;
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    hls.on(Events.BUFFER_CREATED, this.onBufferCreated, this);
    hls.on(Events.ERROR, this.onError, this);
    hls.on(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
  }

  private unregisterListeners() {
    const hls = this.hls;
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    hls.off(Events.BUFFER_CREATED, this.onBufferCreated, this);
    hls.off(Events.ERROR, this.onError, this);
    hls.off(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
  }

  destroy() {
    this.unregisterListeners();
    this.onMediaDetached();

    if (this.reporter) {
      this.reporter.stop(true);
      this.reporter = undefined;
    }

    // @ts-ignore
    this.hls = this.config = this.audioBuffer = this.videoBuffer = null;
    // @ts-ignore
    this.onWaiting = this.onPlaying = this.onPause = null;
    // @ts-ignore
    this.onSeeking = this.onEnded = this.media = null;
  }

  private onMediaAttached(
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachedData,
  ) {
    this.media = data.media;
    this.media.addEventListener('waiting', this.onWaiting);
    this.media.addEventListener('playing', this.onPlaying);
    this.media.addEventListener('pause', this.onPause);
    this.media.addEventListener('seeking', this.onSeeking);
    this.media.addEventListener('ended', this.onEnded);
  }

  private onMediaDetached() {
    if (!this.media) {
      return;
    }

    this.media.removeEventListener('waiting', this.onWaiting);
    this.media.removeEventListener('playing', this.onPlaying);
    this.media.removeEventListener('pause', this.onPause);
    this.media.removeEventListener('seeking', this.onSeeking);
    this.media.removeEventListener('ended', this.onEnded);

    // @ts-ignore
    this.media = null;
  }

  private onBufferCreated(
    event: Events.BUFFER_CREATED,
    data: BufferCreatedData,
  ) {
    this.audioBuffer = data.tracks.audio?.buffer;
    this.videoBuffer = data.tracks.video?.buffer;
  }

  private onWaiting = () => {
    if (this.initialized) {
      this.starved = true;
      this.setPlayerState(CmcdPlayerState.REBUFFERING);
    }

    this.buffering = true;
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
    this.setPlayerState(CmcdPlayerState.SEEKING);
  };

  private onEnded = () => {
    this.setPlayerState(CmcdPlayerState.ENDED);
  };

  private onError(event: Events.ERROR, data: ErrorData) {
    if (data.fatal) {
      this.setPlayerState(CmcdPlayerState.FATAL_ERROR);
      this.reporter!.recordEvent(CmcdEventType.ERROR);
    }
  }

  private onLevelSwitching(
    event: Events.LEVEL_SWITCHING,
    data: LevelSwitchingData,
  ) {
    this.reporter!.update({ br: [data.bitrate / 1000] });

    const eventData: Cmcd = {};
    const frag = data.details?.fragments[0];
    if (frag) {
      eventData.ot = this.getObjectType(frag);
    }
    this.reporter!.recordEvent(CmcdEventType.BITRATE_CHANGE, eventData);
  }

  private setPlayerState(state: CmcdPlayerState) {
    if (this.playerState === state) {
      return;
    }

    this.playerState = state;
    this.reporter!.update({ sta: state });
    this.reporter!.recordEvent(CmcdEventType.PLAY_STATE);
  }

  /**
   * Get the stream type based on level details.
   */
  private getStreamType(): CmcdStreamType | undefined {
    const loadLevel = this.hls.loadLevel;
    const details =
      loadLevel >= 0 ? this.hls.levels[loadLevel]?.details : undefined;

    if (!details) {
      return undefined;
    }

    if (!details.live) {
      return CmcdStreamType.VOD;
    }

    // TODO: Is this the best way to determine the low-latency stream type?
    if (details.canBlockReload || details.canSkipUntil) {
      return CmcdStreamType.LOW_LATENCY;
    }

    return CmcdStreamType.LIVE;
  }

  /**
   * Apply CMCD data to a request using the reporter.
   */
  private apply(context: LoaderContext, data: Cmcd = {}) {
    // Update persistent data
    this.reporter!.update({
      mtp: [this.hls.bandwidthEstimate / 1000],
      pr: this.media?.playbackRate,
      st: this.getStreamType(),
    });

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

    const report = this.reporter!.createRequestReport(
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
      const ot = this.getObjectType(frag);
      const data: Cmcd = { d: (part || frag).duration * 1000, ot };

      if (
        ot === CmcdObjectType.VIDEO ||
        ot === CmcdObjectType.AUDIO ||
        ot == CmcdObjectType.MUXED
      ) {
        data.br = [level.bitrate / 1000];
        const tb = this.getTopBandwidth(ot) / 1000;
        if (Number.isFinite(tb)) {
          data.tb = [tb];
        }
        const bl = this.getBufferLength(ot);
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
      if (!this.hls.audioTracks.length) {
        return CmcdObjectType.MUXED;
      }

      return CmcdObjectType.VIDEO;
    }

    return undefined;
  }

  /**
   * Get the highest bitrate.
   */
  private getTopBandwidth(type: CmcdObjectType) {
    let bitrate: number = 0;
    let levels;
    const hls = this.hls;

    if (type === CmcdObjectType.AUDIO) {
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
   * Get the buffer length for a media type in milliseconds
   */
  private getBufferLength(type: CmcdObjectType) {
    const media = this.media;
    const buffer =
      type === CmcdObjectType.AUDIO ? this.audioBuffer : this.videoBuffer;

    if (!buffer || !media) {
      return NaN;
    }

    // TODO: Implement parameterized buffer length array
    const info = BufferHelper.bufferInfo(
      buffer,
      media.currentTime,
      this.config.maxBufferHole,
    );

    return info.len * 1000;
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
