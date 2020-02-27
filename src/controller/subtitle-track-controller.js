
import Event from '../events';
import TaskLoop from '../task-loop';
import { logger } from '../utils/logger';
import { computeReloadInterval } from './level-helper';
import { clearCurrentCues, filterSubtitleTracks } from '../utils/texttrack-utils';
import { ErrorDetails, ErrorTypes } from '../errors';

/**
 * Subtitle-track-controller, handles states of text-track selection combining user API inputs,
 * manifest default selection and current level group-ID running.
 *
 * @class
 */
class SubtitleTrackController extends TaskLoop {
  constructor (hls) {
    super(hls,
      Event.ERROR,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.MANIFEST_LOADED,
      Event.LEVEL_LOADED,
      Event.SUBTITLE_TRACK_LOADED);

    /**
     * @member {SubtitleTrack[]}
     */
    this.tracks = [];

    /**
     * Currently selected track index
     * @member {number}
     */
    this.trackId = -1;

    /**
     * @member {HTMLMediaElement}
     */
    this.media = null;
    this.stopped = true;

    /**
     * @member {boolean} subtitleDisplay Enable/disable subtitle display rendering
     */
    this.subtitleDisplay = true;

    /**
     * Keeps reference to a default track id when media has not been attached yet
     * @member {number}
     */
    this.queuedDefaultTrack = null;

    /**
     * @public
     * Flag hash of blacklisted track IDs (that have caused failure)
     * @member {{[id: number] => boolean}}
     */
    this.trackIdBlacklist = Object.create(null);

    /**
     * @private
     * The currently running group ID for text (CC)
     * (we grab this on manifest-parsed and new level-loaded)
     * @member {string}
     */
    this._subtitleGroupId = null;

    /**
     * Stores the selected track before media has been attached
     * @private {SubtitleTrack | null}
     */
    this._queuedDefaultTrack = null;

    /**
     * If should select tracks according to default track attribute
     * @private
     * @member {boolean} selectDefaultTrack
     */
    this._selectDefaultTrack = true;
  }

  doTick () {
    this._loadCurrentTrack();
  }

  // Listen for subtitle track change, then extract the current track ID.
  onMediaAttached (data) {
    this.media = data.media;
    if (!this.media) {
      return;
    }

    if (Number.isFinite(this.queuedDefaultTrack)) {
      this._setSubtitleTrack(this._queuedDefaultTrack.id);
      this._queuedDefaultTrack = null;
    }

    this.trackChangeListener = this._onTextTracksChanged.bind(this);

    this.useTextTrackPolling = !(this.media.textTracks && 'onchange' in this.media.textTracks);
    if (this.useTextTrackPolling) {
      // FIXME
      /*
      this.subtitlePollingInterval = setInterval(() => {
        this.trackChangeListener();
      }, 500);
      */
    } else {
      this.media.textTracks.addEventListener('change', this.trackChangeListener);
    }
  }

  onMediaDetaching () {
    if (!this.media) {
      return;
    }

    if (this.useTextTrackPolling) {
      clearInterval(this.subtitlePollingInterval);
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

  onLevelLoaded (data) {
    const levelInfo = this.hls.levels[data.level];

    if (!levelInfo.subtitleGroupIds) {
      return;
    }

    const subtitleGroupId = levelInfo.subtitleGroupIds[levelInfo.urlId];

    if (this._subtitleGroupId !== subtitleGroupId) {
      this._subtitleGroupId = subtitleGroupId;

      logger.log('set subtitle group id:', subtitleGroupId);

      this._selectInitialSubtitleTrack();
    }
  }

  // Fired whenever a new manifest is loaded.
  onManifestLoaded (data) {
    let tracks = data.subtitles || [];
    this.tracks = tracks;
    this.hls.trigger(Event.SUBTITLE_TRACKS_UPDATED, { subtitleTracks: tracks });

    // loop through available subtitle tracks and autoselect default if needed
    // TODO: improve selection logic to handle forced, etc
    tracks.forEach(track => {
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

  onSubtitleTrackLoaded (data) {
    const { id, details } = data;
    const { trackId, tracks } = this;
    const currentTrack = tracks[trackId];
    if (id >= tracks.length || id !== trackId || !currentTrack || this.stopped) {
      this.clearInterval();
      return;
    }

    logger.log(`subtitle track ${id} loaded`);
    if (details.live) {
      const reloadInterval = computeReloadInterval(currentTrack.details, details, data.stats.trequest);
      logger.log(`Reloading live subtitle playlist in ${reloadInterval}ms`);
      this.clearInterval();
      this.setInterval(reloadInterval);
    } else {
      this.clearInterval();
    }
  }

  startLoad () {
    this.stopped = false;
    this._loadCurrentTrack();
  }

  stopLoad () {
    this.stopped = true;
    this._clearReloadTimer();
  }

  onError (data) {
    // TODO: implement similar failure handling logic as in audio-track-controller
    //       -> for this we first need to declare some error codes for subtitle track loading
    //          and also actually trigger such an error event in subtitle-stream-controller

    // Only handle network errors
    if (data.type !== ErrorTypes.NETWORK_ERROR) {
      return;
    }

    // If fatal network error, cancel update task
    if (data.fatal) {
      this.clearInterval();
    }

    // If not an subs-track loading error don't handle further
    if (data.details !== ErrorDetails.SUBTITLE_TRACK_LOAD_ERROR) {
      return;
    }

    logger.warn('Network failure on subtitle-track id:', data.context.id);
    this._handleLoadError();
  }

  /**
   * @public
   * @type {SubititleTrack[]}
   */
  get subtitleTracks () {
    return this.tracks;
  }

  /**
   * @public
   * @type {SubititleTrack}
   */
  /** get index of the selected subtitle track (index in subtitle track lists) **/
  get subtitleTrack () {
    return this.trackId;
  }

  /**
   * @public
   * @type {SubititleTrack}
   */
  /** select a subtitle track, based on its index in subtitle track lists**/
  set subtitleTrack (subtitleTrackId) {
    if (this.trackId !== subtitleTrackId) {
      this._toggleTrackModes(subtitleTrackId);
      this._setSubtitleTrack(subtitleTrackId);
      this._selectDefaultTrack = false;
    }
  }

  _loadCurrentTrack () {
    const { trackId, tracks, hls } = this;
    const currentTrack = tracks[trackId];
    if (trackId < 0 || !currentTrack || (currentTrack.details && !currentTrack.details.live)) {
      return;
    }
    logger.log(`Loading subtitle track ${trackId}`);
    hls.trigger(Event.SUBTITLE_TRACK_LOADING, { url: currentTrack.url, id: trackId });
  }

  _updateTrack () {
    const trackId = this.trackId;
    const subtitleTrack = this.tracks[trackId];
    if (!subtitleTrack) {
      return;
    }

    const details = subtitleTrack.details;
    // check if we need to load playlist for this subtitle Track
    if (!details || details.live) {
      // track not retrieved yet, or live playlist we need to (re)load it
      logger.log(`updating playlist for subtitle track ${trackId}`);
      this.hls.trigger(Event.SUBTITLE_TRACK_LOADING, { url: subtitleTrack.url, id: trackId });
    }
  }

  /**
   * @private
   * Called when we want to reselect the track based on current environment params have been updated,
   * like wether we should fallback to default selection, or match the current level group id upon
   * a level switch that involved a group-ID switch for subs.
   */
  _selectInitialSubtitleTrack () {
    // loop through available subtitle tracks and autoselect default if needed
    // TODO: improve selection logic to handle forced, etc

    let selectedTrack = null;

    const tracks = this.tracks.filter(
      (track) => this._subtitleGroupId === null || track.groupId === this._subtitleGroupId
    );

    if (!tracks.length) {
      return;
    }

    logger.log('Looking for selectable subtitle track...');

    const defaultTracks = tracks.filter((track) => track.default);

    if (this.selectDefaultTrack && defaultTracks.length) {
      selectedTrack = defaultTracks[0];
    } else if (tracks.length) {
      selectedTrack = tracks[0];
    } else {
      logger.warn('No selectable subtitle tracks found');
      return;
    }

    logger.log(`Selecting subtitle track id: ${selectedTrack.id}, name: ${selectedTrack.name}, group-ID: ${selectedTrack.groupId}`);

    if (this.media) {
      this._toggleTrackModes(selectedTrack.id);
      this._setSubtitleTrack(selectedTrack.id);
    } else {
      this._queuedDefaultTrack = selectedTrack.id;
    }
  }

  /**
   * Disables the old subtitleTrack and sets current mode on the next subtitleTrack.
   * This operates on the DOM textTracks.
   * A value of -1 will disable all subtitle tracks.
   * @param newId - The id of the next track to enable
   * @private
   */
  _toggleTrackModes (newId) {
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
   * @private
   * Dispatches the SUBTITLE_TRACK_SWITCH event, which instructs the subtitle-stream-controller to load the selected track.
   * @param newId - The id of the subtitle track to activate.
   */
  _setSubtitleTrack (newId) {
    const { hls, tracks } = this;

    if (!Number.isFinite(newId) || newId < -1 || newId >= tracks.length) {
      return;
    }

    // stopping live reloading timer if any
    this.clearInterval();
    this.trackId = newId;

    logger.log(`Switching to subtitle track ${newId}`);
    hls.trigger(Event.SUBTITLE_TRACK_SWITCH, { id: newId });
    this._loadCurrentTrack();

  }

  _onTextTracksChanged () {
    // Media is undefined when switching streams via loadSource()
    if (!this.media) {
      return;
    }

    let trackId = -1;
    let tracks = filterSubtitleTracks(this.media.textTracks);
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

  /**
   * @private
   */
  _handleLoadError () {
    // First, let's black list current track id
    this.trackIdBlacklist[this.trackId] = true;

    // Let's try to fall back on a functional audio-track with the same group ID
    const previousId = this.trackId;
    const { name, language, groupId } = this.tracks[previousId];

    logger.warn(`Loading failed on subtitle track id: ${previousId}, group-id: ${groupId}, name/language: "${name}" / "${language}"`);

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
      logger.warn(`No fallback subtitle-track found for name/language: "${name}" / "${language}"`);
      return;
    }

    logger.log('Attempting subtitle-track fallback id:', newId, 'group-id:', this.tracks[newId].groupId);

    this._setSubtitleTrack(newId);
  }
}

export default SubtitleTrackController;
