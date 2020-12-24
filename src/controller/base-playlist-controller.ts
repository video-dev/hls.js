import type Hls from '../hls';
import type { NetworkComponentAPI } from '../types/component-api';
import { getSkipValue, HlsSkip, HlsUrlParameters } from '../types/level';
import { computeReloadInterval } from './level-helper';
import { logger } from '../utils/logger';
import type LevelDetails from '../loader/level-details';
import type { MediaPlaylist } from '../types/media-playlist';
import type {
  AudioTrackLoadedData,
  LevelLoadedData,
  TrackLoadedData,
} from '../types/events';
import { ErrorData } from '../types/events';
import * as LevelHelper from './level-helper';
import { Events } from '../events';
import { ErrorTypes } from '../errors';

export default class BasePlaylistController implements NetworkComponentAPI {
  protected hls: Hls;
  protected timer: number = -1;
  protected canLoad: boolean = false;
  protected retryCount: number = 0;
  protected readonly log: (msg: any) => void;
  protected readonly warn: (msg: any) => void;

  constructor(hls: Hls, logPrefix: string) {
    this.log = logger.log.bind(logger, `${logPrefix}:`);
    this.warn = logger.warn.bind(logger, `${logPrefix}:`);
    this.hls = hls;
  }

  public destroy(): void {
    this.clearTimer();
  }

  protected onError(event: Events.ERROR, data: ErrorData): void {
    if (data.fatal && data.type === ErrorTypes.NETWORK_ERROR) {
      this.clearTimer();
    }
  }

  protected clearTimer(): void {
    clearTimeout(this.timer);
    this.timer = -1;
  }

  public startLoad(): void {
    this.canLoad = true;
    this.retryCount = 0;
    this.loadPlaylist();
  }

  public stopLoad(): void {
    this.canLoad = false;
    this.clearTimer();
  }

  protected switchParams(
    playlistUri: string,
    previous?: LevelDetails
  ): HlsUrlParameters | undefined {
    const renditionReports = previous?.renditionReports;
    if (renditionReports) {
      for (let i = 0; i < renditionReports.length; i++) {
        const attr = renditionReports[i];
        const uri = '' + attr.URI;
        if (uri === playlistUri.substr(-uri.length)) {
          const msn = parseInt(attr['LAST-MSN']);
          let part = parseInt(attr['LAST-PART']);
          if (previous && this.hls.config.lowLatencyMode) {
            const currentGoal = Math.min(
              previous.age - previous.partTarget,
              previous.targetduration
            );
            if (part !== undefined && currentGoal > previous.partTarget) {
              part += 1;
            }
          }
          if (Number.isFinite(msn)) {
            return new HlsUrlParameters(
              msn,
              Number.isFinite(part) ? part : undefined,
              HlsSkip.No
            );
          }
        }
      }
    }
  }

  protected loadPlaylist(hlsUrlParameters?: HlsUrlParameters): void {}

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
    const elapsed = stats.loading.end
      ? Math.max(0, self.performance.now() - stats.loading.end)
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
        LevelHelper.mergeDetails(previousDetails, details);
        if (!details.advanced) {
          details.advancedDateTime = previousDetails.advancedDateTime;
        }
      }
      if (!this.canLoad || !details.live) {
        return;
      }
      if (details.canBlockReload && details.endSN && details.advanced) {
        // Load level with LL-HLS delivery directives
        const lowLatencyMode = this.hls.config.lowLatencyMode;
        const lastPartIndex = details.lastPartIndex;
        let msn;
        let part;
        if (lowLatencyMode) {
          msn = lastPartIndex !== -1 ? details.lastPartSn : details.endSN + 1;
          part = lastPartIndex !== -1 ? lastPartIndex + 1 : undefined;
        } else {
          // This playlist update will be late by one part (0). There is no way to know the last part number,
          // or request just the next sn without a part in most implementations.
          msn =
            lastPartIndex !== -1 ? details.lastPartSn + 1 : details.endSN + 1;
          part = lastPartIndex !== -1 ? 0 : undefined;
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
        let skip = getSkipValue(details, msn);
        if (data.deliveryDirectives?.skip) {
          if (details.deltaUpdateFailed) {
            msn = data.deliveryDirectives.msn;
            part = data.deliveryDirectives.part;
            skip = HlsSkip.No;
          }
        }
        this.loadPlaylist(new HlsUrlParameters(msn, part, skip));
        return;
      }
      const reloadInterval = computeReloadInterval(details, stats);
      this.log(
        `reload live playlist ${index} in ${Math.round(reloadInterval)} ms`
      );
      this.timer = self.setTimeout(() => this.loadPlaylist(), reloadInterval);
    } else {
      this.clearTimer();
    }
  }

  protected retryLoadingOrFail(errorEvent: ErrorData): boolean {
    const { config } = this.hls;
    const retry = this.retryCount < config.levelLoadingMaxRetry;
    if (retry) {
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
