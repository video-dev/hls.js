import Hls from '../hls';
import { NetworkComponentAPI } from '../types/component-api';
import { HlsUrlParameters } from '../types/level';
import { computeReloadInterval } from './level-helper';
import { logger } from '../utils/logger';
import type LevelDetails from '../loader/level-details';
import type { MediaPlaylist } from '../types/media-playlist';
import type { AudioTrackLoadedData, LevelLoadedData, TrackLoadedData } from '../types/events';

export default class BasePlaylistController implements NetworkComponentAPI {
  protected hls: Hls;
  protected timer: number = -1;
  protected canLoad: boolean = false;

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

  protected playlistLoaded (index: number, data: LevelLoadedData | AudioTrackLoadedData | TrackLoadedData, previousDetails: LevelDetails | undefined) {
    const { details, stats, deliveryDirectives } = data;

    // if current playlist is a live playlist, arm a timer to reload it
    if (details.live) {
      if (deliveryDirectives) {
        console.assert(deliveryDirectives.msn === details.endSN, `blocking reload result ${details.endSN}, requested ${deliveryDirectives.msn}`);
      }
      details.reloaded(previousDetails);
      if (previousDetails) {
        logger.log(`[${this.constructor?.name}] live playlist ${index} ${details.advanced ? 'REFRESHED' : 'MISSED'}`);
      }
      if (!this.canLoad) {
        return;
      }
      // TODO: Do not use LL-HLS delivery directives if playlist "endSN" is stale
      if (details.canBlockReload && details.endSN && details.advanced) {
        // Load level with LL-HLS delivery directives
        // TODO: LL-HLS Specify latest partial segment
        // TODO: LL-HLS enable skip parameter for delta playlists independent of canBlockReload
        this.loadPlaylist(new HlsUrlParameters(details.endSN + 1, 0, false));
        return;
      }
      const reloadInterval = computeReloadInterval(details, stats);
      logger.log(`[${this.constructor?.name}] reload live playlist ${index} in ${Math.round(reloadInterval)} ms`);
      this.timer = self.setTimeout(() => this.loadPlaylist(), reloadInterval);
    } else {
      this.clearTimer();
    }
  }
}
