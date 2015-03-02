/*
 * buffer controller
 *
 */

import Event from '../events';
import FragmentLoader from '../loader/fragment-loader';
import observer from '../observer';
import { logger } from '../utils/logger';
import TSDemuxer from '../demux/tsdemuxer';
import TSDemuxerWorker from '../demux/tsdemuxerworker';

const IDLE = 0;
const LOADING = 1;
const WAITING_LEVEL = 2;
const PARSING_APPENDING = 3;
const PARSED_APPENDING = 4;

class BufferController {
    constructor(video) {
        this.video = video;
        this.fragmentLoader = new FragmentLoader();
        var enableWorker = true;
        if (enableWorker && typeof Worker !== 'undefined') {
            console.log('TS demuxing in webworker');
            var work = require('webworkify');
            this.w = work(TSDemuxerWorker);
            this.onwmsg = this.onWorkerMessage.bind(this);
            this.w.addEventListener('message', this.onwmsg);
        } else {
            this.demuxer = new TSDemuxer();
        }
        this.mp4segments = [];
        // Source Buffer listeners
        this.onsbue = this.onSourceBufferUpdateEnd.bind(this);
        this.onsbe = this.onSourceBufferError.bind(this);
        // internal listeners
        this.onll = this.onLevelLoaded.bind(this);
        this.onfl = this.onFragmentLoaded.bind(this);
        this.onis = this.onInitSegment.bind(this);
        this.onfpg = this.onFragmentParsing.bind(this);
        this.onfp = this.onFragmentParsed.bind(this);
        this.ontick = this.tick.bind(this);
        this.state = WAITING_LEVEL;
    }

    destroy() {
        this.stop();
        this.fragmentLoader.destroy();
        if (this.w) {
            this.w.removeEventListener('message', this.onwmsg);
            this.w.terminate();
            this.w = null;
        } else {
            this.demuxer.destroy();
        }
        this.mp4segments = [];
        var sb = this.sourceBuffer;
        if (sb) {
            //detach sourcebuffer from Media Source
            this.mediaSource.removeSourceBuffer(sb);
            sb.removeEventListener('updateend', this.onsbue);
            sb.removeEventListener('error', this.onsbe);
            this.sourceBuffer = null;
        }
        this.state = WAITING_LEVEL;
    }

    start(levels, mediaSource) {
        this.levels = levels;
        this.mediaSource = mediaSource;
        this.stop();
        this.timer = setInterval(this.ontick, 100);
        observer.on(Event.FRAGMENT_LOADED, this.onfl);
        observer.on(Event.INIT_SEGMENT, this.onis);
        observer.on(Event.FRAGMENT_PARSING, this.onfpg);
        observer.on(Event.FRAGMENT_PARSED, this.onfp);
        observer.on(Event.LEVEL_LOADED, this.onll);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.ontick);
        }
        this.timer = undefined;
        observer.removeListener(Event.FRAGMENT_LOADED, this.onfl);
        observer.removeListener(Event.FRAGMENT_PARSED, this.onfp);
        observer.removeListener(Event.FRAGMENT_PARSING, this.onfpg);
        observer.removeListener(Event.LEVEL_LOADED, this.onll);
        observer.removeListener(Event.INIT_SEGMENT, this.onis);
    }

    tick() {
        switch (this.state) {
            case LOADING:
                // nothing to do, wait for fragment retrieval
                break;
            case PARSING_APPENDING:
            case PARSED_APPENDING:
                if (this.sourceBuffer) {
                    // if MP4 segment appending in progress nothing to do
                    if (this.sourceBuffer.updating) {
                        //logger.log('sb append in progress');
                        // check if any MP4 segments left to append
                    } else if (this.mp4segments.length) {
                        this.sourceBuffer.appendBuffer(
                            this.mp4segments.shift().data
                        );
                    } else if (this.state == PARSED_APPENDING) {
                        // no more sourcebuffer to update, and parsing finished we are done with this segment, switch back to IDLE state
                        //logger.log('sb append finished');
                        this.state = IDLE;
                    }
                }
                break;
            case IDLE:
                // determine next candidate fragment to be loaded, based on current position and end of buffer position
                // ensure 60s of buffer upfront
                var v = this.video,
                    pos = v.currentTime,
                    buffered = v.buffered,
                    bufferLen,
                    bufferEnd,
                    i;
                for (
                    i = 0, bufferLen = 0, bufferEnd = pos;
                    i < buffered.length;
                    i++
                ) {
                    if (pos >= buffered.start(i) && pos < buffered.end(i)) {
                        // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
                        bufferEnd = buffered.end(i);
                        bufferLen = bufferEnd - pos;
                    }
                }
                // if buffer length is less than 60s try to load a new fragment
                if (bufferLen < 60) {
                    // find fragment index, contiguous with end of buffer position
                    var fragments = this.levels[this.level].fragments;
                    for (i = 0; i < fragments.length; i++) {
                        if (
                            fragments[i].start <= bufferEnd + 0.1 &&
                            fragments[i].start + fragments[i].duration >
                                bufferEnd + 0.1
                        ) {
                            break;
                        }
                    }
                    if (i < fragments.length) {
                        if (this.loadingIndex !== i) {
                            logger.log(
                                '      loading frag ' +
                                    i +
                                    ',pos/bufEnd:' +
                                    pos.toFixed(3) +
                                    '/' +
                                    bufferEnd.toFixed(3)
                            );
                            this.loadingIndex = i;
                            fragments[i].loaded = true;
                            this.fragmentLoader.load(fragments[i].url);
                            this.state = LOADING;
                        } else {
                            logger.log(
                                'avoid loading frag ' +
                                    i +
                                    ',pos/bufEnd:' +
                                    pos.toFixed(3) +
                                    '/' +
                                    bufferEnd.toFixed(3) +
                                    ',frag start/end:' +
                                    fragments[i].start +
                                    '/' +
                                    (fragments[i].start + fragments[i].duration)
                            );
                        }
                    }
                }
                break;
            default:
                break;
        }
    }

    onLevelLoaded(event, data) {
        this.level = data.level;
        var duration = this.levels[this.level].totalduration;
        if (this.w) {
            this.w.postMessage(duration); // post duration
        } else {
            this.demuxer.duration = duration;
        }
        this.fragmentIndex = 0;
        var stats = data.stats;
        logger.log(
            'level loaded,RTT(ms)/load(ms)/duration:' +
                (stats.tfirst - stats.trequest) +
                '/' +
                (stats.tend - stats.trequest) +
                '/' +
                duration
        );
        this.state = IDLE;
        //trigger handler right now
        this.tick();
    }

    onFragmentLoaded(event, data) {
        this.state = PARSING_APPENDING;
        // transmux the MPEG-TS data to ISO-BMFF segments
        this.tparse0 = Date.now();
        if (this.w) {
            // post fragment payload as transferable objects (no copy)
            this.w.postMessage(data.payload, [data.payload]);
            this.tparse1 = Date.now();
        } else {
            this.demuxer.push(new Uint8Array(data.payload));
            this.tparse1 = Date.now();
            this.demuxer.end();
        }
        var stats, rtt, loadtime, bw;
        stats = data.stats;
        rtt = stats.tfirst - stats.trequest;
        loadtime = stats.tend - stats.trequest;
        bw = stats.length * 8 / (1000 * loadtime);
        //logger.log(data.url + ' loaded, RTT(ms)/load(ms)/bitrate:' + rtt + '/' + loadtime + '/' + bw.toFixed(3) + ' Mb/s');
    }

    onInitSegment(event, data) {
        // check if codecs have been explicitely defined in the master playlist for this level;
        // if yes use these ones instead of the ones parsed from the demux
        var codec = this.levels[this.level].codecs;
        if (codec === undefined) {
            codec = data.codec;
        }
        // codec="mp4a.40.5,avc1.420016";
        logger.log('choosed codecs:' + codec);
        // create source Buffer and link them to MediaSource
        var sb = (this.sourceBuffer = this.mediaSource.addSourceBuffer(
            'video/mp4;codecs=' + codec
        ));
        sb.addEventListener('updateend', this.onsbue);
        sb.addEventListener('error', this.onsbe);
        this.mp4segments.push(data);
        //trigger handler right now
        this.tick();
    }

    onFragmentParsing(event, data) {
        this.tparse2 = Date.now();
        //logger.log('push time/total time:' + (this.tparse1-this.tparse0) + '/' + (this.tparse2-this.tparse0));
        this.mp4segments.push(data);
        //trigger handler right now
        this.tick();
    }

    onFragmentParsed(event, data) {
        this.state = PARSED_APPENDING;
        this.tparse2 = Date.now();
        //logger.log('push time/total time:' + (this.tparse1-this.tparse0) + '/' + (this.tparse2-this.tparse0));
        //trigger handler right now
        this.tick();
    }

    onSourceBufferUpdateEnd() {
        //trigger handler right now
        this.tick();
    }

    onSourceBufferError(event) {
        logger.log(' buffer append error:' + event);
    }

    onWorkerMessage(ev) {
        //console.log(ev);
        switch (ev.data.event) {
            case Event.INIT_SEGMENT:
                observer.trigger(Event.INIT_SEGMENT, {
                    data: new Uint8Array(ev.data.data),
                    codec: ev.data.codec
                });
                break;
            case Event.FRAGMENT_PARSING:
                observer.trigger(Event.FRAGMENT_PARSING, {
                    data: new Uint8Array(ev.data.data),
                    start: ev.data.start,
                    end: ev.data.end,
                    type: ev.data.type
                });
                break;
            case Event.FRAGMENT_PARSED:
                observer.trigger(Event.FRAGMENT_PARSED);
                break;
            default:
                break;
        }
    }
}

export default BufferController;
