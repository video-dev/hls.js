import { sliceUint8 } from './typed-array';
import { ElementaryStreamTypes } from '../loader/fragment';
import { PassthroughTrack, UserdataSample } from '../types/demuxer';
import { utf8ArrayToStr } from '../demux/id3';

const UINT32_MAX = Math.pow(2, 32) - 1;
const push = [].push;

// We are using fixed track IDs for driving the MP4 remuxer
// instead of following the TS PIDs.
// There is no reason not to do this and some browsers/SourceBuffer-demuxers
// may not like if there are TrackID "switches"
// See https://github.com/video-dev/hls.js/issues/1331
// Here we are mapping our internal track types to constant MP4 track IDs
// With MSE currently one can only have one track of each, and we are muxing
// whatever video/audio rendition in them.
export const RemuxerTrackIdConfig = {
  video: 1,
  audio: 2,
  id3: 3,
  text: 4,
};

export function bin2str(data: Uint8Array): string {
  return String.fromCharCode.apply(null, data);
}

export function readUint16(buffer: Uint8Array, offset: number): number {
  const val = (buffer[offset] << 8) | buffer[offset + 1];
  return val < 0 ? 65536 + val : val;
}

export function readUint32(buffer: Uint8Array, offset: number): number {
  const val = readSint32(buffer, offset);
  return val < 0 ? 4294967296 + val : val;
}

export function readSint32(buffer: Uint8Array, offset: number): number {
  return (
    (buffer[offset] << 24) |
    (buffer[offset + 1] << 16) |
    (buffer[offset + 2] << 8) |
    buffer[offset + 3]
  );
}

export function writeUint32(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value >> 24;
  buffer[offset + 1] = (value >> 16) & 0xff;
  buffer[offset + 2] = (value >> 8) & 0xff;
  buffer[offset + 3] = value & 0xff;
}

// Find the data for a box specified by its path
export function findBox(data: Uint8Array, path: string[]): Uint8Array[] {
  const results = [] as Uint8Array[];
  if (!path.length) {
    // short-circuit the search for empty paths
    return results;
  }
  const end = data.byteLength;

  for (let i = 0; i < end; ) {
    const size = readUint32(data, i);
    const type = bin2str(data.subarray(i + 4, i + 8));
    const endbox = size > 1 ? i + size : end;

    if (type === path[0]) {
      if (path.length === 1) {
        // this is the end of the path and we've found the box we were
        // looking for
        results.push(data.subarray(i + 8, endbox));
      } else {
        // recursively search for the next box along the path
        const subresults = findBox(data.subarray(i + 8, endbox), path.slice(1));
        if (subresults.length) {
          push.apply(results, subresults);
        }
      }
    }
    i = endbox;
  }

  // we've finished searching all of data
  return results;
}

type SidxInfo = {
  earliestPresentationTime: number;
  timescale: number;
  version: number;
  referencesCount: number;
  references: any[];
  moovEndOffset: number | null;
};

export function parseSegmentIndex(initSegment: Uint8Array): SidxInfo | null {
  const moovBox = findBox(initSegment, ['moov']);
  const moov = moovBox[0];
  const moovEndOffset = moov ? moov.length : null; // we need this in case we need to chop of garbage of the end of current data

  const sidxBox = findBox(initSegment, ['sidx']);

  if (!sidxBox || !sidxBox[0]) {
    return null;
  }

  const references: any[] = [];
  const sidx = sidxBox[0];

  const version = sidx[0];

  // set initial offset, we skip the reference ID (not needed)
  let index = version === 0 ? 8 : 16;

  const timescale = readUint32(sidx, index);
  index += 4;

  // TODO: parse earliestPresentationTime and firstOffset
  // usually zero in our case
  const earliestPresentationTime = 0;
  const firstOffset = 0;

  if (version === 0) {
    index += 8;
  } else {
    index += 16;
  }

  // skip reserved
  index += 2;

  let startByte = sidx.length + firstOffset;

  const referencesCount = readUint16(sidx, index);
  index += 2;

  for (let i = 0; i < referencesCount; i++) {
    let referenceIndex = index;

    const referenceInfo = readUint32(sidx, referenceIndex);
    referenceIndex += 4;

    const referenceSize = referenceInfo & 0x7fffffff;
    const referenceType = (referenceInfo & 0x80000000) >>> 31;

    if (referenceType === 1) {
      // eslint-disable-next-line no-console
      console.warn('SIDX has hierarchical references (not supported)');
      return null;
    }

    const subsegmentDuration = readUint32(sidx, referenceIndex);
    referenceIndex += 4;

    references.push({
      referenceSize,
      subsegmentDuration, // unscaled
      info: {
        duration: subsegmentDuration / timescale,
        start: startByte,
        end: startByte + referenceSize - 1,
      },
    });

    startByte += referenceSize;

    // Skipping 1 bit for |startsWithSap|, 3 bits for |sapType|, and 28 bits
    // for |sapDelta|.
    referenceIndex += 4;

    // skip to next ref
    index = referenceIndex;
  }

  return {
    earliestPresentationTime,
    timescale,
    version,
    referencesCount,
    references,
    moovEndOffset,
  };
}

/**
 * Parses an MP4 initialization segment and extracts stream type and
 * timescale values for any declared tracks. Timescale values indicate the
 * number of clock ticks per second to assume for time-based values
 * elsewhere in the MP4.
 *
 * To determine the start time of an MP4, you need two pieces of
 * information: the timescale unit and the earliest base media decode
 * time. Multiple timescales can be specified within an MP4 but the
 * base media decode time is always expressed in the timescale from
 * the media header box for the track:
 * ```
 * moov > trak > mdia > mdhd.timescale
 * moov > trak > mdia > hdlr
 * ```
 * @param initSegment {Uint8Array} the bytes of the init segment
 * @return {InitData} a hash of track type to timescale values or null if
 * the init segment is malformed.
 */

export interface InitDataTrack {
  timescale: number;
  id: number;
  codec: string;
}

type HdlrType = ElementaryStreamTypes.AUDIO | ElementaryStreamTypes.VIDEO;

export interface InitData extends Array<any> {
  [index: number]:
    | {
        timescale: number;
        type: HdlrType;
        default?: {
          duration: number;
          flags: number;
        };
      }
    | undefined;
  audio?: InitDataTrack;
  video?: InitDataTrack;
  caption?: InitDataTrack;
}

export function parseInitSegment(initSegment: Uint8Array): InitData {
  const result: InitData = [];
  const traks = findBox(initSegment, ['moov', 'trak']);
  for (let i = 0; i < traks.length; i++) {
    const trak = traks[i];
    const tkhd = findBox(trak, ['tkhd'])[0];
    if (tkhd) {
      let version = tkhd[0];
      let index = version === 0 ? 12 : 20;
      const trackId = readUint32(tkhd, index);
      const mdhd = findBox(trak, ['mdia', 'mdhd'])[0];
      if (mdhd) {
        version = mdhd[0];
        index = version === 0 ? 12 : 20;
        const timescale = readUint32(mdhd, index);
        const hdlr = findBox(trak, ['mdia', 'hdlr'])[0];
        if (hdlr) {
          const hdlrType = bin2str(hdlr.subarray(8, 12));
          const type: HdlrType | undefined = {
            soun: ElementaryStreamTypes.AUDIO as const,
            vide: ElementaryStreamTypes.VIDEO as const,
          }[hdlrType];
          if (type) {
            // Parse codec details
            const stsd = findBox(trak, ['mdia', 'minf', 'stbl', 'stsd'])[0];
            let codec;
            if (stsd) {
              codec = bin2str(stsd.subarray(12, 16));
              // TODO: Parse codec details to be able to build MIME type.
              // stsd.start += 8;
              // const codecBox = findBox(stsd, [codec])[0];
              // if (codecBox) {
              //   TODO: Codec parsing support for avc1, mp4a, hevc, av01...
              // }
            }
            result[trackId] = { timescale, type };
            result[type] = { timescale, id: trackId, codec };
          }
        }
      }
    }
  }

  const trex = findBox(initSegment, ['moov', 'mvex', 'trex']);
  trex.forEach((trex) => {
    const trackId = readUint32(trex, 4);
    const track = result[trackId];
    if (track) {
      track.default = {
        duration: readUint32(trex, 12),
        flags: readUint32(trex, 20),
      };
    }
  });

  return result;
}

/**
 * Determine the base media decode start time, in seconds, for an MP4
 * fragment. If multiple fragments are specified, the earliest time is
 * returned.
 *
 * The base media decode time can be parsed from track fragment
 * metadata:
 * ```
 * moof > traf > tfdt.baseMediaDecodeTime
 * ```
 * It requires the timescale value from the mdhd to interpret.
 *
 * @param initData {InitData} a hash of track type to timescale values
 * @param fmp4 {Uint8Array} the bytes of the mp4 fragment
 * @return {number} the earliest base media decode start time for the
 * fragment, in seconds
 */
export function getStartDTS(initData: InitData, fmp4: Uint8Array): number {
  // we need info from two children of each track fragment box
  return (
    findBox(fmp4, ['moof', 'traf']).reduce((result: number | null, traf) => {
      const tfdt = findBox(traf, ['tfdt'])[0];
      const version = tfdt[0];
      const start = findBox(traf, ['tfhd']).reduce(
        (result: number | null, tfhd) => {
          // get the track id from the tfhd
          const id = readUint32(tfhd, 4);
          const track = initData[id];
          if (track) {
            let baseTime = readUint32(tfdt, 4);
            if (version === 1) {
              baseTime *= Math.pow(2, 32);
              baseTime += readUint32(tfdt, 8);
            }
            // assume a 90kHz clock if no timescale was specified
            const scale = track.timescale || 90e3;
            // convert base time to seconds
            const startTime = baseTime / scale;
            if (
              isFinite(startTime) &&
              (result === null || startTime < result)
            ) {
              return startTime;
            }
          }
          return result;
        },
        null
      );
      if (
        start !== null &&
        isFinite(start) &&
        (result === null || start < result)
      ) {
        return start;
      }
      return result;
    }, null) || 0
  );
}

/*
  For Reference:
  aligned(8) class TrackFragmentHeaderBox
           extends FullBox(‘tfhd’, 0, tf_flags){
     unsigned int(32)  track_ID;
     // all the following are optional fields
     unsigned int(64)  base_data_offset;
     unsigned int(32)  sample_description_index;
     unsigned int(32)  default_sample_duration;
     unsigned int(32)  default_sample_size;
     unsigned int(32)  default_sample_flags
  }
 */
export function getDuration(data: Uint8Array, initData: InitData) {
  let rawDuration = 0;
  let videoDuration = 0;
  let audioDuration = 0;
  const trafs = findBox(data, ['moof', 'traf']);
  for (let i = 0; i < trafs.length; i++) {
    const traf = trafs[i];
    // There is only one tfhd & trun per traf
    // This is true for CMAF style content, and we should perhaps check the ftyp
    // and only look for a single trun then, but for ISOBMFF we should check
    // for multiple track runs.
    const tfhd = findBox(traf, ['tfhd'])[0];
    // get the track id from the tfhd
    const id = readUint32(tfhd, 4);
    const track = initData[id];
    if (!track) {
      continue;
    }
    const trackDefault = track.default;
    const tfhdFlags = readUint32(tfhd, 0) | trackDefault?.flags!;
    let sampleDuration: number | undefined = trackDefault?.duration;
    if (tfhdFlags & 0x000008) {
      // 0x000008 indicates the presence of the default_sample_duration field
      if (tfhdFlags & 0x000002) {
        // 0x000002 indicates the presence of the sample_description_index field, which precedes default_sample_duration
        // If present, the default_sample_duration exists at byte offset 12
        sampleDuration = readUint32(tfhd, 12);
      } else {
        // Otherwise, the duration is at byte offset 8
        sampleDuration = readUint32(tfhd, 8);
      }
    }
    // assume a 90kHz clock if no timescale was specified
    const timescale = track.timescale || 90e3;
    const truns = findBox(traf, ['trun']);
    for (let j = 0; j < truns.length; j++) {
      rawDuration = computeRawDurationFromSamples(truns[j]);
      if (!rawDuration && sampleDuration) {
        const sampleCount = readUint32(truns[j], 4);
        rawDuration = sampleDuration * sampleCount;
      }
      if (track.type === ElementaryStreamTypes.VIDEO) {
        videoDuration += rawDuration / timescale;
      } else if (track.type === ElementaryStreamTypes.AUDIO) {
        audioDuration += rawDuration / timescale;
      }
    }
  }
  if (videoDuration === 0 && audioDuration === 0) {
    // If duration samples are not available in the traf use sidx subsegment_duration
    const sidx = parseSegmentIndex(data);
    if (sidx?.references) {
      return sidx.references.reduce(
        (dur, ref) => dur + ref.info.duration || 0,
        0
      );
    }
  }
  if (videoDuration) {
    return videoDuration;
  }
  return audioDuration;
}

/*
  For Reference:
  aligned(8) class TrackRunBox
           extends FullBox(‘trun’, version, tr_flags) {
     unsigned int(32)  sample_count;
     // the following are optional fields
     signed int(32) data_offset;
     unsigned int(32)  first_sample_flags;
     // all fields in the following array are optional
     {
        unsigned int(32)  sample_duration;
        unsigned int(32)  sample_size;
        unsigned int(32)  sample_flags
        if (version == 0)
           { unsigned int(32)
        else
           { signed int(32)
     }[ sample_count ]
  }
 */
export function computeRawDurationFromSamples(trun): number {
  const flags = readUint32(trun, 0);
  // Flags are at offset 0, non-optional sample_count is at offset 4. Therefore we start 8 bytes in.
  // Each field is an int32, which is 4 bytes
  let offset = 8;
  // data-offset-present flag
  if (flags & 0x000001) {
    offset += 4;
  }
  // first-sample-flags-present flag
  if (flags & 0x000004) {
    offset += 4;
  }

  let duration = 0;
  const sampleCount = readUint32(trun, 4);
  for (let i = 0; i < sampleCount; i++) {
    // sample-duration-present flag
    if (flags & 0x000100) {
      const sampleDuration = readUint32(trun, offset);
      duration += sampleDuration;
      offset += 4;
    }
    // sample-size-present flag
    if (flags & 0x000200) {
      offset += 4;
    }
    // sample-flags-present flag
    if (flags & 0x000400) {
      offset += 4;
    }
    // sample-composition-time-offsets-present flag
    if (flags & 0x000800) {
      offset += 4;
    }
  }
  return duration;
}

export function offsetStartDTS(
  initData: InitData,
  fmp4: Uint8Array,
  timeOffset: number
) {
  findBox(fmp4, ['moof', 'traf']).forEach((traf) => {
    findBox(traf, ['tfhd']).forEach((tfhd) => {
      // get the track id from the tfhd
      const id = readUint32(tfhd, 4);
      const track = initData[id];
      if (!track) {
        return;
      }
      // assume a 90kHz clock if no timescale was specified
      const timescale = track.timescale || 90e3;
      // get the base media decode time from the tfdt
      findBox(traf, ['tfdt']).forEach((tfdt) => {
        const version = tfdt[0];
        let baseMediaDecodeTime = readUint32(tfdt, 4);

        if (version === 0) {
          baseMediaDecodeTime -= timeOffset * timescale;
          baseMediaDecodeTime = Math.max(baseMediaDecodeTime, 0);
          writeUint32(tfdt, 4, baseMediaDecodeTime);
        } else {
          baseMediaDecodeTime *= Math.pow(2, 32);
          baseMediaDecodeTime += readUint32(tfdt, 8);
          baseMediaDecodeTime -= timeOffset * timescale;
          baseMediaDecodeTime = Math.max(baseMediaDecodeTime, 0);
          const upper = Math.floor(baseMediaDecodeTime / (UINT32_MAX + 1));
          const lower = Math.floor(baseMediaDecodeTime % (UINT32_MAX + 1));
          writeUint32(tfdt, 4, upper);
          writeUint32(tfdt, 8, lower);
        }
      });
    });
  });
}

// TODO: Check if the last moof+mdat pair is part of the valid range
export function segmentValidRange(data: Uint8Array): SegmentedRange {
  const segmentedRange: SegmentedRange = {
    valid: null,
    remainder: null,
  };

  const moofs = findBox(data, ['moof']);
  if (!moofs) {
    return segmentedRange;
  } else if (moofs.length < 2) {
    segmentedRange.remainder = data;
    return segmentedRange;
  }
  const last = moofs[moofs.length - 1];
  // Offset by 8 bytes; findBox offsets the start by as much
  segmentedRange.valid = sliceUint8(data, 0, last.byteOffset - 8);
  segmentedRange.remainder = sliceUint8(data, last.byteOffset - 8);
  return segmentedRange;
}

export interface SegmentedRange {
  valid: Uint8Array | null;
  remainder: Uint8Array | null;
}

export function appendUint8Array(
  data1: Uint8Array,
  data2: Uint8Array
): Uint8Array {
  const temp = new Uint8Array(data1.length + data2.length);
  temp.set(data1);
  temp.set(data2, data1.length);

  return temp;
}

export interface IEmsgParsingData {
  schemeIdUri: string;
  value: string;
  timeScale: number;
  presentationTimeDelta?: number;
  presentationTime?: number;
  eventDuration: number;
  id: number;
  payload: Uint8Array;
}

export function parseSamples(
  timeOffset: number,
  track: PassthroughTrack
): UserdataSample[] {
  const seiSamples = [] as UserdataSample[];
  const videoData = track.samples;
  const timescale = track.timescale;
  const trackId = track.id;
  let isHEVCFlavor = false;

  const moofs = findBox(videoData, ['moof']);
  moofs.map((moof) => {
    const moofOffset = moof.byteOffset - 8;
    const trafs = findBox(moof, ['traf']);
    trafs.map((traf) => {
      // get the base media decode time from the tfdt
      const baseTime = findBox(traf, ['tfdt']).map((tfdt) => {
        const version = tfdt[0];
        let result = readUint32(tfdt, 4);
        if (version === 1) {
          result *= Math.pow(2, 32);
          result += readUint32(tfdt, 8);
        }
        return result / timescale;
      })[0];

      if (baseTime !== undefined) {
        timeOffset = baseTime;
      }

      return findBox(traf, ['tfhd']).map((tfhd) => {
        const id = readUint32(tfhd, 4);
        const tfhdFlags = readUint32(tfhd, 0) & 0xffffff;
        const baseDataOffsetPresent = (tfhdFlags & 0x000001) !== 0;
        const sampleDescriptionIndexPresent = (tfhdFlags & 0x000002) !== 0;
        const defaultSampleDurationPresent = (tfhdFlags & 0x000008) !== 0;
        let defaultSampleDuration = 0;
        const defaultSampleSizePresent = (tfhdFlags & 0x000010) !== 0;
        let defaultSampleSize = 0;
        const defaultSampleFlagsPresent = (tfhdFlags & 0x000020) !== 0;
        let tfhdOffset = 8;

        if (id === trackId) {
          if (baseDataOffsetPresent) {
            tfhdOffset += 8;
          }
          if (sampleDescriptionIndexPresent) {
            tfhdOffset += 4;
          }
          if (defaultSampleDurationPresent) {
            defaultSampleDuration = readUint32(tfhd, tfhdOffset);
            tfhdOffset += 4;
          }
          if (defaultSampleSizePresent) {
            defaultSampleSize = readUint32(tfhd, tfhdOffset);
            tfhdOffset += 4;
          }
          if (defaultSampleFlagsPresent) {
            tfhdOffset += 4;
          }
          if (track.type === 'video') {
            isHEVCFlavor = isHEVC(track.codec);
          }

          findBox(traf, ['trun']).map((trun) => {
            const version = trun[0];
            const flags = readUint32(trun, 0) & 0xffffff;
            const dataOffsetPresent = (flags & 0x000001) !== 0;
            let dataOffset = 0;
            const firstSampleFlagsPresent = (flags & 0x000004) !== 0;
            const sampleDurationPresent = (flags & 0x000100) !== 0;
            let sampleDuration = 0;
            const sampleSizePresent = (flags & 0x000200) !== 0;
            let sampleSize = 0;
            const sampleFlagsPresent = (flags & 0x000400) !== 0;
            const sampleCompositionOffsetsPresent = (flags & 0x000800) !== 0;
            let compositionOffset = 0;
            const sampleCount = readUint32(trun, 4);
            let trunOffset = 8; // past version, flags, and sample count

            if (dataOffsetPresent) {
              dataOffset = readUint32(trun, trunOffset);
              trunOffset += 4;
            }
            if (firstSampleFlagsPresent) {
              trunOffset += 4;
            }

            let sampleOffset = dataOffset + moofOffset;

            for (let ix = 0; ix < sampleCount; ix++) {
              if (sampleDurationPresent) {
                sampleDuration = readUint32(trun, trunOffset);
                trunOffset += 4;
              } else {
                sampleDuration = defaultSampleDuration;
              }
              if (sampleSizePresent) {
                sampleSize = readUint32(trun, trunOffset);
                trunOffset += 4;
              } else {
                sampleSize = defaultSampleSize;
              }
              if (sampleFlagsPresent) {
                trunOffset += 4;
              }
              if (sampleCompositionOffsetsPresent) {
                if (version === 0) {
                  compositionOffset = readUint32(trun, trunOffset);
                } else {
                  compositionOffset = readSint32(trun, trunOffset);
                }
                trunOffset += 4;
              }
              if (track.type === ElementaryStreamTypes.VIDEO) {
                let naluTotalSize = 0;
                while (naluTotalSize < sampleSize) {
                  const naluSize = readUint32(videoData, sampleOffset);
                  sampleOffset += 4;
                  const naluType = videoData[sampleOffset] & 0x1f;
                  if (isSEIMessage(isHEVCFlavor, naluType)) {
                    const data = videoData.subarray(
                      sampleOffset,
                      sampleOffset + naluSize
                    );
                    parseSEIMessageFromNALu(
                      data,
                      timeOffset + compositionOffset / timescale,
                      seiSamples
                    );
                  }
                  sampleOffset += naluSize;
                  naluTotalSize += naluSize + 4;
                }
              }

              timeOffset += sampleDuration / timescale;
            }
          });
        }
      });
    });
  });
  return seiSamples;
}

function isHEVC(codec: string) {
  if (!codec) {
    return false;
  }
  const delimit = codec.indexOf('.');
  const baseCodec = delimit < 0 ? codec : codec.substring(0, delimit);
  return (
    baseCodec === 'hvc1' ||
    baseCodec === 'hev1' ||
    // Dolby Vision
    baseCodec === 'dvh1' ||
    baseCodec === 'dvhe'
  );
}

function isSEIMessage(isHEVCFlavor: boolean, naluType: number) {
  return isHEVCFlavor ? naluType === 39 || naluType === 40 : naluType === 6;
}

export function parseSEIMessageFromNALu(
  unescapedData: Uint8Array,
  pts: number,
  samples: UserdataSample[]
) {
  const data = discardEPB(unescapedData);
  let seiPtr = 0;
  // skip frameType
  seiPtr++;
  let payloadType = 0;
  let payloadSize = 0;
  let endOfCaptions = false;
  let b = 0;

  while (seiPtr < data.length) {
    payloadType = 0;
    do {
      if (seiPtr >= data.length) {
        break;
      }
      b = data[seiPtr++];
      payloadType += b;
    } while (b === 0xff);

    // Parse payload size.
    payloadSize = 0;
    do {
      if (seiPtr >= data.length) {
        break;
      }
      b = data[seiPtr++];
      payloadSize += b;
    } while (b === 0xff);

    const leftOver = data.length - seiPtr;

    if (!endOfCaptions && payloadType === 4 && seiPtr < data.length) {
      endOfCaptions = true;

      const countryCode = data[seiPtr++];
      if (countryCode === 181) {
        const providerCode = readUint16(data, seiPtr);
        seiPtr += 2;

        if (providerCode === 49) {
          const userStructure = readUint32(data, seiPtr);
          seiPtr += 4;

          if (userStructure === 0x47413934) {
            const userDataType = data[seiPtr++];

            // Raw CEA-608 bytes wrapped in CEA-708 packet
            if (userDataType === 3) {
              const firstByte = data[seiPtr++];
              const totalCCs = 0x1f & firstByte;
              const enabled = 0x40 & firstByte;
              const totalBytes = enabled ? 2 + totalCCs * 3 : 0;
              const byteArray = new Uint8Array(totalBytes);
              if (enabled) {
                byteArray[0] = firstByte;
                for (let i = 1; i < totalBytes; i++) {
                  byteArray[i] = data[seiPtr++];
                }
              }

              samples.push({
                type: userDataType,
                payloadType,
                pts,
                bytes: byteArray,
              });
            }
          }
        }
      }
    } else if (payloadType === 5 && payloadSize < leftOver) {
      endOfCaptions = true;

      if (payloadSize > 16) {
        const uuidStrArray: Array<string> = [];
        for (let i = 0; i < 16; i++) {
          const b = data[seiPtr++].toString(16);
          uuidStrArray.push(b.length == 1 ? '0' + b : b);

          if (i === 3 || i === 5 || i === 7 || i === 9) {
            uuidStrArray.push('-');
          }
        }
        const length = payloadSize - 16;
        const userDataBytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
          userDataBytes[i] = data[seiPtr++];
        }

        samples.push({
          payloadType,
          pts,
          uuid: uuidStrArray.join(''),
          userData: utf8ArrayToStr(userDataBytes),
          userDataBytes,
        });
      }
    } else if (payloadSize < leftOver) {
      seiPtr += payloadSize;
    } else if (payloadSize > leftOver) {
      break;
    }
  }
}

/**
 * remove Emulation Prevention bytes from a RBSP
 */
function discardEPB(data: Uint8Array): Uint8Array {
  const length = data.byteLength;
  const EPBPositions = [] as Array<number>;
  let i = 1;

  // Find all `Emulation Prevention Bytes`
  while (i < length - 2) {
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0x03) {
      EPBPositions.push(i + 2);
      i += 2;
    } else {
      i++;
    }
  }

  // If no Emulation Prevention Bytes were found just return the original
  // array
  if (EPBPositions.length === 0) {
    return data;
  }

  // Create a new array to hold the NAL unit data
  const newLength = length - EPBPositions.length;
  const newData = new Uint8Array(newLength);
  let sourceIndex = 0;

  for (i = 0; i < newLength; sourceIndex++, i++) {
    if (sourceIndex === EPBPositions[0]) {
      // Skip this byte
      sourceIndex++;
      // Remove this position index
      EPBPositions.shift();
    }
    newData[i] = data[sourceIndex];
  }
  return newData;
}

export function parseEmsg(data: Uint8Array): IEmsgParsingData {
  const version = data[0];
  let schemeIdUri: string = '';
  let value: string = '';
  let timeScale: number = 0;
  let presentationTimeDelta: number = 0;
  let presentationTime: number = 0;
  let eventDuration: number = 0;
  let id: number = 0;
  let offset: number = 0;

  if (version === 0) {
    while (bin2str(data.subarray(offset, offset + 1)) !== '\0') {
      schemeIdUri += bin2str(data.subarray(offset, offset + 1));
      offset += 1;
    }

    schemeIdUri += bin2str(data.subarray(offset, offset + 1));
    offset += 1;

    while (bin2str(data.subarray(offset, offset + 1)) !== '\0') {
      value += bin2str(data.subarray(offset, offset + 1));
      offset += 1;
    }

    value += bin2str(data.subarray(offset, offset + 1));
    offset += 1;

    timeScale = readUint32(data, 12);
    presentationTimeDelta = readUint32(data, 16);
    eventDuration = readUint32(data, 20);
    id = readUint32(data, 24);
    offset = 28;
  } else if (version === 1) {
    offset += 4;
    timeScale = readUint32(data, offset);
    offset += 4;
    const leftPresentationTime = readUint32(data, offset);
    offset += 4;
    const rightPresentationTime = readUint32(data, offset);
    offset += 4;
    presentationTime = 2 ** 32 * leftPresentationTime + rightPresentationTime;
    if (!Number.isSafeInteger(presentationTime)) {
      presentationTime = Number.MAX_SAFE_INTEGER;
      // eslint-disable-next-line no-console
      console.warn(
        'Presentation time exceeds safe integer limit and wrapped to max safe integer in parsing emsg box'
      );
    }

    eventDuration = readUint32(data, offset);
    offset += 4;
    id = readUint32(data, offset);
    offset += 4;

    while (bin2str(data.subarray(offset, offset + 1)) !== '\0') {
      schemeIdUri += bin2str(data.subarray(offset, offset + 1));
      offset += 1;
    }

    schemeIdUri += bin2str(data.subarray(offset, offset + 1));
    offset += 1;

    while (bin2str(data.subarray(offset, offset + 1)) !== '\0') {
      value += bin2str(data.subarray(offset, offset + 1));
      offset += 1;
    }

    value += bin2str(data.subarray(offset, offset + 1));
    offset += 1;
  }
  const payload = data.subarray(offset, data.byteLength);

  return {
    schemeIdUri,
    value,
    timeScale,
    presentationTime,
    presentationTimeDelta,
    eventDuration,
    id,
    payload,
  };
}
