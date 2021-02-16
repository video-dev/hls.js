import { Events } from '../events';
import {
  sendAddTrackEvent,
  clearCurrentCues,
  removeCuesInRange,
} from '../utils/texttrack-utils';
import * as ID3 from '../demux/id3';
import type {
  BufferFlushingData,
  FragParsingMetadataData,
  MediaAttachedData,
} from '../types/events';
import type { ComponentAPI } from '../types/component-api';
import type Hls from '../hls';

declare global {
  interface Window {
    WebKitDataCue: VTTCue | void;
  }
}

const MIN_CUE_DURATION = 0.25;

class ID3TrackController implements ComponentAPI {
  private hls: Hls;
  private id3Track: TextTrack | null = null;
  private media: HTMLMediaElement | null = null;

  constructor(hls) {
    this.hls = hls;
    this._registerListeners();
  }

  destroy() {
    this._unregisterListeners();
  }

  private _registerListeners() {
    const { hls } = this;
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.FRAG_PARSING_METADATA, this.onFragParsingMetadata, this);
    hls.on(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
  }

  private _unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.FRAG_PARSING_METADATA, this.onFragParsingMetadata, this);
    hls.off(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
  }

  // Add ID3 metatadata text track.
  protected onMediaAttached(
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachedData
  ): void {
    this.media = data.media;
  }

  protected onMediaDetaching(): void {
    if (!this.id3Track) {
      return;
    }
    clearCurrentCues(this.id3Track);
    this.id3Track = null;
    this.media = null;
  }

  getID3Track(textTracks: TextTrackList): TextTrack | void {
    if (!this.media) {
      return;
    }
    for (let i = 0; i < textTracks.length; i++) {
      const textTrack: TextTrack = textTracks[i];
      if (textTrack.kind === 'metadata' && textTrack.label === 'id3') {
        // send 'addtrack' when reusing the textTrack for metadata,
        // same as what we do for captions
        sendAddTrackEvent(textTrack, this.media);

        return textTrack;
      }
    }
    return this.media.addTextTrack('metadata', 'id3');
  }

  onFragParsingMetadata(
    event: Events.FRAG_PARSING_METADATA,
    data: FragParsingMetadataData
  ) {
    if (!this.media) {
      return;
    }
    const fragment = data.frag;
    const samples = data.samples;

    // create track dynamically
    if (!this.id3Track) {
      this.id3Track = this.getID3Track(this.media.textTracks) as TextTrack;
      this.id3Track.mode = 'hidden';
    }

    // Attempt to recreate Safari functionality by creating
    // WebKitDataCue objects when available and store the decoded
    // ID3 data in the value property of the cue
    const Cue = (self.WebKitDataCue || self.VTTCue || self.TextTrackCue) as any;

    for (let i = 0; i < samples.length; i++) {
      const frames = ID3.getID3Frames(samples[i].data);
      if (frames) {
        const startTime = samples[i].pts;
        let endTime: number =
          i < samples.length - 1 ? samples[i + 1].pts : fragment.end;

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
            this.id3Track.addCue(cue);
          }
        }
      }
    }
  }

  onBufferFlushing(
    event: Events.BUFFER_FLUSHING,
    { startOffset, endOffset, type }: BufferFlushingData
  ) {
    if (!type || type === 'audio') {
      // id3 cues come from parsed audio only remove cues when audio buffer is cleared
      const { id3Track } = this;
      if (id3Track) {
        removeCuesInRange(id3Track, startOffset, endOffset);
      }
    }
  }
}

export default ID3TrackController;
