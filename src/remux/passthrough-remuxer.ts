import {
  flushTextTrackMetadataCueSamples,
  flushTextTrackUserdataCueSamples,
} from './mp4-remuxer';
import { ElementaryStreamTypes } from '../loader/fragment';
import { getCodecCompatibleName } from '../utils/codecs';
import { type ILogger, logger } from '../utils/logger';
import { patchEncyptionData } from '../utils/mp4-tools';
import {
  getDuration,
  getStartDTS,
  offsetStartDTS,
  parseInitSegment,
} from '../utils/mp4-tools';
import type { HlsConfig } from '../config';
import type { HlsEventEmitter } from '../events';
import type { DecryptData } from '../loader/level-key';
import type {
  DemuxedAudioTrack,
  DemuxedMetadataTrack,
  DemuxedUserdataTrack,
  PassthroughTrack,
} from '../types/demuxer';
import type {
  InitSegmentData,
  RemuxedTrack,
  Remuxer,
  RemuxerResult,
} from '../types/remuxer';
import type { TrackSet } from '../types/track';
import type { TypeSupported } from '../utils/codecs';
import type { InitData, InitDataTrack } from '../utils/mp4-tools';
import type { RationalTimestamp } from '../utils/timescale-conversion';

class PassThroughRemuxer implements Remuxer {
  private readonly logger: ILogger;
  private emitInitSegment: boolean = false;
  private audioCodec?: string;
  private videoCodec?: string;
  private initData?: InitData;
  private initPTS: RationalTimestamp | null = null;
  private initTracks?: TrackSet;
  private lastEndTime: number | null = null;

  constructor(
    observer: HlsEventEmitter,
    config: HlsConfig,
    typeSupported: TypeSupported,
    logger: ILogger,
  ) {
    this.logger = logger;
  }

  public destroy() {}

  public resetTimeStamp(defaultInitPTS: RationalTimestamp | null) {
    this.initPTS = defaultInitPTS;
    this.lastEndTime = null;
  }

  public resetNextTimestamp() {
    this.lastEndTime = null;
  }

  public resetInitSegment(
    initSegment: Uint8Array | undefined,
    audioCodec: string | undefined,
    videoCodec: string | undefined,
    decryptdata: DecryptData | null,
  ) {
    this.audioCodec = audioCodec;
    this.videoCodec = videoCodec;
    this.generateInitSegment(patchEncyptionData(initSegment, decryptdata));
    this.emitInitSegment = true;
  }

  private generateInitSegment(initSegment: Uint8Array | undefined): void {
    let { audioCodec, videoCodec } = this;
    if (!initSegment?.byteLength) {
      this.initTracks = undefined;
      this.initData = undefined;
      return;
    }
    const initData = (this.initData = parseInitSegment(initSegment));

    // Get codec from initSegment
    if (initData.audio) {
      audioCodec = getParsedTrackCodec(
        initData.audio,
        ElementaryStreamTypes.AUDIO,
      );
    }

    if (initData.video) {
      videoCodec = getParsedTrackCodec(
        initData.video,
        ElementaryStreamTypes.VIDEO,
      );
    }

    const tracks: TrackSet = {};
    if (initData.audio && initData.video) {
      tracks.audiovideo = {
        container: 'video/mp4',
        codec: audioCodec + ',' + videoCodec,
        supplemental: initData.video.supplemental,
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
        supplemental: initData.video.supplemental,
        initSegment,
        id: 'main',
      };
    } else {
      this.logger.warn(
        '[passthrough-remuxer.ts]: initSegment does not contain moov or trak boxes.',
      );
    }
    this.initTracks = tracks;
  }

  public remux(
    audioTrack: DemuxedAudioTrack,
    videoTrack: PassthroughTrack,
    id3Track: DemuxedMetadataTrack,
    textTrack: DemuxedUserdataTrack,
    timeOffset: number,
    accurateTimeOffset: boolean,
  ): RemuxerResult {
    let { initPTS, lastEndTime } = this;
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
    if (!Number.isFinite(lastEndTime!)) {
      lastEndTime = this.lastEndTime = timeOffset || 0;
    }

    // The binary segment data is added to the videoTrack in the mp4demuxer. We don't check to see if the data is only
    // audio or video (or both); adding it to video was an arbitrary choice.
    const data = videoTrack.samples;
    if (!data?.length) {
      return result;
    }

    const initSegment: InitSegmentData = {
      initPTS: undefined,
      timescale: 1,
    };
    let initData = this.initData;
    if (!initData?.length) {
      this.generateInitSegment(data);
      initData = this.initData;
    }
    if (!initData?.length) {
      // We can't remux if the initSegment could not be generated
      this.logger.warn(
        '[passthrough-remuxer.ts]: Failed to generate initSegment.',
      );
      return result;
    }
    if (this.emitInitSegment) {
      initSegment.tracks = this.initTracks as TrackSet;
      this.emitInitSegment = false;
    }

    const duration = getDuration(data, initData);
    const startDTS = getStartDTS(initData, data);
    const decodeTime = startDTS === null ? timeOffset : startDTS;
    if (
      (accurateTimeOffset || !initPTS) &&
      (isInvalidInitPts(initPTS, decodeTime, timeOffset, duration) ||
        initSegment.timescale !== initPTS.timescale)
    ) {
      initSegment.initPTS = decodeTime - timeOffset;
      if (initPTS && initPTS.timescale === 1) {
        this.logger.warn(
          `Adjusting initPTS @${timeOffset} from ${initPTS.baseTime / initPTS.timescale} to ${initSegment.initPTS}`,
        );
      }
      this.initPTS = initPTS = {
        baseTime: initSegment.initPTS,
        timescale: 1,
      };
    }

    const startTime = audioTrack
      ? decodeTime - initPTS.baseTime / initPTS.timescale
      : (lastEndTime as number);
    const endTime = startTime + duration;
    offsetStartDTS(initData, data, initPTS.baseTime / initPTS.timescale);

    if (duration > 0) {
      this.lastEndTime = endTime;
    } else {
      this.logger.warn('Duration parsed from mp4 should be greater than zero');
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
      startPTS: startTime,
      startDTS: startTime,
      endPTS: endTime,
      endDTS: endTime,
      type,
      hasAudio,
      hasVideo,
      nb: 1,
      dropped: 0,
    };

    result.audio = track.type === 'audio' ? track : undefined;
    result.video = track.type !== 'audio' ? track : undefined;
    result.initSegment = initSegment;
    result.id3 = flushTextTrackMetadataCueSamples(
      id3Track,
      timeOffset,
      initPTS,
      initPTS,
    );

    if (textTrack.samples.length) {
      result.text = flushTextTrackUserdataCueSamples(
        textTrack,
        timeOffset,
        initPTS,
      );
    }

    return result;
  }
}

function isInvalidInitPts(
  initPTS: RationalTimestamp | null,
  startDTS: number,
  timeOffset: number,
  duration: number,
): initPTS is null {
  if (initPTS === null) {
    return true;
  }
  // InitPTS is invalid when distance from program would be more than segment duration or a minimum of one second
  const minDuration = Math.max(duration, 1);
  const startTime = startDTS - initPTS.baseTime / initPTS.timescale;
  return Math.abs(startTime - timeOffset) > minDuration;
}

function getParsedTrackCodec(
  track: InitDataTrack,
  type: ElementaryStreamTypes.AUDIO | ElementaryStreamTypes.VIDEO,
): string {
  const parsedCodec = track?.codec;
  if (parsedCodec && parsedCodec.length > 4) {
    return parsedCodec;
  }
  if (type === ElementaryStreamTypes.AUDIO) {
    if (
      parsedCodec === 'ec-3' ||
      parsedCodec === 'ac-3' ||
      parsedCodec === 'alac'
    ) {
      return parsedCodec;
    }
    if (parsedCodec === 'fLaC' || parsedCodec === 'Opus') {
      // Opting not to get `preferManagedMediaSource` from player config for isSupported() check for simplicity
      const preferManagedMediaSource = false;
      return getCodecCompatibleName(parsedCodec, preferManagedMediaSource);
    }

    logger.warn(`Unhandled audio codec "${parsedCodec}" in mp4 MAP`);
    return parsedCodec || 'mp4a';
  }
  // Provide defaults based on codec type
  // This allows for some playback of some fmp4 playlists without CODECS defined in manifest
  logger.warn(`Unhandled video codec "${parsedCodec}" in mp4 MAP`);
  return parsedCodec || 'avc1';
}
export default PassThroughRemuxer;
