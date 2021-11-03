import type Hls from '../hls';
import {
  BufferCreatedData,
  Fragment,
  FragmentLoaderContext,
  HlsConfig,
  LoaderContext,
  MediaAttachedData,
} from '../hls';
import {
  CMCD,
  CMCDHeaders,
  CMCDObjectType,
  CMCDStreamingFormat,
  CMCDVersion,
} from '../types/cmcd';
import type { ComponentAPI } from '../types/component-api';
import { logger } from '../utils/logger';
import { Events } from '../events';
import { BufferHelper } from '../utils/buffer-helper';

/**
 * Controller to deal with Common Media Client Data (CMCD)
 * @see https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf
 *
 * @class
 * @constructor
 */
export default class CMCDController implements ComponentAPI {
  private hls: Hls;
  private config: HlsConfig;
  private media?: HTMLMediaElement;
  private sid: string;
  private initialized: boolean = false;
  private starved: boolean = false;
  private buffering: boolean = true;
  private audioBuffer: any;
  private videoBuffer: any;

  /**
   * @constructs
   * @param {Hls} hls Our Hls.js instance
   */
  constructor(hls: Hls) {
    this.hls = hls;
    this.config = hls.config;
    this.sid = this.config.cmcdSessionId || CMCDController.uuid();
    this.registerListeners();
  }

  /**
   * @private
   */
  private registerListeners() {
    this.hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.on(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    this.hls.on(Events.BUFFER_CREATED, this.onBufferCreated, this);
  }

  /**
   * @private
   */
  private unregisterListeners() {
    this.hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.off(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    this.hls.off(Events.BUFFER_CREATED, this.onBufferCreated, this);

    this.onMediaDetached();
  }

  /**
   *
   */
  destroy() {
    this.unregisterListeners();

    // @ts-ignore
    this.hls = this.config = this.audioBuffer = this.videoBuffer = null;
  }

  /**
   * @private
   */
  private onMediaAttached(
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachedData
  ) {
    this.media = data.media;
    this.media.addEventListener('waiting', this.onWaiting);
    this.media.addEventListener('playing', this.onPlaying);
  }

  /**
   * @private
   */
  private onMediaDetached() {
    if (!this.media) {
      return;
    }

    this.media.removeEventListener('waiting', this.onWaiting);
    this.media.removeEventListener('playing', this.onPlaying);

    // @ts-ignore
    this.media = null;
  }

  /**
   * @private
   */
  private onBufferCreated(
    event: Events.BUFFER_CREATED,
    data: BufferCreatedData
  ) {
    this.audioBuffer = data.tracks.audio?.buffer;
    this.videoBuffer = data.tracks.video?.buffer;
  }

  /**
   * @private
   */
  private onWaiting = () => {
    if (this.initialized) {
      this.starved = true;
    }

    this.buffering = true;
  };

  /**
   * @private
   */
  private onPlaying = () => {
    if (!this.initialized) {
      this.initialized = true;
    }

    this.buffering = false;
  };

  /**
   * Create baseline CMCD data
   *
   * @return {CMCD}
   * @private
   */
  private createData() {
    return {
      v: CMCDVersion,
      sf: CMCDStreamingFormat.HLS,
      sid: this.sid,
      cid: this.config.cmcdContentId,
      pr: this.media?.playbackRate,
      mtp: this.hls.bandwidthEstimate / 1000,
    };
  }

  /**
   * Apply CMCD data to a request.
   *
   * @param {!LoaderContext} context The loader context
   * @param {!shaka.util.CmcdManager.Data} data The data object
   * @param {boolean} useHeaders Send data via request headers
   * @private
   */
  private apply(
    context: LoaderContext,
    data: CMCD = {},
    useHeaders = this.config.cmcdUseHeaders
  ) {
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

    if (useHeaders) {
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
   *
   * @param {!LoaderContext} context The loader context
   */
  applyPlaylistData(context: LoaderContext) {
    try {
      if (!this.config.cmcdEnabled) {
        return;
      }

      this.apply(context, {
        ot: CMCDObjectType.MANIFEST,
        su: !this.initialized,
      });
    } catch (error) {
      logger.warn('Could not generate manifest CMCD data.', error);
    }
  }

  /**
   * Apply CMCD data to a segment request
   *
   * @param {!LoaderContext} context
   */
  applyFragmentData(context: FragmentLoaderContext) {
    try {
      if (!this.config.cmcdEnabled) {
        return;
      }

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
        data.tb = this.getTopBandwidth(ot);
        data.bl = this.getBufferLength(ot);
      }

      this.apply(context, data);
    } catch (error) {
      logger.warn('Could not generate segment CMCD data.', error);
    }
  }

  /**
   * The CMCD object type.
   *
   * @param {FrameRequestCallback} fragment
   * @returns {CMCDObjectType?}
   * @private
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
   *
   * @returns {number}
   * @private
   */
  private getTopBandwidth(type: CMCDObjectType) {
    let bitrate: number = 0;

    const levels =
      type === CMCDObjectType.AUDIO ? this.hls.audioTracks : this.hls.levels;

    for (const level of levels) {
      if (level.bitrate > bitrate) {
        bitrate = level.bitrate;
      }
    }

    return bitrate > 0 ? bitrate : NaN;
  }

  /**
   * Get the buffer length for a media type in milliseconds
   *
   * @param {string} type
   * @return {number}
   * @private
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
   * Generate a random v4 UUI
   *
   * @returns {string}
   */
  static uuid(): string {
    const url = URL.createObjectURL(new Blob());
    const uuid = url.toString();
    URL.revokeObjectURL(url);
    return uuid.substr(uuid.lastIndexOf('/') + 1);
  }

  /**
   * Serialize a CMCD data object according to the rules defined in the
   * section 3.2 of
   * [CTA-5004](https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf).
   *
   * @param {CMCD} data The CMCD data object
   * @returns {string}
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

      if (type === 'string' && key !== 'ot' && key !== 'sf' && key !== 'st') {
        result = `${key}="${value.replace(/"/g, '"')}"`;
      } else if (type === 'boolean') {
        result = key;
      } else if (type === 'symbol') {
        result = `${key}=${value.description}`;
      } else {
        result = `${key}=${value}`;
      }

      results.push(result);
    }

    return results.join(',');
  }

  /**
   * Convert a CMCD data object to request headers according to the rules
   * defined in the section 2.1 and 3.2 of
   * [CTA-5004](https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf).
   *
   * @param {CMCD} data The CMCD data object
   * @returns {CMCDHeaders}
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
   *
   * @param {CMCD} data The CMCD data object
   * @returns {string}
   */
  static toQuery(data: CMCD): string {
    return `CMCD=${encodeURIComponent(CMCDController.serialize(data))}`;
  }

  /**
   * Append query args to a uri.
   *
   * @param {string} uri
   * @param {string} query
   * @returns {string}
   */
  static appendQueryToUri(uri, query) {
    if (!query) {
      return uri;
    }

    const separator = uri.includes('?') ? '&' : '?';
    return `${uri}${separator}${query}`;
  }
}
