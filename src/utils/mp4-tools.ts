import { logger } from '../utils/logger';

const USER_DATA_REGISTERED_ITU_T_T35 = 4;
const RBSP_TRAILING_BITS = 128;

export function bin2str (buffer): string {
  return String.fromCharCode.apply(null, buffer);
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

/**
 * see ANSI/SCTE 128-1 (2013), section 8.1
 *
 * This code was ported from the mux.js project at: https://github.com/videojs/mux.js
 */
export function parseUserData (sei) {
  if (!sei.payload) {
    return null;
  }

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
  return new Uint8Array(sei.payload.subarray(8, sei.payload.length - 1));
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
    result.baseDataOffset = view.getUint32(i);
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
