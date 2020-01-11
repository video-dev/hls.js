import { Events } from '../events';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';
import { computeReloadInterval } from './level-helper';
import { MediaPlaylist } from '../types/media-playlist';
import {
  TrackSwitchedData,
  ManifestParsedData,
  AudioTracksUpdatedData,
  ErrorData,
  LevelLoadingData,
  AudioTrackLoadedData
} from '../types/events';
import { NetworkComponentAPI } from '../types/component-api';
import Hls from '../hls';

/**
 * @class AudioTrackController
 * @implements {EventHandler}
 *
 * Handles main manifest and audio-track metadata loaded,
 * owns and exposes the selectable audio-tracks data-models.
 *
 * Exposes internal interface to select available audio-tracks.
 *
 * Handles errors on loading audio-track playlists. Manages fallback mechanism
 * with redundants tracks (group-IDs).
 *
 * Handles level-loading and group-ID switches for video (fallback on video levels),
 * and eventually adapts the audio-track group-ID to match.
 *
 * @fires AUDIO_TRACK_LOADING
 * @fires AUDIO_TRACK_SWITCHING
 * @fires AUDIO_TRACKS_UPDATED
 * @fires ERROR
 *
 */
class AudioTrackController implements NetworkComponentAPI {
  /**
   * @private
   * If should select tracks according to default track attribute
   * @member {boolean} _selectDefaultTrack
   */
  private _selectDefaultTrack: boolean = true;
  private hls: Hls;
  private _trackId: number = -1;

  private canLoad: boolean = false;

  private timer: number | null = null;

  private readonly trackIdBlacklist: { [key: number]: boolean };

  /**
   * @public
   * All tracks available
   * @member {AudioTrack[]}
   */
  public tracks: MediaPlaylist[];

  /**
   * @public
   * The currently running group ID for audio
   * (we grab this on manifest-parsed and new level-loaded)
   * @member {string}
   */
  public audioGroupId: string | null = null;

  constructor (hls: Hls) {
    this.hls = hls;
    this.tracks = [];
    this.trackIdBlacklist = Object.create(null);
    this._registerListeners();
  }

  private _registerListeners () {
    const { hls } = this;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.on(Events.AUDIO_TRACK_LOADED, this.onAudioTrackLoaded, this);
    hls.on(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.on(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.on(Events.ERROR, this.onError, this);
  }

  private _unregisterListeners () {
    const { hls } = this;
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.off(Events.AUDIO_TRACK_LOADED, this.onAudioTrackLoaded, this);
    hls.off(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.off(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.off(Events.ERROR, this.onError, this);
  }

  public destroy () {
    this._unregisterListeners();
    this.clearTimer();
  }

  /**
   * Reset audio tracks on new manifest loading.
   */
  protected onManifestLoading (): void {
    this.tracks = [];
    this._trackId = -1;
    this._selectDefaultTrack = true;
  }

  /**
   * Store tracks data from manifest parsed data.
   *
   * Trigger AUDIO_TRACKS_UPDATED event.
   */
  protected onManifestParsed (event: Events.MANIFEST_PARSED, data: ManifestParsedData): void {
    const tracks = this.tracks = data.audioTracks || [];
    const audioTracksUpdated: AudioTracksUpdatedData = { audioTracks: tracks };
    this.hls.trigger(Events.AUDIO_TRACKS_UPDATED, audioTracksUpdated);
  }

  /**
   * Store track details of loaded track in our data-model.
   *
   * Set-up metadata update interval task for live-mode streams.
   *
   * @param {*} data
   */
  protected onAudioTrackLoaded (event: Events.AUDIO_TRACK_LOADED, data: AudioTrackLoadedData): void {
    const { id, details } = data;
    const currentTrack = this.tracks[id];
    const curDetails = currentTrack.details;

    if (id >= this.tracks.length) {
      logger.warn('[audio-track-controller]: Invalid audio track id:', id);
      return;
    }

    currentTrack.details = data.details;
    logger.log(`[audio-track-controller]: audioTrack ${id} loaded [${details.startSN},${details.endSN}]`);

    // if current playlist is a live playlist, arm a timer to reload it
    if (details.live) {
      details.reloaded(curDetails);
      const reloadInterval = computeReloadInterval(details, data.stats);
      logger.log(`[audio-track-controller]: live audio track ${details.updated ? 'REFRESHED' : 'MISSED'}, reload in ${Math.round(reloadInterval)} ms`);
      // Stop reloading if the timer was cleared
      if (this.canLoad) {
        this.timer = self.setTimeout(() => this._updateTrack(this._trackId), reloadInterval);
      }
    } else {
      // playlist is not live and timer is scheduled: cancel it
      this.clearTimer();
    }
  }

  private clearTimer (): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public startLoad (): void {
    this.canLoad = true;
    if (this.timer === null) {
      this._updateTrack(this._trackId);
    }
  }

  public stopLoad (): void {
    this.canLoad = false;
    this.clearTimer();
  }

  /**
   * Update the internal group ID to any audio-track we may have set manually
   * or because of a failure-handling fallback.
   *
   * Quality-levels should update to that group ID in this case.
   */
  protected onAudioTrackSwitched (event: Events.AUDIO_TRACK_SWITCHED, data: TrackSwitchedData): void {
    const audioGroupId = this.tracks[data.id].groupId;
    if (audioGroupId && (this.audioGroupId !== audioGroupId)) {
      this.audioGroupId = audioGroupId;
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

    if (!levelInfo.audioGroupIds) {
      return;
    }

    const audioGroupId = levelInfo.audioGroupIds[levelInfo.urlId];
    if (this.audioGroupId !== audioGroupId) {
      this.audioGroupId = audioGroupId;
      this._selectInitialAudioTrack();
    }
  }

  protected onError (event: Events.ERROR, data: ErrorData): void {
    // Only handle network errors
    if (data.type !== ErrorTypes.NETWORK_ERROR) {
      return;
    }

    // If fatal network error, cancel update task
    if (data.fatal) {
      this.clearTimer();
    }

    // If not an audio-track loading error don't handle further
    if (data.details !== ErrorDetails.AUDIO_TRACK_LOAD_ERROR) {
      return;
    }

    logger.warn('[audio-track-controller]: Network failure on audio-track id:', data.context.id);
    this._handleLoadError();
  }

  get audioTracks (): MediaPlaylist[] {
    return this.tracks;
  }

  get audioTrack (): number {
    return this._trackId;
  }

  set audioTrack (newId: number) {
    this._setAudioTrack(newId);
    // If audio track is selected from API then don't choose from the manifest default track
    this._selectDefaultTrack = false;
  }

  private _setAudioTrack (newId: number): void {
    // noop on same audio track id as already set
    if (this._trackId === newId && this.tracks[this._trackId].details) {
      logger.debug('[audio-track-controller]: Same id as current audio-track passed, and track details available -> no-op');
      return;
    }

    // check if level idx is valid
    if (newId < 0 || newId >= this.tracks.length) {
      logger.warn('[audio-track-controller]: Invalid id passed to audio-track controller');
      return;
    }

    const audioTrack = this.tracks[newId];

    logger.log(`[audio-track-controller]: Now switching to audio-track index ${newId}`);

    // stopping live reloading timer if any
    this.clearTimer();
    this._trackId = newId;

    const { url, type, id } = audioTrack;
    this.hls.trigger(Events.AUDIO_TRACK_SWITCHING, { id, type, url });
    this._loadTrackDetailsIfNeeded(audioTrack);
  }

  private _selectInitialAudioTrack (): void {
    let tracks = this.tracks;
    console.assert(tracks.length, 'Initial audio track should be selected when tracks are known');

    const currentAudioTrack = this.tracks[this._trackId];

    let name: string | null = null;
    if (currentAudioTrack) {
      name = currentAudioTrack.name || null;
    }

    // Pre-select default tracks if there are any
    if (this._selectDefaultTrack) {
      const defaultTracks = tracks.filter((track) => track.default);
      if (defaultTracks.length) {
        tracks = defaultTracks;
      } else {
        logger.warn('[audio-track-controller]: No default audio tracks defined');
      }
    }

    let trackFound = false;

    const traverseTracks = () => {
      // Select track with right group ID
      tracks.some((track): boolean => {
        // We need to match the (pre-)selected group ID
        // and the NAME of the current track.
        if ((!this.audioGroupId || track.groupId === this.audioGroupId) &&
          (!name || name === track.name)) {
          // If there was a previous track try to stay with the same `NAME`.
          // It should be unique across tracks of same group, and consistent through redundant track groups.
          this._setAudioTrack(track.id);
          return (trackFound = true);
        }
        return false;
      });
    };

    traverseTracks();

    if (!trackFound) {
      name = null;
      traverseTracks();
    }

    if (!trackFound) {
      logger.error(`[audio-track-controller]: No track found for running audio group-ID: ${this.audioGroupId}`);

      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
        fatal: true
      });
    }
  }

  private _needsTrackLoading (audioTrack: MediaPlaylist): boolean {
    const { details, url } = audioTrack;

    return !!url && (!details || details.live);
  }

  private _loadTrackDetailsIfNeeded (audioTrack: MediaPlaylist): void {
    if (this._needsTrackLoading(audioTrack)) {
      const { url, id } = audioTrack;
      // track not retrieved yet, or live playlist we need to (re)load it
      logger.log(`[audio-track-controller]: loading audio-track playlist for id: ${id}`);
      this.hls.trigger(Events.AUDIO_TRACK_LOADING, { url, id });
    }
  }

  private _updateTrack (newId: number): void {
    // check if level idx is valid
    if (newId < 0 || newId >= this.tracks.length) {
      return;
    }

    // stopping live reloading timer if any
    this.clearTimer();
    this._trackId = newId;
    logger.log(`[audio-track-controller]: trying to update audio-track ${newId}`);
    const audioTrack = this.tracks[newId];
    this._loadTrackDetailsIfNeeded(audioTrack);
  }

  private _handleLoadError (): void {
    const previousId = this._trackId;

    // First, let's black list current track id
    this.trackIdBlacklist[previousId] = true;

    // Let's try to fall back on a functional audio-track with the same group ID
    const { name, lang, groupId } = this.tracks[previousId];

    logger.warn(`[audio-track-controller]: Loading failed on audio track id: ${previousId}, group-id: ${groupId}, name/language: "${name}" / "${lang}"`);

    // Find a non-blacklisted track ID with the same NAME
    // At least a track that is not blacklisted, thus on another group-ID.
    let newId = previousId;
    for (let i = 0; i < this.tracks.length; i++) {
      if (!this.trackIdBlacklist[i] && this.tracks[i].name === name) {
        newId = i;
        break;
      }
    }

    if (newId === previousId) {
      logger.warn(`[audio-track-controller]: No fallback audio-track found for name/language: "${name}" / "${lang}"`);
      return;
    }

    logger.log('[audio-track-controller]: Attempting audio-track fallback id:', newId, 'group-id:', this.tracks[newId].groupId);

    this._setAudioTrack(newId);
  }
}

export default AudioTrackController;
