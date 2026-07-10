import MP4 from './mp4-generator';
import {
  flushTextTrackMetadataCueSamples,
  flushTextTrackUserdataCueSamples,
} from './mp4-remuxer';
import { ElementaryStreamTypes } from '../loader/fragment';
import { getCodecCompatibleName } from '../utils/codecs';
import { type ILogger, Logger } from '../utils/logger';
import {
  patchEncyptionData,
  truncateIFrameMoofToSamples,
  writeUint32,
} from '../utils/mp4-tools';
import { getSampleData, parseInitSegment } from '../utils/mp4-tools';
import type { HlsEventEmitter } from '../events';
import type { TrackFragmentSample } from './mp4-generator';
import type { HlsConfig } from '../config';
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
  private readonly observer: HlsEventEmitter;
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
    this.observer = observer;
  }

  public destroy() {
    if (this.observer) {
      this.observer.removeAllListeners();
    }
    // @ts-ignore
    this.observer = null;
  }

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
      result.initSegment = initSegment;
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

    if (!baseOffsetSamples) {
      this.log(
        `No media samples found in ${playlistType} ${chunkMeta.level} ${
          chunkMeta.part === -1 ? '' : `part: ${chunkMeta.part} of`
        } sn: ${chunkMeta.sn} at playlist time: ${timeOffset}`,
      );
      return result;
    }

    let data1 = data;
    let data2: Uint8Array<ArrayBuffer> | undefined;
    // Presentation end of rewritten I-Frame samples (video timescale units).
    // Set whenever sample durations are stretched to the playlist duration so
    // that the reported PTS range matches the appended media.
    let videoPtsEnd: number | undefined;
    if (
      __USE_IFRAMES__ &&
      videoSampleTimestamps &&
      videoSampleTimestamps.sampleCount >= 1 &&
      initData.video &&
      chunkMeta.iframe
    ) {
      const { trun, start } = videoSampleTimestamps;
      if (trun.length === 1 && trun[0].samples.length) {
        const fragRun = trun[0];
        const samples = fragRun.samples;
        const { lastSampleDurationOffset, defaultSampleDurationOffset } =
          fragRun;
        // Stretch samples to playlist time when the moof's
        // sample timing is off by more than 1/20s.
        const needsDurationAdjustment =
          Math.abs(chunkMeta.duration - (videoEndTime - videoStartTime)) > 0.05;
        const partialMdat = samples.length < videoSampleTimestamps.sampleCount;
        const needsRemux = needsDurationAdjustment || partialMdat;
        const canRewriteInPlace =
          lastSampleDurationOffset !== undefined ||
          defaultSampleDurationOffset !== undefined;
        if (!needsRemux) {
          // MP4 timing already spans EXTINF and every declared sample's
          // data is in the slice — pass through unchanged.
          duration = videoEndTime - videoStartTime;
        } else if (initData.video.encrypted && canRewriteInPlace) {
          // Encrypted I-Frame: mutate the moof in place so senc /
          // saiz / saio (and any other moof/traf children) survive intact.
          if (partialMdat) {
            const totalSize = samples.reduce(
              (sum, sample) => sum + sample.size,
              0,
            );
            truncateIFrameMoofToSamples(data, samples.length, totalSize);
          }
          // adjust duration
          duration = needsDurationAdjustment
            ? chunkMeta.duration
            : videoEndTime - videoStartTime;
          if (lastSampleDurationOffset !== undefined) {
            const lastSample = samples[samples.length - 1];
            let lastSampleDuration = duration * initData.video.timescale;
            for (let i = 0; i < samples.length - 1; i++) {
              lastSampleDuration -= samples[i].duration;
            }
            if (lastSampleDuration <= 0) {
              // Playlist duration is shorter than the preceding samples;
              // keep the native duration rather than writing an unsigned
              // wrap-around value.
              lastSampleDuration = lastSample.duration;
            }
            writeUint32(data, lastSampleDurationOffset, lastSampleDuration);
            lastSample.duration = lastSampleDuration;
          } else {
            const defaultSampleDuration = Math.round(
              (duration * initData.video.timescale) / samples.length,
            );
            writeUint32(
              data,
              defaultSampleDurationOffset!,
              defaultSampleDuration,
            );
            samples.forEach((sample) => {
              sample.duration = defaultSampleDuration;
            });
          }
          videoPtsEnd = samplesPresentationEnd(start, samples);
        } else if (!initData.video.encrypted) {
          // Unencrypted: regenerate the moof from the in-range samples.
          // The in-place truncation path the encrypted branch uses doesn't
          // preserve enough structure for some unencrypted codecs
          duration = needsDurationAdjustment
            ? chunkMeta.duration
            : videoEndTime - videoStartTime;
          const sampleOffset = fragRun.sampleOffset;
          let totalSize = 0;
          const remuxedSamples = samples.map((sample): TrackFragmentSample => {
            const { cts, duration: sampleDuration, size, flags } = sample;
            const { dependsOn, isNonSync } = Object.assign(
              { dependsOn: 2, isNonSync: 0 },
              flags,
            );
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
          });
          if (remuxedSamples.length) {
            const lastSample = remuxedSamples[remuxedSamples.length - 1];
            let lastSampleDuration = duration * initData.video.timescale;
            for (let i = remuxedSamples.length - 1; i--; ) {
              lastSampleDuration -= remuxedSamples[i].duration;
            }
            if (lastSampleDuration <= 0) {
              // Playlist duration is shorter than the preceding samples;
              // keep the native duration rather than writing an unsigned
              // wrap-around value.
              lastSampleDuration = lastSample.duration;
            }
            lastSample.duration = lastSampleDuration;
            videoPtsEnd = samplesPresentationEnd(start, remuxedSamples);

            data1 = MP4.moof(chunkMeta.sn, start, {
              type: 'video',
              id: videoTrack.id,
              samples: remuxedSamples,
            });
            data2 = data.subarray(sampleOffset - 8, sampleOffset + totalSize);
            writeUint32(data2, 0, totalSize + 8);
          } else {
            this.warn(
              `Could not remux IFrame track fragment (sampleOffset ${sampleOffset}: totalSize: ${totalSize} bytes: ${data})`,
            );
            duration = videoEndTime - videoStartTime;
          }
        } else {
          // Encrypted, but neither trun nor tfhd carries a duration we
          // can rewrite (encoder relies on moov trex defaults).
          this.warn(
            `IFrame remux skipped for encrypted segment without trun or tfhd sample_duration (sn ${chunkMeta.sn}); using native sample duration`,
          );
          duration = videoEndTime - videoStartTime;
        }
      } else {
        this.warn(
          `Could not remux IFrame track fragment (trun count ${trun.length})`,
        );
        duration = videoEndTime - videoStartTime;
      }
    } else {
      duration = syncOnAudio
        ? audioEndTime - audioStartTime
        : videoEndTime - videoStartTime;
    }

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
        detectedDrift = decodeTime >= 0 && Math.abs(1 - driftEstimate) < 0.001;
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

    const startDTS = decodeTime - initPTS.baseTime / initPTS.timescale;
    const endDTS = startDTS + duration;
    const startPTS =
      hasVideo && baseOffsetSamples?.ptsMin !== undefined
        ? baseOffsetSamples.ptsMin / baseOffsetSamples.timescale -
          initPTS.baseTime / initPTS.timescale
        : startDTS;
    // Report the presentation end of rewritten I-Frame samples rather than
    // the timing parsed from the input so that fragment start/end updates
    // (updateFragPTSDTS) match the appended media. Otherwise a stretched
    // single-sample fragment collapses frag.end to ~one frame, breaking
    // buffered-fragment lookups and shifting playlist timing.
    const endPTS =
      videoPtsEnd !== undefined && videoSampleTimestamps
        ? videoPtsEnd / videoSampleTimestamps.timescale -
          initPTS.baseTime / initPTS.timescale
        : hasVideo && baseOffsetSamples?.ptsMax
          ? baseOffsetSamples.ptsMax / baseOffsetSamples.timescale -
            initPTS.baseTime / initPTS.timescale
          : endDTS;

    // For troubleshooting duplicates of https://github.com/video-dev/hls.js/issues/6777
    // if (videoSampleTimestamps) {
    //   console.log(
    //     `#6777 segment ${chunkMeta.sn}: dts: ${videoSampleTimestamps.start}-${videoSampleTimestamps.start + videoSampleTimestamps.duration} pts: ${videoSampleTimestamps.ptsMin}-${
    //       videoSampleTimestamps.ptsMax
    //     }`,
    //   );
    // }

    if (duration > 0) {
      this.lastEndTime = endDTS;
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
      startPTS,
      startDTS,
      endPTS,
      endDTS,
      type,
      hasAudio,
      hasVideo,
      nb: 1,
      dropped: 0,
      encrypted,
    };

    result.audio = hasAudio && !hasVideo ? track : undefined;
    result.video = hasVideo ? track : undefined;
    const isVideoContiguous = this.isVideoContiguous;
    const videoSampleCount = videoSampleTimestamps?.sampleCount;
    if (videoSampleCount) {
      const firstKeyFrame = videoSampleTimestamps.keyFrameIndex;
      const independent = firstKeyFrame !== -1;
      track.nb = videoSampleCount;
      track.dropped =
        firstKeyFrame === 0 || isVideoContiguous
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
      if (!isVideoContiguous) {
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

function samplesPresentationEnd(
  baseDecodeTime: number,
  samples: Array<{ cts?: number; duration: number }>,
): number {
  let dts = baseDecodeTime;
  let end = baseDecodeTime;
  for (let i = 0; i < samples.length; i++) {
    const { cts, duration } = samples[i];
    end = Math.max(end, dts + (cts || 0) + duration);
    dts += duration;
  }
  return end;
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
  } else if (parsedCodec === 'mjpg') {
    return parsedCodec;
  }
  // Provide defaults based on codec type
  // This allows for some playback of some fmp4 playlists without CODECS defined in manifest
  logger.warn(`Unhandled video codec "${parsedCodec}" in mp4 MAP`);
  return parsedCodec || 'avc1';
}
export default PassThroughRemuxer;
