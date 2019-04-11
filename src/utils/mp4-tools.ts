// Todo: Optimize by using loops instead of array methods
const UINT32_MAX = Math.pow(2, 32) - 1;

export function bin2str (buffer) {
  return String.fromCharCode.apply(null, buffer);
}

export function readUint16 (buffer, offset) {
  if (buffer.data) {
    offset += buffer.start;
    buffer = buffer.data;
  }

  const val = buffer[offset] << 8 |
    buffer[offset + 1];

  return val < 0 ? 65536 + val : val;
}

export function readUint32 (buffer, offset) {
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
export function findBox (data, path): any {
  let results = [] as Array<any>,
    i, size, type, end, subresults, start, endbox;

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
    return null;
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
  const moov = findBox(initSegment, ['moov'])[0];
  const moovEndOffset = moov ? moov.end : null; // we need this in case we need to chop of garbage of the end of current data

  let index = 0;
  let sidx = findBox(initSegment, ['sidx']);
  let references;

  if (!sidx || !sidx[0]) {
    return null;
  }

  references = [];
  sidx = sidx[0];

  const version = sidx.data[0];

  // set initial offset, we skip the reference ID (not needed)
  index = version === 0 ? 8 : 16;

  const timescale = readUint32(sidx, index);
  index += 4;

  // TODO: parse earliestPresentationTime and firstOffset
  // usually zero in our case
  let earliestPresentationTime = 0;
  let firstOffset = 0;

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
 * @return {object} a hash of track type to timescale values or null if
 * the init segment is malformed.
 */
export function parseInitSegment (initSegment) {
  let result = [] as Array<any>;
  let traks = findBox(initSegment, ['moov', 'trak']);

  traks.forEach(trak => {
    const tkhd = findBox(trak, ['tkhd'])[0];
    if (tkhd) {
      let version = tkhd.data[tkhd.start];
      let index = version === 0 ? 12 : 20;
      let trackId = readUint32(tkhd, index);

      const mdhd = findBox(trak, ['mdia', 'mdhd'])[0];
      if (mdhd) {
        version = mdhd.data[mdhd.start];
        index = version === 0 ? 12 : 20;
        const timescale = readUint32(mdhd, index);

        const hdlr = findBox(trak, ['mdia', 'hdlr'])[0];
        if (hdlr) {
          const hdlrType = bin2str(hdlr.data.subarray(hdlr.start + 8, hdlr.start + 12));
          let type = { 'soun': 'audio', 'vide': 'video' }[hdlrType];
          if (type) {
            // extract codec info. TODO : parse codec details to be able to build MIME type
            let codecBox = findBox(trak, ['mdia', 'minf', 'stbl', 'stsd']);
            if (codecBox.length) {
              codecBox = codecBox[0];
              let codecType = bin2str(codecBox.data.subarray(codecBox.start + 12, codecBox.start + 16));
            }
            result[trackId] = { timescale: timescale, type: type };
            result[type] = { timescale: timescale, id: trackId };
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
  let trafs, baseTimes, result;

  // we need info from two children of each track fragment box
  trafs = findBox(fragment, ['moof', 'traf']);

  // determine the start times for each track
  baseTimes = [].concat.apply([], trafs.map(function (traf) {
    return findBox(traf, ['tfhd']).map(function (tfhd) {
      let id, scale, baseTime;

      // get the track id from the tfhd
      id = readUint32(tfhd, 4);
      // assume a 90kHz clock if no timescale was specified
      scale = initData[id].timescale || 90e3;

      // get the base media decode time from the tfdt
      baseTime = findBox(traf, ['tfdt']).map(function (tfdt) {
        let version, result;

        version = tfdt.data[tfdt.start];
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
  result = Math.min.apply(null, baseTimes);
  return isFinite(result) ? result : 0;
}

// TODO: Handle non-constant sample duration
export function getDuration (data, initData) {
  let duration = 0;
  const trafs = findBox(data, ['moof', 'traf']);
  for (let i = 0; i < trafs.length; i++) {
    const traf = trafs[i];
    // There must be only one tfhd & trun per traf
    const tfhd = findBox(traf, ['tfhd'])[0];
    const trun = findBox(traf, ['trun'])[0];

    const tfhdFlags = readUint32(tfhd, 0);
    let sampleDuration;
    if (tfhdFlags & 0x00002) {
      sampleDuration = readUint32(tfhd, 12);
    } else {
      sampleDuration = readUint32(tfhd, 8);
    }

    const id = readUint32(tfhd, 4);
    const scale = initData[id].timescale || 90e3;
    const sampleCount = readUint32(trun, 4);

    duration += ((sampleDuration * sampleCount) / scale);
  }
  return duration;
}

export function offsetStartDTS (initData, fragment, timeOffset) {
  findBox(fragment, ['moof', 'traf']).map(function (traf) {
    return findBox(traf, ['tfhd']).map(function (tfhd) {
      // get the track id from the tfhd
      let id = readUint32(tfhd, 4);
      // assume a 90kHz clock if no timescale was specified
      let timescale = initData[id].timescale || 90e3;

      // get the base media decode time from the tfdt
      findBox(traf, ['tfdt']).map(function (tfdt) {
        let version = tfdt.data[tfdt.start];
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
    valid: new Uint8Array(0),
    remainder: new Uint8Array(0)
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
  segmentedRange.valid = data.slice(0, last.start - 8);
  segmentedRange.remainder = data.slice(last.start - 8);
  return segmentedRange;
}

export interface SegmentedRange {
  valid: Uint8Array,
  remainder: Uint8Array,
}

export function appendUint8Array (data1: Uint8Array, data2: Uint8Array) : Uint8Array {
    const temp = new Uint8Array(data1.length + data2.length);
    temp.set(data1);
    temp.set(data2, data1.length);
    return temp;
}
