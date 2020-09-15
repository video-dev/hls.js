import { Events } from '../events';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';
import { MediaPlaylist } from '../types/media-playlist';
import {
  TrackSwitchedData,
  ManifestParsedData,
  AudioTracksUpdatedData,
  ErrorData,
  LevelLoadingData,
  AudioTrackLoadedData
} from '../types/events';
import BasePlaylistController from './base-playlist-controller';
import Hls from '../hls';
import { HlsUrlParameters } from '../types/level';

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
class AudioTrackController extends BasePlaylistController {
  /**
   * @private
   * If should select tracks according to default track attribute
   * @member {boolean} _selectDefaultTrack
   */
  private selectDefaultTrack: boolean = true;
  private trackId: number = -1;

  private readonly restrictedTracks: { [key: number]: boolean } = Object.create(null);

  /**
   * @public
   * All tracks available
   * @member {AudioTrack[]}
   */
  public tracks: MediaPlaylist[] = [];

  /**
   * @public
   * The currently running group ID for audio
   * (we grab this on manifest-parsed and new level-loaded)
   * @member {string}
   */
  public audioGroupId: string | null = null;

  constructor (hls: Hls) {
    super(hls);
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
    super.destroy();
  }

  /**
   * Reset audio tracks on new manifest loading.
   */
  protected onManifestLoading (): void {
    this.tracks = [];
    this.trackId = -1;
    this.selectDefaultTrack = true;
    this.audioGroupId = null;
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
    this._selectAudioGroup(data.level);
  }

  private _selectAudioGroup (levelId: number) {
    const levelInfo = this.hls.levels[levelId];

    if (!levelInfo?.audioGroupIds) {
      return;
    }

    const audioGroupId = levelInfo.audioGroupIds[levelInfo.urlId];
    if (this.audioGroupId !== audioGroupId) {
      this.audioGroupId = audioGroupId;
      this._selectInitialAudioTrack();
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
    const track = this.tracks[trackId];
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
      this._setAudioTrack(newId);
    }
  }

  get audioTracks (): MediaPlaylist[] {
    return this.tracks;
  }

  get audioTrack (): number {
    return this.trackId;
  }

  set audioTrack (newId: number) {
    this._setAudioTrack(newId);
    // If audio track is selected from API then don't choose from the manifest default track
    this.selectDefaultTrack = false;
  }

  private _setAudioTrack (newId: number): void {
    // noop on same audio track id as already set
    if (this.trackId === newId && this.tracks[this.trackId].details) {
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
    this.trackId = newId;

    const { url, type, id } = audioTrack;
    this.hls.trigger(Events.AUDIO_TRACK_SWITCHING, { id, type, url });
    // TODO: LL-HLS use RENDITION-REPORT if available
    this.loadPlaylist();
  }

  private _selectInitialAudioTrack (): void {
    let tracks = this.tracks;
    console.assert(tracks.length, 'Initial audio track should be selected when tracks are known');

    const currentAudioTrack = this.tracks[this.trackId];

    let name: string | null = null;
    if (currentAudioTrack) {
      name = currentAudioTrack.name || null;
    }

    // Pre-select default tracks if there are any
    if (this.selectDefaultTrack) {
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

  protected loadPlaylist (hlsUrlParameters?: HlsUrlParameters): void {
    const audioTrack = this.tracks[this.trackId];
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
