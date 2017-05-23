/**
 * MP3 demuxer
 */
import ID3 from '../demux/id3';
import MpegAudio from './mpegaudio';

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
        var offset, length;
        let id3Data = ID3.getID3Data(data, 0);
        if (id3Data && ID3.getTimeStamp(id3Data) !== undefined) {
            // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
            // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
            // More info http://www.mp3-tech.org/programmer/frame_header.html
            for (
                offset = id3.length,
                    length = Math.min(data.length - 1, offset + 100);
                offset < length;
                offset++
            ) {
                if (MpegAudio.isHeader(data, offset)) {
                    //logger.log('MPEG sync word found !');
                    return true;
                }
            }
        }
        return false;
    }

    // feed incoming data to the front of the parsing pipeline
    append(data, timeOffset, contiguous, accurateTimeOffset) {
        let id3Data = ID3.getID3Data(data, 0);
        let pts = 90 * ID3.getTimeStamp(id3Data);
        var afterID3 = id3Data.length;
        var offset;
        var length = data.length;
        var frameIndex = 0,
            stamp = 0;
        var track = this._audioTrack;

        let id3Samples = [];
        id3Samples.push({ pts: pts, dts: pts, data: id3Data });

        while (offset < length - 1) {
            if (MpegAudio.isHeader(data, offset)) {
                // Using http://www.datavoyage.com/mpgscript/mpeghdr.htm as a reference
                if (offset + 24 > length) {
                    break;
                }

                var frame = this.parseMpegAudioFrame(data, offset);
                if (frame && offset + frame.frameLength < length) {
                    var frameDuration = 1152 * 90000 / frame.sampleRate;
                    stamp = pts + frameIndex * frameDuration;
                    var sampleData = data.subarray(
                        offset,
                        offset + frameLength
                    );

                    track.config = [];
                    track.channelCount = frame.channelCount;
                    track.samplerate = sampleRate;
                    track.samples.push({
                        unit: data.subarray(offset, offset + frameLength),
                        pts: stamp,
                        dts: stamp
                    });
                    track.len += data.length;

                    frameIndex++;
                    offset += frameLength;
                } else {
                    //logger.log('Unable to parse Mpeg audio frame');
                    offset++;
                }
            } else if (ID3.isHeader(data, offset)) {
                id3Data = ID3.getID3Data(data, offset);
                id3Samples.push({ pts: stamp, dts: stamp, data: id3Data });
                offset += id3Data.length;
            } else {
                //nothing found, keep looking
                offset++;
            }
        }

        this.remuxer.remux(
            track,
            { samples: [] },
            { samples: id3Samples, inputTimeScale: 90000 },
            { samples: [] },
            timeOffset,
            contiguous,
            accurateTimeOffset
        );
    }

    parseMpegAudioFrame(data, offset) {
        var headerB = (data[offset + 1] >> 3) & 3;
        var headerC = (data[offset + 1] >> 1) & 3;
        var headerE = (data[offset + 2] >> 4) & 15;
        var headerF = (data[offset + 2] >> 2) & 3;
        var headerG = !!(data[offset + 2] & 2);
        if (headerB !== 1 && headerE !== 0 && headerE !== 15 && headerF !== 3) {
            var columnInBitrates =
                headerB === 3 ? 3 - headerC : headerC === 3 ? 3 : 4;
            var bitRate =
                MpegAudio.BitratesMap[columnInBitrates * 14 + headerE - 1] *
                1000;
            var columnInSampleRates = headerB === 3 ? 0 : headerB === 2 ? 1 : 2;
            var sampleRate =
                MpegAudio.SamplingRateMap[columnInSampleRates * 3 + headerF];
            var padding = headerG ? 1 : 0;
            var channelCount = data[offset + 3] >> 6 === 3 ? 1 : 2; // If bits of channel mode are `11` then it is a single channel (Mono)
            var frameLength =
                headerC === 3
                    ? ((headerB === 3 ? 12 : 6) * bitRate / sampleRate +
                          padding) <<
                      2
                    : ((headerB === 3 ? 144 : 72) * bitRate / sampleRate +
                          padding) |
                      0;

            return { sampleRate, channelCount, frameLength };
        }

        return undefined;
    }

    destroy() {}
}

export default MP3Demuxer;
