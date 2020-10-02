import Hls from '../hls';
import { NetworkComponentAPI } from '../types/component-api';
import { getSkipValue, HlsSkip, HlsUrlParameters } from '../types/level';
import { computeReloadInterval } from './level-helper';
import { logger } from '../utils/logger';
import type LevelDetails from '../loader/level-details';
import type { MediaPlaylist } from '../types/media-playlist';
import type { AudioTrackLoadedData, LevelLoadedData, TrackLoadedData } from '../types/events';
import { ErrorData } from '../types/events';
import * as LevelHelper from './level-helper';

export default class BasePlaylistController implements NetworkComponentAPI {
  protected hls: Hls;
  protected timer: number = -1;
  protected canLoad: boolean = false;
  protected retryCount: number = 0;

  constructor (hls: Hls) {
    this.hls = hls;
  }

  public destroy (): void {
    this.clearTimer();
  }

  protected clearTimer (): void {
    clearTimeout(this.timer);
    this.timer = -1;
  }

  public startLoad (): void {
    this.canLoad = true;
    this.retryCount = 0;
    this.loadPlaylist();
  }

  public stopLoad (): void {
    this.canLoad = false;
    this.clearTimer();
  }

  protected loadPlaylist (hlsUrlParameters?: HlsUrlParameters): void {}

  protected shouldLoadTrack (track: MediaPlaylist): boolean {
    return this.canLoad && track && !!track.url && (!track.details || track.details.live);
  }

  protected playlistLoaded (index: number, data: LevelLoadedData | AudioTrackLoadedData | TrackLoadedData, previousDetails?: LevelDetails) {
    const { details, stats } = data;

    // if current playlist is a live playlist, arm a timer to reload it
    if (details.live) {
      details.reloaded(previousDetails);
      if (previousDetails) {
        logger.log(`[${this.constructor.name}] live playlist ${index} ${details.advanced ? ('REFRESHED ' + details.lastPartSn + '-' + details.lastPartIndex) : 'MISSED'}`);
      }
      // Merge live playlists to adjust fragment starts and fill in delta playlist skipped segments
      if (previousDetails && details.fragments.length > 0) {
        LevelHelper.mergeDetails(previousDetails, details);
      }
      if (!this.canLoad) {
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
          msn = lastPartIndex !== -1 ? details.lastPartSn + 1 : details.endSN + 1;
          part = lastPartIndex !== -1 ? 0 : undefined;
        }
        // Low-Latency CDN Tune-in: "age" header and time since load indicates we're behind by more than one part
        // Update directives to obtain the Playlist that has the estimated additional duration of media
        let currentGoal = Math.min(details.age - details.partTarget, details.targetduration * 1.5);
        if (currentGoal > 0) {
          if (previousDetails && currentGoal > previousDetails.tuneInGoal) {
            // If we attempted to get the next or latest playlist update, but currentGoal increased,
            // then we either can't catchup, or the "age" header cannot be trusted.
            logger.warn(`[${this.constructor.name}] CDN Tune-in goal increased from: ${previousDetails.tuneInGoal} to: ${currentGoal} with playlist age: ${details.age}`);
            currentGoal = 0;
          } else {
            const segments = Math.floor(currentGoal / details.targetduration);
            msn += segments;
            if (part !== undefined) {
              const parts = Math.round((currentGoal % details.targetduration) / details.partTarget);
              part += parts;
            }
            logger.log(`[${this.constructor.name}] CDN Tune-in age: ${details.age} goal: ${currentGoal} skip sn ${segments} to part ${part}`);
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
      logger.log(`[${this.constructor.name}] reload live playlist ${index} in ${Math.round(reloadInterval)} ms`);
      this.timer = self.setTimeout(() => this.loadPlaylist(), reloadInterval);
    } else {
      this.clearTimer();
    }
  }

  protected retryLoadingOrFail (errorEvent: ErrorData): boolean {
    const { config } = this.hls;
    const retry = this.retryCount < config.levelLoadingMaxRetry;
    if (retry) {
      this.retryCount++;
      if (errorEvent.details.indexOf('LoadTimeOut') > -1 && errorEvent.context?.deliveryDirectives) {
        // The LL-HLS request already timed out so retry immediately
        logger.warn(`[${this.constructor.name}]: retry playlist loading #${this.retryCount} after "${errorEvent.details}"`);
        this.loadPlaylist();
      } else {
        // exponential backoff capped to max retry timeout
        const delay = Math.min(Math.pow(2, this.retryCount) * config.levelLoadingRetryDelay, config.levelLoadingMaxRetryTimeout);
        // Schedule level/track reload
        this.timer = self.setTimeout(() => this.loadPlaylist(), delay);
        logger.warn(`[${this.constructor.name}]: retry playlist loading #${this.retryCount} in ${delay} ms after "${errorEvent.details}"`);
      }
    } else {
      logger.error(`${this.constructor.name}]: cannot recover from error "${errorEvent.details}"`);
      // stopping live reloading timer if any
      this.clearTimer();
      // switch error to fatal
      errorEvent.fatal = true;
    }
    return retry;
  }
}
