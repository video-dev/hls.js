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
import type Hls from '../hls';
import type { BufferCodecsData, MediaAttachingData } from '../types/events';

export class HlsAssetPlayer {
  public readonly hls: Hls;
  public readonly interstitial: InterstitialEvent;
  public readonly assetItem: InterstitialAssetItem;
  public tracks: Partial<BufferCodecsData> | null = null;
  private hasDetails: boolean = false;
  private mediaAttached: HTMLMediaElement | null = null;
  private playoutOffset: number = 0;

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
        this.playoutOffset =
          event.assetList[event.assetList.indexOf(assetItem)]?.startOffset || 0;
        media.addEventListener('timeupdate', this.checkPlayout);
      }
    });
  }

  private checkPlayout = () => {
    const interstitial = this.interstitial;
    const playoutLimit = interstitial.playoutLimit;
    if (this.playoutOffset + this.currentTime >= playoutLimit) {
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
    return this.hls.media;
  }

  get bufferedEnd(): number {
    const media = this.media || this.mediaAttached;
    if (!media) {
      return 0;
    }
    const bufferInfo = BufferHelper.bufferInfo(media, media.currentTime, 0.001);
    return this.getAssetTime(bufferInfo.end);
  }

  get currentTime(): number {
    const media = this.media || this.mediaAttached;
    if (!media) {
      return 0;
    }
    return this.getAssetTime(media.currentTime);
  }

  get duration(): number {
    const duration = this.assetItem?.duration;
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

  get timelineOffset(): number {
    return this.hls.config.timelineOffset || 0;
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
      media.removeEventListener('timeupdate', this.checkPlayout);
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
    this.hls.detachMedia();
  }

  resumeBuffering() {
    this.hls.resumeBuffering();
  }

  pauseBuffering() {
    this.hls.pauseBuffering();
  }

  transferMedia() {
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
    return `HlsAssetPlayer: ${eventAssetToString(this.assetItem)} ${this.hls.sessionId} ${this.interstitial.appendInPlace ? 'append-in-place' : ''}`;
  }
}
