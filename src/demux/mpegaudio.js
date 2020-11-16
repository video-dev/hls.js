/**
 *  MPEG parser helper
 */

var match = navigator.userAgent.match(/Chrome\/(\d+)/i);
const needChromeFix = match && parseInt(match[1]) <= 87;

const MpegAudio = {

  BitratesMap: [
    32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448,
    32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384,
    32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
    32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256,
    8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],

  SamplingRateMap: [44100, 48000, 32000, 22050, 24000, 16000, 11025, 12000, 8000],

  SamplesCoefficients: [
    // MPEG 2.5
    [
      0, // Reserved
      72, // Layer3
      144, // Layer2
      12 // Layer1
    ],
    // Reserved
    [
      0, // Reserved
      0, // Layer3
      0, // Layer2
      0 // Layer1
    ],
    // MPEG 2
    [
      0, // Reserved
      72, // Layer3
      144, // Layer2
      12 // Layer1
    ],
    // MPEG 1
    [
      0, // Reserved
      144, // Layer3
      144, // Layer2
      12 // Layer1
    ]
  ],

  BytesInSlot: [
    0, // Reserved
    1, // Layer3
    1, // Layer2
    4 // Layer1
  ],

  appendFrame: function (track, data, offset, pts, frameIndex) {
    // Using http://www.datavoyage.com/mpgscript/mpeghdr.htm as a reference
    if (offset + 24 > data.length) {
      return undefined;
    }

    let header = this.parseHeader(data, offset);
    if (header && offset + header.frameLength <= data.length) {
      let frameDuration = header.samplesPerFrame * 90000 / header.sampleRate;
      let stamp = pts + frameIndex * frameDuration;
      let sample = { unit: data.subarray(offset, offset + header.frameLength), pts: stamp, dts: stamp };

      track.config = [];
      track.channelCount = header.channelCount;
      track.samplerate = header.sampleRate;
      track.samples.push(sample);

      return { sample, length: header.frameLength };
    }

    return undefined;
  },

  parseHeader: function (data, offset) {
    let mpegVersion = (data[offset + 1] >> 3) & 3;
    let mpegLayer = (data[offset + 1] >> 1) & 3;
    let bitRateIndex = (data[offset + 2] >> 4) & 15;
    let sampleRateIndex = (data[offset + 2] >> 2) & 3;
    let paddingBit = (data[offset + 2] >> 1) & 1;
    let channelMode = data[offset + 3] >> 6;

    if (mpegVersion !== 1 && bitRateIndex !== 0 && bitRateIndex !== 15 && sampleRateIndex !== 3) {
      let columnInBitrates = mpegVersion === 3 ? (3 - mpegLayer) : (mpegLayer === 3 ? 3 : 4);
      let bitRate = MpegAudio.BitratesMap[columnInBitrates * 14 + bitRateIndex - 1] * 1000;
      let columnInSampleRates = mpegVersion === 3 ? 0 : mpegVersion === 2 ? 1 : 2;
      let sampleRate = MpegAudio.SamplingRateMap[columnInSampleRates * 3 + sampleRateIndex];
      let channelCount = channelMode === 3 ? 1 : 2; // If bits of channel mode are `11` then it is a single channel (Mono)
      let sampleCoefficient = MpegAudio.SamplesCoefficients[mpegVersion][mpegLayer];
      let bytesInSlot = MpegAudio.BytesInSlot[mpegLayer];
      let samplesPerFrame = sampleCoefficient * 8 * bytesInSlot;
      let frameLength = parseInt(sampleCoefficient * bitRate / sampleRate + paddingBit, 10) * bytesInSlot;

      if (needChromeFix && mpegLayer === 2 && bitRate >= 224000 && channelMode === 0) {
        // Work around bug in Chromium by setting channelMode to dual-channel (01) instead of stereo (00)
        data[offset + 3] = data[offset + 3] | 0x80;
      }

      return { sampleRate, channelCount, frameLength, samplesPerFrame };
    }

    return undefined;
  },

  isHeaderPattern: function (data, offset) {
    return data[offset] === 0xff && (data[offset + 1] & 0xe0) === 0xe0 && (data[offset + 1] & 0x06) !== 0x00;
  },

  isHeader: function (data, offset) {
    // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
    // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
    // More info http://www.mp3-tech.org/programmer/frame_header.html
    if (offset + 1 < data.length && this.isHeaderPattern(data, offset)) {
      return true;
    }

    return false;
  },

  probe: function (data, offset) {
    // same as isHeader but we also check that MPEG frame follows last MPEG frame
    // or end of data is reached
    if (offset + 1 < data.length && this.isHeaderPattern(data, offset)) {
      // MPEG header Length
      let headerLength = 4;
      // MPEG frame Length
      let header = this.parseHeader(data, offset);
      let frameLength = headerLength;
      if (header && header.frameLength) {
        frameLength = header.frameLength;
      }

      let newOffset = offset + frameLength;
      if (newOffset === data.length || (newOffset + 1 < data.length && this.isHeaderPattern(data, newOffset))) {
        return true;
      }
    }
    return false;
  }
};

export default MpegAudio;
