/*
 * audio track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';

class AudioTrackController extends EventHandler {

  constructor(hls) {
    super(hls, Event.MANIFEST_LOADING,
               Event.MANIFEST_LOADED);
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
    this.tracks = data.audioTracks || [];
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
    this.trackId = audioTrackId;
  }
}

export default AudioTrackController;
