import { Events } from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';
import {
  ManifestParsedData,
  AudioTracksUpdatedData,
  ErrorData,
  LevelLoadingData,
  AudioTrackLoadedData,
} from '../types/events';
import BasePlaylistController from './base-playlist-controller';
import { PlaylistContextType } from '../types/loader';
import type Hls from '../hls';
import type { HlsUrlParameters } from '../types/level';
import type { MediaPlaylist } from '../types/media-playlist';

class AudioTrackController extends BasePlaylistController {
  private tracks: MediaPlaylist[] = [];
  private groupId: string | null = null;
  private tracksInGroup: MediaPlaylist[] = [];
  private trackId: number = -1;
  private selectDefaultTrack: boolean = true;

  constructor(hls: Hls) {
    super(hls, '[audio-track-controller]');
    this.registerListeners();
  }

  private registerListeners() {
    const { hls } = this;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.on(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.on(Events.AUDIO_TRACK_LOADED, this.onAudioTrackLoaded, this);
    hls.on(Events.ERROR, this.onError, this);
  }

  private unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.off(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.off(Events.AUDIO_TRACK_LOADED, this.onAudioTrackLoaded, this);
    hls.off(Events.ERROR, this.onError, this);
  }

  public destroy() {
    this.unregisterListeners();
    super.destroy();
  }

  protected onManifestLoading(): void {
    this.tracks = [];
    this.groupId = null;
    this.tracksInGroup = [];
    this.trackId = -1;
    this.selectDefaultTrack = true;
  }

  protected onManifestParsed(
    event: Events.MANIFEST_PARSED,
    data: ManifestParsedData
  ): void {
    this.tracks = data.audioTracks || [];
  }

  protected onAudioTrackLoaded(
    event: Events.AUDIO_TRACK_LOADED,
    data: AudioTrackLoadedData
  ): void {
    const { id, details } = data;
    const currentTrack = this.tracksInGroup[id];

    if (!currentTrack) {
      this.warn(`Invalid audio track id ${id}`);
      return;
    }

    const curDetails = currentTrack.details;
    currentTrack.details = data.details;
    this.log(`audioTrack ${id} loaded [${details.startSN}-${details.endSN}]`);

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
  protected onLevelLoading(
    event: Events.LEVEL_LOADING,
    data: LevelLoadingData
  ): void {
    const levelInfo = this.hls.levels[data.level];

    if (!levelInfo?.audioGroupIds) {
      return;
    }

    const audioGroupId = levelInfo.audioGroupIds[levelInfo.urlId];
    if (this.groupId !== audioGroupId) {
      this.groupId = audioGroupId;

      const audioTracks = this.tracks.filter(
        (track): boolean => !audioGroupId || track.groupId === audioGroupId
      );

      // Disable selectDefaultTrack if there are no default tracks
      if (
        this.selectDefaultTrack &&
        !audioTracks.some((track) => track.default)
      ) {
        this.selectDefaultTrack = false;
      }

      this.tracksInGroup = audioTracks;
      const audioTracksUpdated: AudioTracksUpdatedData = { audioTracks };
      this.hls.trigger(Events.AUDIO_TRACKS_UPDATED, audioTracksUpdated);

      this.selectInitialTrack();
    }
  }

  protected onError(event: Events.ERROR, data: ErrorData): void {
    super.onError(event, data);
    if (data.fatal || !data.context) {
      return;
    }

    if (
      data.context.type === PlaylistContextType.AUDIO_TRACK &&
      data.context.id === this.trackId &&
      data.context.groupId === this.groupId
    ) {
      this.retryLoadingOrFail(data);
    }
  }

  get audioTracks(): MediaPlaylist[] {
    return this.tracksInGroup;
  }

  get audioTrack(): number {
    return this.trackId;
  }

  set audioTrack(newId: number) {
    // If audio track is selected from API then don't choose from the manifest default track
    this.selectDefaultTrack = false;
    this.setAudioTrack(newId);
  }

  private setAudioTrack(newId: number): void {
    const tracks = this.tracksInGroup;
    // noop on same audio track id as already set
    if (this.trackId === newId && tracks[newId]?.details) {
      return;
    }

    // check if level idx is valid
    if (newId < 0 || newId >= tracks.length) {
      this.warn('Invalid id passed to audio-track controller');
      return;
    }

    // stopping live reloading timer if any
    this.clearTimer();

    const lastTrack = tracks[this.trackId];
    const track = tracks[newId];
    this.log(`Now switching to audio-track index ${newId}`);
    this.trackId = newId;
    const { url, type, id } = track;
    this.hls.trigger(Events.AUDIO_TRACK_SWITCHING, { id, type, url });
    const hlsUrlParameters = this.switchParams(track.url, lastTrack?.details);
    this.loadPlaylist(hlsUrlParameters);
  }

  private selectInitialTrack(): void {
    const audioTracks = this.tracksInGroup;
    console.assert(
      audioTracks.length,
      'Initial audio track should be selected when tracks are known'
    );
    const currentAudioTrackName = audioTracks[this.trackId]?.name;
    const trackId =
      this.findTrackId(currentAudioTrackName) || this.findTrackId();

    if (trackId !== -1) {
      this.setAudioTrack(trackId);
    } else {
      this.warn(`No track found for running audio group-ID: ${this.groupId}`);

      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
        fatal: true,
      });
    }
  }

  private findTrackId(name?: string): number {
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

  protected loadPlaylist(hlsUrlParameters?: HlsUrlParameters): void {
    const audioTrack = this.tracksInGroup[this.trackId];
    if (this.shouldLoadTrack(audioTrack)) {
      const id = audioTrack.id;
      const groupId = audioTrack.groupId as string;
      let url = audioTrack.url;
      if (hlsUrlParameters) {
        try {
          url = hlsUrlParameters.addDirectives(url);
        } catch (error) {
          this.warn(
            `Could not construct new URL with HLS Delivery Directives: ${error}`
          );
        }
      }
      // track not retrieved yet, or live playlist we need to (re)load it
      this.log(`loading audio-track playlist for id: ${id}`);
      this.clearTimer();
      this.hls.trigger(Events.AUDIO_TRACK_LOADING, {
        url,
        id,
        groupId,
        deliveryDirectives: hlsUrlParameters || null,
      });
    }
  }
}

export default AudioTrackController;
