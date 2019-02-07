import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';
import { mergeSubtitlePlaylists } from './level-helper';

class SubtitleTrackController extends EventHandler {
  constructor (hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.MANIFEST_LOADING,
      Event.MANIFEST_LOADED,
      Event.SUBTITLE_TRACK_LOADED,
      Event.LEVEL_UPDATED);
    this.tracks = [];
    this.trackId = -1;
    this.media = null;

    /**
     * @member {boolean} subtitleDisplay Enable/disable subtitle display rendering
     */
    this.subtitleDisplay = true;
  }

  _onTextTracksChanged () {
    // Media is undefined when switching streams via loadSource()
    if (!this.media || !this.hls.config.renderNatively) {
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

  destroy () {
    EventHandler.prototype.destroy.call(this);
  }

  // Listen for subtitle track change, then extract the current track ID.
  onMediaAttached (data) {
    this.media = data.media;
    if (!this.media) {
      return;
    }

    if (this.queuedDefaultTrack) {
      this.subtitleTrack = this.queuedDefaultTrack;
      delete this.queuedDefaultTrack;
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
    // this.trackId = -1;
  }

  // Fired whenever a new manifest is loaded.
  onManifestLoaded (data) {
    let tracks = data.subtitles || [];
    this.tracks = tracks;
    // this.trackId = -1;
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
    if (id >= tracks.length || !currentTrack) {
      return;
    }
    logger.log(`subtitle track ${id} loaded`);
    const { live, url, targetduration } = details;
    if (live) {
      mergeSubtitlePlaylists(currentTrack.details, details, this.lastAVStart);
      currentTrack.details = details;
      this._setReloadTimer(id, url, targetduration);
    } else {
      currentTrack.details = details;
      this._stopTimer();
    }
  }

  onLevelUpdated ({ details }) {
    const frags = details.fragments;
    this.lastAVStart = frags.length ? frags[0].start : 0;
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
      this.setSubtitleTrackInternal(subtitleTrackId);
    }
  }

  /**
   * This method is responsible for validating the subtitle index and periodically reloading if live.
   * Dispatches the SUBTITLE_TRACK_SWITCH event, which instructs the subtitle-stream-controller to load the selected track.
   * @param newId - The id of the subtitle track to activate.
   */
  setSubtitleTrackInternal (newId) {
    const { hls, tracks } = this;
    if (!Number.isFinite(newId) || newId < -1 || newId >= tracks.length) {
      return;
    }

    this._stopTimer();
    this.trackId = newId;
    logger.log(`switching to subtitle track ${newId}`);
    hls.trigger(Event.SUBTITLE_TRACK_SWITCH, { id: newId });
    if (newId === -1) {
      return;
    }

    const subtitleTrack = tracks[newId];
    const details = subtitleTrack.details;
    if (!details || details.live) {
      // Load the playlist if it hasn't been loaded before. If it has and it's live, kick off loading immediately. The
      // onSubtitleTrackLoaded handler will kick off the reload interval afterwards.
      logger.log(`(re)loading playlist for subtitle track ${newId}`);
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

  _stopTimer () {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  _setReloadTimer (id, url, reloadIntervalSeconds) {
    const { trackId, hls } = this;
    if (trackId !== id || !this.timer) {
      this._stopTimer();
      this.timer = setInterval(() => {
        logger.log(`reloading playlist for subtitle track ${id}`);
        hls.trigger(Event.SUBTITLE_TRACK_LOADING, { url, id });
      }, 1000 * reloadIntervalSeconds, this);
    }
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
