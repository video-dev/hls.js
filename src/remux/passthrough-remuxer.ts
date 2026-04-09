import MP4 from './mp4-generator';
import {
  flushTextTrackMetadataCueSamples,
  flushTextTrackUserdataCueSamples,
} from './mp4-remuxer';
import { ElementaryStreamTypes } from '../loader/fragment';
import { getCodecCompatibleName } from '../utils/codecs';
import { type ILogger, Logger } from '../utils/logger';
import { patchEncyptionData, writeUint32 } from '../utils/mp4-tools';
import { getSampleData, parseInitSegment } from '../utils/mp4-tools';
import type { TrackFragmentSample } from './mp4-generator';
import type { HlsConfig } from '../config';
import type { HlsEventEmitter } from '../events';
import type { DecryptData } from '../loader/level-key';
import type {
  DemuxedAudioTrack,
  DemuxedMetadataTrack,
  DemuxedUserdataTrack,
  PassthroughTrack,
} from '../types/demuxer';
import type { PlaylistLevelType } from '../types/loader';
import type {
  InitSegmentData,
  RemuxedTrack,
  Remuxer,
  RemuxerResult,
} from '../types/remuxer';
import type { TrackSet } from '../types/track';
import type { ChunkMetadata } from '../types/transmuxer';
import type { TypeSupported } from '../utils/codecs';
import type { InitData, InitDataTrack, TrackTimes } from '../utils/mp4-tools';
import type { TimestampOffset } from '../utils/timescale-conversion';

class PassThroughRemuxer extends Logger implements Remuxer {
  private emitInitSegment: boolean = false;
  private audioCodec?: string;
  private videoCodec?: string;
  private initData?: InitData;
  private initPTS: TimestampOffset | null = null;
  private initTracks?: TrackSet;
  private lastEndTime: number | null = null;
  private isVideoContiguous: boolean = false;

  constructor(
    observer: HlsEventEmitter,
    config: HlsConfig,
    typeSupported: TypeSupported,
    logger: ILogger,
  ) {
    super('passthrough-remuxer', logger);
  }

  public destroy() {}

  public resetTimeStamp(defaultInitPTS: TimestampOffset | null) {
    this.lastEndTime = null;
    const initPTS = this.initPTS;
    if (initPTS && defaultInitPTS) {
      if (
        initPTS.baseTime === defaultInitPTS.baseTime &&
        initPTS.timescale === defaultInitPTS.timescale
      ) {
        return;
      }
    }
    this.initPTS = defaultInitPTS;
  }

  public resetNextTimestamp() {
    this.isVideoContiguous = false;
    this.lastEndTime = null;
  }

  public resetInitSegment(
    initSegment: Uint8Array<ArrayBuffer> | undefined,
    audioCodec: string | undefined,
    videoCodec: string | undefined,
    decryptdata: DecryptData | null,
  ) {
    this.audioCodec = audioCodec;
    this.videoCodec = videoCodec;
    this.generateInitSegment(initSegment, decryptdata);
    this.emitInitSegment = true;
  }

  private generateInitSegment(
    initSegment: Uint8Array<ArrayBuffer> | undefined,
    decryptdata?: DecryptData | null,
  ) {
    let { audioCodec, videoCodec } = this;
    if (!initSegment?.byteLength) {
      this.initTracks = undefined;
      this.initData = undefined;
      return;
    }
    const { audio, video } = (this.initData = parseInitSegment(initSegment));

    if (decryptdata) {
      patchEncyptionData(initSegment, decryptdata);
    } else {
      const eitherTrack = audio || video;
      if (eitherTrack?.encrypted) {
        this.warn(
          `Init segment with encrypted track with has no key ("${eitherTrack.codec}")!`,
        );
      }
    }

    // Get codec from initSegment
    if (audio) {
      audioCodec = getParsedTrackCodec(
        audio,
        ElementaryStreamTypes.AUDIO,
        this,
      );
    }

    if (video) {
      videoCodec = getParsedTrackCodec(
        video,
        ElementaryStreamTypes.VIDEO,
        this,
      );
    }

    const tracks: TrackSet = {};
    if (audio && video) {
      tracks.audiovideo = {
        container: 'video/mp4',
        codec: audioCodec + ',' + videoCodec,
        supplemental: video.supplemental,
        encrypted: video.encrypted,
        initSegment,
        id: 'main',
      };
    } else if (audio) {
      tracks.audio = {
        container: 'audio/mp4',
        codec: audioCodec,
        encrypted: audio.encrypted,
        initSegment,
        id: 'audio',
      };
    } else if (video) {
      tracks.video = {
        container: 'video/mp4',
        codec: videoCodec,
        supplemental: video.supplemental,
        encrypted: video.encrypted,
        initSegment,
        id: 'main',
      };
    } else {
      this.warn('initSegment does not contain moov or trak boxes.');
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
    flush: boolean,
    playlistType: PlaylistLevelType,
    chunkMeta: ChunkMetadata,
  ): RemuxerResult {
    let { initPTS, lastEndTime } = this;
    const result: RemuxerResult = {
      audio: undefined,
      video: undefined,
      text: undefined,
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
    if (!data.length) {
      return result;
    }

    const initSegment: InitSegmentData = {
      initPTS: undefined,
      timescale: undefined,
      trackId: undefined,
    };
    let initData = this.initData;
    if (!initData?.length) {
      this.generateInitSegment(data);
      initData = this.initData;
    }
    if (!initData?.length) {
      // We can't remux if the initSegment could not be generated
      this.warn('Failed to generate initSegment.');
      return result;
    }
    if (this.emitInitSegment) {
      initSegment.tracks = this.initTracks;
      this.emitInitSegment = false;
    }

    const trackSampleData = getSampleData(data, initData, chunkMeta, this);
    const audioSampleTimestamps = initData.audio
      ? trackSampleData[initData.audio.id]
      : null;
    const videoSampleTimestamps = initData.video
      ? trackSampleData[initData.video.id]
      : null;

    const hasAudio = !!initData.audio;
    const hasVideo = !!initData.video;

    let type: any = '';
    if (hasAudio) {
      type += 'audio';
    }

    if (hasVideo) {
      type += 'video';
    }

    const videoStartTime = toStartEndOrDefault(videoSampleTimestamps, Infinity);
    const audioStartTime = toStartEndOrDefault(audioSampleTimestamps, Infinity);
    const videoEndTime = toStartEndOrDefault(videoSampleTimestamps, 0, true);
    const audioEndTime = toStartEndOrDefault(audioSampleTimestamps, 0, true);

    let decodeTime = timeOffset;
    let duration = 0;

    if (
      videoSampleTimestamps &&
      audioSampleTimestamps &&
      initData.audio &&
      (audioStartTime > videoEndTime || videoStartTime > audioEndTime)
    ) {
      this.warn(
        `audio and video track sample timestamps do not overlap. v: ${videoStartTime}-${videoEndTime} a: ${audioStartTime}-${audioEndTime}}`,
        videoSampleTimestamps,
        audioSampleTimestamps,
      );
    }

    const syncOnAudio =
      !!audioSampleTimestamps &&
      (!videoSampleTimestamps ||
        (!initPTS && audioStartTime < videoStartTime) ||
        (!!initPTS && initPTS.trackId === initData.audio!.id));
    const baseOffsetSamples = syncOnAudio
      ? audioSampleTimestamps
      : videoSampleTimestamps;

    let data1 = data;
    let data2: Uint8Array<ArrayBuffer> | undefined;
    if (
      __USE_IFRAMES__ &&
      videoSampleTimestamps &&
      videoSampleTimestamps.sampleCount > 1 &&
      initData.video &&
      chunkMeta.iframe
    ) {
      duration = chunkMeta.duration;
      const { trun, start, duration: sampleDuration } = videoSampleTimestamps;
      if (trun.length === 1 && trun[0].samples.length) {
        const sampleOffset = trun[0].sampleOffset;
        let totalSize = 0;
        const samples = trun[0].samples
          .map((sample): TrackFragmentSample | null => {
            const {
              cts,
              size,
              flags: { dependsOn, isNonSync },
            } = sample;
            if (sampleOffset + totalSize + size > data.length) {
              return null;
            }

            totalSize += size;
            return {
              cts: cts || 0,
              duration: sampleDuration,
              size,
              flags: {
                isLeading: 0,
                isDependedOn: 0,
                hasRedundancy: 0,
                degradPrio: 0,
                dependsOn,
                isNonSync,
                paddingValue: 0,
              },
            };
          })
          .filter((sampleOrNull) => !!sampleOrNull);
        if (samples.length) {
          const lastSample = samples[samples.length - 1];
          let lastSampleDuration = duration * initData.video.timescale;
          for (let i = samples.length - 1; i--; ) {
            lastSampleDuration -= samples[i].duration;
          }
          lastSample.duration = lastSampleDuration;

          // Remux Iframe segments reporting more than one sample (mp4 byte-range contains moof for playback segment)
          data1 = MP4.moof(chunkMeta.sn, start, {
            type: 'video',
            id: videoTrack.id,
            samples, //: [samples[0]],
          });
          data2 = data.subarray(sampleOffset - 8, sampleOffset + totalSize);
          writeUint32(data2, 0, totalSize + 8);
        } else {
          this.warn(
            `Could not remux IFrame track fragment (sampleOffset ${sampleOffset}: totalSize: ${totalSize} bytes: ${data})`,
          );
        }
      } else {
        this.warn(
          `Could not remux IFrame track fragment (trun count ${trun.length})`,
        );
      }
    } else {
      duration = syncOnAudio
        ? audioEndTime - audioStartTime
        : videoEndTime - videoStartTime;
    }

    if (baseOffsetSamples) {
      const timescale = baseOffsetSamples.timescale;
      const baseTime = baseOffsetSamples.start - timeOffset * timescale;
      const trackId = syncOnAudio ? initData.audio!.id : initData.video!.id;

      decodeTime = baseOffsetSamples.start / timescale;

      if (
        (accurateTimeOffset || !initPTS) &&
        (isInvalidInitPts(initPTS, decodeTime, timeOffset, duration) ||
          timescale !== initPTS.timescale)
      ) {
        let detectedDrift = false;
        const trackType = syncOnAudio ? 'audio' : 'video';
        if (initPTS) {
          const driftEstimate =
            timeOffset !== 0 ? decodeTime / timeOffset : 1 + decodeTime / 1;
          detectedDrift =
            decodeTime >= 0 && Math.abs(1 - driftEstimate) < 0.001;
          this.log(
            `${trackType} timestamps in track ${trackId} at playlist time: ${accurateTimeOffset ? '' : '~'}${timeOffset} maps to ${decodeTime} with initPTS: ${initPTS.baseTime / initPTS.timescale} (${
              baseTime / timescale - initPTS.baseTime / initPTS.timescale
            }s diff) (${type}) drift estimate: ${driftEstimate} ${detectedDrift ? '(ignoring drift)' : 'remapping timestamps (initPTS)'}`,
          );
        }
        if (!detectedDrift) {
          this.log(
            `Found initPTS in ${trackType} track ${trackId} at playlist time: ${timeOffset} offset: ${decodeTime - timeOffset} (${baseTime}/${timescale})`,
          );
          initPTS = null;
          initSegment.initPTS = baseTime;
          initSegment.timescale = timescale;
          initSegment.trackId = trackId;
        }
      }
    } else {
      this.warn(
        `No audio or video samples found for initPTS at playlist time: ${timeOffset}`,
      );
    }
    if (!initPTS) {
      if (
        !initSegment.timescale ||
        initSegment.trackId === undefined ||
        initSegment.initPTS === undefined
      ) {
        this.warn('Could not set initPTS');
        initSegment.initPTS = decodeTime;
        initSegment.timescale = 1;
        initSegment.trackId = -1;
      }
      this.initPTS = initPTS = {
        baseTime: initSegment.initPTS,
        timescale: initSegment.timescale,
        trackId: initSegment.trackId,
      };
    } else {
      initSegment.initPTS = initPTS.baseTime;
      initSegment.timescale = initPTS.timescale;
      initSegment.trackId = initPTS.trackId;
    }

    const startTime = decodeTime - initPTS.baseTime / initPTS.timescale;
    const endTime = startTime + duration;

    if (duration > 0) {
      this.lastEndTime = endTime;
    } else {
      this.warn('Duration parsed from mp4 should be greater than zero');
      this.resetNextTimestamp();
    }

    const encrypted =
      (initData.audio ? initData.audio.encrypted : false) ||
      (initData.video ? initData.video.encrypted : false);

    const track: RemuxedTrack = {
      data1,
      data2,
      startPTS: startTime,
      startDTS: startTime,
      endPTS: endTime,
      endDTS: endTime,
      type,
      hasAudio,
      hasVideo,
      nb: 1,
      dropped: 0,
      encrypted,
    };

    result.audio = hasAudio && !hasVideo ? track : undefined;
    result.video = hasVideo ? track : undefined;
    const videoSampleCount = videoSampleTimestamps?.sampleCount;
    if (videoSampleCount) {
      const firstKeyFrame = videoSampleTimestamps.keyFrameIndex;
      const independent = firstKeyFrame !== -1;
      track.nb = videoSampleCount;
      track.dropped =
        firstKeyFrame === 0 || this.isVideoContiguous
          ? 0
          : independent
            ? firstKeyFrame
            : videoSampleCount;
      track.independent = independent;
      track.firstKeyFrame = firstKeyFrame;
      if (independent && videoSampleTimestamps.keyFrameStart) {
        track.firstKeyFramePTS =
          (videoSampleTimestamps.keyFrameStart - initPTS.baseTime) /
          initPTS.timescale;
      }
      if (!this.isVideoContiguous) {
        result.independent = independent;
      }
      this.isVideoContiguous ||= independent;
      if (track.dropped) {
        this.warn(
          `fmp4 does not start with IDR: firstIDR ${firstKeyFrame}/${videoSampleCount} dropped: ${track.dropped} start: ${track.firstKeyFramePTS || 'NA'}`,
        );
      }
    }

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

function toStartEndOrDefault(
  trackTimes: TrackTimes | null,
  defaultValue: number,
  end: boolean = false,
): number {
  return trackTimes?.start !== undefined
    ? (trackTimes.start + (end ? trackTimes.duration : 0)) /
        trackTimes.timescale
    : defaultValue;
}

function isInvalidInitPts(
  initPTS: TimestampOffset | null,
  startDTS: number,
  timeOffset: number,
  duration: number,
): initPTS is null {
  if (initPTS === null) {
    return true;
  }
  // InitPTS is invalid when distance from program would be more than or equal to segment duration or a minimum of one second
  const minDuration = Math.max(duration, 1);
  const startTime = startDTS - initPTS.baseTime / initPTS.timescale;
  return Math.abs(startTime - timeOffset) >= minDuration;
}

function getParsedTrackCodec(
  track: InitDataTrack,
  type: ElementaryStreamTypes.AUDIO | ElementaryStreamTypes.VIDEO,
  logger: ILogger,
): string {
  const parsedCodec = track.codec;
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
