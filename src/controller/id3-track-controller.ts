import { Events } from '../events';
import {
  sendAddTrackEvent,
  clearCurrentCues,
  removeCuesInRange,
} from '../utils/texttrack-utils';
import * as ID3 from '../demux/id3';
import { DateRange, DateRangeAttribute } from '../loader/date-range';
import { MetadataSchema } from '../types/demuxer';
import type {
  BufferFlushingData,
  FragParsingMetadataData,
  LevelUpdatedData,
  MediaAttachedData,
} from '../types/events';
import type { ComponentAPI } from '../types/component-api';
import type Hls from '../hls';

declare global {
  interface Window {
    WebKitDataCue: VTTCue | void;
  }
}

type Cue = VTTCue | TextTrackCue;

const MIN_CUE_DURATION = 0.25;

function getCueClass() {
  // Attempt to recreate Safari functionality by creating
  // WebKitDataCue objects when available and store the decoded
  // ID3 data in the value property of the cue
  return (self.WebKitDataCue || self.VTTCue || self.TextTrackCue) as any;
}

function dateRangeDateToTimelineSeconds(date: Date, offset: number): number {
  return date.getTime() / 1000 - offset;
}

function hexToArrayBuffer(str): ArrayBuffer {
  return Uint8Array.from(
    str
      .replace(/^0x/, '')
      .replace(/([\da-fA-F]{2}) ?/g, '0x$1 ')
      .replace(/ +$/, '')
      .split(' ')
  ).buffer;
}
class ID3TrackController implements ComponentAPI {
  private hls: Hls;
  private id3Track: TextTrack | null = null;
  private media: HTMLMediaElement | null = null;
  private dateRangeCuesAppended: Record<
    string,
    { cues: Record<string, Cue>; dateRange: DateRange; durationKnown: boolean }
  > = {};

  constructor(hls) {
    this.hls = hls;
    this._registerListeners();
  }

  destroy() {
    this._unregisterListeners();
    this.id3Track = null;
    this.media = null;
    this.dateRangeCuesAppended = {};
    // @ts-ignore
    this.hls = null;
  }

  private _registerListeners() {
    const { hls } = this;
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.FRAG_PARSING_METADATA, this.onFragParsingMetadata, this);
    hls.on(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
    hls.on(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
  }

  private _unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.FRAG_PARSING_METADATA, this.onFragParsingMetadata, this);
    hls.off(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
    hls.off(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
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
    this.dateRangeCuesAppended = {};
  }

  private onManifestLoading() {
    this.dateRangeCuesAppended = {};
  }

  createTrack(media: HTMLMediaElement): TextTrack {
    const track = this.getID3Track(media.textTracks) as TextTrack;
    track.mode = 'hidden';
    return track;
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

    const {
      hls: {
        config: { enableEmsgMetadataCues, enableID3MetadataCues },
      },
    } = this;
    if (!enableEmsgMetadataCues && !enableID3MetadataCues) {
      return;
    }

    const { frag: fragment, samples, details } = data;

    // create track dynamically
    if (!this.id3Track) {
      this.id3Track = this.createTrack(this.media);
    }

    // VTTCue end time must be finite, so use playlist edge or fragment end until next fragment with same frame type is found
    const maxCueTime = details.edge || fragment.end;
    const Cue = getCueClass();
    let updateCueRanges = false;
    const frameTypesAdded: Record<string, number | null> = {};

    for (let i = 0; i < samples.length; i++) {
      const type = samples[i].type;
      if (
        (type === MetadataSchema.emsg && !enableEmsgMetadataCues) ||
        !enableID3MetadataCues
      ) {
        continue;
      }

      const frames = ID3.getID3Frames(samples[i].data);
      if (frames) {
        const startTime = samples[i].pts;
        let endTime: number = maxCueTime;

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
            if (type) {
              cue.type = type;
            }
            this.id3Track.addCue(cue);
            frameTypesAdded[frame.key] = null;
            updateCueRanges = true;
          }
        }
      }
    }
    if (updateCueRanges) {
      this.updateId3CueEnds(frameTypesAdded);
    }
  }

  updateId3CueEnds(frameTypesAdded: Record<string, number | null>) {
    // Update endTime of previous cue with same IDR frame.type (Ex: TXXX cue spans to next TXXX)
    const cues = this.id3Track?.cues;
    if (cues) {
      for (let i = cues.length; i--; ) {
        const cue = cues[i] as any;
        const frameType = cue.value?.key;
        if (frameType && frameType in frameTypesAdded) {
          const startTime = frameTypesAdded[frameType];
          if (startTime && cue.endTime !== startTime) {
            cue.endTime = startTime;
          }
          frameTypesAdded[frameType] = cue.startTime;
        }
      }
    }
  }

  onBufferFlushing(
    event: Events.BUFFER_FLUSHING,
    { startOffset, endOffset, type }: BufferFlushingData
  ) {
    const { id3Track, hls } = this;
    if (!hls) {
      return;
    }

    const {
      config: { enableEmsgMetadataCues, enableID3MetadataCues },
    } = hls;
    if (id3Track && (enableEmsgMetadataCues || enableID3MetadataCues)) {
      let predicate;

      if (type === 'audio') {
        predicate = (cue) =>
          (cue as any).type === MetadataSchema.audioId3 &&
          enableID3MetadataCues;
      } else if (type === 'video') {
        predicate = (cue) =>
          (cue as any).type === MetadataSchema.emsg && enableEmsgMetadataCues;
      } else {
        predicate = (cue) =>
          ((cue as any).type === MetadataSchema.audioId3 &&
            enableID3MetadataCues) ||
          ((cue as any).type === MetadataSchema.emsg && enableEmsgMetadataCues);
      }
      removeCuesInRange(id3Track, startOffset, endOffset, predicate);
    }
  }

  onLevelUpdated(event: Events.LEVEL_UPDATED, { details }: LevelUpdatedData) {
    if (
      !this.media ||
      !details.hasProgramDateTime ||
      !this.hls.config.enableDateRangeMetadataCues
    ) {
      return;
    }
    const { dateRangeCuesAppended, id3Track } = this;
    const { dateRanges } = details;
    const ids = Object.keys(dateRanges);
    // Remove cues from track not found in details.dateRanges
    if (id3Track) {
      const idsToRemove = Object.keys(dateRangeCuesAppended).filter(
        (id) => !ids.includes(id)
      );
      for (let i = idsToRemove.length; i--; ) {
        const id = idsToRemove[i];
        Object.keys(dateRangeCuesAppended[id].cues).forEach((key) => {
          id3Track.removeCue(dateRangeCuesAppended[id].cues[key]);
        });
        delete dateRangeCuesAppended[id];
      }
    }
    // Exit if the playlist does not have Date Ranges or does not have Program Date Time
    const lastFragment = details.fragments[details.fragments.length - 1];
    if (ids.length === 0 || !Number.isFinite(lastFragment?.programDateTime)) {
      return;
    }

    if (!this.id3Track) {
      this.id3Track = this.createTrack(this.media);
    }

    const dateTimeOffset =
      (lastFragment.programDateTime as number) / 1000 - lastFragment.start;
    const maxCueTime = details.edge || lastFragment.end;
    const Cue = getCueClass();

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const dateRange = dateRanges[id];
      const appendedDateRangeCues = dateRangeCuesAppended[id];
      const cues = appendedDateRangeCues?.cues || {};
      let durationKnown = appendedDateRangeCues?.durationKnown || false;
      const startTime = dateRangeDateToTimelineSeconds(
        dateRange.startDate,
        dateTimeOffset
      );
      let endTime = maxCueTime;
      const endDate = dateRange.endDate;
      if (endDate) {
        endTime = dateRangeDateToTimelineSeconds(endDate, dateTimeOffset);
        durationKnown = true;
      } else if (dateRange.endOnNext && !durationKnown) {
        const nextDateRangeWithSameClass = ids
          .reduce((filterMapArray, id) => {
            const candidate = dateRanges[id];
            if (
              candidate.class === dateRange.class &&
              candidate.id !== id &&
              candidate.startDate > dateRange.startDate
            ) {
              filterMapArray.push(candidate);
            }
            return filterMapArray;
          }, [] as DateRange[])
          .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
        if (nextDateRangeWithSameClass) {
          endTime = dateRangeDateToTimelineSeconds(
            nextDateRangeWithSameClass.startDate,
            dateTimeOffset
          );
          durationKnown = true;
        }
      }

      const attributes = Object.keys(dateRange.attr);
      for (let j = 0; j < attributes.length; j++) {
        const key = attributes[j];
        if (
          key === DateRangeAttribute.ID ||
          key === DateRangeAttribute.CLASS ||
          key === DateRangeAttribute.START_DATE ||
          key === DateRangeAttribute.DURATION ||
          key === DateRangeAttribute.END_DATE ||
          key === DateRangeAttribute.END_ON_NEXT
        ) {
          continue;
        }
        let cue = cues[key] as any;
        if (cue) {
          if (durationKnown && !appendedDateRangeCues.durationKnown) {
            cue.endTime = endTime;
          }
        } else {
          let data = dateRange.attr[key];
          cue = new Cue(startTime, endTime, '');
          if (
            key === DateRangeAttribute.SCTE35_OUT ||
            key === DateRangeAttribute.SCTE35_IN
          ) {
            data = hexToArrayBuffer(data);
          }
          cue.value = { key, data };
          cue.type = MetadataSchema.dateRange;
          this.id3Track.addCue(cue);
          cues[key] = cue;
        }
      }
      dateRangeCuesAppended[id] = {
        cues,
        dateRange,
        durationKnown,
      };
    }
  }
}

export default ID3TrackController;
