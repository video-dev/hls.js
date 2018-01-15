/**
 *  ADTS parser helper
 */
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';

export function getAudioConfig(observer, data, offset, audioCodec) {
  var adtsObjectType, // :int
    adtsSampleingIndex, // :int
    adtsExtensionSampleingIndex, // :int
    adtsChanelConfig, // :int
    config,
    userAgent = navigator.userAgent.toLowerCase(),
    manifestCodec = audioCodec,
    adtsSampleingRates = [
      96000, 88200,
      64000, 48000,
      44100, 32000,
      24000, 22050,
      16000, 12000,
      11025, 8000,
      7350];
  // byte 2
  adtsObjectType = ((data[offset + 2] & 0xC0) >>> 6) + 1;
  adtsSampleingIndex = ((data[offset + 2] & 0x3C) >>> 2);
  if (adtsSampleingIndex > adtsSampleingRates.length - 1) {
    observer.trigger(Event.ERROR, { type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: `invalid ADTS sampling index:${adtsSampleingIndex}` });
    return;
  }
  adtsChanelConfig = ((data[offset + 2] & 0x01) << 2);
  // byte 3
  adtsChanelConfig |= ((data[offset + 3] & 0xC0) >>> 6);
  logger.log(`manifest codec:${audioCodec},ADTS data:type:${adtsObjectType},sampleingIndex:${adtsSampleingIndex}[${adtsSampleingRates[adtsSampleingIndex]}Hz],channelConfig:${adtsChanelConfig}`);
  // firefox: freq less than 24kHz = AAC SBR (HE-AAC)
  if (/firefox/i.test(userAgent)) {
    if (adtsSampleingIndex >= 6) {
      adtsObjectType = 5;
      config = new Array(4);
      // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
      // there is a factor 2 between frame sample rate and output sample rate
      // multiply frequency by 2 (see table below, equivalent to substract 3)
      adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
    } else {
      adtsObjectType = 2;
      config = new Array(2);
      adtsExtensionSampleingIndex = adtsSampleingIndex;
    }
    // Android : always use AAC
  } else if (userAgent.indexOf('android') !== -1) {
    adtsObjectType = 2;
    config = new Array(2);
    adtsExtensionSampleingIndex = adtsSampleingIndex;
  } else {
    /*  for other browsers (Chrome/Vivaldi/Opera ...)
        always force audio type to be HE-AAC SBR, as some browsers do not support audio codec switch properly (like Chrome ...)
    */
    adtsObjectType = 5;
    config = new Array(4);
    // if (manifest codec is HE-AAC or HE-AACv2) OR (manifest codec not specified AND frequency less than 24kHz)
    if ((audioCodec && ((audioCodec.indexOf('mp4a.40.29') !== -1) ||
      (audioCodec.indexOf('mp4a.40.5') !== -1))) ||
      (!audioCodec && adtsSampleingIndex >= 6)) {
      // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
      // there is a factor 2 between frame sample rate and output sample rate
      // multiply frequency by 2 (see table below, equivalent to substract 3)
      adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
    } else {
      // if (manifest codec is AAC) AND (frequency less than 24kHz AND nb channel is 1) OR (manifest codec not specified and mono audio)
      // Chrome fails to play back with low frequency AAC LC mono when initialized with HE-AAC.  This is not a problem with stereo.
      if (audioCodec && audioCodec.indexOf('mp4a.40.2') !== -1 && ((adtsSampleingIndex >= 6 && adtsChanelConfig === 1) ||
            /vivaldi/i.test(userAgent)) ||
        (!audioCodec && adtsChanelConfig === 1)) {
        adtsObjectType = 2;
        config = new Array(2);
      }
      adtsExtensionSampleingIndex = adtsSampleingIndex;
    }
  }
  /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config
      ISO 14496-3 (AAC).pdf - Table 1.13 — Syntax of AudioSpecificConfig()
    Audio Profile / Audio Object Type
    0: Null
    1: AAC Main
    2: AAC LC (Low Complexity)
    3: AAC SSR (Scalable Sample Rate)
    4: AAC LTP (Long Term Prediction)
    5: SBR (Spectral Band Replication)
    6: AAC Scalable
   sampling freq
    0: 96000 Hz
    1: 88200 Hz
    2: 64000 Hz
    3: 48000 Hz
    4: 44100 Hz
    5: 32000 Hz
    6: 24000 Hz
    7: 22050 Hz
    8: 16000 Hz
    9: 12000 Hz
    10: 11025 Hz
    11: 8000 Hz
    12: 7350 Hz
    13: Reserved
    14: Reserved
    15: frequency is written explictly
    Channel Configurations
    These are the channel configurations:
    0: Defined in AOT Specifc Config
    1: 1 channel: front-center
    2: 2 channels: front-left, front-right
  */
  // audioObjectType = profile => profile, the MPEG-4 Audio Object Type minus 1
  config[0] = adtsObjectType << 3;
  // samplingFrequencyIndex
  config[0] |= (adtsSampleingIndex & 0x0E) >> 1;
  config[1] |= (adtsSampleingIndex & 0x01) << 7;
  // channelConfiguration
  config[1] |= adtsChanelConfig << 3;
  if (adtsObjectType === 5) {
    // adtsExtensionSampleingIndex
    config[1] |= (adtsExtensionSampleingIndex & 0x0E) >> 1;
    config[2] = (adtsExtensionSampleingIndex & 0x01) << 7;
    // adtsObjectType (force to 2, chrome is checking that object type is less than 5 ???
    //    https://chromium.googlesource.com/chromium/src.git/+/master/media/formats/mp4/aac.cc
    config[2] |= 2 << 2;
    config[3] = 0;
  }
  return { config: config, samplerate: adtsSampleingRates[adtsSampleingIndex], channelCount: adtsChanelConfig, codec: ('mp4a.40.' + adtsObjectType), manifestCodec: manifestCodec };
}

export function isHeaderPattern(data, offset) {
  return data[offset] === 0xff && (data[offset + 1] & 0xf6) === 0xf0;
}

export function getHeaderLength(data, offset) {
  return (!!(data[offset + 1] & 0x01) ? 7 : 9);
}

export function getFullFrameLength(data, offset) {
  return ((data[offset + 3] & 0x03) << 11) |
    (data[offset + 4] << 3) |
    ((data[offset + 5] & 0xE0) >>> 5);
}

export function isHeader(data, offset) {
  // Look for ADTS header | 1111 1111 | 1111 X00X | where X can be either 0 or 1
  // Layer bits (position 14 and 15) in header should be always 0 for ADTS
  // More info https://wiki.multimedia.cx/index.php?title=ADTS
  if (offset + 1 < data.length && isHeaderPattern(data, offset)) {
    return true;
  }
  return false;
}

export function probe(data, offset) {
  // same as isHeader but we also check that ADTS frame follows last ADTS frame
  // or end of data is reached
  if (offset + 1 < data.length && isHeaderPattern(data, offset)) {
    // ADTS header Length
    let headerLength = getHeaderLength(data, offset);
    // ADTS frame Length
    let frameLength = headerLength;
    if (offset + 5 < data.length) {
      frameLength = getFullFrameLength(data, offset);
    }
    let newOffset = offset + frameLength;
    if (newOffset === data.length || (newOffset + 1 < data.length && isHeaderPattern(data, newOffset))) {
      return true;
    }
  }
  return false;
}

export function initTrackConfig(track, observer, data, offset, audioCodec) {
  if (!track.samplerate) {
    var config = getAudioConfig(observer, data, offset, audioCodec);
    track.config = config.config;
    track.samplerate = config.samplerate;
    track.channelCount = config.channelCount;
    track.codec = config.codec;
    track.manifestCodec = config.manifestCodec;
    logger.log(`parsed codec:${track.codec},rate:${config.samplerate},nb channel:${config.channelCount}`);
  }
}

export function getFrameDuration(samplerate) {
  return 1024 * 90000 / samplerate;
}

export function parseFrameHeader(data, offset, pts, frameIndex, frameDuration) {
  var headerLength, frameLength, stamp;
  var length = data.length;

  // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
  headerLength = getHeaderLength(data, offset);
  // retrieve frame size
  frameLength = getFullFrameLength(data, offset);
  frameLength -= headerLength;

  if ((frameLength > 0) && ((offset + headerLength + frameLength) <= length)) {
    stamp = pts + frameIndex * frameDuration;
    //logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);
    return { headerLength, frameLength, stamp };
  }

  return undefined;
}

export function appendFrame(track, data, offset, pts, frameIndex) {
  var frameDuration = getFrameDuration(track.samplerate);
  var header = parseFrameHeader(data, offset, pts, frameIndex, frameDuration);
  if (header) {
    var stamp = header.stamp;
    var headerLength = header.headerLength;
    var frameLength = header.frameLength;

    //logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);
    var aacSample = {
      unit: data.subarray(offset + headerLength, offset + headerLength + frameLength),
      pts: stamp,
      dts: stamp
    };

    track.samples.push(aacSample);
    track.len += frameLength;

    return {sample: aacSample, length: frameLength + headerLength};
  }

  return undefined;
}

