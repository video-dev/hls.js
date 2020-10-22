/*
 * id3 metadata track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import ID3 from '../demux/id3';
import { sendAddTrackEvent, clearCurrentCues, getClosestCue, addCue } from '../utils/texttrack-utils';

const MIN_CUE_DURATION = 0.25;

class ID3TrackController extends EventHandler {
  constructor (hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.FRAG_PARSING_METADATA,
      Event.LIVE_BACK_BUFFER_REACHED
    );
    this.id3Track = undefined;
    this.media = undefined;
  }

  destroy () {
    EventHandler.prototype.destroy.call(this);
  }

  // Add ID3 metatadata text track.
  onMediaAttached (data) {
    this.media = data.media;
    if (!this.media) {

    }
  }

  onMediaDetaching () {
    clearCurrentCues(this.id3Track);
    this.id3Track = undefined;
    this.media = undefined;
  }

  getID3Track (textTracks) {
    for (let i = 0; i < textTracks.length; i++) {
      let textTrack = textTracks[i];
      if (textTrack.kind === 'metadata' && textTrack.label === 'id3') {
        // send 'addtrack' when reusing the textTrack for metadata,
        // same as what we do for captions
        sendAddTrackEvent(textTrack, this.media);

        return textTrack;
      }
    }
    return this.media.addTextTrack('metadata', 'id3');
  }

  onFragParsingMetadata (data) {
    const fragment = data.frag;
    const samples = data.samples;

    // create track dynamically
    if (!this.id3Track) {
      this.id3Track = this.getID3Track(this.media.textTracks);
      this.id3Track.mode = 'hidden';
    }

    // Attempt to recreate Safari functionality by creating
    // WebKitDataCue objects when available and store the decoded
    // ID3 data in the value property of the cue
    let Cue = window.WebKitDataCue || window.VTTCue || window.TextTrackCue;

    for (let i = 0; i < samples.length; i++) {
      const frames = ID3.getID3Frames(samples[i].data);
      if (frames) {
        // Ensure the pts is positive - sometimes it's reported as a small negative number
        let startTime = Math.max(samples[i].pts, 0);
        let endTime = i < samples.length - 1 ? samples[i + 1].pts : fragment.endPTS;
        if (!endTime) {
          endTime = fragment.start + fragment.duration;
        }

        const timeDiff = endTime - startTime;
        if (timeDiff <= 0) {
          endTime = startTime + MIN_CUE_DURATION;
        }

        for (let j = 0; j < frames.length; j++) {
          const frame = frames[j];
          // Safari doesn't put the timestamp frame in the TextTrack
          if (!ID3.isTimeStampFrame(frame)) {
            const cue = new Cue(startTime, endTime, '');
            cue.value = frame;
            addCue(this.id3Track, cue);
          }
        }
      }
    }
  }

  onLiveBackBufferReached ({ bufferEnd }) {
    const { id3Track } = this;
    if (!id3Track || !id3Track.cues || !id3Track.cues.length) {
      return;
    }
    const foundCue = getClosestCue(id3Track.cues, bufferEnd);
    if (!foundCue) {
      return;
    }
    while (id3Track.cues[0] !== foundCue) {
      id3Track.removeCue(id3Track.cues[0]);
    }
  }
}

export default ID3TrackController;
