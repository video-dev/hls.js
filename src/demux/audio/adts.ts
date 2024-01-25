/**
 * ADTS parser helper
 * @link https://wiki.multimedia.cx/index.php?title=ADTS
 */
import { logger } from '../../utils/logger';
import { ErrorTypes, ErrorDetails } from '../../errors';
import type { HlsEventEmitter } from '../../events';
import { Events } from '../../events';
import type {
  DemuxedAudioTrack,
  AudioFrame,
  AudioSample,
} from '../../types/demuxer';

type AudioConfig = {
  config: number[];
  samplerate: number;
  channelCount: number;
  codec: string;
  parsedCodec: string;
  manifestCodec: string;
};

type FrameHeader = {
  headerLength: number;
  frameLength: number;
};

export function getAudioConfig(
  observer: HlsEventEmitter,
  data: Uint8Array,
  offset: number,
  audioCodec: string,
): AudioConfig | void {
  let adtsObjectType: number;
  let originalAdtsObjectType: number;
  let adtsExtensionSamplingIndex: number;
  let adtsChannelConfig: number;
  let config: number[];
  const userAgent = navigator.userAgent.toLowerCase();
  const manifestCodec = audioCodec;
  const adtsSamplingRates = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025,
    8000, 7350,
  ];
  // byte 2
  adtsObjectType = originalAdtsObjectType =
    ((data[offset + 2] & 0xc0) >>> 6) + 1;
  const adtsSamplingIndex = (data[offset + 2] & 0x3c) >>> 2;
  if (adtsSamplingIndex > adtsSamplingRates.length - 1) {
    const error = new Error(`invalid ADTS sampling index:${adtsSamplingIndex}`);
    observer.emit(Events.ERROR, Events.ERROR, {
      type: ErrorTypes.MEDIA_ERROR,
      details: ErrorDetails.FRAG_PARSING_ERROR,
      fatal: true,
      error,
      reason: error.message,
    });
    return;
  }
  adtsChannelConfig = (data[offset + 2] & 0x01) << 2;
  // byte 3
  adtsChannelConfig |= (data[offset + 3] & 0xc0) >>> 6;
  logger.log(
    `manifest codec:${audioCodec}, ADTS type:${adtsObjectType}, samplingIndex:${adtsSamplingIndex}`,
  );
  // Firefox and Pale Moon: freq less than 24kHz = AAC SBR (HE-AAC)
  if (/firefox|palemoon/i.test(userAgent)) {
    if (adtsSamplingIndex >= 6) {
      adtsObjectType = 5;
      config = new Array(4);
      // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
      // there is a factor 2 between frame sample rate and output sample rate
      // multiply frequency by 2 (see table below, equivalent to substract 3)
      adtsExtensionSamplingIndex = adtsSamplingIndex - 3;
    } else {
      adtsObjectType = 2;
      config = new Array(2);
      adtsExtensionSamplingIndex = adtsSamplingIndex;
    }
    // Android : always use AAC
  } else if (userAgent.indexOf('android') !== -1) {
    adtsObjectType = 2;
    config = new Array(2);
    adtsExtensionSamplingIndex = adtsSamplingIndex;
  } else {
    /*  for other browsers (Chrome/Vivaldi/Opera ...)
        always force audio type to be HE-AAC SBR, as some browsers do not support audio codec switch properly (like Chrome ...)
    */
    adtsObjectType = 5;
    config = new Array(4);
    // if (manifest codec is HE-AAC or HE-AACv2) OR (manifest codec not specified AND frequency less than 24kHz)
    if (
      (audioCodec &&
        (audioCodec.indexOf('mp4a.40.29') !== -1 ||
          audioCodec.indexOf('mp4a.40.5') !== -1)) ||
      (!audioCodec && adtsSamplingIndex >= 6)
    ) {
      // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
      // there is a factor 2 between frame sample rate and output sample rate
      // multiply frequency by 2 (see table below, equivalent to substract 3)
      adtsExtensionSamplingIndex = adtsSamplingIndex - 3;
    } else {
      // if (manifest codec is AAC) AND (frequency less than 24kHz AND nb channel is 1) OR (manifest codec not specified and mono audio)
      // Chrome fails to play back with low frequency AAC LC mono when initialized with HE-AAC.  This is not a problem with stereo.
      if (
        (audioCodec &&
          audioCodec.indexOf('mp4a.40.2') !== -1 &&
          ((adtsSamplingIndex >= 6 && adtsChannelConfig === 1) ||
            /vivaldi/i.test(userAgent))) ||
        (!audioCodec && adtsChannelConfig === 1)
      ) {
        adtsObjectType = 2;
        config = new Array(2);
      }
      adtsExtensionSamplingIndex = adtsSamplingIndex;
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
  config[0] |= (adtsSamplingIndex & 0x0e) >> 1;
  config[1] |= (adtsSamplingIndex & 0x01) << 7;
  // channelConfiguration
  config[1] |= adtsChannelConfig << 3;
  if (adtsObjectType === 5) {
    // adtsExtensionSamplingIndex
    config[1] |= (adtsExtensionSamplingIndex & 0x0e) >> 1;
    config[2] = (adtsExtensionSamplingIndex & 0x01) << 7;
    // adtsObjectType (force to 2, chrome is checking that object type is less than 5 ???
    //    https://chromium.googlesource.com/chromium/src.git/+/master/media/formats/mp4/aac.cc
    config[2] |= 2 << 2;
    config[3] = 0;
  }
  return {
    config,
    samplerate: adtsSamplingRates[adtsSamplingIndex],
    channelCount: adtsChannelConfig,
    codec: 'mp4a.40.' + adtsObjectType,
    parsedCodec: 'mp4a.40.' + originalAdtsObjectType,
    manifestCodec,
  };
}

export function isHeaderPattern(data: Uint8Array, offset: number): boolean {
  return data[offset] === 0xff && (data[offset + 1] & 0xf6) === 0xf0;
}

export function getHeaderLength(data: Uint8Array, offset: number): number {
  return data[offset + 1] & 0x01 ? 7 : 9;
}

export function getFullFrameLength(data: Uint8Array, offset: number): number {
  return (
    ((data[offset + 3] & 0x03) << 11) |
    (data[offset + 4] << 3) |
    ((data[offset + 5] & 0xe0) >>> 5)
  );
}

export function canGetFrameLength(data: Uint8Array, offset: number): boolean {
  return offset + 5 < data.length;
}

export function isHeader(data: Uint8Array, offset: number): boolean {
  // Look for ADTS header | 1111 1111 | 1111 X00X | where X can be either 0 or 1
  // Layer bits (position 14 and 15) in header should be always 0 for ADTS
  // More info https://wiki.multimedia.cx/index.php?title=ADTS
  return offset + 1 < data.length && isHeaderPattern(data, offset);
}

export function canParse(data: Uint8Array, offset: number): boolean {
  return (
    canGetFrameLength(data, offset) &&
    isHeaderPattern(data, offset) &&
    getFullFrameLength(data, offset) <= data.length - offset
  );
}

export function probe(data: Uint8Array, offset: number): boolean {
  // same as isHeader but we also check that ADTS frame follows last ADTS frame
  // or end of data is reached
  if (isHeader(data, offset)) {
    // ADTS header Length
    const headerLength = getHeaderLength(data, offset);
    if (offset + headerLength >= data.length) {
      return false;
    }
    // ADTS frame Length
    const frameLength = getFullFrameLength(data, offset);
    if (frameLength <= headerLength) {
      return false;
    }

    const newOffset = offset + frameLength;
    return newOffset === data.length || isHeader(data, newOffset);
  }
  return false;
}

export function initTrackConfig(
  track: DemuxedAudioTrack,
  observer: HlsEventEmitter,
  data: Uint8Array,
  offset: number,
  audioCodec: string,
) {
  if (!track.samplerate) {
    const config = getAudioConfig(observer, data, offset, audioCodec);
    if (!config) {
      return;
    }
    track.config = config.config;
    track.samplerate = config.samplerate;
    track.channelCount = config.channelCount;
    track.codec = config.codec;
    track.manifestCodec = config.manifestCodec;
    track.parsedCodec = config.parsedCodec;
    logger.log(
      `parsed codec:${track.parsedCodec}, codec:${track.codec}, rate:${config.samplerate}, channels:${config.channelCount}`,
    );
  }
}

export function getFrameDuration(samplerate: number): number {
  return (1024 * 90000) / samplerate;
}

export function parseFrameHeader(
  data: Uint8Array,
  offset: number,
): FrameHeader | void {
  // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
  const headerLength = getHeaderLength(data, offset);
  if (offset + headerLength <= data.length) {
    // retrieve frame size
    const frameLength = getFullFrameLength(data, offset) - headerLength;
    if (frameLength > 0) {
      // logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}`);
      return { headerLength, frameLength };
    }
  }
}

export function appendFrame(
  track: DemuxedAudioTrack,
  data: Uint8Array,
  offset: number,
  pts: number,
  frameIndex: number,
): AudioFrame {
  const frameDuration = getFrameDuration(track.samplerate as number);
  const stamp = pts + frameIndex * frameDuration;
  const header = parseFrameHeader(data, offset);
  let unit: Uint8Array;
  if (header) {
    const { frameLength, headerLength } = header;
    const length = headerLength + frameLength;
    const missing = Math.max(0, offset + length - data.length);
    // logger.log(`AAC frame ${frameIndex}, pts:${stamp} length@offset/total: ${frameLength}@${offset+headerLength}/${data.byteLength} missing: ${missing}`);
    if (missing) {
      unit = new Uint8Array(length - headerLength);
      unit.set(data.subarray(offset + headerLength, data.length), 0);
    } else {
      unit = data.subarray(offset + headerLength, offset + length);
    }

    const sample: AudioSample = {
      unit,
      pts: stamp,
    };
    if (!missing) {
      track.samples.push(sample as AudioSample);
    }

    return { sample, length, missing };
  }
  // overflow incomplete header
  const length = data.length - offset;
  unit = new Uint8Array(length);
  unit.set(data.subarray(offset, data.length), 0);
  const sample: AudioSample = {
    unit,
    pts: stamp,
  };
  return { sample, length, missing: -1 };
}
