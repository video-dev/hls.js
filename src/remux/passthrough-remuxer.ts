import {
  flushTextTrackMetadataCueSamples,
  flushTextTrackUserdataCueSamples,
} from './mp4-remuxer';
import type { InitData, InitDataTrack } from '../utils/mp4-tools';
import {
  getDuration,
  getStartDTS,
  offsetStartDTS,
  parseInitSegment,
} from '../utils/mp4-tools';
import { ElementaryStreamTypes } from '../loader/fragment';
import { logger } from '../utils/logger';
import type { TrackSet } from '../types/track';
import type {
  InitSegmentData,
  RemuxedTrack,
  Remuxer,
  RemuxerResult,
} from '../types/remuxer';
import type {
  DemuxedAudioTrack,
  DemuxedMetadataTrack,
  DemuxedUserdataTrack,
  PassthroughTrack,
} from '../types/demuxer';

class PassThroughRemuxer implements Remuxer {
  private emitInitSegment: boolean = false;
  private audioCodec?: string;
  private videoCodec?: string;
  private initData?: InitData;
  private initPTS?: number;
  private initTracks?: TrackSet;
  private lastEndDTS: number | null = null;

  public destroy() {}

  public resetTimeStamp(defaultInitPTS) {
    this.initPTS = defaultInitPTS;
    this.lastEndDTS = null;
  }

  public resetNextTimestamp() {
    this.lastEndDTS = null;
  }

  public resetInitSegment(
    initSegment: Uint8Array | undefined,
    audioCodec: string | undefined,
    videoCodec: string | undefined
  ) {
    this.audioCodec = audioCodec;
    this.videoCodec = videoCodec;
    this.generateInitSegment(initSegment);
    this.emitInitSegment = true;
  }

  private generateInitSegment(initSegment: Uint8Array | undefined): void {
    let { audioCodec, videoCodec } = this;
    if (!initSegment || !initSegment.byteLength) {
      this.initTracks = undefined;
      this.initData = undefined;
      return;
    }
    const initData = (this.initData = parseInitSegment(initSegment));

    // Get codec from initSegment or fallback to default
    if (!audioCodec) {
      audioCodec = getParsedTrackCodec(
        initData.audio,
        ElementaryStreamTypes.AUDIO
      );
    }

    if (!videoCodec) {
      videoCodec = getParsedTrackCodec(
        initData.video,
        ElementaryStreamTypes.VIDEO
      );
    }

    const tracks: TrackSet = {};
    if (initData.audio && initData.video) {
      tracks.audiovideo = {
        container: 'video/mp4',
        codec: audioCodec + ',' + videoCodec,
        initSegment,
        id: 'main',
      };
    } else if (initData.audio) {
      tracks.audio = {
        container: 'audio/mp4',
        codec: audioCodec,
        initSegment,
        id: 'audio',
      };
    } else if (initData.video) {
      tracks.video = {
        container: 'video/mp4',
        codec: videoCodec,
        initSegment,
        id: 'main',
      };
    } else {
      logger.warn(
        '[passthrough-remuxer.ts]: initSegment does not contain moov or trak boxes.'
      );
    }
    this.initTracks = tracks;
  }

  public remux(
    audioTrack: DemuxedAudioTrack,
    videoTrack: PassthroughTrack,
    id3Track: DemuxedMetadataTrack,
    textTrack: DemuxedUserdataTrack,
    timeOffset: number
  ): RemuxerResult {
    let { initPTS, lastEndDTS } = this;
    const result: RemuxerResult = {
      audio: undefined,
      video: undefined,
      text: textTrack,
      id3: id3Track,
      initSegment: undefined,
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

    const initSegment: InitSegmentData = {
      initPTS: undefined,
      timescale: 1,
    };
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
      initSegment.tracks = this.initTracks as TrackSet;
      this.emitInitSegment = false;
    }

    if (!Number.isFinite(initPTS!)) {
      this.initPTS =
        initSegment.initPTS =
        initPTS =
          computeInitPTS(initData, data, lastEndDTS);
    }

    const duration = getDuration(data, initData);
    const startDTS = lastEndDTS as number;
    const endDTS = duration + startDTS;
    offsetStartDTS(initData, data, initPTS as number);

    if (duration > 0) {
      this.lastEndDTS = endDTS;
    } else {
      logger.warn('Duration parsed from mp4 should be greater than zero');
      this.resetNextTimestamp();
    }

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
      dropped: 0,
    };

    result.audio = track.type === 'audio' ? track : undefined;
    result.video = track.type !== 'audio' ? track : undefined;
    result.initSegment = initSegment;
    const initPtsNum = this.initPTS ?? 0;
    result.id3 = flushTextTrackMetadataCueSamples(
      id3Track,
      timeOffset,
      initPtsNum,
      initPtsNum
    );

    if (textTrack.samples.length) {
      result.text = flushTextTrackUserdataCueSamples(
        textTrack,
        timeOffset,
        initPtsNum
      );
    }

    return result;
  }
}

const computeInitPTS = (initData, data, timeOffset) =>
  getStartDTS(initData, data) - timeOffset;

function getParsedTrackCodec(
  track: InitDataTrack | undefined,
  type: ElementaryStreamTypes.AUDIO | ElementaryStreamTypes.VIDEO
): string {
  const parsedCodec = track?.codec;
  if (parsedCodec && parsedCodec.length > 4) {
    return parsedCodec;
  }
  // Since mp4-tools cannot parse full codec string (see 'TODO: Parse codec details'... in mp4-tools)
  // Provide defaults based on codec type
  // This allows for some playback of some fmp4 playlists without CODECS defined in manifest
  if (parsedCodec === 'hvc1') {
    return 'hvc1.1.c.L120.90';
  }
  if (parsedCodec === 'av01') {
    return 'av01.0.04M.08';
  }
  if (parsedCodec === 'avc1' || type === ElementaryStreamTypes.VIDEO) {
    return 'avc1.42e01e';
  }
  return 'mp4a.40.5';
}
export default PassThroughRemuxer;
