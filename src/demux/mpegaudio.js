/**
 *  MPEG parser helper
 */
import {logger} from '../utils/logger';

const MpegAudio = {

  onFrame: function(track, data, bitRate, sampleRate, channelCount, frameIndex, pts) {
    var frameDuration = 1152 * 90000 / sampleRate;
    var stamp = pts + frameIndex * frameDuration;

    track.config = [];
    track.channelCount = channelCount;
    track.samplerate = sampleRate;
    track.samples.push({unit: data, pts: stamp, dts: stamp});
    track.len += data.length;
  },

  onNoise: function(data) {
    logger.warn('mpeg audio has noise: ' + data.length + ' bytes');
  },

  parseFrames: function(track, data, start, end, frameIndex, pts) {
    var BitratesMap = [
        32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448,
        32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384,
        32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
        32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256,
        8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    var SamplingRateMap = [44100, 48000, 32000, 22050, 24000, 16000, 11025, 12000, 8000];

    if (start + 2 > end) {
        return -1; // we need at least 2 bytes to detect sync pattern
    }
    if (data[start] === 0xFF || (data[start + 1] & 0xE0) === 0xE0) {
        // Using http://www.datavoyage.com/mpgscript/mpeghdr.htm as a reference
        if (start + 24 > end) {
            return -1;
        }
        var headerB = (data[start + 1] >> 3) & 3;
        var headerC = (data[start + 1] >> 1) & 3;
        var headerE = (data[start + 2] >> 4) & 15;
        var headerF = (data[start + 2] >> 2) & 3;
        var headerG = !!(data[start + 2] & 2);
        if (headerB !== 1 && headerE !== 0 && headerE !== 15 && headerF !== 3) {
            var columnInBitrates = headerB === 3 ? (3 - headerC) : (headerC === 3 ? 3 : 4);
            var bitRate = BitratesMap[columnInBitrates * 14 + headerE - 1] * 1000;
            var columnInSampleRates = headerB === 3 ? 0 : headerB === 2 ? 1 : 2;
            var sampleRate = SamplingRateMap[columnInSampleRates * 3 + headerF];
            var padding = headerG ? 1 : 0;
            var channelCount = data[start + 3] >> 6 === 3 ? 1 : 2; // If bits of channel mode are `11` then it is a single channel (Mono)
            var frameLength = headerC === 3 ?
                ((headerB === 3 ? 12 : 6) * bitRate / sampleRate + padding) << 2 :
                ((headerB === 3 ? 144 : 72) * bitRate / sampleRate + padding) | 0;
            if (start + frameLength > end) {
                return -1;
            }

            this.onFrame(track, data.subarray(start, start + frameLength), bitRate, sampleRate, channelCount, frameIndex, pts);

            return frameLength;
        }
    }
    // noise or ID3, trying to skip
    var offset = start + 2;
    while (offset < end) {
        if (data[offset - 1] === 0xFF && (data[offset] & 0xE0) === 0xE0) {
            // sync pattern is found
            this.onNoise(data.subarray(start, offset - 1));

            return offset - start - 1;
        }
        offset++;
    }
    return -1;
  },

  parse: function(track, data, offset, pts) {
    var length = data.length;
    var frameIndex = 0;
    var parsed;

    while (offset < length &&
        (parsed = this.parseFrames(track, data, offset, length, frameIndex++, pts)) > 0) {
        offset += parsed;
    }
  }
};

module.exports = MpegAudio;
