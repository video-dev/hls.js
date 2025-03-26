import { Events, type HlsListeners } from '../events';
import {
  eventAssetToString,
  getInterstitialUrl,
  type InterstitialAssetId,
  type InterstitialAssetItem,
  type InterstitialEvent,
  type InterstitialId,
} from '../loader/interstitial-event';
import { BufferHelper } from '../utils/buffer-helper';
import type { HlsConfig } from '../config';
import type { InterstitialScheduleEventItem } from '../controller/interstitials-schedule';
import type Hls from '../hls';
import type { BufferCodecsData, MediaAttachingData } from '../types/events';

export interface InterstitialPlayer {
  currentTime: number;
  duration: number;
  assetPlayers: (HlsAssetPlayer | null)[];
  playingIndex: number;
  scheduleItem: InterstitialScheduleEventItem | null;
}
export class HlsAssetPlayer {
  public readonly hls: Hls;
  public readonly interstitial: InterstitialEvent;
  public readonly assetItem: InterstitialAssetItem;
  public tracks: Partial<BufferCodecsData> | null = null;
  private hasDetails: boolean = false;
  private mediaAttached: HTMLMediaElement | null = null;
  private _currentTime?: number;
  private _bufferedEosTime?: number;

  constructor(
    HlsPlayerClass: typeof Hls,
    userConfig: Partial<HlsConfig>,
    interstitial: InterstitialEvent,
    assetItem: InterstitialAssetItem,
  ) {
    const hls = (this.hls = new HlsPlayerClass(userConfig));
    this.interstitial = interstitial;
    this.assetItem = assetItem;
    let uri: string = assetItem.uri;
    try {
      uri = getInterstitialUrl(uri, hls.sessionId).href;
    } catch (error) {
      // Ignore error parsing ASSET_URI or adding _HLS_primary_id to it. The
      // issue should surface as an INTERSTITIAL_ASSET_ERROR loading the asset.
    }
    hls.loadSource(uri);
    const detailsLoaded = () => {
      this.hasDetails = true;
    };
    hls.once(Events.LEVEL_LOADED, detailsLoaded);
    hls.once(Events.AUDIO_TRACK_LOADED, detailsLoaded);
    hls.once(Events.SUBTITLE_TRACK_LOADED, detailsLoaded);
    hls.on(Events.MEDIA_ATTACHING, (name, { media }) => {
      this.removeMediaListeners();
      this.mediaAttached = media;
      const event = this.interstitial;
      if (event.playoutLimit) {
        media.addEventListener('timeupdate', this.checkPlayout);
      }
    });
  }

  bufferedInPlaceToEnd(media?: HTMLMediaElement | null) {
    if (!this.interstitial.appendInPlace) {
      return false;
    }
    if (this.hls?.bufferedToEnd) {
      return true;
    }
    if (!media || !this._bufferedEosTime) {
      return false;
    }
    const start = this.timelineOffset;
    const bufferInfo = BufferHelper.bufferInfo(media, start, 0);
    const bufferedEnd = this.getAssetTime(bufferInfo.end);
    return bufferedEnd >= this._bufferedEosTime - 0.02;
  }

  private checkPlayout = () => {
    const interstitial = this.interstitial;
    const playoutLimit = interstitial.playoutLimit;
    const currentTime = this.currentTime;
    if (this.startOffset + currentTime >= playoutLimit) {
      this.hls.trigger(Events.PLAYOUT_LIMIT_REACHED, {});
    }
  };

  get destroyed(): boolean {
    return !this.hls?.userConfig;
  }

  get assetId(): InterstitialAssetId {
    return this.assetItem.identifier;
  }

  get interstitialId(): InterstitialId {
    return this.assetItem.parentIdentifier;
  }

  get media(): HTMLMediaElement | null {
    return this.hls?.media || null;
  }

  get bufferedEnd(): number {
    const media = this.media || this.mediaAttached;
    if (!media) {
      if (this._bufferedEosTime) {
        return this._bufferedEosTime;
      }
      return this.currentTime;
    }
    const bufferInfo = BufferHelper.bufferInfo(media, media.currentTime, 0.001);
    return this.getAssetTime(bufferInfo.end);
  }

  get currentTime(): number {
    const media = this.media || this.mediaAttached;
    if (!media) {
      return this._currentTime || 0;
    }
    return this.getAssetTime(media.currentTime);
  }

  get duration(): number {
    const duration = this.assetItem.duration;
    if (!duration) {
      return 0;
    }
    return duration;
  }

  get remaining(): number {
    const duration = this.duration;
    if (!duration) {
      return 0;
    }
    return Math.max(0, duration - this.currentTime);
  }

  get startOffset(): number {
    return this.assetItem.startOffset;
  }

  get timelineOffset(): number {
    return this.hls?.config.timelineOffset || 0;
  }

  set timelineOffset(value: number) {
    const timelineOffset = this.timelineOffset;
    if (value !== timelineOffset) {
      const diff = value - timelineOffset;
      if (Math.abs(diff) > 1 / 90000) {
        if (this.hasDetails) {
          throw new Error(
            `Cannot set timelineOffset after playlists are loaded`,
          );
        }
        this.hls.config.timelineOffset = value;
      }
    }
  }

  private getAssetTime(time: number): number {
    const timelineOffset = this.timelineOffset;
    const duration = this.duration;
    return Math.min(Math.max(0, time - timelineOffset), duration);
  }

  private removeMediaListeners() {
    const media = this.mediaAttached;
    if (media) {
      this._currentTime = media.currentTime;
      this.bufferSnapShot();
      media.removeEventListener('timeupdate', this.checkPlayout);
    }
  }

  private bufferSnapShot() {
    if (this.mediaAttached) {
      if (this.hls?.bufferedToEnd) {
        this._bufferedEosTime = this.bufferedEnd;
      }
    }
  }

  destroy() {
    this.removeMediaListeners();
    this.hls.destroy();
    // @ts-ignore
    this.hls = this.interstitial = null;
    // @ts-ignore
    this.tracks = this.mediaAttached = this.checkPlayout = null;
  }

  attachMedia(data: HTMLMediaElement | MediaAttachingData) {
    this.hls.attachMedia(data);
  }

  detachMedia() {
    this.removeMediaListeners();
    this.mediaAttached = null;
    this.hls.detachMedia();
  }

  resumeBuffering() {
    this.hls.resumeBuffering();
  }

  pauseBuffering() {
    this.hls.pauseBuffering();
  }

  transferMedia() {
    this.bufferSnapShot();
    return this.hls.transferMedia();
  }

  on<E extends keyof HlsListeners, Context = undefined>(
    event: E,
    listener: HlsListeners[E],
    context?: Context,
  ) {
    this.hls.on(event, listener);
  }

  once<E extends keyof HlsListeners, Context = undefined>(
    event: E,
    listener: HlsListeners[E],
    context?: Context,
  ) {
    this.hls.once(event, listener);
  }

  off<E extends keyof HlsListeners, Context = undefined>(
    event: E,
    listener: HlsListeners[E],
    context?: Context,
  ) {
    this.hls.off(event, listener);
  }

  toString(): string {
    return `HlsAssetPlayer: ${eventAssetToString(this.assetItem)} ${this.hls?.sessionId} ${this.interstitial?.appendInPlace ? 'append-in-place' : ''}`;
  }
}
