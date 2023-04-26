import type Hls from '../hls';
import type { NetworkComponentAPI } from '../types/component-api';
import { getSkipValue, HlsSkip, HlsUrlParameters, Level } from '../types/level';
import { computeReloadInterval, mergeDetails } from './level-helper';
import { ErrorData } from '../types/events';
import { getRetryDelay, isTimeoutError } from '../utils/error-helper';
import { NetworkErrorAction } from './error-controller';
import { logger } from '../utils/logger';
import type { LevelDetails } from '../loader/level-details';
import type { MediaPlaylist } from '../types/media-playlist';
import type {
  AudioTrackLoadedData,
  LevelLoadedData,
  TrackLoadedData,
} from '../types/events';

export default class BasePlaylistController implements NetworkComponentAPI {
  protected hls: Hls;
  protected timer: number = -1;
  protected requestScheduled: number = -1;
  protected canLoad: boolean = false;
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

  protected clearTimer(): void {
    clearTimeout(this.timer);
    this.timer = -1;
  }

  public startLoad(): void {
    this.canLoad = true;
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
      let foundIndex = -1;
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
        // Use exact match. Otherwise, the last partial match, if any, will be used
        // (Playlist URI includes a query string that the Rendition Report does not)
        if (uri === playlistUri) {
          foundIndex = i;
          break;
        } else if (uri === playlistUri.substring(0, uri.length)) {
          foundIndex = i;
        }
      }
      if (foundIndex !== -1) {
        const attr = renditionReports[foundIndex];
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

  protected loadPlaylist(hlsUrlParameters?: HlsUrlParameters): void {
    if (this.requestScheduled === -1) {
      this.requestScheduled = self.performance.now();
    }
    // Loading is handled by the subclasses
  }

  protected shouldLoadPlaylist(
    playlist: Level | MediaPlaylist | null | undefined
  ): boolean {
    return (
      this.canLoad &&
      !!playlist &&
      !!playlist.url &&
      (!playlist.details || playlist.details.live)
    );
  }

  protected shouldReloadPlaylist(
    playlist: Level | MediaPlaylist | null | undefined
  ): boolean {
    return (
      this.timer === -1 &&
      this.requestScheduled === -1 &&
      this.shouldLoadPlaylist(playlist)
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
      let deliveryDirectives: HlsUrlParameters | undefined;
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
      } else if (details.canBlockReload) {
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
      if (details.updated && now > this.requestScheduled + reloadInterval) {
        this.requestScheduled = stats.loading.start;
      }

      if (msn !== undefined && details.canBlockReload) {
        this.requestScheduled =
          stats.loading.first +
          reloadInterval -
          (details.partTarget * 1000 || 1000);
      } else if (
        this.requestScheduled === -1 ||
        this.requestScheduled + reloadInterval < now
      ) {
        this.requestScheduled = now;
      } else if (this.requestScheduled - now <= 0) {
        this.requestScheduled += reloadInterval;
      }
      let estimatedTimeUntilUpdate = this.requestScheduled - now;
      estimatedTimeUntilUpdate = Math.max(0, estimatedTimeUntilUpdate);
      this.log(
        `reload live playlist ${index} in ${Math.round(
          estimatedTimeUntilUpdate
        )} ms`
      );
      // this.log(
      //   `live reload ${details.updated ? 'REFRESHED' : 'MISSED'}
      // reload in ${estimatedTimeUntilUpdate / 1000}
      // round trip ${(stats.loading.end - stats.loading.start) / 1000}
      // diff ${
      //   (reloadInterval -
      //     (estimatedTimeUntilUpdate +
      //       stats.loading.end -
      //       stats.loading.start)) /
      //   1000
      // }
      // reload interval ${reloadInterval / 1000}
      // target duration ${details.targetduration}
      // distance to edge ${distanceToLiveEdgeMs / 1000}`
      // );

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

  protected checkRetry(errorEvent: ErrorData): boolean {
    const errorDetails = errorEvent.details;
    const isTimeout = isTimeoutError(errorEvent);
    const errorAction = errorEvent.errorAction;
    const { action, retryCount = 0, retryConfig } = errorAction || {};
    const retry =
      !!errorAction &&
      !!retryConfig &&
      (action === NetworkErrorAction.RetryRequest ||
        (!errorAction.resolved &&
          action === NetworkErrorAction.SendAlternateToPenaltyBox));
    if (retry) {
      this.requestScheduled = -1;
      if (isTimeout && errorEvent.context?.deliveryDirectives) {
        // The LL-HLS request already timed out so retry immediately
        this.warn(
          `Retrying playlist loading ${retryCount + 1}/${
            retryConfig.maxNumRetry
          } after "${errorDetails}" without delivery-directives`
        );
        this.loadPlaylist();
      } else {
        const delay = getRetryDelay(retryConfig, retryCount);
        // Schedule level/track reload
        this.timer = self.setTimeout(() => this.loadPlaylist(), delay);
        this.warn(
          `Retrying playlist loading ${retryCount + 1}/${
            retryConfig.maxNumRetry
          } after "${errorDetails}" in ${delay}ms`
        );
      }
      // `levelRetry = true` used to inform other controllers that a retry is happening
      errorEvent.levelRetry = true;
      errorAction.resolved = true;
    }
    return retry;
  }
}
