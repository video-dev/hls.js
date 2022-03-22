import {
  FragmentLoaderConstructor,
  HlsConfig,
  PlaylistLoaderConstructor,
} from '../config';
import { Events } from '../events';
import Hls, { Fragment } from '../hls';
import {
  CMCD,
  CMCDHeaders,
  CMCDObjectType,
  CMCDStreamingFormat,
  CMCDVersion,
} from '../types/cmcd';
import { ComponentAPI } from '../types/component-api';
import { BufferCreatedData, MediaAttachedData } from '../types/events';
import {
  FragmentLoaderContext,
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
  PlaylistLoaderContext,
} from '../types/loader';
import { BufferHelper } from '../utils/buffer-helper';
import { logger } from '../utils/logger';

/**
 * Controller to deal with Common Media Client Data (CMCD)
 * @see https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf
 */
export default class CMCDController implements ComponentAPI {
  private hls: Hls;
  private config: HlsConfig;
  private media?: HTMLMediaElement;
  private sid?: string;
  private cid?: string;
  private useHeaders: boolean = false;
  private initialized: boolean = false;
  private starved: boolean = false;
  private buffering: boolean = true;
  private audioBuffer?: SourceBuffer; // eslint-disable-line no-restricted-globals
  private videoBuffer?: SourceBuffer; // eslint-disable-line no-restricted-globals

  constructor(hls: Hls) {
    this.hls = hls;
    const config = (this.config = hls.config);
    const { cmcd } = config;

    if (cmcd != null) {
      config.pLoader = this.createPlaylistLoader();
      config.fLoader = this.createFragmentLoader();

      this.sid = cmcd.sessionId || CMCDController.uuid();
      this.cid = cmcd.contentId;
      this.useHeaders = cmcd.useHeaders === true;
      this.registerListeners();
    }
  }

  private registerListeners() {
    const hls = this.hls;
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    hls.on(Events.BUFFER_CREATED, this.onBufferCreated, this);
  }

  private unregisterListeners() {
    const hls = this.hls;
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    hls.off(Events.BUFFER_CREATED, this.onBufferCreated, this);

    this.onMediaDetached();
  }

  destroy() {
    this.unregisterListeners();

    // @ts-ignore
    this.hls = this.config = this.audioBuffer = this.videoBuffer = null;
  }

  private onMediaAttached(
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachedData
  ) {
    this.media = data.media;
    this.media.addEventListener('waiting', this.onWaiting);
    this.media.addEventListener('playing', this.onPlaying);
  }

  private onMediaDetached() {
    if (!this.media) {
      return;
    }

    this.media.removeEventListener('waiting', this.onWaiting);
    this.media.removeEventListener('playing', this.onPlaying);

    // @ts-ignore
    this.media = null;
  }

  private onBufferCreated(
    event: Events.BUFFER_CREATED,
    data: BufferCreatedData
  ) {
    this.audioBuffer = data.tracks.audio?.buffer;
    this.videoBuffer = data.tracks.video?.buffer;
  }

  private onWaiting = () => {
    if (this.initialized) {
      this.starved = true;
    }

    this.buffering = true;
  };

  private onPlaying = () => {
    if (!this.initialized) {
      this.initialized = true;
    }

    this.buffering = false;
  };

  /**
   * Create baseline CMCD data
   */
  private createData(): CMCD {
    return {
      v: CMCDVersion,
      sf: CMCDStreamingFormat.HLS,
      sid: this.sid,
      cid: this.cid,
      pr: this.media?.playbackRate,
      mtp: this.hls.bandwidthEstimate / 1000,
    };
  }

  /**
   * Apply CMCD data to a request.
   */
  private apply(context: LoaderContext, data: CMCD = {}) {
    // apply baseline data
    Object.assign(data, this.createData());

    const isVideo =
      data.ot === CMCDObjectType.INIT ||
      data.ot === CMCDObjectType.VIDEO ||
      data.ot === CMCDObjectType.MUXED;

    if (this.starved && isVideo) {
      data.bs = true;
      data.su = true;
      this.starved = false;
    }

    if (data.su == null) {
      data.su = this.buffering;
    }

    // TODO: Implement rtp, nrr, nor, dl

    if (this.useHeaders) {
      const headers = CMCDController.toHeaders(data);
      if (!Object.keys(headers).length) {
        return;
      }

      if (!context.headers) {
        context.headers = {};
      }

      Object.assign(context.headers, headers);
    } else {
      const query = CMCDController.toQuery(data);
      if (!query) {
        return;
      }

      context.url = CMCDController.appendQueryToUri(context.url, query);
    }
  }

  /**
   * Apply CMCD data to a manifest request.
   */
  private applyPlaylistData = (context: PlaylistLoaderContext) => {
    try {
      this.apply(context, {
        ot: CMCDObjectType.MANIFEST,
        su: !this.initialized,
      });
    } catch (error) {
      logger.warn('Could not generate manifest CMCD data.', error);
    }
  };

  /**
   * Apply CMCD data to a segment request
   */
  private applyFragmentData = (context: FragmentLoaderContext) => {
    try {
      const fragment = context.frag;
      const level = this.hls.levels[fragment.level];
      const ot = this.getObjectType(fragment);
      const data: CMCD = {
        d: fragment.duration * 1000,
        ot,
      };

      if (
        ot === CMCDObjectType.VIDEO ||
        ot === CMCDObjectType.AUDIO ||
        ot == CMCDObjectType.MUXED
      ) {
        data.br = level.bitrate / 1000;
        data.tb = this.getTopBandwidth(ot) / 1000;
        data.bl = this.getBufferLength(ot);
      }

      this.apply(context, data);
    } catch (error) {
      logger.warn('Could not generate segment CMCD data.', error);
    }
  };

  /**
   * The CMCD object type.
   */
  private getObjectType(fragment: Fragment): CMCDObjectType | undefined {
    const { type } = fragment;

    if (type === 'subtitle') {
      return CMCDObjectType.TIMED_TEXT;
    }

    if (fragment.sn === 'initSegment') {
      return CMCDObjectType.INIT;
    }

    if (type === 'audio') {
      return CMCDObjectType.AUDIO;
    }

    if (type === 'main') {
      if (!this.hls.audioTracks.length) {
        return CMCDObjectType.MUXED;
      }

      return CMCDObjectType.VIDEO;
    }

    return undefined;
  }

  /**
   * Get the highest bitrate.
   */
  private getTopBandwidth(type: CMCDObjectType) {
    let bitrate: number = 0;
    let levels;
    const hls = this.hls;

    if (type === CMCDObjectType.AUDIO) {
      levels = hls.audioTracks;
    } else {
      const max = hls.maxAutoLevel;
      const len = max > -1 ? max + 1 : hls.levels.length;
      levels = hls.levels.slice(0, len);
    }

    for (const level of levels) {
      if (level.bitrate > bitrate) {
        bitrate = level.bitrate;
      }
    }

    return bitrate > 0 ? bitrate : NaN;
  }

  /**
   * Get the buffer length for a media type in milliseconds
   */
  private getBufferLength(type: CMCDObjectType) {
    const media = this.hls.media;
    const buffer =
      type === CMCDObjectType.AUDIO ? this.audioBuffer : this.videoBuffer;

    if (!buffer || !media) {
      return NaN;
    }

    const info = BufferHelper.bufferInfo(
      buffer,
      media.currentTime,
      this.config.maxBufferHole
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
        callbacks: LoaderCallbacks<PlaylistLoaderContext>
      ) {
        apply(context);
        this.loader.load(context, config, callbacks);
      }
    };
  }

  /**
   * Create a playlist loader
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
        callbacks: LoaderCallbacks<FragmentLoaderContext>
      ) {
        apply(context);
        this.loader.load(context, config, callbacks);
      }
    };
  }

  /**
   * Generate a random v4 UUI
   *
   * @returns {string}
   */
  static uuid(): string {
    const url = URL.createObjectURL(new Blob());
    const uuid = url.toString();
    URL.revokeObjectURL(url);
    return uuid.slice(uuid.lastIndexOf('/') + 1);
  }

  /**
   * Serialize a CMCD data object according to the rules defined in the
   * section 3.2 of
   * [CTA-5004](https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf).
   */
  static serialize(data: CMCD): string {
    const results: string[] = [];
    const isValid = (value: any) =>
      !Number.isNaN(value) && value != null && value !== '' && value !== false;
    const toRounded = (value: number) => Math.round(value);
    const toHundred = (value: number) => toRounded(value / 100) * 100;
    const toUrlSafe = (value: string) => encodeURIComponent(value);
    const formatters = {
      br: toRounded,
      d: toRounded,
      bl: toHundred,
      dl: toHundred,
      mtp: toHundred,
      nor: toUrlSafe,
      rtp: toHundred,
      tb: toRounded,
    };

    const keys = Object.keys(data || {}).sort();

    for (const key of keys) {
      let value = data[key];

      // ignore invalid values
      if (!isValid(value)) {
        continue;
      }

      // Version should only be reported if not equal to 1.
      if (key === 'v' && value === 1) {
        continue;
      }

      // Playback rate should only be sent if not equal to 1.
      if (key == 'pr' && value === 1) {
        continue;
      }

      // Certain values require special formatting
      const formatter = formatters[key];
      if (formatter) {
        value = formatter(value);
      }

      // Serialize the key/value pair
      const type = typeof value;
      let result: string;

      if (key === 'ot' || key === 'sf' || key === 'st') {
        result = `${key}=${value}`;
      } else if (type === 'boolean') {
        result = key;
      } else if (type === 'number') {
        result = `${key}=${value}`;
      } else {
        result = `${key}=${JSON.stringify(value)}`;
      }

      results.push(result);
    }

    return results.join(',');
  }

  /**
   * Convert a CMCD data object to request headers according to the rules
   * defined in the section 2.1 and 3.2 of
   * [CTA-5004](https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf).
   */
  static toHeaders(data: CMCD): Partial<CMCDHeaders> {
    const keys = Object.keys(data);
    const headers = {};
    const headerNames = ['Object', 'Request', 'Session', 'Status'];
    const headerGroups = [{}, {}, {}, {}];
    const headerMap = {
      br: 0,
      d: 0,
      ot: 0,
      tb: 0,
      bl: 1,
      dl: 1,
      mtp: 1,
      nor: 1,
      nrr: 1,
      su: 1,
      cid: 2,
      pr: 2,
      sf: 2,
      sid: 2,
      st: 2,
      v: 2,
      bs: 3,
      rtp: 3,
    };

    for (const key of keys) {
      // Unmapped fields are mapped to the Request header
      const index = headerMap[key] != null ? headerMap[key] : 1;
      headerGroups[index][key] = data[key];
    }

    for (let i = 0; i < headerGroups.length; i++) {
      const value = CMCDController.serialize(headerGroups[i]);
      if (value) {
        headers[`CMCD-${headerNames[i]}`] = value;
      }
    }

    return headers;
  }

  /**
   * Convert a CMCD data object to query args according to the rules
   * defined in the section 2.2 and 3.2 of
   * [CTA-5004](https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf).
   */
  static toQuery(data: CMCD): string {
    return `CMCD=${encodeURIComponent(CMCDController.serialize(data))}`;
  }

  /**
   * Append query args to a uri.
   */
  static appendQueryToUri(uri, query) {
    if (!query) {
      return uri;
    }

    const separator = uri.includes('?') ? '&' : '?';
    return `${uri}${separator}${query}`;
  }
}
