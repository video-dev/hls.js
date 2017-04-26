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
        var id3 = new ID3(data),
            offset,
            length;
        if (id3.hasTimeStamp) {
            // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
            // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
            // More info http://www.mp3-tech.org/programmer/frame_header.html
            for (
                offset = id3.length,
                    length = Math.min(data.length - 1, offset + 100);
                offset < length;
                offset++
            ) {
                if (
                    data[offset] === 0xff &&
                    (data[offset + 1] & 0xe0) === 0xe0 &&
                    (data[offset + 1] & 0x06) !== 0x00
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
        var afterID3 = id3.length;
        var offset, length;

        // Look for MPEG header
        for (
            offset = afterID3, length = data.length;
            offset < length - 1;
            offset++
        ) {
            if (
                data[offset] === 0xff &&
                (data[offset + 1] & 0xe0) === 0xe0 &&
                (data[offset + 1] & 0x06) !== 0x00
            ) {
                break;
            }
        }

        MpegAudio.parse(this._audioTrack, data, id3.length, pts);

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

    destroy() {}
}

export default MP3Demuxer;
