import { sliceUint8 } from './typed-array';
import { ElementaryStreamTypes } from '../loader/fragment';

// Todo: Optimize by using loops instead of array methods
const UINT32_MAX = Math.pow(2, 32) - 1;

export function bin2str (buffer): string {
  return String.fromCharCode.apply(null, buffer);
}

export function readUint16 (buffer, offset): number {
  if (buffer.data) {
    offset += buffer.start;
    buffer = buffer.data;
  }

  const val = buffer[offset] << 8 |
    buffer[offset + 1];

  return val < 0 ? 65536 + val : val;
}

export function readUint32 (buffer, offset): number {
  if (buffer.data) {
    offset += buffer.start;
    buffer = buffer.data;
  }

  const val = buffer[offset] << 24 |
    buffer[offset + 1] << 16 |
    buffer[offset + 2] << 8 |
    buffer[offset + 3];
  return val < 0 ? 4294967296 + val : val;
}

export function writeUint32 (buffer, offset, value) {
  if (buffer.data) {
    offset += buffer.start;
    buffer = buffer.data;
  }
  buffer[offset] = value >> 24;
  buffer[offset + 1] = (value >> 16) & 0xff;
  buffer[offset + 2] = (value >> 8) & 0xff;
  buffer[offset + 3] = value & 0xff;
}

// Find the data for a box specified by its path
export function findBox (data, path): Array<any> {
  let results = [] as Array<any>;
  let i;
  let size;
  let type;
  let end;
  let subresults;
  let start;
  let endbox;

  if (data.data) {
    start = data.start;
    end = data.end;
    data = data.data;
  } else {
    start = 0;
    end = data.byteLength;
  }

  if (!path.length) {
    // short-circuit the search for empty paths
    return results;
  }

  for (i = start; i < end;) {
    size = readUint32(data, i);
    type = bin2str(data.subarray(i + 4, i + 8));
    endbox = size > 1 ? i + size : end;

    if (type === path[0]) {
      if (path.length === 1) {
        // this is the end of the path and we've found the box we were
        // looking for
        results.push({ data: data, start: i + 8, end: endbox });
      } else {
        // recursively search for the next box along the path
        subresults = findBox({ data: data, start: i + 8, end: endbox }, path.slice(1));
        if (subresults.length) {
          results = results.concat(subresults);
        }
      }
    }
    i = endbox;
  }

  // we've finished searching all of data
  return results;
}

export function parseSegmentIndex (initSegment) {
  const moovBox = findBox(initSegment, ['moov']);
  const moov = moovBox ? moovBox[0] : null;
  const moovEndOffset = moov ? moov.end : null; // we need this in case we need to chop of garbage of the end of current data

  const sidxBox = findBox(initSegment, ['sidx']);

  if (!sidxBox || !sidxBox[0]) {
    return null;
  }

  const references: any[] = [];
  const sidx = sidxBox[0];

  const version = sidx.data[0];

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

  let startByte = sidx.end + firstOffset;

  const referencesCount = readUint16(sidx, index);
  index += 2;

  for (let i = 0; i < referencesCount; i++) {
    let referenceIndex = index;

    const referenceInfo = readUint32(sidx, referenceIndex);
    referenceIndex += 4;

    const referenceSize = referenceInfo & 0x7FFFFFFF;
    const referenceType = (referenceInfo & 0x80000000) >>> 31;

    if (referenceType === 1) {
      console.warn('SIDX has hierarchical references (not supported)');
      return;
    }

    const subsegmentDuration = readUint32(sidx, referenceIndex);
    referenceIndex += 4;

    references.push({
      referenceSize,
      subsegmentDuration, // unscaled
      info: {
        duration: subsegmentDuration / timescale,
        start: startByte,
        end: startByte + referenceSize - 1
      }
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
    moovEndOffset
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
 * @param init {Uint8Array} the bytes of the init segment
 * @return {InitData} a hash of track type to timescale values or null if
 * the init segment is malformed.
 */

interface InitDataTrack {
  timescale: number,
  id: number,
  codec: string
}

type HdlrType = ElementaryStreamTypes.AUDIO | ElementaryStreamTypes.VIDEO;

export interface InitData extends Array<any> {
  [index: number]: { timescale: number, type: HdlrType };
  audio?: InitDataTrack
  video?: InitDataTrack
}

export function parseInitSegment (initSegment): InitData {
  const result: InitData = [];
  const traks = findBox(initSegment, ['moov', 'trak']);

  traks.forEach(trak => {
    const tkhd = findBox(trak, ['tkhd'])[0];
    if (tkhd) {
      let version = tkhd.data[tkhd.start];
      let index = version === 0 ? 12 : 20;
      const trackId = readUint32(tkhd, index);

      const mdhd = findBox(trak, ['mdia', 'mdhd'])[0];
      if (mdhd) {
        version = mdhd.data[mdhd.start];
        index = version === 0 ? 12 : 20;
        const timescale = readUint32(mdhd, index);

        const hdlr = findBox(trak, ['mdia', 'hdlr'])[0];
        if (hdlr) {
          const hdlrType = bin2str(hdlr.data.subarray(hdlr.start + 8, hdlr.start + 12));
          const type: HdlrType = { soun: ElementaryStreamTypes.AUDIO, vide: ElementaryStreamTypes.VIDEO }[hdlrType];
          if (type) {
            // TODO: Parse codec details to be able to build MIME type.
            const codexBoxes = findBox(trak, ['mdia', 'minf', 'stbl', 'stsd']);
            let codec;
            if (codexBoxes.length) {
              const codecBox = codexBoxes[0];
              codec = bin2str(codecBox.data.subarray(codecBox.start + 12, codecBox.start + 16));
            }
            result[trackId] = { timescale, type };
            result[type] = { timescale, id: trackId, codec };
          }
        }
      }
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
 * @param timescale {object} a hash of track ids to timescale values.
 * @return {number} the earliest base media decode start time for the
 * fragment, in seconds
 */
export function getStartDTS (initData, fragment) {
  // we need info from two children of each track fragment box
  const trafs = findBox(fragment, ['moof', 'traf']);

  // determine the start times for each track
  const baseTimes = [].concat.apply([], trafs.map(function (traf) {
    return findBox(traf, ['tfhd']).map(function (tfhd) {
      // get the track id from the tfhd
      const id = readUint32(tfhd, 4);
      // assume a 90kHz clock if no timescale was specified
      const scale = initData[id].timescale || 90e3;

      // get the base media decode time from the tfdt
      const baseTime = findBox(traf, ['tfdt']).map(function (tfdt) {
        let result;

        const version = tfdt.data[tfdt.start];
        result = readUint32(tfdt, 4);
        if (version === 1) {
          result *= Math.pow(2, 32);

          result += readUint32(tfdt, 8);
        }
        return result;
      })[0];
      // convert base time to seconds
      return baseTime / scale;
    });
  }));

  // return the minimum
  const result = Math.min.apply(null, baseTimes);
  return isFinite(result) ? result : 0;
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
export function getDuration (data, initData) {
  let rawDuration = 0;
  let totalDuration = 0;
  let videoDuration = 0;
  const trafs = findBox(data, ['moof', 'traf']);
  for (let i = 0; i < trafs.length; i++) {
    const traf = trafs[i];
    // There is only one tfhd & trun per traf
    const tfhd = findBox(traf, ['tfhd'])[0];
    const trun = findBox(traf, ['trun'])[0];
    const tfhdFlags = readUint32(tfhd, 0);
    let sampleDuration;
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
      const sampleCount = readUint32(trun, 4);
      rawDuration += sampleDuration * sampleCount;
    } else {
      rawDuration = computeRawDurationFromSamples(trun);
    }

    const id = readUint32(tfhd, 4);
    const track = initData[id];
    const scale = track.timescale || 90e3;
    totalDuration += rawDuration / scale;
    if (track && track.type === ElementaryStreamTypes.VIDEO) {
      videoDuration += rawDuration / scale;
    }
  }
  if (totalDuration === 0) {
    // If duration samples are not available in the traf use sidx subsegment_duration
    const sidx = parseSegmentIndex(data);
    if (sidx?.references) {
      return sidx.references.reduce((dur, ref) => dur + ref.info.duration || 0, 0);
    }
  }
  if (videoDuration) {
    // Only return duration of the video track. We don't want the combined duration of video and audio.
    return videoDuration;
  }
  return totalDuration;
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
export function computeRawDurationFromSamples (trun): number {
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

export function offsetStartDTS (initData, fragment, timeOffset) {
  findBox(fragment, ['moof', 'traf']).map(function (traf) {
    return findBox(traf, ['tfhd']).map(function (tfhd) {
      // get the track id from the tfhd
      const id = readUint32(tfhd, 4);
      // assume a 90kHz clock if no timescale was specified
      const timescale = initData[id].timescale || 90e3;

      // get the base media decode time from the tfdt
      findBox(traf, ['tfdt']).map(function (tfdt) {
        const version = tfdt.data[tfdt.start];
        let baseMediaDecodeTime = readUint32(tfdt, 4);
        if (version === 0) {
          writeUint32(tfdt, 4, baseMediaDecodeTime - timeOffset * timescale);
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
export function segmentValidRange (data: Uint8Array): SegmentedRange {
  const segmentedRange: SegmentedRange = {
    valid: null,
    remainder: null
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
  segmentedRange.valid = sliceUint8(data, 0, last.start - 8);
  segmentedRange.remainder = sliceUint8(data, last.start - 8);
  return segmentedRange;
}

export interface SegmentedRange {
  valid: Uint8Array | null,
  remainder: Uint8Array | null,
}

export function appendUint8Array (data1: Uint8Array, data2: Uint8Array) : Uint8Array {
  const temp = new Uint8Array(data1.length + data2.length);
  temp.set(data1);
  temp.set(data2, data1.length);

  return temp;
}
