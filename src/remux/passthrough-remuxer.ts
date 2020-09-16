import { getDuration, getStartDTS, offsetStartDTS, parseInitSegment, InitData } from '../utils/mp4-tools';
import { logger } from '../utils/logger';
import type { TrackSet } from '../types/track';
import type { InitSegmentData, RemuxedTrack, Remuxer, RemuxerResult } from '../types/remuxer';
import type { DemuxedAudioTrack, DemuxedTrack, PassthroughVideoTrack } from '../types/demuxer';

class PassThroughRemuxer implements Remuxer {
  private emitInitSegment: boolean = false;
  private audioCodec?: string;
  private videoCodec?: string;
  private initData?: InitData;
  private initPTS?: number;
  private initTracks?: TrackSet;
  private lastEndDTS: number | null = null;

  destroy () {
  }

  resetTimeStamp (defaultInitPTS) {
    this.initPTS = defaultInitPTS;
    this.lastEndDTS = null;
  }

  resetNextTimestamp () {
    this.lastEndDTS = null;
  }

  resetInitSegment (initSegment: Uint8Array, audioCodec: string | undefined, videoCodec: string | undefined) {
    this.audioCodec = audioCodec;
    this.videoCodec = videoCodec;
    this.generateInitSegment(initSegment);
    this.emitInitSegment = true;
  }

  generateInitSegment (initSegment: Uint8Array): void {
    let { audioCodec, videoCodec } = this;
    if (!initSegment || !initSegment.byteLength) {
      this.initTracks = undefined;
      this.initData = undefined;
      return;
    }
    const initData = this.initData = parseInitSegment(initSegment);

    // default audio codec if nothing specified
    // TODO : extract that from initsegment
    if (!audioCodec) {
      audioCodec = 'mp4a.40.5';
    }

    if (!videoCodec) {
      videoCodec = 'avc1.42e01e';
    }

    const tracks: TrackSet = {};
    if (initData.audio && initData.video) {
      tracks.audiovideo = {
        container: 'video/mp4',
        codec: audioCodec + ',' + videoCodec,
        initSegment,
        id: 'main'
      };
    } else if (initData.audio) {
      tracks.audio = { container: 'audio/mp4', codec: audioCodec, initSegment, id: 'audio' };
    } else if (initData.video) {
      tracks.video = { container: 'video/mp4', codec: videoCodec, initSegment, id: 'main' };
    } else {
      logger.warn('[passthrough-remuxer.ts]: initSegment does not contain moov or trak boxes.');
    }
    this.initTracks = tracks;
  }

  remux (audioTrack: DemuxedAudioTrack, videoTrack: PassthroughVideoTrack, id3Track: DemuxedTrack, textTrack: DemuxedTrack, timeOffset: number): RemuxerResult {
    let { initPTS, lastEndDTS } = this;
    const result: RemuxerResult = {
      audio: undefined,
      video: undefined,
      text: textTrack,
      id3: id3Track,
      initSegment: undefined
    };

    // If we haven't yet set a lastEndDTS, or it was reset, set it to the provided timeOffset. We want to use the
    // lastEndDTS over timeOffset whenever possible; during progressive playback, the media source will not update
    // the media duration (which is what timeOffset is provided as) before we need to process the next chunk.
    if (!Number.isFinite(lastEndDTS!)) {
      lastEndDTS = this.lastEndDTS = timeOffset || 0;
    }

    // The binary segment data is added to the videoTrack in the mp4demuxer. We don't check to see if the data is only
    // audio or video (or both); adding it to video was an arbitrary choice.
    const data = videoTrack.samples;
    if (!data || !data.length) {
      return result;
    }

    const initSegment: InitSegmentData = {};
    let initData = this.initData;
    if (!initData || !initData.length) {
      this.generateInitSegment(data);
      initData = this.initData;
    }
    if (!initData || !initData.length) {
      // We can't remux if the initSegment could not be generated
      logger.warn('[passthrough-remuxer.ts]: Failed to generate initSegment.');
      return result;
    }
    if (this.emitInitSegment) {
      initSegment.tracks = this.initTracks;
      this.emitInitSegment = false;
    }

    if (!Number.isFinite(initPTS as number)) {
      this.initPTS = initSegment.initPTS = initPTS = computeInitPTS(initData, data, timeOffset);
    }

    const duration = getDuration(data, initData);
    console.assert(duration > 0, 'Duration parsed from mp4 should be greater than zero');

    const startDTS = lastEndDTS as number;
    const endDTS = duration + startDTS;
    offsetStartDTS(initData, data, initPTS);
    this.lastEndDTS = endDTS;

    const hasAudio = !!initData.audio;
    const hasVideo = !!initData.video;

    let type: any = '';
    if (hasAudio) {
      type += 'audio';
    }

    if (hasVideo) {
      type += 'video';
    }

    const track: RemuxedTrack = {
      data1: data,
      startPTS: startDTS,
      startDTS,
      endPTS: endDTS,
      endDTS,
      type,
      hasAudio,
      hasVideo,
      nb: 1,
      dropped: 0
    };

    result.audio = track.type === 'audio' ? track : undefined;
    result.video = track.type !== 'audio' ? track : undefined;
    result.text = textTrack;
    result.id3 = id3Track;
    result.initSegment = initSegment;

    return result;
  }
}

const computeInitPTS = (initData, data, timeOffset) => getStartDTS(initData, data) - timeOffset;

export default PassThroughRemuxer;
