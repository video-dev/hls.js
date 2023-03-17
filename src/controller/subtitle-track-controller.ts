import { Events } from '../events';
import { clearCurrentCues } from '../utils/texttrack-utils';
import BasePlaylistController from './base-playlist-controller';
import type { HlsUrlParameters } from '../types/level';
import type Hls from '../hls';
import type {
  TrackLoadedData,
  MediaAttachedData,
  SubtitleTracksUpdatedData,
  ManifestParsedData,
  LevelSwitchingData,
} from '../types/events';
import type { MediaPlaylist } from '../types/media-playlist';
import { ErrorData, LevelLoadingData } from '../types/events';
import { PlaylistContextType } from '../types/loader';

class SubtitleTrackController extends BasePlaylistController {
  private media: HTMLMediaElement | null = null;
  private tracks: MediaPlaylist[] = [];
  private groupId: string | null = null;
  private tracksInGroup: MediaPlaylist[] = [];
  private trackId: number = -1;
  private selectDefaultTrack: boolean = true;
  private queuedDefaultTrack: number = -1;
  private trackChangeListener: () => void = () => this.onTextTracksChanged();
  private asyncPollTrackChange: () => void = () => this.pollTrackChange(0);
  private useTextTrackPolling: boolean = false;
  private subtitlePollingInterval: number = -1;
  private _subtitleDisplay: boolean = true;

  constructor(hls: Hls) {
    super(hls, '[subtitle-track-controller]');
    this.registerListeners();
  }

  public destroy() {
    this.unregisterListeners();
    this.tracks.length = 0;
    this.tracksInGroup.length = 0;
    this.trackChangeListener = this.asyncPollTrackChange = null as any;
    super.destroy();
  }

  public get subtitleDisplay(): boolean {
    return this._subtitleDisplay;
  }

  public set subtitleDisplay(value: boolean) {
    this._subtitleDisplay = value;
    if (this.trackId > -1) {
      this.toggleTrackModes(this.trackId);
    }
  }

  private registerListeners() {
    const { hls } = this;
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.on(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.on(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
    hls.on(Events.SUBTITLE_TRACK_LOADED, this.onSubtitleTrackLoaded, this);
    hls.on(Events.ERROR, this.onError, this);
  }

  private unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.off(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.off(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
    hls.off(Events.SUBTITLE_TRACK_LOADED, this.onSubtitleTrackLoaded, this);
    hls.off(Events.ERROR, this.onError, this);
  }

  // Listen for subtitle track change, then extract the current track ID.
  protected onMediaAttached(
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachedData
  ): void {
    this.media = data.media;
    if (!this.media) {
      return;
    }

    if (this.queuedDefaultTrack > -1) {
      this.subtitleTrack = this.queuedDefaultTrack;
      this.queuedDefaultTrack = -1;
    }

    this.useTextTrackPolling = !(
      this.media.textTracks && 'onchange' in this.media.textTracks
    );
    if (this.useTextTrackPolling) {
      this.pollTrackChange(500);
    } else {
      this.media.textTracks.addEventListener(
        'change',
        this.asyncPollTrackChange
      );
    }
  }

  private pollTrackChange(timeout: number) {
    self.clearInterval(this.subtitlePollingInterval);
    this.subtitlePollingInterval = self.setInterval(
      this.trackChangeListener,
      timeout
    );
  }

  protected onMediaDetaching(): void {
    if (!this.media) {
      return;
    }

    self.clearInterval(this.subtitlePollingInterval);
    if (!this.useTextTrackPolling) {
      this.media.textTracks.removeEventListener(
        'change',
        this.asyncPollTrackChange
      );
    }

    if (this.trackId > -1) {
      this.queuedDefaultTrack = this.trackId;
    }

    const textTracks = filterSubtitleTracks(this.media.textTracks);
    // Clear loaded cues on media detachment from tracks
    textTracks.forEach((track) => {
      clearCurrentCues(track);
    });
    // Disable all subtitle tracks before detachment so when reattached only tracks in that content are enabled.
    this.subtitleTrack = -1;
    this.media = null;
  }

  protected onManifestLoading(): void {
    this.tracks = [];
    this.groupId = null;
    this.tracksInGroup = [];
    this.trackId = -1;
    this.selectDefaultTrack = true;
  }

  // Fired whenever a new manifest is loaded.
  protected onManifestParsed(
    event: Events.MANIFEST_PARSED,
    data: ManifestParsedData
  ): void {
    this.tracks = data.subtitleTracks;
  }

  protected onSubtitleTrackLoaded(
    event: Events.SUBTITLE_TRACK_LOADED,
    data: TrackLoadedData
  ): void {
    const { id, details } = data;
    const { trackId } = this;
    const currentTrack = this.tracksInGroup[trackId];

    if (!currentTrack) {
      this.warn(`Invalid subtitle track id ${id}`);
      return;
    }

    const curDetails = currentTrack.details;
    currentTrack.details = data.details;
    this.log(
      `subtitle track ${id} loaded [${details.startSN}-${details.endSN}]`
    );

    if (id === this.trackId) {
      this.retryCount = 0;
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
    if (!levelInfo?.textGroupIds) {
      return;
    }

    const textGroupId = levelInfo.textGroupIds[levelInfo.urlId];
    if (this.groupId !== textGroupId) {
      const lastTrack = this.tracksInGroup
        ? this.tracksInGroup[this.trackId]
        : undefined;

      const subtitleTracks = this.tracks.filter(
        (track): boolean => !textGroupId || track.groupId === textGroupId
      );
      this.tracksInGroup = subtitleTracks;
      const initialTrackId =
        this.findTrackId(lastTrack?.name) || this.findTrackId();
      this.groupId = textGroupId;

      const subtitleTracksUpdated: SubtitleTracksUpdatedData = {
        subtitleTracks,
      };
      this.log(
        `Updating subtitle tracks, ${subtitleTracks.length} track(s) found in "${textGroupId}" group-id`
      );
      this.hls.trigger(Events.SUBTITLE_TRACKS_UPDATED, subtitleTracksUpdated);

      if (initialTrackId !== -1) {
        this.setSubtitleTrack(initialTrackId, lastTrack);
      }
    }
  }

  private findTrackId(name?: string): number {
    const textTracks = this.tracksInGroup;
    for (let i = 0; i < textTracks.length; i++) {
      const track = textTracks[i];
      if (!this.selectDefaultTrack || track.default) {
        if (!name || name === track.name) {
          return track.id;
        }
      }
    }
    return -1;
  }

  protected onError(event: Events.ERROR, data: ErrorData): void {
    super.onError(event, data);
    if (data.fatal || !data.context) {
      return;
    }

    if (
      data.context.type === PlaylistContextType.SUBTITLE_TRACK &&
      data.context.id === this.trackId &&
      data.context.groupId === this.groupId
    ) {
      this.retryLoadingOrFail(data);
    }
  }

  /** get alternate subtitle tracks list from playlist **/
  get subtitleTracks(): MediaPlaylist[] {
    return this.tracksInGroup;
  }

  /** get/set index of the selected subtitle track (based on index in subtitle track lists) **/
  get subtitleTrack(): number {
    return this.trackId;
  }

  set subtitleTrack(newId: number) {
    this.selectDefaultTrack = false;
    const lastTrack = this.tracksInGroup
      ? this.tracksInGroup[this.trackId]
      : undefined;
    this.setSubtitleTrack(newId, lastTrack);
  }

  protected loadPlaylist(hlsUrlParameters?: HlsUrlParameters): void {
    super.loadPlaylist();
    const currentTrack = this.tracksInGroup[this.trackId];
    if (this.shouldLoadTrack(currentTrack)) {
      const id = currentTrack.id;
      const groupId = currentTrack.groupId as string;
      let url = currentTrack.url;
      if (hlsUrlParameters) {
        try {
          url = hlsUrlParameters.addDirectives(url);
        } catch (error) {
          this.warn(
            `Could not construct new URL with HLS Delivery Directives: ${error}`
          );
        }
      }
      this.log(`Loading subtitle playlist for id ${id}`);
      this.hls.trigger(Events.SUBTITLE_TRACK_LOADING, {
        url,
        id,
        groupId,
        deliveryDirectives: hlsUrlParameters || null,
      });
    }
  }

  /**
   * Disables the old subtitleTrack and sets current mode on the next subtitleTrack.
   * This operates on the DOM textTracks.
   * A value of -1 will disable all subtitle tracks.
   */
  private toggleTrackModes(newId: number): void {
    const { media, trackId } = this;
    if (!media) {
      return;
    }

    const textTracks = filterSubtitleTracks(media.textTracks);
    const groupTracks = textTracks.filter(
      (track) => (track as any).groupId === this.groupId
    );
    if (newId === -1) {
      [].slice.call(textTracks).forEach((track) => {
        track.mode = 'disabled';
      });
    } else {
      const oldTrack = groupTracks[trackId];
      if (oldTrack) {
        oldTrack.mode = 'disabled';
      }
    }

    const nextTrack = groupTracks[newId];
    if (nextTrack) {
      nextTrack.mode = this.subtitleDisplay ? 'showing' : 'hidden';
    }
  }

  /**
   * This method is responsible for validating the subtitle index and periodically reloading if live.
   * Dispatches the SUBTITLE_TRACK_SWITCH event, which instructs the subtitle-stream-controller to load the selected track.
   */
  private setSubtitleTrack(
    newId: number,
    lastTrack: MediaPlaylist | undefined
  ): void {
    const tracks = this.tracksInGroup;

    // setting this.subtitleTrack will trigger internal logic
    // if media has not been attached yet, it will fail
    // we keep a reference to the default track id
    // and we'll set subtitleTrack when onMediaAttached is triggered
    if (!this.media) {
      this.queuedDefaultTrack = newId;
      return;
    }

    if (this.trackId !== newId) {
      this.toggleTrackModes(newId);
    }

    // exit if track id as already set or invalid
    if (
      (this.trackId === newId && (newId === -1 || tracks[newId]?.details)) ||
      newId < -1 ||
      newId >= tracks.length
    ) {
      return;
    }

    // stopping live reloading timer if any
    this.clearTimer();

    const track = tracks[newId];
    this.log(`Switching to subtitle track ${newId}`);
    this.trackId = newId;
    if (track) {
      const { id, groupId = '', name, type, url } = track;
      this.hls.trigger(Events.SUBTITLE_TRACK_SWITCH, {
        id,
        groupId,
        name,
        type,
        url,
      });
      const hlsUrlParameters = this.switchParams(track.url, lastTrack?.details);
      this.loadPlaylist(hlsUrlParameters);
    } else {
      // switch to -1
      this.hls.trigger(Events.SUBTITLE_TRACK_SWITCH, { id: newId });
    }
  }

  private onTextTracksChanged(): void {
    if (!this.useTextTrackPolling) {
      self.clearInterval(this.subtitlePollingInterval);
    }
    // Media is undefined when switching streams via loadSource()
    if (!this.media || !this.hls.config.renderTextTracksNatively) {
      return;
    }

    let trackId: number = -1;
    const tracks = filterSubtitleTracks(this.media.textTracks);
    for (let id = 0; id < tracks.length; id++) {
      if (tracks[id].mode === 'hidden') {
        // Do not break in case there is a following track with showing.
        trackId = id;
      } else if (tracks[id].mode === 'showing') {
        trackId = id;
        break;
      }
    }

    // Setting current subtitleTrack will invoke code.
    if (this.subtitleTrack !== trackId) {
      this.subtitleTrack = trackId;
    }
  }
}

function filterSubtitleTracks(textTrackList: TextTrackList): TextTrack[] {
  const tracks: TextTrack[] = [];
  for (let i = 0; i < textTrackList.length; i++) {
    const track = textTrackList[i];
    // Edge adds a track without a label; we don't want to use it
    if (
      (track.kind === 'subtitles' || track.kind === 'captions') &&
      track.label
    ) {
      tracks.push(textTrackList[i]);
    }
  }
  return tracks;
}

export default SubtitleTrackController;
