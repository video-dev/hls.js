import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';
import { computeReloadInterval } from './level-helper';

class SubtitleTrackController extends EventHandler {
  constructor (hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.MANIFEST_LOADED,
      Event.SUBTITLE_TRACK_LOADED);
    this.tracks = [];
    this.trackId = -1;
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
  }

  destroy () {
    EventHandler.prototype.destroy.call(this);
  }

  // Listen for subtitle track change, then extract the current track ID.
  onMediaAttached (data) {
    this.media = data.media;
    if (!this.media) {
      return;
    }

    if (Number.isFinite(this.queuedDefaultTrack)) {
      this.subtitleTrack = this.queuedDefaultTrack;
      this.queuedDefaultTrack = null;
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
      this._clearReloadTimer();
      return;
    }

    logger.log(`subtitle track ${id} loaded`);
    if (details.live) {
      const reloadInterval = computeReloadInterval(currentTrack.details, details, data.stats.trequest);
      logger.log(`Reloading live subtitle playlist in ${reloadInterval}ms`);
      this.timer = setTimeout(() => {
        this._loadCurrentTrack();
      }, reloadInterval);
    } else {
      this._clearReloadTimer();
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

  /** get alternate subtitle tracks list from playlist **/
  get subtitleTracks () {
    return this.tracks;
  }

  /** get index of the selected subtitle track (index in subtitle track lists) **/
  get subtitleTrack () {
    return this.trackId;
  }

  /** select a subtitle track, based on its index in subtitle track lists**/
  set subtitleTrack (subtitleTrackId) {
    if (this.trackId !== subtitleTrackId) {
      this._toggleTrackModes(subtitleTrackId);
      this._setSubtitleTrackInternal(subtitleTrackId);
    }
  }

  _clearReloadTimer () {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
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
     * This method is responsible for validating the subtitle index and periodically reloading if live.
     * Dispatches the SUBTITLE_TRACK_SWITCH event, which instructs the subtitle-stream-controller to load the selected track.
     * @param newId - The id of the subtitle track to activate.
     */
  _setSubtitleTrackInternal (newId) {
    const { hls, tracks } = this;
    if (!Number.isFinite(newId) || newId < -1 || newId >= tracks.length) {
      return;
    }

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
}

function filterSubtitleTracks (textTrackList) {
  let tracks = [];
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
