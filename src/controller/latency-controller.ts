import { LevelDetails } from '../loader/level-details';
import { ErrorDetails } from '../errors';
import { Events } from '../events';
import type {
  ErrorData,
  LevelUpdatedData,
  MediaAttachingData,
} from '../types/events';
import { logger } from '../utils/logger';
import type { ComponentAPI } from '../types/component-api';
import type Hls from '../hls';
import type { HlsConfig } from '../config';

export default class LatencyController implements ComponentAPI {
  private hls: Hls;
  private readonly config: HlsConfig;
  private media: HTMLMediaElement | null = null;
  private levelDetails: LevelDetails | null = null;
  private currentTime: number = 0;
  private stallCount: number = 0;
  private _latency: number | null = null;
  private timeupdateHandler = () => this.timeupdate();

  constructor(hls: Hls) {
    this.hls = hls;
    this.config = hls.config;
    this.registerListeners();
  }

  get latency(): number {
    return this._latency || 0;
  }

  get maxLatency(): number {
    const { config, levelDetails } = this;
    if (config.liveMaxLatencyDuration !== undefined) {
      return config.liveMaxLatencyDuration;
    }
    return levelDetails
      ? config.liveMaxLatencyDurationCount * levelDetails.targetduration
      : 0;
  }

  get targetLatency(): number | null {
    const { levelDetails } = this;
    if (levelDetails === null) {
      return null;
    }
    const { holdBack, partHoldBack, targetduration } = levelDetails;
    const { liveSyncDuration, liveSyncDurationCount, lowLatencyMode } =
      this.config;
    const userConfig = this.hls.userConfig;
    let targetLatency = lowLatencyMode ? partHoldBack || holdBack : holdBack;
    if (
      userConfig.liveSyncDuration ||
      userConfig.liveSyncDurationCount ||
      targetLatency === 0
    ) {
      targetLatency =
        liveSyncDuration !== undefined
          ? liveSyncDuration
          : liveSyncDurationCount * targetduration;
    }
    const maxLiveSyncOnStallIncrease = targetduration;
    const liveSyncOnStallIncrease = 1.0;
    return (
      targetLatency +
      Math.min(
        this.stallCount * liveSyncOnStallIncrease,
        maxLiveSyncOnStallIncrease,
      )
    );
  }

  get liveSyncPosition(): number | null {
    const liveEdge = this.estimateLiveEdge();
    const targetLatency = this.targetLatency;
    const levelDetails = this.levelDetails;
    if (liveEdge === null || targetLatency === null || levelDetails === null) {
      return null;
    }
    const edge = levelDetails.edge;
    const syncPosition = liveEdge - targetLatency - this.edgeStalled;
    const min = edge - levelDetails.totalduration;
    const max =
      edge -
      ((this.config.lowLatencyMode && levelDetails.partTarget) ||
        levelDetails.targetduration);
    return Math.min(Math.max(min, syncPosition), max);
  }

  get drift(): number {
    const { levelDetails } = this;
    if (levelDetails === null) {
      return 1;
    }
    return levelDetails.drift;
  }

  get edgeStalled(): number {
    const { levelDetails } = this;
    if (levelDetails === null) {
      return 0;
    }
    const maxLevelUpdateAge =
      ((this.config.lowLatencyMode && levelDetails.partTarget) ||
        levelDetails.targetduration) * 3;
    return Math.max(levelDetails.age - maxLevelUpdateAge, 0);
  }

  private get forwardBufferLength(): number {
    const { media, levelDetails } = this;
    if (!media || !levelDetails) {
      return 0;
    }
    const bufferedRanges = media.buffered.length;
    return (
      (bufferedRanges
        ? media.buffered.end(bufferedRanges - 1)
        : levelDetails.edge) - this.currentTime
    );
  }

  public destroy(): void {
    this.unregisterListeners();
    this.onMediaDetaching();
    this.levelDetails = null;
    // @ts-ignore
    this.hls = this.timeupdateHandler = null;
  }

  private registerListeners() {
    this.hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    this.hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    this.hls.on(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
    this.hls.on(Events.ERROR, this.onError, this);
  }

  private unregisterListeners() {
    this.hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    this.hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    this.hls.off(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
    this.hls.off(Events.ERROR, this.onError, this);
  }

  private onMediaAttached(
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachingData,
  ) {
    this.media = data.media;
    this.media.addEventListener('timeupdate', this.timeupdateHandler);
  }

  private onMediaDetaching() {
    if (this.media) {
      this.media.removeEventListener('timeupdate', this.timeupdateHandler);
      this.media = null;
    }
  }

  private onManifestLoading() {
    this.levelDetails = null;
    this._latency = null;
    this.stallCount = 0;
  }

  private onLevelUpdated(
    event: Events.LEVEL_UPDATED,
    { details }: LevelUpdatedData,
  ) {
    this.levelDetails = details;
    if (details.advanced) {
      this.timeupdate();
    }
    if (!details.live && this.media) {
      this.media.removeEventListener('timeupdate', this.timeupdateHandler);
    }
  }

  private onError(event: Events.ERROR, data: ErrorData) {
    if (data.details !== ErrorDetails.BUFFER_STALLED_ERROR) {
      return;
    }
    this.stallCount++;
    if (this.levelDetails?.live) {
      logger.warn(
        '[playback-rate-controller]: Stall detected, adjusting target latency',
      );
    }
  }

  private timeupdate() {
    const { media, levelDetails } = this;
    if (!media || !levelDetails) {
      return;
    }
    this.currentTime = media.currentTime;

    const latency = this.computeLatency();
    if (latency === null) {
      return;
    }
    this._latency = latency;

    // Adapt playbackRate to meet target latency in low-latency mode
    const { lowLatencyMode, maxLiveSyncPlaybackRate } = this.config;
    if (
      !lowLatencyMode ||
      maxLiveSyncPlaybackRate === 1 ||
      !levelDetails.live
    ) {
      return;
    }
    const targetLatency = this.targetLatency;
    if (targetLatency === null) {
      return;
    }
    const distanceFromTarget = latency - targetLatency;
    // Only adjust playbackRate when within one target duration of targetLatency
    // and more than one second from under-buffering.
    // Playback further than one target duration from target can be considered DVR playback.
    const liveMinLatencyDuration = Math.min(
      this.maxLatency,
      targetLatency + levelDetails.targetduration,
    );
    const inLiveRange = distanceFromTarget < liveMinLatencyDuration;

    if (
      inLiveRange &&
      distanceFromTarget > 0.05 &&
      this.forwardBufferLength > 1
    ) {
      const max = Math.min(2, Math.max(1.0, maxLiveSyncPlaybackRate));
      const rate =
        Math.round(
          (2 / (1 + Math.exp(-0.75 * distanceFromTarget - this.edgeStalled))) *
            20,
        ) / 20;
      media.playbackRate = Math.min(max, Math.max(1, rate));
    } else if (media.playbackRate !== 1 && media.playbackRate !== 0) {
      media.playbackRate = 1;
    }
  }

  private estimateLiveEdge(): number | null {
    const { levelDetails } = this;
    if (levelDetails === null) {
      return null;
    }
    return levelDetails.edge + levelDetails.age;
  }

  private computeLatency(): number | null {
    const liveEdge = this.estimateLiveEdge();
    if (liveEdge === null) {
      return null;
    }
    return liveEdge - this.currentTime;
  }
}
