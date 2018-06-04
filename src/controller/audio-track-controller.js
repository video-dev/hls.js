import Event from '../events';
import TaskLoop from '../task-loop';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';

/**
 * Audio-track controller
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
     * All tracks available
     * @member {AudioTrack[]}
     */
    this.tracks = [];

    /**
     * Currently selected index in `tracks`
     * @member {number} trackId
     */
    this.trackId = -1;

    /**
     * List of blacklisted audio track IDs (that have caused failure)
     * @member {number[]}
     */
    this.trackIdBlacklist = Object.create(null);

    /**
     * The currently running group ID for audio
     * (we grab this on manifest-parsed and new level-loaded)
     * @member {string}
     */
    this.audioGroupId = null;
  }

  /**
   * Handle network errors loading audio track manifests
   * and also pausing on any netwok errors.
   * @param {ErrorEventData} data
   */
  onError (data) {
    if (data.fatal && data.type === ErrorTypes.NETWORK_ERROR) {
      this.clearInterval();
    }

    if (data.type !== ErrorTypes.NETWORK_ERROR) {
      return;
    }

    switch (data.details) {
    case ErrorDetails.AUDIO_TRACK_LOAD_ERROR:
      logger.warn('Network failure on audio-track id:', data.context.id);
      this._handleLoadError();
      break;
    default:
      break;
    }
  }

  /**
   * Reset audio tracks on new manifest loading
   */
  onManifestLoading () {
    this.tracks = [];
    this.trackId = -1;

    // this._selectInitialAudioTrack();
  }

  /**
   * Store tracks data from manifest parsed data
   * @param {*} data
   */
  onManifestParsed (data) {
    const tracks = this.tracks = data.audioTracks || [];
    this.hls.trigger(Event.AUDIO_TRACKS_UPDATED, { audioTracks: tracks });
  }

  onAudioTrackLoaded (data) {
    if (data.id < this.tracks.length) {
      logger.log(`audioTrack ${data.id} loaded`);
      this.tracks[data.id].details = data.details;
      // check if current playlist is a live playlist
      if (data.details.live && !this.hasInterval()) {
        // if live playlist we will have to reload it periodically
        // set reload period to playlist target duration
        const updatePeriodMs = data.details.targetduration * 1000;
        this.setInterval(updatePeriodMs);
      }
      if (!data.details.live && this.hasInterval()) {
        // playlist is not live and timer is armed : stopping it
        this.clearInterval();
      }
    }
  }

  onAudioTrackSwitched (data) {
    const audioGroupId = this.hls.audioTracks[data.id].groupId;

    if (audioGroupId && (this.audioGroupId !== audioGroupId)) {
      this.audioGroupId = audioGroupId;

      this._selectInitialAudioTrack();
    }
  }

  /**
   *
   * @param {*} data
   */
  onLevelLoaded (data) {
    // FIXME: crashes because currentLevel is undefined
    // const levelInfo = this.hls.levels[this.hls.currentLevel];

    const levelInfo = this.hls.levels[data.level];

    if (levelInfo.audioGroupIds) {
      const audioGroupId = levelInfo.audioGroupIds[levelInfo.urlId];

      if (this.audioGroupId !== audioGroupId) {
        this.audioGroupId = audioGroupId;
        this._selectInitialAudioTrack();
      }
    }
  }

  /**
   * @type {AudioTrack[]} Audio-track list
   */
  get audioTracks () {
    return this.tracks;
  }

  /**
   * @type {number} Index in audio-tracks list
   */
  get audioTrack () {
    return this.trackId;
  }

  set audioTrack (newId) {
    // noop on same audio track id as already set
    if (this.trackId === newId && this.tracks[this.trackId].details) {
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
    this.trackId = newId;

    const { url, type, id } = audioTrack;
    this.hls.trigger(Event.AUDIO_TRACK_SWITCHING, { id, type, url });
    this._loadTrackDetailsIfNeeded(audioTrack);
  }

  /**
   * @override
   */
  doTick () {
    this._updateTrack(this.trackId);
  }

  /**
   * Select initial track
   * @private
   */
  _selectInitialAudioTrack () {
    const currentAudioTrack = this.tracks[this.trackId];

    let name = null;
    if (currentAudioTrack) {
      name = currentAudioTrack.name;
    }

    let tracks = this.tracks;

    if (!tracks.length) {
      return;
    }

    // Pre-select default tracks if there are any
    const defaultTracks = tracks.filter((track) => track.default);
    if (defaultTracks.length) {
      tracks = defaultTracks;
    } else {
      logger.warn('No default audio tracks defined');
    }

    let trackFound = false;
    const traverseTracks = () => {
      // Select track with right group ID

      tracks.forEach((track) => {
        if (trackFound) {
          return;
        }
        if (
          (!this.audioGroupId || track.groupId === this.audioGroupId) &&
          (!name || name === track.name)) { // If there was a previous track try to stay with the same `NAME`
          // (should be unique across tracks, but consistent through redundant tracks)
          this.audioTrack = track.id;
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

      // this.audioTrack = 0;
    }
  }

  /**
   * @private
   * @param {AudioTrack} audioTrack
   * @returns {boolean}
   */
  _needsTrackLoading (audioTrack) {
    const { details } = audioTrack;

    if (!details) {
      return true;
    } else if (details.live) {
      return true;
    }
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
    this.trackId = newId;
    logger.log(`trying to update audio-track ${newId}`);
    const audioTrack = this.tracks[newId];
    this._loadTrackDetailsIfNeeded(audioTrack);
  }

  /**
   * @private
   */
  _handleLoadError () {
    // First, let's black list current track id
    this.trackIdBlacklist[this.trackId] = true;

    // Let's try to fall back on a functional audio-track with the same group ID
    const previousId = this.trackId;
    const { name, language, groupId } = this.tracks[previousId];

    logger.warn(`Loading failed on audio track id: ${previousId}, group-id: ${groupId}, name/language: "${name}" / "${language}"`);

    // Find a non-blacklisted track ID with the same NAME/LANGUAGE
    let newId = previousId;
    for (let i = 0; i < this.tracks.length; i++) {
      if (this.trackIdBlacklist[i]) {
        continue;
      }
      const newTrack = this.tracks[i];
      if (newTrack.name === name &&
       newTrack.language === language) {
        newId = i;
        break;
      }
    }

    if (newId === previousId) {
      logger.warn(`No fallback audio-track found for name/language: "${name}" / "${language}"`);
      return;
    }

    logger.log('Attempting audio-track fallback id:', newId, 'group-id:', this.tracks[newId].groupId);

    this.audioTrack = newId;
  }
}

export default AudioTrackController;
