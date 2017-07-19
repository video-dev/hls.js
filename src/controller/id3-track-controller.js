/*
 * id3 metadata track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import ID3 from '../demux/id3';

class ID3TrackController extends EventHandler {

  constructor(hls) {
    super(hls,
               Event.MEDIA_ATTACHED,
               Event.MEDIA_DETACHING,
               Event.FRAG_PARSING_METADATA);
    this._id3Track = undefined;
    this._media = undefined;
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  // Add ID3 metatadata text track.
  onMediaAttached(data) {
    this._media = data.media;
    if (!this._media) {
      return;
    }
  }

  onMediaDetaching() {
    this._media = undefined;
  }

  onFragParsingMetadata(data) {
    const fragment = data.frag;
    const samples = data.samples;

    // create track dynamically
    if (!this._id3Track) {
      this._id3Track = this._media.addTextTrack('metadata', 'id3');
      this._id3Track.mode = 'hidden';
    }

    // Attempt to recreate Safari functionality by creating
    // WebKitDataCue objects when available and store the decoded
    // ID3 data in the value property of the cue
    let Cue = window.WebKitDataCue || window.VTTCue || window.TextTrackCue;

    for (let i = 0; i < samples.length; i++) {
      const frames = ID3.getID3Frames(samples[i].data);
      if (frames) {
        const startTime = samples[i].pts;
        let endTime = i < samples.length - 1 ? samples[i+1].pts : fragment.endPTS;

        // Give a slight bump to the endTime if it's equal to startTime to avoid a SyntaxError in IE
        if (startTime === endTime) {
          endTime += 0.0001;
        }

        for(let j = 0; j < frames.length; j++) {
          const frame = frames[j];
          // Safari doesn't put the timestamp frame in the TextTrack
          if (!ID3.isTimeStampFrame(frame)) {
            const cue = new Cue(startTime, endTime, '');
            cue.value = frame;
            this._id3Track.addCue(cue);
          }
        }
      }
    }
  }
}

export default ID3TrackController;
