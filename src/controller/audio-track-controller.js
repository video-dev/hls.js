/*
 * audio track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';

class AudioTrackController extends EventHandler {

  constructor(hls) {
    super(hls, Event.MANIFEST_LOADING,
               Event.MANIFEST_LOADED,
               Event.AUDIO_TRACK_LOADED);
    this.tracks = [];
    this.trackId = 0;
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  onManifestLoading() {
    // reset audio tracks on manifest loading
    this.tracks = [];
    this.trackId = 0;
  }

  onManifestLoaded(data) {
    let tracks = data.audioTracks || [];
    let defaultFound = false;
    this.tracks = tracks;
    this.hls.trigger(Event.AUDIO_TRACKS_UPDATED, {audioTracks : tracks});
    // loop through available audio tracks and autoselect default if needed
    tracks.forEach(track => {
      if(track.default) {
        this.audioTrack = track.id;
        defaultFound = true;
        return;
      }
    });
    if (defaultFound === false && tracks.length) {
      logger.log('no default audio track defined, use first audio track as default');
      this.audioTrack = 0;
    }
  }

  onAudioTrackLoaded(data) {
    if (data.id < this.tracks.length) {
      logger.log(`audioTrack ${data.id} loaded`);
      this.tracks[data.id].details = data.details;
      // check if current playlist is a live playlist
      if (data.details.live && !this.timer) {
        // if live playlist we will have to reload it periodically
        // set reload period to playlist target duration
        this.timer = setInterval(this.ontick, 1000 * data.details.targetduration);
      }
      if (!data.details.live && this.timer) {
        // playlist is not live and timer is armed : stopping it
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }

  /** get alternate audio tracks list from playlist **/
  get audioTracks() {
    return this.tracks;
  }

  /** get index of the selected audio track (index in audio track lists) **/
  get audioTrack() {
   return this.trackId;
  }

  /** select an audio track, based on its index in audio track lists**/
  set audioTrack(audioTrackId) {
    if (this.trackId !== audioTrackId || this.tracks[audioTrackId].details === undefined) {
      this.setAudioTrackInternal(audioTrackId);
    }
  }

 setAudioTrackInternal(newId) {
    // check if level idx is valid
    if (newId >= 0 && newId < this.tracks.length) {
      // stopping live reloading timer if any
      if (this.timer) {
       clearInterval(this.timer);
       this.timer = null;
      }
      this.trackId = newId;
      logger.log(`switching to audioTrack ${newId}`);
      let audioTrack = this.tracks[newId], type = audioTrack.type;
      this.hls.trigger(Event.AUDIO_TRACK_SWITCH, {id: newId, type : type});
       // check if we need to load playlist for this audio Track
       let details = audioTrack.details;
      if (type !== 'main' && (details === undefined || details.live === true)) {
        // track not retrieved yet, or live playlist we need to (re)load it
        logger.log(`(re)loading playlist for audioTrack ${newId}`);
        this.hls.trigger(Event.AUDIO_TRACK_LOADING, {url: audioTrack.url, id: newId});
      }
    }
  }
}

export default AudioTrackController;
