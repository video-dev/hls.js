import { Events } from '../events';
import { sendAddTrackEvent, clearCurrentCues, getClosestCue } from '../utils/texttrack-utils';
import * as ID3 from '../demux/id3';
import { FragParsingMetadataData, LiveBackBufferData, MediaAttachedData } from '../types/events';
import { ComponentAPI } from '../types/component-api';
import Hls from '../hls';

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

  constructor (hls) {
    this.hls = hls;
    this._registerListeners();
  }

  destroy () {
    this._unregisterListeners();
  }

  private _registerListeners () {
    this.hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    this.hls.on(Events.FRAG_PARSING_METADATA, this.onFragParsingMetadata, this);
    this.hls.on(Events.LIVE_BACK_BUFFER_REACHED, this.onLiveBackBufferReached, this);
  }

  private _unregisterListeners () {
    this.hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    this.hls.off(Events.FRAG_PARSING_METADATA, this.onFragParsingMetadata, this);
    this.hls.off(Events.LIVE_BACK_BUFFER_REACHED, this.onLiveBackBufferReached, this);
  }

  // Add ID3 metatadata text track.
  protected onMediaAttached (event: Events.MEDIA_ATTACHED, data: MediaAttachedData): void {
    this.media = data.media;
    if (!this.media) {

    }
  }

  protected onMediaDetaching (): void {
    if (!this.id3Track) {
      return;
    }
    clearCurrentCues(this.id3Track);
    this.id3Track = null;
    this.media = null;
  }

  getID3Track (textTracks: TextTrackList): TextTrack | void {
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

  onFragParsingMetadata (event: Events.FRAG_PARSING_METADATA, data: FragParsingMetadataData) {
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
        let endTime: number = i < samples.length - 1 ? samples[i + 1].pts : fragment.endPTS;
        if (!endTime) {
          endTime = fragment.start + fragment.duration;
        }

        const timeDiff = endTime - startTime;
        if (timeDiff < MIN_CUE_DURATION) {
          endTime += MIN_CUE_DURATION - timeDiff;
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

  onLiveBackBufferReached (event: Events.LIVE_BACK_BUFFER_REACHED, { bufferEnd }: LiveBackBufferData) {
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
