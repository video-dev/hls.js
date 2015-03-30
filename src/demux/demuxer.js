import Event from '../events';
import TSDemuxer from './tsdemuxer';
import TSDemuxerWorker from './tsdemuxerworker';
import observer from '../observer';
import { logger } from '../utils/logger';

class Demuxer {
    constructor() {
        var enableWorker = true;
        if (enableWorker && typeof Worker !== 'undefined') {
            logger.log('TS demuxing in webworker');
            var work = require('webworkify');
            this.w = work(TSDemuxerWorker);
            this.onwmsg = this.onWorkerMessage.bind(this);
            this.w.addEventListener('message', this.onwmsg);
            this.w.postMessage({ cmd: 'init' });
        } else {
            this.demuxer = new TSDemuxer();
        }
        this.demuxInitialized = true;
    }

    set duration(newDuration) {
        if (this.w) {
            // post fragment payload as transferable objects (no copy)
            this.w.postMessage({ cmd: 'duration', data: newDuration });
        } else {
            this.demuxer.duration = newDuration;
        }
    }

    destroy() {
        if (this.w) {
            this.w.removeEventListener('message', this.onwmsg);
            this.w.terminate();
            this.w = null;
        } else {
            this.demuxer.destroy();
        }
    }

    push(data, audioCodec, videoCodec, timeOffset) {
        if (this.w) {
            // post fragment payload as transferable objects (no copy)
            this.w.postMessage(
                {
                    cmd: 'demux',
                    data: data,
                    audioCodec: audioCodec,
                    videoCodec: videoCodec,
                    timeOffset: timeOffset
                },
                [data]
            );
        } else {
            this.demuxer.push(
                new Uint8Array(data),
                audioCodec,
                videoCodec,
                timeOffset
            );
            this.demuxer.end();
        }
    }

    switchLevel() {
        if (this.w) {
            // post fragment payload as transferable objects (no copy)
            this.w.postMessage({ cmd: 'switchLevel' });
        } else {
            this.demuxer.switchLevel();
        }
    }

    onWorkerMessage(ev) {
        //console.log('onWorkerMessage:' + ev.data.event);
        switch (ev.data.event) {
            case Event.FRAG_PARSING_INIT_SEGMENT:
                var obj = {};
                if (ev.data.audioMoov) {
                    obj.audioMoov = new Uint8Array(ev.data.audioMoov);
                    obj.audioCodec = ev.data.audioCodec;
                    obj.audioChannelCount = ev.data.audioChannelCount;
                }

                if (ev.data.videoMoov) {
                    obj.videoMoov = new Uint8Array(ev.data.videoMoov);
                    obj.videoCodec = ev.data.videoCodec;
                    obj.videoWidth = ev.data.videoWidth;
                    obj.videoHeight = ev.data.videoHeight;
                }
                observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, obj);
                break;
            case Event.FRAG_PARSING_DATA:
                observer.trigger(Event.FRAG_PARSING_DATA, {
                    moof: new Uint8Array(ev.data.moof),
                    mdat: new Uint8Array(ev.data.mdat),
                    startPTS: ev.data.startPTS,
                    endPTS: ev.data.endPTS,
                    startDTS: ev.data.startDTS,
                    endDTS: ev.data.endDTS,
                    type: ev.data.type
                });
                break;
            case Event.FRAG_PARSED:
                observer.trigger(Event.FRAG_PARSED);
                break;
            default:
                break;
        }
    }
}
export default Demuxer;
