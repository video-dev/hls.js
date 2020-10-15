import LevelDetails from '../loader/level-details';
import { ErrorDetails } from '../errors';
import { Events } from '../events';
import { ErrorData, LevelUpdatedData, MediaAttachingData } from '../types/events';
import { logger } from '../utils/logger';
import type { ComponentAPI } from '../types/component-api';
import type Hls from '../hls';
import type { HlsConfig } from '../config';

// TODO: LatencyController config options:
//  - maxLiveSyncPlaybackRate
//  - minLiveSyncPlaybackRate
//  - maxLevelUpdateAge (rename or existing option we could use?)
//  - adjustLatencyOnErrorMax
//  - liveSyncOnStallIncrease
//  - maxLiveSyncOnStallIncrease
const L = 1.5; // Change playback rate by up to 1.5x
const k = 0.75;
const sigmoid = (x, x0) => L / (1 + Math.exp(-k * (x - x0)));

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
    const maxLevelUpdateAge = this.levelDetails.targetduration * 3;
    const edgeStalled = Math.max(this.levelDetails.age - maxLevelUpdateAge, 0);
    return Math.min(this.levelDetails.edge, liveEdge - targetLatency - edgeStalled);
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
    const distance = latency - latencyTarget;
    if (distance && levelDetails.live) {
      media.playbackRate = Math.max(0.1, sigmoid(latency, latencyTarget));
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

  private computeTargetLatency (): number | null {
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
