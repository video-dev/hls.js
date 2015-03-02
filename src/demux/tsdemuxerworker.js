import Event from '../events';
import TSDemuxer from '../demux/tsdemuxer';
import observer from '../observer';

class TSDemuxerWorker {
    constructor() {
        self.demuxer = new TSDemuxer();
        self.addEventListener('message', function(ev) {
            // if type is number then it is playlist duration
            if (typeof ev.data === 'number') {
                self.demuxer.duration = ev.data;
            } else {
                // if not number, this is our fragment payload, trigger a demux
                self.demuxer.push(new Uint8Array(ev.data));
                self.demuxer.end();
            }
        });

        // listen to events triggered by TS Demuxer
        observer.on(Event.INIT_SEGMENT, function(ev, data) {
            var objData = {
                event: ev,
                codec: data.codec,
                data: data.data.buffer
            };
            // pass init segment as transferable object (no copy)
            self.postMessage(objData, [objData.data]);
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
            // pass fMP4 data as transferable object (no copy)
            self.postMessage(objData, [objData.moof, objData.mdat]);
        });
        observer.on(Event.FRAGMENT_PARSED, function(ev) {
            var objData = { event: ev };
            self.postMessage(objData);
        });
    }
}

export default TSDemuxerWorker;
