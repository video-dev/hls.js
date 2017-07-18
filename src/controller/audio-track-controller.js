/*
 * audio track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';
import {ErrorTypes} from '../errors';

class AudioTrackController extends EventHandler {

  constructor(hls) {
    super(hls, Event.MANIFEST_LOADING,
               Event.MANIFEST_PARSED,
               Event.AUDIO_TRACK_LOADED,
               Event.ERROR);
    this._ticks = 0;
    this._hls = hls;
    this._ontick = this._tick.bind(this);
  }

  destroy() {
    this._cleanTimer();
    EventHandler.prototype.destroy.call(this);
  }

  _cleanTimer() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  _tick() {
    this._ticks++;
    if (this._ticks === 1) {
      this._doTick();
      if (this._ticks > 1) {
        setTimeout(this._tick, 1);
      }
      this._ticks = 0;
    }
  }

  _doTick() {
    this._updateTrack(this._trackId);
  }

  onError(data) {
    if(data.fatal && data.type === ErrorTypes.NETWORK_ERROR) {
      this._cleanTimer();
    }
  }

  onManifestLoading() {
    // reset audio tracks on manifest loading
    this._tracks = [];
    this._trackId = -1;
  }

  onManifestParsed(data) {
    let tracks = data.audioTracks || [];
    let defaultFound = false;
    this._tracks = tracks;
    this._hls.trigger(Event.AUDIO_TRACKS_UPDATED, {audioTracks : tracks});
    // loop through available audio tracks and autoselect default if needed
    let id = 0;
    tracks.forEach(track => {
      if(track.default && !defaultFound) {
        this._setAudioTrackInternal(id);
        defaultFound = true;
        return;
      }
      id++;
    });
    if (defaultFound === false && tracks.length) {
      logger.log('no default audio track defined, use first audio track as default');
      this._setAudioTrackInternal(0);
    }
  }

  onAudioTrackLoaded(data) {
    if (data.id < this._tracks.length) {
      logger.log(`audioTrack ${data.id} loaded`);
      this._tracks[data.id].details = data.details;
      // check if current playlist is a live playlist
      if (data.details.live && !this._timer) {
        // if live playlist we will have to reload it periodically
        // set reload period to playlist target duration
        this._timer = setInterval(this._ontick, 1000 * data.details.targetduration);
      }
      if (!data.details.live && this._timer) {
        // playlist is not live and timer is armed : stopping it
        this._cleanTimer();
      }
    }
  }

  /** get alternate audio tracks list from playlist **/
  get audioTracks() {
    return this._tracks;
  }

  /** get index of the selected audio track (index in audio track lists) **/
  get audioTrack() {
   return this._trackId;
  }

  /** select an audio track, based on its index in audio track lists**/
  set audioTrack(audioTrackId) {
    if (this._trackId !== audioTrackId || this._tracks[audioTrackId].details === undefined) {
      this._setAudioTrackInternal(audioTrackId);
    }
  }

 _setAudioTrackInternal(newId) {
    // check if level idx is valid
    if (newId >= 0 && newId < this._tracks.length) {
      // stopping live reloading timer if any
      this._cleanTimer();
      this._trackId = newId;
      logger.log(`switching to audioTrack ${newId}`);
      let audioTrack = this._tracks[newId],
          hls = this._hls,
          type = audioTrack.type,
          url = audioTrack.url,
          eventObj = {id: newId, type : type, url : url};
      // keep AUDIO_TRACK_SWITCH for legacy reason
      hls.trigger(Event.AUDIO_TRACK_SWITCH, eventObj);
      hls.trigger(Event.AUDIO_TRACK_SWITCHING, eventObj);
       // check if we need to load playlist for this audio Track
       let details = audioTrack.details;
      if (url && (details === undefined || details.live === true)) {
        // track not retrieved yet, or live playlist we need to (re)load it
        logger.log(`(re)loading playlist for audioTrack ${newId}`);
        hls.trigger(Event.AUDIO_TRACK_LOADING, {url: url, id: newId});
      }
    }
  }

  _updateTrack(newId) {
    // check if level idx is valid
    if (newId >= 0 && newId < this._tracks.length) {
      // stopping live reloading timer if any
      this._cleanTimer();
      this._trackId = newId;
      logger.log(`updating audioTrack ${newId}`);
      let audioTrack = this._tracks[newId], url = audioTrack.url;
       // check if we need to load playlist for this audio Track
       let details = audioTrack.details;
      if (url && (details === undefined || details.live === true)) {
        // track not retrieved yet, or live playlist we need to (re)load it
        logger.log(`(re)loading playlist for audioTrack ${newId}`);
        this._hls.trigger(Event.AUDIO_TRACK_LOADING, {url: url, id: newId});
      }
    }
  }
}

export default AudioTrackController;
