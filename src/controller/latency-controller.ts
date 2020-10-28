import LevelDetails from '../loader/level-details';
import { ErrorDetails } from '../errors';
import { Events } from '../events';
import { ErrorData, LevelUpdatedData, MediaAttachingData } from '../types/events';
import { logger } from '../utils/logger';
import type { ComponentAPI } from '../types/component-api';
import type Hls from '../hls';
import type { HlsConfig } from '../config';

// TODO: LatencyController config options:
//  - liveSyncOnStallIncrease
//  - maxLiveSyncOnStallIncrease

// TODO: LatencyController unit tests
//  - latency estimate

export default class LatencyController implements ComponentAPI {
  private readonly hls: Hls;
  private readonly config: HlsConfig;
  private media: HTMLMediaElement | null = null;
  private levelDetails: LevelDetails | null = null;
  private currentTime: number = 0;
  private stallCount: number = 0;
  private _latency: number | null = null;
  private timeupdateHandler = () => this.timeupdate();

  constructor (hls: Hls) {
    this.hls = hls;
    this.config = hls.config;
    this.registerListeners();
  }

  get latency (): number {
    return this._latency || 0;
  }

  get liveSyncPosition (): number | null {
    const liveEdge = this.estimateLiveEdge();
    const targetLatency = this.computeTargetLatency();
    if (liveEdge === null || targetLatency === null || this.levelDetails === null) {
      return null;
    }
    return Math.min(this.levelDetails.edge, liveEdge - targetLatency - this.edgeStalled);
  }

  get edgeStalled (): number {
    const { levelDetails } = this;
    if (levelDetails === null) {
      return 0;
    }
    const maxLevelUpdateAge = ((this.config.lowLatencyMode && levelDetails.partTarget) || levelDetails.targetduration) * 3;
    return Math.max(levelDetails.age - maxLevelUpdateAge, 0);
  }

  get maxLatency (): number {
    const { config, levelDetails } = this;
    if (levelDetails === null) {
      return 0;
    }
    return config.liveMaxLatencyDuration !== undefined
      ? config.liveMaxLatencyDuration
      : config.liveMaxLatencyDurationCount * levelDetails.targetduration;
  }

  public destroy (): void {
    this.unregisterListeners();
    this.onMediaDetaching();
  }

  private registerListeners () {
    this.hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    this.hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    this.hls.on(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
    this.hls.on(Events.ERROR, this.onError, this);
  }

  private unregisterListeners () {
    this.hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached);
    this.hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching);
    this.hls.off(Events.MANIFEST_LOADING, this.onManifestLoading);
    this.hls.off(Events.LEVEL_UPDATED, this.onLevelUpdated);
    this.hls.off(Events.ERROR, this.onError);
  }

  private onMediaAttached (event: Events.MEDIA_ATTACHED, data: MediaAttachingData) {
    this.media = data.media;
    this.media.addEventListener('timeupdate', this.timeupdateHandler);
  }

  private onMediaDetaching () {
    if (this.media) {
      this.media.removeEventListener('timeupdate', this.timeupdateHandler);
      this.media = null;
    }
  }

  private onManifestLoading () {
    this.levelDetails = null;
    this._latency = null;
    this.stallCount = 0;
  }

  private onLevelUpdated (event: Events.LEVEL_UPDATED, { details }: LevelUpdatedData) {
    this.levelDetails = details;
    if (details.advanced) {
      this.timeupdate();
    }
    if (!details.live && this.media) {
      this.media.removeEventListener('timeupdate', this.timeupdateHandler);
    }
  }

  private onError (event: Events.ERROR, data: ErrorData) {
    if (data.details !== ErrorDetails.BUFFER_STALLED_ERROR) {
      return;
    }
    this.stallCount++;
    logger.warn('[playback-rate-controller]: Stall detected, adjusting target latency');
  }

  private timeupdate () {
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

    const latencyTarget = this.computeTargetLatency();
    if (latencyTarget === null) {
      return;
    }
    const { minLiveSyncPlaybackRate, maxLiveSyncPlaybackRate } = this.config;
    if (minLiveSyncPlaybackRate === 1 && maxLiveSyncPlaybackRate === 1) {
      return;
    }
    const distanceFromTarget = latency - latencyTarget;
    if (distanceFromTarget && levelDetails.live) {
      const distanceFromEdge = levelDetails.edge - this.currentTime;
      const min = Math.min(1, Math.max(0.5, minLiveSyncPlaybackRate));
      if (distanceFromEdge > 0.5) {
        const max = Math.min(2, Math.max(1.0, maxLiveSyncPlaybackRate));
        const rate = 2 / (1 + Math.exp(-0.75 * distanceFromTarget - this.edgeStalled));
        media.playbackRate = Math.min(max, Math.max(min, rate));
      } else {
        media.playbackRate = Math.min(1, Math.max(min, media.playbackRate - 0.125));
      }
    } else if (media.playbackRate !== 1) {
      media.playbackRate = 1;
    }
  }

  private estimateLiveEdge (): number | null {
    const { levelDetails } = this;
    if (levelDetails === null) {
      return null;
    }
    return levelDetails.edge + levelDetails.age;
  }

  private computeLatency (): number | null {
    const liveEdge = this.estimateLiveEdge();
    if (liveEdge === null) {
      return null;
    }
    return liveEdge - this.currentTime;
  }

  public computeTargetLatency (): number | null {
    const { levelDetails } = this;
    if (levelDetails === null) {
      return null;
    }
    const { holdBack, partHoldBack, targetduration } = levelDetails;
    const { liveSyncDuration, liveSyncDurationCount, lowLatencyMode } = this.config;
    const userConfig = this.hls.userConfig;
    let targetLatency = lowLatencyMode ? partHoldBack || holdBack : holdBack;
    if (userConfig.liveSyncDuration || userConfig.liveSyncDurationCount || targetLatency === 0) {
      targetLatency = liveSyncDuration !== undefined ? liveSyncDuration : liveSyncDurationCount * targetduration;
    }
    const maxLiveSyncOnStallIncrease = levelDetails.targetduration;
    const liveSyncOnStallIncrease = 1.0;
    return targetLatency + Math.min(this.stallCount * liveSyncOnStallIncrease, maxLiveSyncOnStallIncrease);
  }
}
