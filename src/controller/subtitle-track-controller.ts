import BasePlaylistController from './base-playlist-controller';
import { Events } from '../events';
import {
  clearCurrentCues,
  filterSubtitleTracks,
} from '../utils/texttrack-utils';
import { PlaylistContextType } from '../types/loader';
import {
  mediaAttributesIdentical,
  subtitleTrackMatchesTextTrack,
} from '../utils/media-option-attributes';
import type Hls from '../hls';
import type { MediaPlaylist } from '../types/media-playlist';
import type { HlsUrlParameters } from '../types/level';
import type {
  ErrorData,
  LevelLoadingData,
  MediaAttachedData,
  SubtitleTracksUpdatedData,
  ManifestParsedData,
  TrackLoadedData,
  LevelSwitchingData,
} from '../types/events';

class SubtitleTrackController extends BasePlaylistController {
  private media: HTMLMediaElement | null = null;
  private tracks: MediaPlaylist[] = [];
  private groupIds: (string | undefined)[] | null = null;
  private tracksInGroup: MediaPlaylist[] = [];
  private trackId: number = -1;
  private currentTrack: MediaPlaylist | null = null;
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
    this.currentTrack = null;
    this.trackChangeListener = this.asyncPollTrackChange = null as any;
    super.destroy();
  }

  public get subtitleDisplay(): boolean {
    return this._subtitleDisplay;
  }

  public set subtitleDisplay(value: boolean) {
    this._subtitleDisplay = value;
    if (this.trackId > -1) {
      this.toggleTrackModes();
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
    data: MediaAttachedData,
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
        this.asyncPollTrackChange,
      );
    }
  }

  private pollTrackChange(timeout: number) {
    self.clearInterval(this.subtitlePollingInterval);
    this.subtitlePollingInterval = self.setInterval(
      this.trackChangeListener,
      timeout,
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
        this.asyncPollTrackChange,
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
    this.groupIds = null;
    this.tracksInGroup = [];
    this.trackId = -1;
    this.currentTrack = null;
    this.selectDefaultTrack = true;
  }

  // Fired whenever a new manifest is loaded.
  protected onManifestParsed(
    event: Events.MANIFEST_PARSED,
    data: ManifestParsedData,
  ): void {
    this.tracks = data.subtitleTracks;
  }

  protected onSubtitleTrackLoaded(
    event: Events.SUBTITLE_TRACK_LOADED,
    data: TrackLoadedData,
  ): void {
    const { id, groupId, details } = data;
    const trackInActiveGroup = this.tracksInGroup[id];

    if (!trackInActiveGroup || trackInActiveGroup.groupId !== groupId) {
      this.warn(
        `Subtitle track with id:${id} and group:${groupId} not found in active group ${trackInActiveGroup?.groupId}`,
      );
      return;
    }

    const curDetails = trackInActiveGroup.details;
    trackInActiveGroup.details = data.details;
    this.log(
      `Subtitle track ${id} "${trackInActiveGroup.name}" lang:${trackInActiveGroup.lang} group:${groupId} loaded [${details.startSN}-${details.endSN}]`,
    );

    if (id === this.trackId) {
      this.playlistLoaded(id, data, curDetails);
    }
  }

  protected onLevelLoading(
    event: Events.LEVEL_LOADING,
    data: LevelLoadingData,
  ): void {
    this.switchLevel(data.level);
  }

  protected onLevelSwitching(
    event: Events.LEVEL_SWITCHING,
    data: LevelSwitchingData,
  ): void {
    this.switchLevel(data.level);
  }

  private switchLevel(levelIndex: number) {
    const levelInfo = this.hls.levels[levelIndex];
    if (!levelInfo) {
      return;
    }
    const subtitleGroups = levelInfo.subtitleGroups || null;
    const currentGroups = this.groupIds;
    const currentTrack = this.currentTrack;
    if (
      !subtitleGroups ||
      currentGroups?.length !== subtitleGroups?.length ||
      subtitleGroups?.some((groupId) => currentGroups?.indexOf(groupId) === -1)
    ) {
      this.groupIds = subtitleGroups;
      this.trackId = -1;
      this.currentTrack = null;

      const subtitleTracks = this.tracks.filter(
        (track): boolean =>
          !subtitleGroups || subtitleGroups.indexOf(track.groupId) !== -1,
      );
      if (subtitleTracks.length) {
        // Disable selectDefaultTrack if there are no default tracks
        if (
          this.selectDefaultTrack &&
          !subtitleTracks.some(
            (track) => track.default || track.forced || track.autoselect,
          )
        ) {
          this.selectDefaultTrack = false;
        }
        // track.id should match hls.audioTracks index
        subtitleTracks.forEach((track, i) => {
          track.id = i;
        });
      } else if (!currentTrack && !this.tracksInGroup.length) {
        // Do not dispatch SUBTITLE_TRACKS_UPDATED when there were and are no tracks
        return;
      }

      this.tracksInGroup = subtitleTracks;
      let trackId = this.findTrackId(currentTrack);
      if (trackId === -1 && currentTrack) {
        trackId = this.findTrackId(null);
      }

      const subtitleTracksUpdated: SubtitleTracksUpdatedData = {
        subtitleTracks,
      };
      this.log(
        `Updating subtitle tracks, ${
          subtitleTracks.length
        } track(s) found in "${subtitleGroups?.join(',')}" group-id`,
      );
      this.hls.trigger(Events.SUBTITLE_TRACKS_UPDATED, subtitleTracksUpdated);

      if (trackId !== -1 && this.trackId === -1) {
        this.setSubtitleTrack(trackId);
      }
    } else if (this.shouldReloadPlaylist(currentTrack)) {
      // Retry playlist loading if no playlist is or has been loaded yet
      this.setSubtitleTrack(this.trackId);
    }
  }

  private findTrackId(currentTrack: MediaPlaylist | null): number {
    const tracks = this.tracksInGroup;
    const selectDefault = this.selectDefaultTrack;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (
        (selectDefault &&
          !track.default &&
          !track.forced &&
          !track.autoselect) ||
        (!selectDefault && !currentTrack)
      ) {
        continue;
      }
      if (
        !currentTrack ||
        mediaAttributesIdentical(currentTrack.attrs, track.attrs)
      ) {
        return track.id;
      }
      if (
        mediaAttributesIdentical(currentTrack.attrs, track.attrs, [
          'LANGUAGE',
          'ASSOC-LANGUAGE',
          'CHARACTERISTICS',
        ])
      ) {
        return track.id;
      }
      if (
        mediaAttributesIdentical(currentTrack.attrs, track.attrs, ['LANGUAGE'])
      ) {
        return track.id;
      }
    }
    return -1;
  }

  private findTrackForTextTrack(textTrack: TextTrack | null): number {
    if (textTrack) {
      const tracks = this.tracksInGroup;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (subtitleTrackMatchesTextTrack(track, textTrack)) {
          return i;
        }
      }
    }
    return -1;
  }

  protected onError(event: Events.ERROR, data: ErrorData): void {
    if (data.fatal || !data.context) {
      return;
    }

    if (
      data.context.type === PlaylistContextType.SUBTITLE_TRACK &&
      data.context.id === this.trackId &&
      (!this.groupIds || this.groupIds.indexOf(data.context.groupId) !== -1)
    ) {
      this.checkRetry(data);
    }
  }

  get allSubtitleTracks(): MediaPlaylist[] {
    return this.tracks;
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
    this.setSubtitleTrack(newId);
  }

  protected loadPlaylist(hlsUrlParameters?: HlsUrlParameters): void {
    super.loadPlaylist();
    const currentTrack = this.currentTrack;
    if (this.shouldLoadPlaylist(currentTrack) && currentTrack) {
      const id = currentTrack.id;
      const groupId = currentTrack.groupId as string;
      let url = currentTrack.url;
      if (hlsUrlParameters) {
        try {
          url = hlsUrlParameters.addDirectives(url);
        } catch (error) {
          this.warn(
            `Could not construct new URL with HLS Delivery Directives: ${error}`,
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
  private toggleTrackModes(): void {
    const { media } = this;
    if (!media) {
      return;
    }

    const textTracks = filterSubtitleTracks(media.textTracks);
    const currentTrack = this.currentTrack;
    let nextTrack;
    if (currentTrack) {
      nextTrack = textTracks.filter((textTrack) =>
        subtitleTrackMatchesTextTrack(currentTrack, textTrack),
      )[0];
      if (!nextTrack) {
        this.warn(
          `Unable to find subtitle TextTrack with name "${currentTrack.name}" and language "${currentTrack.lang}"`,
        );
      }
    }
    [].slice.call(textTracks).forEach((track) => {
      if (track.mode !== 'disabled' && track !== nextTrack) {
        track.mode = 'disabled';
      }
    });
    if (nextTrack) {
      const mode = this.subtitleDisplay ? 'showing' : 'hidden';
      if (nextTrack.mode !== mode) {
        nextTrack.mode = mode;
      }
    }
  }

  /**
   * This method is responsible for validating the subtitle index and periodically reloading if live.
   * Dispatches the SUBTITLE_TRACK_SWITCH event, which instructs the subtitle-stream-controller to load the selected track.
   */
  private setSubtitleTrack(newId: number): void {
    const tracks = this.tracksInGroup;

    // setting this.subtitleTrack will trigger internal logic
    // if media has not been attached yet, it will fail
    // we keep a reference to the default track id
    // and we'll set subtitleTrack when onMediaAttached is triggered
    if (!this.media) {
      this.queuedDefaultTrack = newId;
      return;
    }

    // exit if track id as already set or invalid
    if (newId < -1 || newId >= tracks.length) {
      this.warn(`Invalid subtitle track id: ${newId}`);
      return;
    }

    // stopping live reloading timer if any
    this.clearTimer();

    this.selectDefaultTrack = false;
    const lastTrack = this.currentTrack;
    const track: MediaPlaylist | null = tracks[newId] || null;
    this.trackId = newId;
    this.currentTrack = track;
    this.toggleTrackModes();
    if (!track) {
      // switch to -1
      this.hls.trigger(Events.SUBTITLE_TRACK_SWITCH, { id: newId });
      return;
    }
    const trackLoaded = track.details && !track.details.live;
    if (newId === this.trackId && track === lastTrack && trackLoaded) {
      return;
    }
    this.log(
      `Switching to subtitle-track ${newId}` +
        (track
          ? ` "${track.name}" lang:${track.lang} group:${track.groupId}`
          : ''),
    );
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
  }

  private onTextTracksChanged(): void {
    if (!this.useTextTrackPolling) {
      self.clearInterval(this.subtitlePollingInterval);
    }
    // Media is undefined when switching streams via loadSource()
    if (!this.media || !this.hls.config.renderTextTracksNatively) {
      return;
    }

    let textTrack: TextTrack | null = null;
    const tracks = filterSubtitleTracks(this.media.textTracks);
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].mode === 'hidden') {
        // Do not break in case there is a following track with showing.
        textTrack = tracks[i];
      } else if (tracks[i].mode === 'showing') {
        textTrack = tracks[i];
        break;
      }
    }

    // Find internal track index for TextTrack
    const trackId = this.findTrackForTextTrack(textTrack);
    if (this.subtitleTrack !== trackId) {
      this.setSubtitleTrack(trackId);
    }
  }
}

export default SubtitleTrackController;
