/**
 * MP3 demuxer
 */
import { logger } from '../utils/logger';
import ID3 from '../demux/id3';

class MP3Demuxer {
    constructor(observer, remuxer, config) {
        this.observer = observer;
        this.config = config;
        this.remuxer = remuxer;
    }

    resetInitSegment(initSegment, audioCodec, videoCodec, duration) {
        this._audioTrack = {
            container: 'audio/mpeg',
            type: 'audio',
            id: -1,
            sequenceNumber: 0,
            isAAC: false,
            samples: [],
            len: 0,
            manifestCodec: audioCodec,
            duration: duration,
            inputTimeScale: 90000
        };
    }

    resetTimeStamp() {}

    static probe(data) {
        // check if data contains ID3 timestamp and MPEG sync word
        var id3 = new ID3(data),
            offset,
            len;
        if (id3.hasTimeStamp) {
            // look for MPEG header (0xFFEx)
            for (
                offset = id3.length, len = data.length;
                offset < len - 1;
                offset++
            ) {
                if (
                    data[offset] === 0xff &&
                    (data[offset + 1] & 0xe0) === 0xe0
                ) {
                    //logger.log('MPEG sync word found !');
                    return true;
                }
            }
        }
        return false;
    }

    // feed incoming data to the front of the parsing pipeline
    append(data, timeOffset, contiguous, accurateTimeOffset) {
        var id3 = new ID3(data);
        var pts = 90 * id3.timeStamp;
        var length;
        var offset;
        var frameIndex = 0;
        var parsed;

        // look for ADTS header (0xFFEx)
        for (
            offset = id3.length, length = data.length;
            offset < length - 1;
            offset++
        ) {
            if (data[offset] === 0xff && (data[offset + 1] & 0xe0) === 0xe0) {
                break;
            }
        }

        while (
            offset < length &&
            (parsed = this._parseMpeg(
                data,
                offset,
                length,
                frameIndex++,
                pts
            )) > 0
        ) {
            offset += parsed;
        }

        this.remuxer.remux(
            this._audioTrack,
            { samples: [] },
            {
                samples: [{ pts: pts, dts: pts, unit: id3.payload }],
                inputTimeScale: 90000
            },
            { samples: [] },
            timeOffset,
            contiguous,
            accurateTimeOffset
        );
    }

    _onMpegFrame(data, bitRate, sampleRate, channelCount, frameIndex, pts) {
        var frameDuration = 1152 * 90000 / sampleRate;
        var stamp = pts + frameIndex * frameDuration;
        var track = this._audioTrack;

        track.config = [];
        track.channelCount = channelCount;
        track.samplerate = sampleRate;
        track.samples.push({ unit: data, pts: stamp, dts: stamp });
        track.len += data.length;
    }

    _onMpegNoise(data) {
        logger.warn('mpeg audio has noise: ' + data.length + ' bytes');
    }

    _parseMpeg(data, start, end, frameIndex, pts) {
        var BitratesMap = [
            32,
            64,
            96,
            128,
            160,
            192,
            224,
            256,
            288,
            320,
            352,
            384,
            416,
            448,
            32,
            48,
            56,
            64,
            80,
            96,
            112,
            128,
            160,
            192,
            224,
            256,
            320,
            384,
            32,
            40,
            48,
            56,
            64,
            80,
            96,
            112,
            128,
            160,
            192,
            224,
            256,
            320,
            32,
            48,
            56,
            64,
            80,
            96,
            112,
            128,
            144,
            160,
            176,
            192,
            224,
            256,
            8,
            16,
            24,
            32,
            40,
            48,
            56,
            64,
            80,
            96,
            112,
            128,
            144,
            160
        ];
        var SamplingRateMap = [
            44100,
            48000,
            32000,
            22050,
            24000,
            16000,
            11025,
            12000,
            8000
        ];

        if (start + 2 > end) {
            return -1; // we need at least 2 bytes to detect sync pattern
        }
        if (data[start] === 0xff || (data[start + 1] & 0xe0) === 0xe0) {
            // Using http://www.datavoyage.com/mpgscript/mpeghdr.htm as a reference
            if (start + 24 > end) {
                return -1;
            }
            var headerB = (data[start + 1] >> 3) & 3;
            var headerC = (data[start + 1] >> 1) & 3;
            var headerE = (data[start + 2] >> 4) & 15;
            var headerF = (data[start + 2] >> 2) & 3;
            var headerG = !!(data[start + 2] & 2);
            if (
                headerB !== 1 &&
                headerE !== 0 &&
                headerE !== 15 &&
                headerF !== 3
            ) {
                var columnInBitrates =
                    headerB === 3 ? 3 - headerC : headerC === 3 ? 3 : 4;
                var bitRate =
                    BitratesMap[columnInBitrates * 14 + headerE - 1] * 1000;
                var columnInSampleRates =
                    headerB === 3 ? 0 : headerB === 2 ? 1 : 2;
                var sampleRate =
                    SamplingRateMap[columnInSampleRates * 3 + headerF];
                var padding = headerG ? 1 : 0;
                var channelCount = data[start + 3] >> 6 === 3 ? 1 : 2; // If bits of channel mode are `11` then it is a single channel (Mono)
                var frameLength =
                    headerC === 3
                        ? ((headerB === 3 ? 12 : 6) * bitRate / sampleRate +
                              padding) <<
                          2
                        : ((headerB === 3 ? 144 : 72) * bitRate / sampleRate +
                              padding) |
                          0;
                if (start + frameLength > end) {
                    return -1;
                }
                if (this._onMpegFrame) {
                    this._onMpegFrame(
                        data.subarray(start, start + frameLength),
                        bitRate,
                        sampleRate,
                        channelCount,
                        frameIndex,
                        pts
                    );
                }
                return frameLength;
            }
        }
        // noise or ID3, trying to skip
        var offset = start + 2;
        while (offset < end) {
            if (data[offset - 1] === 0xff && (data[offset] & 0xe0) === 0xe0) {
                // sync pattern is found
                if (this._onMpegNoise) {
                    this._onMpegNoise(data.subarray(start, offset - 1));
                }
                return offset - start - 1;
            }
            offset++;
        }
        return -1;
    }

    destroy() {}
}

export default MP3Demuxer;
