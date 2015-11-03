/*  inline demuxer.
 *   probe fragments and instantiate appropriate demuxer depending on content type (TSDemuxer, AACDemuxer, ...)
 */

import TSDemuxer from '../demux/tsdemuxer';

class DemuxerInline {
    constructor(hls, remuxer) {
        this.hls = hls;
        this.demuxer = new TSDemuxer(hls, remuxer);
    }

    destroy() {
        this.demuxer.destroy();
    }

    push(data, audioCodec, videoCodec, timeOffset, cc, level, duration) {
        this.demuxer.push(
            data,
            audioCodec,
            videoCodec,
            timeOffset,
            cc,
            level,
            duration
        );
    }

    remux() {
        this.demuxer.remux();
    }
}

export default DemuxerInline;
