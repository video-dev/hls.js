/*
 * buffer controller
 *
 */

import Event from '../events';
import FragmentLoader from '../loader/fragment-loader';
import observer from '../observer';
import { logger } from '../utils/logger';
import TSDemuxer from '../demux/tsdemuxer';

const LOADING_IDLE = 0;
const LOADING_IN_PROGRESS = 1;
// const LOADING_WAITING_LEVEL_UPDATE = 2;
// const LOADING_STALLED = 3;
// const LOADING_FRAGMENT_IO_ERROR = 4;
const LOADING_COMPLETED = 5;

class BufferController {
    constructor(video) {
        this.video = video;
        this.fragmentLoader = new FragmentLoader();
        this.demuxer = new TSDemuxer();
        this.mp4segments = [];
        // Source Buffer listeners
        this.onsbue = this.onSourceBufferUpdateEnd.bind(this);
        this.onsbe = this.onSourceBufferError.bind(this);
        // internal listeners
        this.onll = this.onLevelLoaded.bind(this);
        this.onfl = this.onFragmentLoaded.bind(this);
        this.onfp = this.onFragmentParsed.bind(this);
        this.ontick = this.tick.bind(this);
        this.state = LOADING_IDLE;
    }

    destroy() {
        this.stop();
        this.fragmentLoader.destroy();
        this.demuxer.destroy();
        this.mp4segments = [];
        this.sourceBuffer.removeEventListener('updateend', this.onsbue);
        this.sourceBuffer.removeEventListener('error', this.onsbe);
        this.state = LOADING_IDLE;
    }

    start(levels, sb) {
        this.levels = levels;
        this.sourceBuffer = sb;
        this.stop();
        this.timer = setInterval(this.ontick, 100);
        observer.on(Event.FRAGMENT_LOADED, this.onfl);
        observer.on(Event.FRAGMENT_PARSED, this.onfp);
        observer.on(Event.LEVEL_LOADED, this.onll);
        sb.addEventListener('updateend', this.onsbue);
        sb.addEventListener('error', this.onsbe);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.ontick);
        }
        this.timer = undefined;
        observer.removeListener(Event.FRAGMENT_LOADED, this.onfl);
        observer.removeListener(Event.FRAGMENT_PARSED, this.onfp);
        observer.removeListener(Event.LEVEL_LOADED, this.onll);
    }

    tick() {
        if (this.state == LOADING_IDLE) {
            // check buffer, ensure that we have at least 2mns of buffer available
            var v = this.video;
            var buffer =
                (v.buffered.length === 0 ? 0 : v.buffered.end(0)) -
                v.currentTime;
            if (buffer < 120) {
                // load next segment
                this.fragmentLoader.load(
                    this.fragments[this.fragmentIndex++].url
                );
                this.state = LOADING_IN_PROGRESS;
            }
        }
    }

    onLevelLoaded(event, data) {
        this.fragments = this.levels[data.level].fragments;
        this.demuxer.duration = this.levels[data.level].totalduration;
        this.fragmentIndex = 0;
        var stats = data.stats;
        logger.log(
            'level loaded,RTT(ms)/load(ms)/nb frag:' +
                (stats.tfirst - stats.trequest) +
                '/' +
                (stats.tend - stats.trequest) +
                '/' +
                this.fragments.length
        );
    }

    onFragmentLoaded(event, data) {
        // transmux the MPEG-TS data to ISO-BMFF segments
        this.demuxer.push(new Uint8Array(data.payload));
        this.demuxer.end();
        if (this.fragmentIndex == this.fragments.length) {
            logger.log('last fragment loaded');
            observer.trigger(Event.LAST_FRAGMENT_LOADED);
            this.state = LOADING_COMPLETED;
        } else {
            this.state = LOADING_IDLE;
        }
        var stats, rtt, loadtime, bw;
        stats = data.stats;
        rtt = stats.tfirst - stats.trequest;
        loadtime = stats.tend - stats.trequest;
        bw = stats.length * 8 / (1000 * loadtime);
        //logger.log(data.url + ' loaded, RTT(ms)/load(ms)/bitrate:' + rtt + '/' + loadtime + '/' + bw.toFixed(3) + ' Mb/s');
    }

    onFragmentParsed(event, data) {
        this.mp4segments.push(data);
        this.appendSegments();
    }

    appendSegments() {
        if (
            this.sourceBuffer &&
            !this.sourceBuffer.updating &&
            this.mp4segments.length
        ) {
            this.sourceBuffer.appendBuffer(this.mp4segments.shift().data);
        }
    }

    onSourceBufferUpdateEnd() {
        logger.log('buffer appended');
        this.appendSegments();
    }

    onSourceBufferError() {
        logger.log(' buffer append error:' + event);
    }
}

export default BufferController;
