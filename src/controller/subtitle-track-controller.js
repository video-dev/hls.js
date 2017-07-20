/*
 * subtitle track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';

function filterSubtitleTracks(textTrackList) {
  let tracks = [];
  for (let i = 0; i < textTrackList.length; i++) {
    if (textTrackList[i].kind === 'subtitles') {
      tracks.push(textTrackList[i]);
    }
  }
  return tracks;
}

class SubtitleTrackController extends EventHandler {

  constructor(hls) {
    super(hls,
               Event.MEDIA_ATTACHED,
               Event.MEDIA_DETACHING,
               Event.MANIFEST_LOADING,
               Event.MANIFEST_LOADED,
               Event.SUBTITLE_TRACK_LOADED);
    this._hls = hls;
    this._tracks = [];
    this._trackId = -1;
    this._media = undefined;
    this._subtitleDisplay = false;
  }

  _onTextTracksChanged() {
    // Media is undefined when switching streams via loadSource()
    if (!this._media) {
      return;
    }

    let trackId = -1;
    let tracks = filterSubtitleTracks(this._media.textTracks);
    for (let id = 0; id < tracks.length; id++) {
      if (tracks[id].mode === 'showing') {
        trackId = id;
      }
    }

    // Setting current subtitleTrack will invoke code.
    this._subtitleTrack = trackId;
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  // Listen for subtitle track change, then extract the current track ID.
  onMediaAttached(data) {
    this._media = data.media;
    if (!this._media) {
      return;
    }

    if (this._queuedDefaultTrack !== undefined) {
      this._subtitleTrack = this._queuedDefaultTrack;
      delete this._queuedDefaultTrack;
    }

    this._trackChangeListener = this._onTextTracksChanged.bind(this);

    this._useTextTrackPolling = !(this._media.textTracks && 'onchange' in this._media.textTracks);
    if (this._useTextTrackPolling) {
      this._subtitlePollingInterval = setInterval(() => {
        this._trackChangeListener();
      }, 500);
    } else {
      this._media.textTracks.addEventListener('change', this._trackChangeListener);
    }
  }

  onMediaDetaching() {
    if (!this._media) {
      return;
    }
    if (this._useTextTrackPolling) {
      clearInterval(this._subtitlePollingInterval);
    } else {
      this._media.textTracks.removeEventListener('change', this._trackChangeListener);
    }

    this._media = undefined;
  }

  // Reset subtitle tracks on manifest loading
  onManifestLoading() {
    this._tracks = [];
    this._trackId = -1;
  }

  // Fired whenever a new manifest is loaded.
  onManifestLoaded(data) {
    let tracks = data.subtitles || [];
    this._tracks = tracks;
    this._trackId = -1;
    this._hls.trigger(Event.SUBTITLE_TRACKS_UPDATED, {subtitleTracks : tracks});

    // loop through available subtitle tracks and autoselect default if needed
    // TODO: improve selection logic to handle forced, etc
    tracks.forEach(track => {
      if (track.default) {
        // setting this.subtitleTrack will trigger internal logic
        // if media has not been attached yet, it will fail
        // we keep a reference to the default track id
        // and we'll set subtitleTrack when onMediaAttached is triggered
        if (this._media) {
          this._subtitleTrack = track.id;
        } else {
          this._queuedDefaultTrack = track.id;
        }
      }
    });
  }

  // Trigger subtitle track playlist reload.
  _onTick() {
    const trackId = this._trackId;
    const subtitleTrack = this._tracks[trackId];
    if (!subtitleTrack) {
      return;
    }

    const details = subtitleTrack.details;
    // check if we need to load playlist for this subtitle Track
    if (details === undefined || details.live === true) {
      // track not retrieved yet, or live playlist we need to (re)load it
      logger.log(`(re)loading playlist for subtitle track ${trackId}`);
      this._hls.trigger(Event.SUBTITLE_TRACK_LOADING, {url: subtitleTrack.url, id: trackId});
    }
  }

  onSubtitleTrackLoaded(data) {
    if (data.id < this._tracks.length) {
      logger.log(`subtitle track ${data.id} loaded`);
      this._tracks[data.id].details = data.details;
      // check if current playlist is a live playlist
      if (data.details.live && !this._timer) {
        // if live playlist we will have to reload it periodically
        // set reload period to playlist target duration
        this._timer = setInterval(() => {
          this._onTick();
        }, 1000 * data.details.targetduration, this);
      }
      if (!data.details.live && this._timer) {
        // playlist is not live and timer is armed : stopping it
        clearInterval(this._timer);
        this._timer = null;
      }
    }
  }

  /** get alternate subtitle tracks list from playlist **/
  get subtitleTracks() {
    return this._tracks;
  }

  /** get index of the selected subtitle track (index in subtitle track lists) **/
  get subtitleTrack() {
   return this._trackId;
  }

  /** select a subtitle track, based on its index in subtitle track lists**/
  set subtitleTrack(subtitleTrackId) {
    if (this._trackId !== subtitleTrackId) {// || this._tracks[subtitleTrackId].details === undefined) {
      this._setSubtitleTrackInternal(subtitleTrackId);
    }
  }

 _setSubtitleTrackInternal(newId) {
    // check if level idx is valid
    if (newId < -1 || newId >= this._tracks.length) {
      return;
    }

    // stopping live reloading timer if any
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }

    let textTracks = filterSubtitleTracks(this._media.textTracks);

    // hide currently enabled subtitle track
    if (this._trackId !== -1 && this._subtitleDisplay) {
      textTracks[this._trackId].mode = 'hidden';
    }

    this._trackId = newId;
    logger.log(`switching to subtitle track ${newId}`);
    this._hls.trigger(Event.SUBTITLE_TRACK_SWITCH, {id: newId});

    if (newId === -1) {
      return;
    }

    let subtitleTrack = this._tracks[newId];
    if (this._subtitleDisplay) {
      textTracks[newId].mode = 'showing';
    }

    // check if we need to load playlist for this subtitle Track
    let details = subtitleTrack.details;
    if (details === undefined || details.live === true) {
      // track not retrieved yet, or live playlist we need to (re)load it
      logger.log(`(re)loading playlist for subtitle track ${newId}`);
      this._hls.trigger(Event.SUBTITLE_TRACK_LOADING, {url: subtitleTrack.url, id: newId});
    }
  }
}

export default SubtitleTrackController;
