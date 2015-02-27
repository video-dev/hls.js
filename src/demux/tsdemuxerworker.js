import Event from '../events';
import TSDemuxer from '../demux/tsdemuxer2';
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
        observer.on(Event.FRAGMENT_PARSED, function(ev, data) {
            var objData = { event: ev, data: data.data.buffer };
            // pass fMP4 data as transferable object (no copy)
            self.postMessage(objData, [objData.data]);
        });
    }
}

export default TSDemuxerWorker;
