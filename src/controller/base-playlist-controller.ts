import type Hls from '../hls';
import type { NetworkComponentAPI } from '../types/component-api';
import { getSkipValue, HlsSkip, HlsUrlParameters } from '../types/level';
import { computeReloadInterval, mergeDetails } from './level-helper';
import { logger } from '../utils/logger';
import type { LevelDetails } from '../loader/level-details';
import type { MediaPlaylist } from '../types/media-playlist';
import type {
  AudioTrackLoadedData,
  LevelLoadedData,
  TrackLoadedData,
} from '../types/events';
import { ErrorData } from '../types/events';
import { Events } from '../events';
import { ErrorTypes } from '../errors';

export default class BasePlaylistController implements NetworkComponentAPI {
  protected hls: Hls;
  protected timer: number = -1;
  protected requestScheduled: number = -1;
  protected canLoad: boolean = false;
  protected retryCount: number = 0;
  protected log: (msg: any) => void;
  protected warn: (msg: any) => void;

  constructor(hls: Hls, logPrefix: string) {
    this.log = logger.log.bind(logger, `${logPrefix}:`);
    this.warn = logger.warn.bind(logger, `${logPrefix}:`);
    this.hls = hls;
  }

  public destroy(): void {
    this.clearTimer();
    // @ts-ignore
    this.hls = this.log = this.warn = null;
  }

  protected onError(event: Events.ERROR, data: ErrorData): void {
    if (
      data.fatal &&
      (data.type === ErrorTypes.NETWORK_ERROR ||
        data.type === ErrorTypes.KEY_SYSTEM_ERROR)
    ) {
      this.stopLoad();
    }
  }

  protected clearTimer(): void {
    clearTimeout(this.timer);
    this.timer = -1;
  }

  public startLoad(): void {
    this.canLoad = true;
    this.retryCount = 0;
    this.requestScheduled = -1;
    this.loadPlaylist();
  }

  public stopLoad(): void {
    this.canLoad = false;
    this.clearTimer();
  }

  protected switchParams(
    playlistUri: string,
    previous: LevelDetails | undefined
  ): HlsUrlParameters | undefined {
    const renditionReports = previous?.renditionReports;
    if (renditionReports) {
      for (let i = 0; i < renditionReports.length; i++) {
        const attr = renditionReports[i];
        let uri: string;
        try {
          uri = new self.URL(attr.URI, previous.url).href;
        } catch (error) {
          logger.warn(
            `Could not construct new URL for Rendition Report: ${error}`
          );
          uri = attr.URI || '';
        }
        if (uri === playlistUri.slice(-uri.length)) {
          const msn = parseInt(attr['LAST-MSN']) || previous?.lastPartSn;
          let part = parseInt(attr['LAST-PART']) || previous?.lastPartIndex;
          if (this.hls.config.lowLatencyMode) {
            const currentGoal = Math.min(
              previous.age - previous.partTarget,
              previous.targetduration
            );
            if (part >= 0 && currentGoal > previous.partTarget) {
              part += 1;
            }
          }
          return new HlsUrlParameters(
            msn,
            part >= 0 ? part : undefined,
            HlsSkip.No
          );
        }
      }
    }
  }

  protected loadPlaylist(hlsUrlParameters?: HlsUrlParameters): void {
    if (this.requestScheduled === -1) {
      this.requestScheduled = self.performance.now();
    }
  }

  protected shouldLoadTrack(track: MediaPlaylist): boolean {
    return (
      this.canLoad &&
      track &&
      !!track.url &&
      (!track.details || track.details.live)
    );
  }

  protected playlistLoaded(
    index: number,
    data: LevelLoadedData | AudioTrackLoadedData | TrackLoadedData,
    previousDetails?: LevelDetails
  ) {
    const { details, stats } = data;

    // Set last updated date-time
    const now = self.performance.now();
    const elapsed = stats.loading.first
      ? Math.max(0, now - stats.loading.first)
      : 0;
    details.advancedDateTime = Date.now() - elapsed;

    // if current playlist is a live playlist, arm a timer to reload it
    if (details.live || previousDetails?.live) {
      details.reloaded(previousDetails);
      if (previousDetails) {
        this.log(
          `live playlist ${index} ${
            details.advanced
              ? 'REFRESHED ' + details.lastPartSn + '-' + details.lastPartIndex
              : 'MISSED'
          }`
        );
      }
      // Merge live playlists to adjust fragment starts and fill in delta playlist skipped segments
      if (previousDetails && details.fragments.length > 0) {
        mergeDetails(previousDetails, details);
      }
      if (!this.canLoad || !details.live) {
        return;
      }
      let deliveryDirectives: HlsUrlParameters;
      let msn: number | undefined = undefined;
      let part: number | undefined = undefined;
      if (details.canBlockReload && details.endSN && details.advanced) {
        // Load level with LL-HLS delivery directives
        const lowLatencyMode = this.hls.config.lowLatencyMode;
        const lastPartSn = details.lastPartSn;
        const endSn = details.endSN;
        const lastPartIndex = details.lastPartIndex;
        const hasParts = lastPartIndex !== -1;
        const lastPart = lastPartSn === endSn;
        // When low latency mode is disabled, we'll skip part requests once the last part index is found
        const nextSnStartIndex = lowLatencyMode ? 0 : lastPartIndex;
        if (hasParts) {
          msn = lastPart ? endSn + 1 : lastPartSn;
          part = lastPart ? nextSnStartIndex : lastPartIndex + 1;
        } else {
          msn = endSn + 1;
        }
        // Low-Latency CDN Tune-in: "age" header and time since load indicates we're behind by more than one part
        // Update directives to obtain the Playlist that has the estimated additional duration of media
        const lastAdvanced = details.age;
        const cdnAge = lastAdvanced + details.ageHeader;
        let currentGoal = Math.min(
          cdnAge - details.partTarget,
          details.targetduration * 1.5
        );
        if (currentGoal > 0) {
          if (previousDetails && currentGoal > previousDetails.tuneInGoal) {
            // If we attempted to get the next or latest playlist update, but currentGoal increased,
            // then we either can't catchup, or the "age" header cannot be trusted.
            this.warn(
              `CDN Tune-in goal increased from: ${previousDetails.tuneInGoal} to: ${currentGoal} with playlist age: ${details.age}`
            );
            currentGoal = 0;
          } else {
            const segments = Math.floor(currentGoal / details.targetduration);
            msn += segments;
            if (part !== undefined) {
              const parts = Math.round(
                (currentGoal % details.targetduration) / details.partTarget
              );
              part += parts;
            }
            this.log(
              `CDN Tune-in age: ${
                details.ageHeader
              }s last advanced ${lastAdvanced.toFixed(
                2
              )}s goal: ${currentGoal} skip sn ${segments} to part ${part}`
            );
          }
          details.tuneInGoal = currentGoal;
        }
        deliveryDirectives = this.getDeliveryDirectives(
          details,
          data.deliveryDirectives,
          msn,
          part
        );
        if (lowLatencyMode || !lastPart) {
          this.loadPlaylist(deliveryDirectives);
          return;
        }
      } else {
        deliveryDirectives = this.getDeliveryDirectives(
          details,
          data.deliveryDirectives,
          msn,
          part
        );
      }
      const bufferInfo = this.hls.mainForwardBufferInfo;
      const position = bufferInfo ? bufferInfo.end - bufferInfo.len : 0;
      const distanceToLiveEdgeMs = (details.edge - position) * 1000;
      const reloadInterval = computeReloadInterval(
        details,
        distanceToLiveEdgeMs
      );
      if (!details.updated) {
        this.requestScheduled = -1;
      } else if (now > this.requestScheduled + reloadInterval) {
        this.requestScheduled = stats.loading.start;
      }

      if (msn !== undefined && details.canBlockReload) {
        this.requestScheduled =
          stats.loading.first +
          reloadInterval -
          (details.partTarget * 1000 || 1000);
      } else {
        this.requestScheduled =
          (this.requestScheduled === -1 ? now : this.requestScheduled) +
          reloadInterval;
      }
      let estimatedTimeUntilUpdate = this.requestScheduled - now;
      estimatedTimeUntilUpdate = Math.max(0, estimatedTimeUntilUpdate);
      this.log(
        `reload live playlist ${index} in ${Math.round(
          estimatedTimeUntilUpdate
        )} ms`
      );
      //     this.log(
      //       `live reload ${details.updated ? 'REFRESHED' : 'MISSED'}
      // reload in ${estimatedTimeUntilUpdate / 1000}
      // round trip ${(stats.loading.end - stats.loading.start) / 1000}
      // diff ${
      //   (reloadInterval -
      //     (estimatedTimeUntilUpdate + stats.loading.end - stats.loading.start)) /
      //   1000
      // }
      // reload interval ${reloadInterval / 1000}
      // target duration ${details.targetduration}
      // distance to edge ${distanceToLiveEdgeMs / 1000}`
      //     );

      this.timer = self.setTimeout(
        () => this.loadPlaylist(deliveryDirectives),
        estimatedTimeUntilUpdate
      );
    } else {
      this.clearTimer();
    }
  }

  private getDeliveryDirectives(
    details: LevelDetails,
    previousDeliveryDirectives: HlsUrlParameters | null,
    msn?: number,
    part?: number
  ): HlsUrlParameters {
    let skip = getSkipValue(details, msn);
    if (previousDeliveryDirectives?.skip && details.deltaUpdateFailed) {
      msn = previousDeliveryDirectives.msn;
      part = previousDeliveryDirectives.part;
      skip = HlsSkip.No;
    }
    return new HlsUrlParameters(msn, part, skip);
  }

  protected retryLoadingOrFail(errorEvent: ErrorData): boolean {
    const { config } = this.hls;
    const retry = this.retryCount < config.levelLoadingMaxRetry;
    if (retry) {
      this.requestScheduled = -1;
      this.retryCount++;
      if (
        errorEvent.details.indexOf('LoadTimeOut') > -1 &&
        errorEvent.context?.deliveryDirectives
      ) {
        // The LL-HLS request already timed out so retry immediately
        this.warn(
          `retry playlist loading #${this.retryCount} after "${errorEvent.details}"`
        );
        this.loadPlaylist();
      } else {
        // exponential backoff capped to max retry timeout
        const delay = Math.min(
          Math.pow(2, this.retryCount) * config.levelLoadingRetryDelay,
          config.levelLoadingMaxRetryTimeout
        );
        // Schedule level/track reload
        this.timer = self.setTimeout(() => this.loadPlaylist(), delay);
        this.warn(
          `retry playlist loading #${this.retryCount} in ${delay} ms after "${errorEvent.details}"`
        );
      }
    } else {
      this.warn(`cannot recover from error "${errorEvent.details}"`);
      // stopping live reloading timer if any
      this.clearTimer();
      // switch error to fatal
      errorEvent.fatal = true;
    }
    return retry;
  }
}
