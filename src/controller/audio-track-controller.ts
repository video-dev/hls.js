import { Events } from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';
import {
  ManifestParsedData,
  AudioTracksUpdatedData,
  ErrorData,
  LevelLoadingData,
  AudioTrackLoadedData,
  LevelSwitchingData,
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
  private currentTrack: MediaPlaylist | null = null;
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
    hls.on(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
    hls.on(Events.AUDIO_TRACK_LOADED, this.onAudioTrackLoaded, this);
    hls.on(Events.ERROR, this.onError, this);
  }

  private unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.off(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.off(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
    hls.off(Events.AUDIO_TRACK_LOADED, this.onAudioTrackLoaded, this);
    hls.off(Events.ERROR, this.onError, this);
  }

  public destroy() {
    this.unregisterListeners();
    this.tracks.length = 0;
    this.tracksInGroup.length = 0;
    this.currentTrack = null;
    super.destroy();
  }

  protected onManifestLoading(): void {
    this.tracks = [];
    this.groupId = null;
    this.tracksInGroup = [];
    this.trackId = -1;
    this.currentTrack = null;
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
    const { id, groupId, details } = data;
    const trackInActiveGroup = this.tracksInGroup[id];

    if (!trackInActiveGroup || trackInActiveGroup.groupId !== groupId) {
      this.warn(
        `Track with id:${id} and group:${groupId} not found in active group ${trackInActiveGroup.groupId}`
      );
      return;
    }

    const curDetails = trackInActiveGroup.details;
    trackInActiveGroup.details = data.details;
    this.log(
      `audio-track ${id} "${trackInActiveGroup.name}" lang:${trackInActiveGroup.lang} group:${groupId} loaded [${details.startSN}-${details.endSN}]`
    );

    if (id === this.trackId) {
      this.playlistLoaded(id, data, curDetails);
    }
  }

  protected onLevelLoading(
    event: Events.LEVEL_LOADING,
    data: LevelLoadingData
  ): void {
    this.switchLevel(data.level);
  }

  protected onLevelSwitching(
    event: Events.LEVEL_SWITCHING,
    data: LevelSwitchingData
  ): void {
    this.switchLevel(data.level);
  }

  private switchLevel(levelIndex: number) {
    const levelInfo = this.hls.levels[levelIndex];

    if (!levelInfo?.audioGroupIds) {
      return;
    }

    const audioGroupId = levelInfo.audioGroupIds[levelInfo.urlId];
    if (this.groupId !== audioGroupId) {
      this.groupId = audioGroupId || null;

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
      this.log(
        `Updating audio tracks, ${audioTracks.length} track(s) found in group:${audioGroupId}`
      );
      this.hls.trigger(Events.AUDIO_TRACKS_UPDATED, audioTracksUpdated);

      this.selectInitialTrack();
    } else if (this.shouldReloadPlaylist(this.currentTrack)) {
      // Retry playlist loading if no playlist is or has been loaded yet
      this.setAudioTrack(this.trackId);
    }
  }

  protected onError(event: Events.ERROR, data: ErrorData): void {
    if (data.fatal || !data.context) {
      return;
    }

    if (
      data.context.type === PlaylistContextType.AUDIO_TRACK &&
      data.context.id === this.trackId &&
      data.context.groupId === this.groupId
    ) {
      this.requestScheduled = -1;
      this.checkRetry(data);
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

    // check if level idx is valid
    if (newId < 0 || newId >= tracks.length) {
      this.warn('Invalid id passed to audio-track controller');
      return;
    }

    // stopping live reloading timer if any
    this.clearTimer();

    const lastTrack = this.currentTrack;
    tracks[this.trackId];
    const track = tracks[newId];
    const { groupId, name } = track;
    this.log(
      `Switching to audio-track ${newId} "${name}" lang:${track.lang} group:${groupId}`
    );
    this.trackId = newId;
    this.currentTrack = track;
    this.selectDefaultTrack = false;
    this.hls.trigger(Events.AUDIO_TRACK_SWITCHING, { ...track });
    // Do not reload track unless live
    if (track.details && !track.details.live) {
      return;
    }
    const hlsUrlParameters = this.switchParams(track.url, lastTrack?.details);
    this.loadPlaylist(hlsUrlParameters);
  }

  private selectInitialTrack(): void {
    const audioTracks = this.tracksInGroup;
    const trackId =
      this.findTrackId(this.currentTrack) | this.findTrackId(null);

    if (trackId !== -1) {
      this.setAudioTrack(trackId);
    } else {
      const error = new Error(
        `No track found for running audio group-ID: ${this.groupId} track count: ${audioTracks.length}`
      );
      this.warn(error.message);

      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
        fatal: true,
        error,
      });
    }
  }

  private findTrackId(currentTrack: MediaPlaylist | null): number {
    const audioTracks = this.tracksInGroup;
    for (let i = 0; i < audioTracks.length; i++) {
      const track = audioTracks[i];
      if (!this.selectDefaultTrack || track.default) {
        if (
          !currentTrack ||
          (currentTrack.attrs['STABLE-RENDITION-ID'] !== undefined &&
            currentTrack.attrs['STABLE-RENDITION-ID'] ===
              track.attrs['STABLE-RENDITION-ID'])
        ) {
          return track.id;
        }
        if (
          currentTrack.name === track.name &&
          currentTrack.lang === track.lang
        ) {
          return track.id;
        }
      }
    }
    return -1;
  }

  protected loadPlaylist(hlsUrlParameters?: HlsUrlParameters): void {
    super.loadPlaylist();
    const audioTrack = this.tracksInGroup[this.trackId];
    if (this.shouldLoadPlaylist(audioTrack)) {
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
      this.log(
        `loading audio-track playlist ${id} "${audioTrack.name}" lang:${audioTrack.lang} group:${groupId}`
      );
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
