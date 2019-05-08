/*
 * id3 metadata track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import ID3 from '../demux/id3';
import Hls from '../hls';
import Fragment from '../loader/fragment';
import { logger } from '../utils/logger';
import { sendAddTrackEvent, clearCurrentCues } from '../utils/texttrack-utils';

interface onMediaAttachedPayload {
  media: HTMLVideoElement;
}

interface onFragParsingMetadataPayload {
  frag?: Fragment;
  id?: string;
  samples: any[];
}

class ID3TrackController extends EventHandler {
  private id3Track: TextTrack | null = null;
  private media: HTMLVideoElement | null = null;

  constructor (hls: Hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.FRAG_PARSING_METADATA);
  }

  public destroy (): void {
    EventHandler.prototype.destroy.call(this);
  }

  // Add ID3 metatadata text track.
  public onMediaAttached (data: onMediaAttachedPayload): void {
    this.media = data.media;
  }

  public onMediaDetaching (): void {
    clearCurrentCues(this.id3Track);

    this.id3Track = null;
    this.media = null;
  }

  public getID3Track (textTracks: TextTrack[]): TextTrack {
    for (let i = 0, len = textTracks.length; i < len; i++) {
      const textTrack = textTracks[i];

      if (textTrack.kind === 'metadata' && textTrack.label === 'id3') {
        // send 'addtrack' when reusing the textTrack for metadata,
        // same as what we do for captions
        sendAddTrackEvent(textTrack, this.media);

        return textTrack;
      }
    }

    return this.media.addTextTrack('metadata', 'id3');
  }

  public onFragParsingMetadata (data: onFragParsingMetadataPayload): void {
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
    const Cue = window.WebKitDataCue || window.VTTCue || window.TextTrackCue;

    for (let i = 0, len = samples.length; i < len; i++) {
      const frames = ID3.getID3Frames(samples[i].data);

      if (frames) {
        const startTime = samples[i].pts;
        let endTime = i < len - 1 ? samples[i + 1].pts : fragment.endPTS;

        if (startTime === endTime) {
          // Give a slight bump to the endTime if it's equal to startTime to avoid a SyntaxError in IE
          endTime += 0.0001;
        } else if (startTime > endTime) {
          logger.warn('detected an id3 sample with endTime < startTime, adjusting endTime to (startTime + 0.25)');
          endTime = startTime + 0.25;
        }

        for (let j = 0; j < frames.length; j++) {
          const frame = frames[j];

          // Safari doesn't put the timestamp frame in the TextTrack
          if (!ID3.isTimeStampFrame(frame)) {
            const cue = new Cue(startTime, endTime, '');
            cue.value = frame;
            this.id3Track.addCue(cue);
          }
        }
      }
    }
  }
}

export default ID3TrackController;
