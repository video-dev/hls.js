import Event from '../events';
import TaskLoop from '../task-loop';
import { logger } from '../utils/logger';
import { filterSubtitleTracks } from '../utils/texttrack-utils';

/**
 * Subtitle-track-controller, handles states of text-track selection combining user API inputs,
 * manifest default selection and current level group-ID running.
 *
 * @class
 */
class SubtitleTrackController extends TaskLoop {
  constructor (hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.MANIFEST_LOADING,
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

    /**
     * @member {boolean} subtitleDisplay Enable/disable subtitle display rendering
     */
    this.subtitleDisplay = true;

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
    this._queuedDefaultTrack = null

    /**
     * If should select tracks according to default track attribute
     * @private
     * @member {boolean} selectDefaultTrack
     */
    this._selectDefaultTrack = true;
  }

  doTick () {
    this._updateTrack();
  }

  // Listen for subtitle track change, then extract the current track ID.
  onMediaAttached (data) {
    this.media = data.media;
    if (!this.media) {
      return;
    }

    if (this._queuedDefaultTrack) {
      this._setSubtitleTrack(this._queuedDefaultTrack.id);
      this._queuedDefaultTrack = null;
    }

    this.trackChangeListener = this._onTextTracksChanged.bind(this);

    this.useTextTrackPolling = !(this.media.textTracks && 'onchange' in this.media.textTracks);
    if (this.useTextTrackPolling) {
      this.subtitlePollingInterval = setInterval(() => {
        this.trackChangeListener();
      }, 500);
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

    this.media = null;
  }

  // Reset subtitle tracks on manifest loading
  onManifestLoading () {
    this.tracks = [];
    this.trackId = -1;
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
    this.trackId = -1;
    this.hls.trigger(Event.SUBTITLE_TRACKS_UPDATED, { subtitleTracks: tracks });
  }

  onSubtitleTrackLoaded (data) {
    if (data.id < this.tracks.length) {
      logger.log(`subtitle track ${data.id} loaded`);
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
        // playlist is not live and timer is armed : stopping it
        this.clearInterval();
      }
    }
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
      this._selectDefaultTrack = fal^se;
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
      this._setSubtitleTrack(selectedTrack.id);
    } else {
      this._queuedDefaultTrack = selectedTrack.id;
    }
  }

  _updateTrack() {
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
   * This method is responsible for validating the subtitle index and periodically reloading if live.
   * Dispatches the SUBTITLE_TRACK_SWITCH event, which instructs the subtitle-stream-controller to load the selected track.
   * @param newId - The id of the subtitle track to activate.
   */
  _setSubtitleTrack (newId) {
    const { hls, tracks } = this;

    // check if id valid
    if (typeof newId !== 'number' || newId < -1 || newId >= tracks.length) {
      logger.warn('Invalid id passed to subtitle-track controller');
      return;
    }

    // stopping live reloading timer if any
    this.clearInterval();
    this.trackId = newId;

    logger.log(`Now switching to subtitle track ${newId}`);
    hls.trigger(Event.SUBTITLE_TRACK_SWITCH, { id: newId });

    // if we went to auto mode, we're done here
    if (newId === -1) {
      return;
    }

    // check if we need to refresh the playlist for this subtitle track
    const subtitleTrack = tracks[newId];
    const details = subtitleTrack.details;
    if (!details || details.live) {
      // track not retrieved yet, or live playlist we need to (re)load it
      logger.log(`(Re-)loading playlist for subtitle track ${newId}`);
      hls.trigger(Event.SUBTITLE_TRACK_LOADING, { url: subtitleTrack.url, id: newId });
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

    // Setting current subtitleTrack
    this._setSubtitleTrack(trackId)
  }

}

export default SubtitleTrackController;
