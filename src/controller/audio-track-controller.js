import Event from '../events';
import TaskLoop from '../task-loop';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';

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
class AudioTrackController extends TaskLoop {
  constructor (hls) {
    super(hls,
      Event.MANIFEST_LOADING,
      Event.MANIFEST_PARSED,
      Event.AUDIO_TRACK_LOADED,
      Event.AUDIO_TRACK_SWITCHED,
      Event.LEVEL_LOADED,
      Event.ERROR
    );

    /**
     * @private
     * Currently selected index in `tracks`
     * @member {number} trackId
     */
    this._trackId = -1;

    /**
     * @private
     * If should select tracks according to default track attribute
     * @member {boolean} _selectDefaultTrack
     */
    this._selectDefaultTrack = true;

    /**
     * @public
     * All tracks available
     * @member {AudioTrack[]}
     */
    this.tracks = [];

    /**
     * @public
     * List of blacklisted audio track IDs (that have caused failure)
     * @member {number[]}
     */
    this.trackIdBlacklist = Object.create(null);

    /**
     * @public
     * The currently running group ID for audio
     * (we grab this on manifest-parsed and new level-loaded)
     * @member {string}
     */
    this.audioGroupId = null;
  }

  /**
   * Reset audio tracks on new manifest loading.
   */
  onManifestLoading () {
    this.tracks = [];
    this._trackId = -1;
    this._selectDefaultTrack = true;
  }

  /**
   * Store tracks data from manifest parsed data.
   *
   * Trigger AUDIO_TRACKS_UPDATED event.
   *
   * @param {*} data
   */
  onManifestParsed (data) {
    const tracks = this.tracks = data.audioTracks || [];
    this.hls.trigger(Event.AUDIO_TRACKS_UPDATED, { audioTracks: tracks });
  }

  /**
   * Store track details of loaded track in our data-model.
   *
   * Set-up metadata update interval task for live-mode streams.
   *
   * @param {} data
   */
  onAudioTrackLoaded (data) {
    if (data.id >= this.tracks.length) {
      logger.warn('Invalid audio track id:', data.id);
      return;
    }

    logger.log(`audioTrack ${data.id} loaded`);

    this.tracks[data.id].details = data.details;

    // check if current playlist is a live playlist
    // and if we have already our reload interval setup
    if (data.details.live && !this.hasInterval()) {
      // if live playlist we will have to reload it periodically
      // set reload period to playlist target duration
      const updatePeriodMs = data.details.targetduration * 1000;
      this.setInterval(updatePeriodMs);
    }

    if (!data.details.live && this.hasInterval()) {
      // playlist is not live and timer is scheduled: cancel it
      this.clearInterval();
    }
  }

  /**
   * Update the internal group ID to any audio-track we may have set manually
   * or because of a failure-handling fallback.
   *
   * Quality-levels should update to that group ID in this case.
   *
   * @param {*} data
   */
  onAudioTrackSwitched (data) {
    const audioGroupId = this.tracks[data.id].groupId;
    if (audioGroupId && (this.audioGroupId !== audioGroupId)) {
      this.audioGroupId = audioGroupId;
    }
  }

  /**
   * When a level gets loaded, if it has redundant audioGroupIds (in the same ordinality as it's redundant URLs)
   * we are setting our audio-group ID internally to the one set, if it is different from the group ID currently set.
   *
   * If group-ID got update, we re-select the appropriate audio-track with this group-ID matching the currently
   * selected one (based on NAME property).
   *
   * @param {*} data
   */
  onLevelLoaded (data) {
    // FIXME: crashes because currentLevel is undefined
    // const levelInfo = this.hls.levels[this.hls.currentLevel];

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

  /**
   * Handle network errors loading audio track manifests
   * and also pausing on any netwok errors.
   *
   * @param {ErrorEventData} data
   */
  onError (data) {
    // Only handle network errors
    if (data.type !== ErrorTypes.NETWORK_ERROR) {
      return;
    }

    // If fatal network error, cancel update task
    if (data.fatal) {
      this.clearInterval();
    }

    // If not an audio-track loading error don't handle further
    if (data.details !== ErrorDetails.AUDIO_TRACK_LOAD_ERROR) {
      return;
    }

    logger.warn('Network failure on audio-track id:', data.context.id);
    this._handleLoadError();
  }

  /**
   * @type {AudioTrack[]} Audio-track list we own
   */
  get audioTracks () {
    return this.tracks;
  }

  /**
   * @type {number} Index into audio-tracks list of currently selected track.
   */
  get audioTrack () {
    return this._trackId;
  }

  /**
   * Select current track by index
   */
  set audioTrack (newId) {
    this._setAudioTrack(newId);
    // If audio track is selected from API then don't choose from the manifest default track
    this._selectDefaultTrack = false;
  }

  /**
   * @private
   * @param {number} newId
   */
  _setAudioTrack (newId) {
    // noop on same audio track id as already set
    if (this._trackId === newId && this.tracks[this._trackId].details) {
      logger.debug('Same id as current audio-track passed, and track details available -> no-op');
      return;
    }

    // check if level idx is valid
    if (newId < 0 || newId >= this.tracks.length) {
      logger.warn('Invalid id passed to audio-track controller');
      return;
    }

    const audioTrack = this.tracks[newId];

    logger.log(`Now switching to audio-track index ${newId}`);

    // stopping live reloading timer if any
    this.clearInterval();
    this._trackId = newId;

    const { url, type, id } = audioTrack;
    this.hls.trigger(Event.AUDIO_TRACK_SWITCHING, { id, type, url });
    this._loadTrackDetailsIfNeeded(audioTrack);
  }

  /**
   * @override
   */
  doTick () {
    this._updateTrack(this._trackId);
  }

  /**
   * Select initial track
   * @private
   */
  _selectInitialAudioTrack () {
    let tracks = this.tracks;
    if (!tracks.length) {
      return;
    }

    const currentAudioTrack = this.tracks[this._trackId];

    let name = null;
    if (currentAudioTrack) {
      name = currentAudioTrack.name;
    }

    // Pre-select default tracks if there are any
    if (this._selectDefaultTrack) {
      const defaultTracks = tracks.filter((track) => track.default);
      if (defaultTracks.length) {
        tracks = defaultTracks;
      } else {
        logger.warn('No default audio tracks defined');
      }
    }

    let trackFound = false;

    const traverseTracks = () => {
      // Select track with right group ID
      tracks.forEach((track) => {
        if (trackFound) {
          return;
        }
        // We need to match the (pre-)selected group ID
        // and the NAME of the current track.
        if ((!this.audioGroupId || track.groupId === this.audioGroupId) &&
          (!name || name === track.name)) {
          // If there was a previous track try to stay with the same `NAME`.
          // It should be unique across tracks of same group, and consistent through redundant track groups.
          this._setAudioTrack(track.id);
          trackFound = true;
        }
      });
    };

    traverseTracks();

    if (!trackFound) {
      name = null;
      traverseTracks();
    }

    if (!trackFound) {
      logger.error(`No track found for running audio group-ID: ${this.audioGroupId}`);

      this.hls.trigger(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
        fatal: true
      });
    }
  }

  /**
   * @private
   * @param {AudioTrack} audioTrack
   * @returns {boolean}
   */
  _needsTrackLoading (audioTrack) {
    const { details, url } = audioTrack;

    if (!details || details.live) {
      // check if we face an audio track embedded in main playlist (audio track without URI attribute)
      return !!url;
    }

    return false;
  }

  /**
   * @private
   * @param {AudioTrack} audioTrack
   */
  _loadTrackDetailsIfNeeded (audioTrack) {
    if (this._needsTrackLoading(audioTrack)) {
      const { url, id } = audioTrack;
      // track not retrieved yet, or live playlist we need to (re)load it
      logger.log(`loading audio-track playlist for id: ${id}`);
      this.hls.trigger(Event.AUDIO_TRACK_LOADING, { url, id });
    }
  }

  /**
   * @private
   * @param {number} newId
   */
  _updateTrack (newId) {
    // check if level idx is valid
    if (newId < 0 || newId >= this.tracks.length) {
      return;
    }

    // stopping live reloading timer if any
    this.clearInterval();
    this._trackId = newId;
    logger.log(`trying to update audio-track ${newId}`);
    const audioTrack = this.tracks[newId];
    this._loadTrackDetailsIfNeeded(audioTrack);
  }

  /**
   * @private
   */
  _handleLoadError () {
    // First, let's black list current track id
    this.trackIdBlacklist[this._trackId] = true;

    // Let's try to fall back on a functional audio-track with the same group ID
    const previousId = this._trackId;
    const { name, language, groupId } = this.tracks[previousId];

    logger.warn(`Loading failed on audio track id: ${previousId}, group-id: ${groupId}, name/language: "${name}" / "${language}"`);

    // Find a non-blacklisted track ID with the same NAME
    // At least a track that is not blacklisted, thus on another group-ID.
    let newId = previousId;
    for (let i = 0; i < this.tracks.length; i++) {
      if (this.trackIdBlacklist[i]) {
        continue;
      }
      const newTrack = this.tracks[i];
      if (newTrack.name === name) {
        newId = i;
        break;
      }
    }

    if (newId === previousId) {
      logger.warn(`No fallback audio-track found for name/language: "${name}" / "${language}"`);
      return;
    }

    logger.log('Attempting audio-track fallback id:', newId, 'group-id:', this.tracks[newId].groupId);

    this._setAudioTrack(newId);
  }
}

export default AudioTrackController;
