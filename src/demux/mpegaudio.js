/**
 *  MPEG parser helper
 */

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

        var header = this.parseHeader(data, offset);
        if (header && offset + header.frameLength <= data.length) {
            var frameDuration = header.samplesPerFrame * 90000 / header.sampleRate;
            var stamp = pts + frameIndex * frameDuration;
            var sample = { unit: data.subarray(offset, offset + header.frameLength), pts: stamp, dts: stamp };

            track.config = [];
            track.channelCount = header.channelCount;
            track.samplerate = header.sampleRate;
            track.samples.push(sample);
            track.len += header.frameLength;

            return { sample, length: header.frameLength };
        }

        return undefined;
    },

    parseHeader: function (data, offset) {
        var headerB = (data[offset + 1] >> 3) & 3;
        var headerC = (data[offset + 1] >> 1) & 3;
        var headerE = (data[offset + 2] >> 4) & 15;
        var headerF = (data[offset + 2] >> 2) & 3;
        var headerG = (data[offset + 2] >> 1) & 1;
        if (headerB !== 1 && headerE !== 0 && headerE !== 15 && headerF !== 3) {
            var columnInBitrates = headerB === 3 ? (3 - headerC) : (headerC === 3 ? 3 : 4);
            var bitRate = MpegAudio.BitratesMap[columnInBitrates * 14 + headerE - 1] * 1000;
            var columnInSampleRates = headerB === 3 ? 0 : headerB === 2 ? 1 : 2;
            var sampleRate = MpegAudio.SamplingRateMap[columnInSampleRates * 3 + headerF];
            var channelCount = data[offset + 3] >> 6 === 3 ? 1 : 2; // If bits of channel mode are `11` then it is a single channel (Mono)
            var sampleCoefficient = MpegAudio.SamplesCoefficients[headerB][headerC];
            var bytesInSlot = MpegAudio.BytesInSlot[headerC];
            var samplesPerFrame = sampleCoefficient * 8 * bytesInSlot;
            var frameLength = parseInt(sampleCoefficient * bitRate / sampleRate + headerG, 10) * bytesInSlot;

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
