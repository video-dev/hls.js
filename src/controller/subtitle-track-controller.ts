import { Events } from '../events';
import { logger } from '../utils/logger';
import { clearCurrentCues } from '../utils/texttrack-utils';
import { MediaPlaylist } from '../types/media-playlist';
import {
  TrackLoadedData,
  MediaAttachedData,
  SubtitleTracksUpdatedData,
  ManifestParsedData
} from '../types/events';
import BasePlaylistController from './base-playlist-controller';
import Hls from '../hls';
import { HlsUrlParameters } from '../types/level';

class SubtitleTrackController extends BasePlaylistController {
  private tracks: MediaPlaylist[];
  private trackId: number = -1;
  private media: HTMLMediaElement | null = null;
  private queuedDefaultTrack?: number;
  private trackChangeListener: () => void = () => this._onTextTracksChanged();
  private useTextTrackPolling: boolean = false;
  private subtitlePollingInterval: number = -1;

  public subtitleDisplay: boolean = true; // Enable/disable subtitle display rendering

  constructor (hls: Hls) {
    super(hls);
    this.tracks = [];
    this._registerListeners();
  }

  public destroy () {
    this._unregisterListeners();
    super.destroy();
  }

  private _registerListeners () {
    this.hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    this.hls.on(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    this.hls.on(Events.SUBTITLE_TRACK_LOADED, this.onSubtitleTrackLoaded, this);
  }

  private _unregisterListeners () {
    this.hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    this.hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    this.hls.off(Events.SUBTITLE_TRACK_LOADED, this.onSubtitleTrackLoaded, this);
  }

  // Listen for subtitle track change, then extract the current track ID.
  protected onMediaAttached (event: Events.MEDIA_ATTACHED, data: MediaAttachedData): void {
    this.media = data.media;
    if (!this.media) {
      return;
    }

    if (this.queuedDefaultTrack) {
      this.subtitleTrack = this.queuedDefaultTrack;
      delete this.queuedDefaultTrack;
    }

    this.useTextTrackPolling = !(this.media.textTracks && 'onchange' in this.media.textTracks);
    if (this.useTextTrackPolling) {
      this.subtitlePollingInterval = self.setInterval(() => {
        this.trackChangeListener();
      }, 500);
    } else {
      this.media.textTracks.addEventListener('change', this.trackChangeListener);
    }
  }

  protected onMediaDetaching (): void {
    if (!this.media) {
      return;
    }

    if (this.useTextTrackPolling) {
      self.clearInterval(this.subtitlePollingInterval);
    } else {
      this.media.textTracks.removeEventListener('change', this.trackChangeListener);
    }

    if (Number.isFinite(this.subtitleTrack)) {
      this.queuedDefaultTrack = this.subtitleTrack;
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

  // Fired whenever a new manifest is loaded.
  protected onManifestParsed (event: Events.MANIFEST_PARSED, data: ManifestParsedData): void {
    const subtitleTracks = data.subtitleTracks;
    this.tracks = subtitleTracks;
    const subtitleTracksUpdated: SubtitleTracksUpdatedData = { subtitleTracks };
    this.hls.trigger(Events.SUBTITLE_TRACKS_UPDATED, subtitleTracksUpdated);

    // loop through available subtitle tracks and autoselect default if needed
    subtitleTracks.forEach((track: MediaPlaylist) => {
      if (track.default) {
        // setting this.subtitleTrack will trigger internal logic
        // if media has not been attached yet, it will fail
        // we keep a reference to the default track id
        // and we'll set subtitleTrack when onMediaAttached is triggered
        if (this.media) {
          this.subtitleTrack = track.id;
        } else {
          this.queuedDefaultTrack = track.id;
        }
      }
    });
  }

  protected onSubtitleTrackLoaded (event: Events.SUBTITLE_TRACK_LOADED, data: TrackLoadedData): void {
    const { id, details } = data;
    const { trackId } = this;
    const currentTrack = this.tracks[trackId];

    if (!currentTrack) {
      logger.warn('[subtitle-track-controller]: Invalid subtitle track id:', id);
      return;
    }

    const curDetails = currentTrack.details;
    currentTrack.details = data.details;
    logger.log(`[subtitle-track-controller]: subtitle track ${id} loaded [${details.startSN}-${details.endSN}]`);

    if (id === this.trackId) {
      this.playlistLoaded(id, data, curDetails);
    }
  }

  /** get alternate subtitle tracks list from playlist **/
  get subtitleTracks (): MediaPlaylist[] {
    return this.tracks;
  }

  /** get index of the selected subtitle track (index in subtitle track lists) **/
  get subtitleTrack (): number {
    return this.trackId;
  }

  /** select a subtitle track, based on its index in subtitle track lists**/
  set subtitleTrack (subtitleTrackId: number) {
    if (this.trackId !== subtitleTrackId) {
      this._toggleTrackModes(subtitleTrackId);
      this._setSubtitleTrackInternal(subtitleTrackId);
    }
  }

  protected loadPlaylist (hlsUrlParameters?: HlsUrlParameters): void {
    const currentTrack = this.tracks[this.trackId];
    if (this.shouldLoadTrack(currentTrack)) {
      const id = currentTrack.id;
      let url = currentTrack.url;
      if (hlsUrlParameters) {
        try {
          url = hlsUrlParameters.addDirectives(url);
        } catch (error) {
          logger.warn(`[subtitle-track-controller] Could not construct new URL with HLS Delivery Directives: ${error}`);
        }
      }
      logger.log(`[subtitle-track-controller]: Loading subtitle playlist for id ${id}`);
      this.hls.trigger(Events.SUBTITLE_TRACK_LOADING, {
        url,
        id,
        deliveryDirectives: hlsUrlParameters || null
      });
    }
  }

  /**
   * Disables the old subtitleTrack and sets current mode on the next subtitleTrack.
   * This operates on the DOM textTracks.
   * A value of -1 will disable all subtitle tracks.
   */
  private _toggleTrackModes (newId: number): void {
    const { media, subtitleDisplay, trackId } = this;
    if (!media) {
      return;
    }

    const textTracks = filterSubtitleTracks(media.textTracks);
    if (newId === -1) {
      [].slice.call(textTracks).forEach(track => {
        track.mode = 'disabled';
      });
    } else {
      const oldTrack = textTracks[trackId];
      if (oldTrack) {
        oldTrack.mode = 'disabled';
      }
    }

    const nextTrack = textTracks[newId];
    if (nextTrack) {
      nextTrack.mode = subtitleDisplay ? 'showing' : 'hidden';
    }
  }

  /**
     * This method is responsible for validating the subtitle index and periodically reloading if live.
     * Dispatches the SUBTITLE_TRACK_SWITCH event, which instructs the subtitle-stream-controller to load the selected track.
     */
  private _setSubtitleTrackInternal (newId: number): void {
    const { hls, tracks } = this;
    if (this.trackId === newId && this.tracks[this.trackId].details ||
      newId < -1 || newId >= tracks.length) {
      return;
    }

    this.trackId = newId;
    logger.log(`[subtitle-track-controller]: Switching to subtitle track ${newId}`);
    hls.trigger(Events.SUBTITLE_TRACK_SWITCH, { id: newId });
    // TODO: LL-HLS use RENDITION-REPORT if available
    this.loadPlaylist();
  }

  private _onTextTracksChanged (): void {
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
    this.subtitleTrack = trackId;
  }
}

function filterSubtitleTracks (textTrackList: TextTrackList): TextTrack[] {
  const tracks: TextTrack[] = [];
  for (let i = 0; i < textTrackList.length; i++) {
    const track = textTrackList[i];
    // Edge adds a track without a label; we don't want to use it
    if (track.kind === 'subtitles' && track.label) {
      tracks.push(textTrackList[i]);
    }
  }
  return tracks;
}

export default SubtitleTrackController;
