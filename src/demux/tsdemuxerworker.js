import Event from '../events';
import TSDemuxer from '../demux/tsdemuxer';
import observer from '../observer';

class TSDemuxerWorker {
    constructor() {
        self.addEventListener('message', function(ev) {
            //console.log('demuxer cmd:' + ev.data.cmd);
            switch (ev.data.cmd) {
                case 'init':
                    self.demuxer = new TSDemuxer();
                    break;
                case 'duration':
                    self.demuxer.duration = ev.data.data;
                    break;
                case 'switchLevel':
                    self.demuxer.switchLevel();
                    break;
                case 'demux':
                    self.demuxer.push(
                        new Uint8Array(ev.data.data),
                        ev.data.codecs,
                        ev.data.timeOffset
                    );
                    self.demuxer.end();
                    break;
                default:
                    break;
            }
        });

        // listen to events triggered by TS Demuxer
        observer.on(Event.INIT_SEGMENT, function(ev, data) {
            var objData = {
                event: ev,
                codec: data.codec,
                moov: data.moov.buffer,
                width: data.width,
                height: data.height,
                audioChannelCount: data.audioChannelCount
            };
            // pass moov as transferable object (no copy)
            self.postMessage(objData, [objData.moov]);
        });
        observer.on(Event.FRAGMENT_PARSING, function(ev, data) {
            var objData = {
                event: ev,
                type: data.type,
                start: data.start,
                end: data.end,
                moof: data.moof.buffer,
                mdat: data.mdat.buffer
            };
            // pass moof/mdat data as transferable object (no copy)
            self.postMessage(objData, [objData.moof, objData.mdat]);
        });
        observer.on(Event.FRAGMENT_PARSED, function(ev) {
            var objData = { event: ev };
            self.postMessage(objData);
        });
    }
}

export default TSDemuxerWorker;
