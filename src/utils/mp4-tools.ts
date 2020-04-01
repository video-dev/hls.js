import { sliceUint8 } from './typed-array';
import { ElementaryStreamTypes } from '../loader/fragment';
import { logger } from '../utils/logger';

// Todo: Optimize by using loops instead of array methods
const UINT32_MAX = Math.pow(2, 32) - 1;
const USER_DATA_REGISTERED_ITU_T_T35 = 4;
const RBSP_TRAILING_BITS = 128;

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

export function probe (data) {
  // ensure we find a moof box in the first 16 kB
  return findBox({ data: data, start: 0, end: Math.min(data.length, 16384) }, ['moof']).length > 0;
}

interface InitDataTrack {
    timescale: number,
    id: number,
    codec: string
  }

/**
 * see ANSI/SCTE 128-1 (2013), section 8.1
 *
 * This code was ported from the mux.js project at: https://github.com/videojs/mux.js
 */
export function parseUserData (sei) {
  // itu_t_t35_contry_code must be 181 (United States) for
  // captions
  if (sei.payload[0] !== 181) {
    return null;
  }

  // itu_t_t35_provider_code should be 49 (ATSC) for captions
  if (((sei.payload[1] << 8) | sei.payload[2]) !== 49) {
    return null;
  }

  // the user_identifier should be "GA94" to indicate ATSC1 data
  if (String.fromCharCode(sei.payload[3],
    sei.payload[4],
    sei.payload[5],
    sei.payload[6]) !== 'GA94') {
    return null;
  }

  // finally, user_data_type_code should be 0x03 for caption data
  if (sei.payload[7] !== 0x03) {
    return null;
  }

  // return the user_data_type_structure and strip the trailing
  // marker bits
  return sei.payload.subarray(8, sei.payload.length - 1);
}

/**
  * Parse a supplemental enhancement information (SEI) NAL unit.
  * Stops parsing once a message of type ITU T T35 has been found.
  *
  * This code was ported from the mux.js project at:
  *   https://github.com/videojs/mux.js
  *
  * @param bytes {Uint8Array} the bytes of a SEI NAL unit
  * @return {object} the parsed SEI payload
  * @see Rec. ITU-T H.264, 7.3.2.3.1
  */
export function parseSei (bytes) {
  let
    i = 0;
  const result = {
    payloadType: -1,
    payloadSize: 0,
    payload: null
  };
  let payloadType = 0;
  let payloadSize = 0;

  // go through the sei_rbsp parsing each each individual sei_message
  while (i < bytes.byteLength) {
    // stop once we have hit the end of the sei_rbsp
    if (bytes[i] === RBSP_TRAILING_BITS) {
      break;
    }

    // Parse payload type
    while (bytes[i] === 0xFF) {
      payloadType += 255;
      i++;
    }
    payloadType += bytes[i++];

    // Parse payload size
    while (bytes[i] === 0xFF) {
      payloadSize += 255;
      i++;
    }
    payloadSize += bytes[i++];

    // this sei_message is a 608/708 caption so save it and break
    // there can only ever be one caption message in a frame's sei
    if (!result.payload && payloadType === USER_DATA_REGISTERED_ITU_T_T35) {
      result.payloadType = payloadType;
      result.payloadSize = payloadSize;
      result.payload = bytes.subarray(i, i + payloadSize);
      break;
    }

    // skip the payload and parse the next message
    i += payloadSize;
    payloadType = 0;
    payloadSize = 0;
  }

  return result;
}
/**
 * Parses text track samples to be used in 608 extraction
 *
 * @param data
 * @param videoTrackId
 */
export function parseVideoSegmentTextTrackSamples (data, videoTrackId) {
  const captionNals = parseCaptionNals(data, videoTrackId);
  return captionNals.map(nal => {
    const seiNalUnits = parseSei(nal.escapedRBSP);
    const userData = parseUserData(seiNalUnits);
    return {
      type: 3,
      trackId: nal.trackId,
      pts: nal.pts,
      dts: nal.dts,
      bytes: userData
    };
  });
}

/**
  * Parses out caption nals from an FMP4 segment's video tracks.
  *
  * This code was ported from the mux.js project at: https://github.com/videojs/mux.js
  * @param {Uint8Array} segment - The bytes of a single segment
  * @param {Number} videoTrackId - The trackId of a video track in the segment
  * @return {Object.<Number, Object[]>} A mapping of video trackId to
  *   a list of seiNals found in that track
  **/
export function parseCaptionNals (data, videoTrackId) {
  let captionNals = [] as any;
  // To get the samples
  const trafs = findBox(data, ['moof', 'traf']);
  // To get SEI NAL units
  const mdats = findBox(data, ['mdat']);
  const mdatTrafPairs = [] as any;

  // Pair up each traf with a mdat as moofs and mdats are in pairs
  mdats.forEach(function (mdat, index) {
    const matchingTraf = trafs[index];
    mdatTrafPairs.push({
      mdat: mdat,
      traf: matchingTraf
    });
  });

  mdatTrafPairs.forEach(function (pair) {
    const mdat = pair.mdat;
    const mdatBytes = mdat.data.subarray(mdat.start, mdat.end);
    const traf = pair.traf;
    const trafBytes = traf.data.subarray(traf.start, traf.end);
    const tfhd = findBox(trafBytes, ['tfhd']);
    // Exactly 1 tfhd per traf
    const headerInfo = parseTfhd(tfhd[0]);
    const trackId = headerInfo.trackId;
    const tfdt = findBox(trafBytes, ['tfdt']);
    // Either 0 or 1 tfdt per traf
    const baseMediaDecodeTime = (tfdt.length > 0) ? parseTfdt(tfdt[0]).baseMediaDecodeTime : 0;
    const truns = findBox(trafBytes, ['trun']);
    let samples;
    let seiNals;

    // Only parse video data for the chosen video track
    if (videoTrackId === trackId && truns.length > 0) {
      samples = parseSamples(truns, baseMediaDecodeTime, headerInfo);

      seiNals = findSeiNals(mdatBytes, samples, trackId);

      captionNals = captionNals.concat(seiNals);
    }
  });

  return captionNals;
}

export function parseTfhd (tfhd) {
  const data = tfhd.data.subarray(tfhd.start, tfhd.end);
  const
    view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const result = {
    version: data[0],
    flags: new Uint8Array(data.subarray(1, 4)),
    trackId: view.getUint32(4)
  } as any;
  const baseDataOffsetPresent = result.flags[2] & 0x01;
  const sampleDescriptionIndexPresent = result.flags[2] & 0x02;
  const defaultSampleDurationPresent = result.flags[2] & 0x08;
  const defaultSampleSizePresent = result.flags[2] & 0x10;
  const defaultSampleFlagsPresent = result.flags[2] & 0x20;
  const durationIsEmpty = result.flags[0] & 0x010000;
  const defaultBaseIsMoof = result.flags[0] & 0x020000;
  let i;

  i = 8;
  if (baseDataOffsetPresent) {
    i += 4; // truncate top 4 bytes
    // FIXME: should we read the full 64 bits?
    result.baseDataOffset = view.getUint32(12);
    i += 4;
  }
  if (sampleDescriptionIndexPresent) {
    result.sampleDescriptionIndex = view.getUint32(i);
    i += 4;
  }
  if (defaultSampleDurationPresent) {
    result.defaultSampleDuration = view.getUint32(i);
    i += 4;
  }
  if (defaultSampleSizePresent) {
    result.defaultSampleSize = view.getUint32(i);
    i += 4;
  }
  if (defaultSampleFlagsPresent) {
    result.defaultSampleFlags = view.getUint32(i);
  }
  if (durationIsEmpty) {
    result.durationIsEmpty = true;
  }
  if (!baseDataOffsetPresent && defaultBaseIsMoof) {
    result.baseDataOffsetIsMoof = true;
  }
  return result;
}

export function parseTfdt (tfdt) {
  const data = tfdt.data.subarray(tfdt.start, tfdt.end);
  const result = {
    version: data[0],
    flags: new Uint8Array(data.subarray(1, 4)),
    baseMediaDecodeTime: toUnsigned(data[4] << 24 | data[5] << 16 | data[6] << 8 | data[7])
  };
  if (result.version === 1) {
    result.baseMediaDecodeTime *= Math.pow(2, 32);
    result.baseMediaDecodeTime += toUnsigned(data[8] << 24 | data[9] << 16 | data[10] << 8 | data[11]);
  }
  return result;
}

/**
  * Parses sample information out of Track Run Boxes and calculates
  * the absolute presentation and decode timestamps of each sample.
  *
  * This code was ported from the mux.js project at: https://github.com/videojs/mux.js
  *
  * @param {Array<Uint8Array>} truns - The Trun Run boxes to be parsed
  * @param {Number} baseMediaDecodeTime - base media decode time from tfdt
      @see ISO-BMFF-12/2015, Section 8.8.12
  * @param {Object} tfhd - The parsed Track Fragment Header
  *   @see inspect.parseTfhd
  * @return {Object[]} the parsed samples
  *
  * @see ISO-BMFF-12/2015, Section 8.8.8
 **/
export function parseSamples (truns, baseMediaDecodeTime, tfhd) {
  let currentDts = baseMediaDecodeTime;
  const defaultSampleDuration = tfhd.defaultSampleDuration || 0;
  const defaultSampleSize = tfhd.defaultSampleSize || 0;
  const trackId = tfhd.trackId;
  let allSamples = [] as any;

  truns.forEach(function (trun) {
    // Note: We currently do not parse the sample table as well
    // as the trun. It's possible some sources will require this.
    // moov > trak > mdia > minf > stbl
    const trackRun = parseTrun(trun);
    const samples = trackRun.samples as any[];

    samples.forEach(function (sample) {
      if (sample.duration === undefined) {
        sample.duration = defaultSampleDuration;
      }
      if (sample.size === undefined) {
        sample.size = defaultSampleSize;
      }
      sample.trackId = trackId;
      sample.dts = currentDts;
      if (sample.compositionTimeOffset === undefined) {
        sample.compositionTimeOffset = 0;
      }
      sample.pts = currentDts + sample.compositionTimeOffset;

      currentDts += sample.duration;
    });

    allSamples = allSamples.concat(samples);
  });

  return allSamples;
}

/**
  * Finds SEI nal units contained in a Media Data Box.
  * Assumes that `parseSamples` has been called first.
  *
  * This was ported from the mux.js project at: https://github.com/videojs/mux.js
  *
  * @param {Uint8Array} avcStream - The bytes of the mdat
  * @param {Object[]} samples - The samples parsed out by `parseSamples`
  * @param {Number} trackId - The trackId of this video track
  * @return {Object[]} seiNals - the parsed SEI NALUs found.
  *   The contents of the seiNal should match what is expected by
  *   CaptionStream.push (nalUnitType, size, data, escapedRBSP, pts, dts)
  *
  * @see ISO-BMFF-12/2015, Section 8.1.1
  * @see Rec. ITU-T H.264, 7.3.2.3.1
  **/
export function findSeiNals (avcStream, samples, trackId) {
  const
    avcView = new DataView(avcStream.buffer, avcStream.byteOffset, avcStream.byteLength);
  const result = [] as any;
  let seiNal;
  let i;
  let length;
  let lastMatchedSample;

  for (i = 0; i + 4 < avcStream.length; i += length) {
    length = avcView.getUint32(i);
    i += 4;

    // Bail if this doesn't appear to be an H264 stream
    if (length <= 0) {
      continue;
    }

    switch (avcStream[i] & 0x1F) {
    case 0x06:
      var data = avcStream.subarray(i + 1, i + 1 + length);
      var matchingSample = mapToSample(i, samples);

      seiNal = {
        nalUnitType: 'sei_rbsp',
        size: length,
        data: data,
        escapedRBSP: discardEmulationPreventionBytes(data),
        trackId: trackId
      };

      if (matchingSample) {
        seiNal.pts = matchingSample.pts;
        seiNal.dts = matchingSample.dts;
        lastMatchedSample = matchingSample;
      } else if (lastMatchedSample) {
        // If a matching sample cannot be found, use the last
        // sample's values as they should be as close as possible
        seiNal.pts = lastMatchedSample.pts;
        seiNal.dts = lastMatchedSample.dts;
      } else {
        logger.log('We\'ve encountered a nal unit without data. See mux.js#233.');
        break;
      }

      result.push(seiNal);
      break;
    default:
      break;
    }
  }

  return result;
}

/**
 * This code was ported from the mux.js project at: https://github.com/videojs/mux.js
 *
 * @param trun
 */
export function parseTrun (trun) {
  const data = trun.data.subarray(trun.start, trun.end);
  const
    result = {
      version: data[0],
      flags: new Uint8Array(data.subarray(1, 4)),
      samples: []
    } as any;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // Flag interpretation
  const dataOffsetPresent = result.flags[2] & 0x01; // compare with 2nd byte of 0x1
  const firstSampleFlagsPresent = result.flags[2] & 0x04; // compare with 2nd byte of 0x4
  const sampleDurationPresent = result.flags[1] & 0x01; // compare with 2nd byte of 0x100
  const sampleSizePresent = result.flags[1] & 0x02; // compare with 2nd byte of 0x200
  const sampleFlagsPresent = result.flags[1] & 0x04; // compare with 2nd byte of 0x400
  const sampleCompositionTimeOffsetPresent = result.flags[1] & 0x08; // compare with 2nd byte of 0x800
  let sampleCount = view.getUint32(4);
  let offset = 8;
  let sample;

  if (dataOffsetPresent) {
    // 32 bit signed integer
    result.dataOffset = view.getInt32(offset);
    offset += 4;
  }

  // Overrides the flags for the first sample only. The order of
  // optional values will be: duration, size, compositionTimeOffset
  if (firstSampleFlagsPresent && sampleCount) {
    sample = {
      flags: parseSampleFlags(data.subarray(offset, offset + 4))
    };
    offset += 4;
    if (sampleDurationPresent) {
      sample.duration = view.getUint32(offset);
      offset += 4;
    }
    if (sampleSizePresent) {
      sample.size = view.getUint32(offset);
      offset += 4;
    }
    if (sampleCompositionTimeOffsetPresent) {
      // Note: this should be a signed int if version is 1
      sample.compositionTimeOffset = view.getUint32(offset);
      offset += 4;
    }
    result.samples.push(sample);
    sampleCount--;
  }

  while (sampleCount--) {
    sample = {};
    if (sampleDurationPresent) {
      sample.duration = view.getUint32(offset);
      offset += 4;
    }
    if (sampleSizePresent) {
      sample.size = view.getUint32(offset);
      offset += 4;
    }
    if (sampleFlagsPresent) {
      sample.flags = parseSampleFlags(data.subarray(offset, offset + 4));
      offset += 4;
    }
    if (sampleCompositionTimeOffsetPresent) {
      // Note: this should be a signed int if version is 1
      sample.compositionTimeOffset = view.getUint32(offset);
      offset += 4;
    }
    result.samples.push(sample);
  }
  return result;
}

/**
  * Parses sample information out of Track Run Boxes and calculates
  * the absolute presentation and decode timestamps of each sample.
  *
  * This code was ported from the mux.js project at: https://github.com/videojs/mux.js
  *
  * @param {Array<Uint8Array>} truns - The Trun Run boxes to be parsed
  * @param {Number} baseMediaDecodeTime - base media decode time from tfdt
      @see ISO-BMFF-12/2015, Section 8.8.12
  * @param {Object} tfhd - The parsed Track Fragment Header
  *   @see inspect.parseTfhd
  * @return {Object[]} the parsed samples
  *
  * @see ISO-BMFF-12/2015, Section 8.8.8
 **/
export function parseSampleFlags (flags) {
  return {
    isLeading: (flags[0] & 0x0c) >>> 2,
    dependsOn: flags[0] & 0x03,
    isDependedOn: (flags[1] & 0xc0) >>> 6,
    hasRedundancy: (flags[1] & 0x30) >>> 4,
    paddingValue: (flags[1] & 0x0e) >>> 1,
    isNonSyncSample: flags[1] & 0x01,
    degradationPriority: (flags[2] << 8) | flags[3]
  };
}

/**
  * Maps an offset in the mdat to a sample based on the the size of the samples.
  * Assumes that `parseSamples` has been called first.
  *
  * This code was ported from the mux.js project at: https://github.com/videojs/mux.js
  *
  * @param {Number} offset - The offset into the mdat
  * @param {Object[]} samples - An array of samples, parsed using `parseSamples`
  * @return {?Object} The matching sample, or null if no match was found.
  *
  * @see ISO-BMFF-12/2015, Section 8.8.8
**/
export function mapToSample (offset, samples) {
  let approximateOffset = offset;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];

    if (approximateOffset < sample.size) {
      return sample;
    }

    approximateOffset -= sample.size;
  }

  return null;
}

/**
 *
 * This code was ported from the mux.js project at: https://github.com/videojs/mux.js
 */
export function discardEmulationPreventionBytes (data) {
  const
    length = data.byteLength;
  const emulationPreventionBytesPositions = [] as any;
  let i = 1;
  let newLength; let newData;

  // Find all `Emulation Prevention Bytes`
  while (i < length - 2) {
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0x03) {
      emulationPreventionBytesPositions.push(i + 2);
      i += 2;
    } else {
      i++;
    }
  }

  // If no Emulation Prevention Bytes were found just return the original
  // array
  if (emulationPreventionBytesPositions.length === 0) {
    return data;
  }

  // Create a new array to hold the NAL unit data
  newLength = length - emulationPreventionBytesPositions.length;
  newData = new Uint8Array(newLength);
  let sourceIndex = 0;

  for (i = 0; i < newLength; sourceIndex++, i++) {
    if (sourceIndex === emulationPreventionBytesPositions[0]) {
      // Skip this byte
      sourceIndex++;
      // Remove this position index
      emulationPreventionBytesPositions.shift();
    }
    newData[i] = data[sourceIndex];
  }

  return newData;
}

export function toUnsigned (value) {
  return value >>> 0;
}
