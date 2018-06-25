/*
 * subtitle track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';

function filterSubtitleTracks (textTrackList) {
  let tracks = [];
  for (let i = 0; i < textTrackList.length; i++) {
    if (textTrackList[i].kind === 'subtitles') {
      tracks.push(textTrackList[i]);
    }
  }
  return tracks;
}

class SubtitleTrackController extends EventHandler {
  constructor (hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.MANIFEST_LOADING,
      Event.MANIFEST_LOADED,
      Event.SUBTITLE_TRACK_LOADED);
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
    this.trackId = -1;
  }

  // Fired whenever a new manifest is loaded.
  onManifestLoaded (data) {
    let tracks = data.subtitles || [];
    this.tracks = tracks;
    this.trackId = -1;
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

  // Trigger subtitle track playlist reload.
  onTick () {
    const trackId = this.trackId;
    const subtitleTrack = this.tracks[trackId];
    if (!subtitleTrack) {
      return;
    }

    const details = subtitleTrack.details;
    // check if we need to load playlist for this subtitle Track
    if (!details || details.live) {
      // track not retrieved yet, or live playlist we need to (re)load it
      logger.log(`(re)loading playlist for subtitle track ${trackId}`);
      this.hls.trigger(Event.SUBTITLE_TRACK_LOADING, { url: subtitleTrack.url, id: trackId });
    }
  }

  onSubtitleTrackLoaded (data) {
    if (data.id < this.tracks.length) {
      logger.log(`subtitle track ${data.id} loaded`);
      this.tracks[data.id].details = data.details;
      // check if current playlist is a live playlist
      if (data.details.live && !this.timer) {
        // if live playlist we will have to reload it periodically
        // set reload period to playlist target duration
        this.timer = setInterval(() => {
          this.onTick();
        }, 1000 * data.details.targetduration, this);
      }
      if (!data.details.live && this.timer) {
        // playlist is not live and timer is armed : stopping it
        this._stopTimer();
      }
    }
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
    if (typeof newId !== 'number' || newId < -1 || newId >= tracks.length) {
      return;
    }

    this._stopTimer();
    this.trackId = newId;
    logger.log(`switching to subtitle track ${newId}`);
    hls.trigger(Event.SUBTITLE_TRACK_SWITCH, { id: newId });
    if (newId === -1) {
      return;
    }

    // check if we need to load playlist for this subtitle Track
    const subtitleTrack = tracks[newId];
    const details = subtitleTrack.details;
    if (!details || details.live) {
      // track not retrieved yet, or live playlist we need to (re)load it
      logger.log(`(re)loading playlist for subtitle track ${newId}`);
      hls.trigger(Event.SUBTITLE_TRACK_LOADING, { url: subtitleTrack.url, id: newId });
    }
  }

  _stopTimer () {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
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
}

export default SubtitleTrackController;
