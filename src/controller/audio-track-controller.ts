import { Events } from '../events';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';
import type { MediaPlaylist } from '../types/media-playlist';
import {
  ManifestParsedData,
  AudioTracksUpdatedData,
  ErrorData,
  LevelLoadingData,
  AudioTrackLoadedData
} from '../types/events';
import BasePlaylistController from './base-playlist-controller';
import type Hls from '../hls';
import type { HlsUrlParameters } from '../types/level';

class AudioTrackController extends BasePlaylistController {
  private readonly restrictedTracks: { [key: number]: boolean } = Object.create(null);
  private tracks: MediaPlaylist[] = [];
  private groupId: string | null = null;
  private tracksInGroup: MediaPlaylist[] = [];
  private trackId: number = -1;
  private selectDefaultTrack: boolean = true;

  constructor (hls: Hls) {
    super(hls);
    this.registerListeners();
  }

  private registerListeners () {
    const { hls } = this;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.on(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.on(Events.AUDIO_TRACK_LOADED, this.onAudioTrackLoaded, this);
    hls.on(Events.ERROR, this.onError, this);
  }

  private unregisterListeners () {
    const { hls } = this;
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.off(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.off(Events.AUDIO_TRACK_LOADED, this.onAudioTrackLoaded, this);
    hls.off(Events.ERROR, this.onError, this);
  }

  public destroy () {
    this.unregisterListeners();
    super.destroy();
  }

  protected onManifestLoading (): void {
    this.tracks = [];
    this.groupId = null;
    this.tracksInGroup = [];
    this.trackId = -1;
    this.selectDefaultTrack = true;
  }

  protected onManifestParsed (event: Events.MANIFEST_PARSED, data: ManifestParsedData): void {
    this.tracks = data.audioTracks || [];
  }

  protected onAudioTrackLoaded (event: Events.AUDIO_TRACK_LOADED, data: AudioTrackLoadedData): void {
    const { id, details } = data;
    const currentTrack = this.tracksInGroup[id];

    if (!currentTrack) {
      logger.warn('[audio-track-controller]: Invalid audio track id:', id);
      return;
    }

    const curDetails = currentTrack.details;
    currentTrack.details = data.details;
    logger.log(`[audio-track-controller]: audioTrack ${id} loaded [${details.startSN}-${details.endSN}]`);

    if (id === this.trackId) {
      this.retryCount = 0;
      this.playlistLoaded(id, data, curDetails);
    }
  }

  /**
   * When a level is loading, if it has redundant audioGroupIds (in the same ordinality as it's redundant URLs)
   * we are setting our audio-group ID internally to the one set, if it is different from the group ID currently set.
   *
   * If group-ID got update, we re-select the appropriate audio-track with this group-ID matching the currently
   * selected one (based on NAME property).
   */
  protected onLevelLoading (event: Events.LEVEL_LOADING, data: LevelLoadingData): void {
    const levelInfo = this.hls.levels[data.level];

    if (!levelInfo?.audioGroupIds) {
      return;
    }

    const audioGroupId = levelInfo.audioGroupIds[levelInfo.urlId];
    if (this.groupId !== audioGroupId) {
      this.groupId = audioGroupId;

      const audioTracks = this.tracks.filter((track): boolean =>
        !audioGroupId || track.groupId === audioGroupId);

      this.tracksInGroup = audioTracks;
      const audioTracksUpdated: AudioTracksUpdatedData = { audioTracks };
      this.hls.trigger(Events.AUDIO_TRACKS_UPDATED, audioTracksUpdated);

      this.selectInitialTrack();
    }
  }

  protected onError (event: Events.ERROR, data: ErrorData): void {
    if (data.fatal) {
      if (data.type === ErrorTypes.NETWORK_ERROR) {
        this.clearTimer();
      }
      return;
    }

    switch (data.details) {
    case ErrorDetails.AUDIO_TRACK_LOAD_ERROR:
    case ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT:
      logger.warn(`[audio-track-controller]: Network error "${data.details}" data.details on audio-track id: ${data.context?.id}`);
      if (data.context?.id === this.trackId) {
        this.recoverTrack(data, this.trackId);
      }
      break;
    }
  }

  private recoverTrack (errorEvent: ErrorData, trackId: number) {
    // First, let's black list current track id
    this.restrictedTracks[trackId] = true;

    // Let's try to fall back on a functional audio-track with the same group ID
    const track = this.tracksInGroup[trackId];
    const { name, groupId } = track;

    logger.warn(`[audio-track-controller]: Loading failed on audio track id: ${trackId}, group-id: ${groupId}, name/language: "${name}" / "${track.lang}"`);

    // Find a non-blacklisted track ID with the same NAME
    // At least a track that is not blacklisted, thus on another group-ID.
    let newId = trackId;
    for (let i = 0; i < this.tracks.length; i++) {
      if (!this.restrictedTracks[i] && this.tracks[i].name === name) {
        newId = i;
        break;
      }
    }

    if (newId === trackId) {
      this.restrictedTracks[trackId] = false;
      // perform retries
      this.retryLoadingOrFail(errorEvent);
    } else {
      logger.log('[audio-track-controller]: Attempting audio-track fallback id:', newId, 'group-id:', this.tracks[newId].groupId);
      this.setAudioTrack(newId);
    }
  }

  get audioTracks (): MediaPlaylist[] {
    return this.tracksInGroup;
  }

  get audioTrack (): number {
    return this.trackId;
  }

  set audioTrack (newId: number) {
    // If audio track is selected from API then don't choose from the manifest default track
    this.selectDefaultTrack = false;
    this.setAudioTrack(newId);
  }

  private setAudioTrack (newId: number): void {
    const tracks = this.tracksInGroup;
    // noop on same audio track id as already set
    if (this.trackId === newId && tracks[newId]?.details) {
      return;
    }

    // check if level idx is valid
    if (newId < 0 || newId >= tracks.length) {
      logger.warn('[audio-track-controller]: Invalid id passed to audio-track controller');
      return;
    }

    // stopping live reloading timer if any
    this.clearTimer();

    const lastTrack = tracks[this.trackId];
    const track = tracks[newId];
    logger.log(`[audio-track-controller]: Now switching to audio-track index ${newId}`);
    this.trackId = newId;
    const { url, type, id } = track;
    this.hls.trigger(Events.AUDIO_TRACK_SWITCHING, { id, type, url });
    const hlsUrlParameters = this.switchParams(track.url, lastTrack?.details);
    this.loadPlaylist(hlsUrlParameters);
  }

  private selectInitialTrack (): void {
    const audioTracks = this.tracksInGroup;
    console.assert(audioTracks.length, 'Initial audio track should be selected when tracks are known');
    const currentAudioTrackName = audioTracks[this.trackId]?.name;
    const trackId = this.findTrackId(currentAudioTrackName) || this.findTrackId();

    if (trackId !== -1) {
      this.setAudioTrack(trackId);
    } else {
      logger.error(`[audio-track-controller]: No track found for running audio group-ID: ${this.groupId}`);

      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
        fatal: true
      });
    }
  }

  private findTrackId (name?: string): number {
    const audioTracks = this.tracksInGroup;
    for (let i = 0; i < audioTracks.length; i++) {
      const track = audioTracks[i];
      if (!this.selectDefaultTrack || track.default) {
        if (!name || name === track.name) {
          return track.id;
        }
      }
    }
    return -1;
  }

  protected loadPlaylist (hlsUrlParameters?: HlsUrlParameters): void {
    const audioTrack = this.tracksInGroup[this.trackId];
    if (this.shouldLoadTrack(audioTrack)) {
      const id = audioTrack.id;
      let url = audioTrack.url;
      if (hlsUrlParameters) {
        try {
          url = hlsUrlParameters.addDirectives(url);
        } catch (error) {
          logger.warn(`[audio-track-controller] Could not construct new URL with HLS Delivery Directives: ${error}`);
        }
      }
      // track not retrieved yet, or live playlist we need to (re)load it
      logger.log(`[audio-track-controller]: loading audio-track playlist for id: ${id}`);
      this.clearTimer();
      this.hls.trigger(Events.AUDIO_TRACK_LOADING, {
        url,
        id,
        deliveryDirectives: hlsUrlParameters || null
      });
    }
  }
}

export default AudioTrackController;
