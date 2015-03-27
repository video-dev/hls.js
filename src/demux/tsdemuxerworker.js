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
        observer.on(Event.FRAG_PARSING_INIT_SEGMENT, function(ev, data) {
            var objData = {
                event: ev,
                audioCodec: data.audioCodec,
                audioMoov: data.audioMoov.buffer,
                audioChannelCount: data.audioChannelCount,
                videoCodec: data.videoCodec,
                videoMoov: data.videoMoov.buffer,
                videoWidth: data.videoWidth,
                videoHeight: data.videoHeight
            };
            // pass moov as transferable object (no copy)
            self.postMessage(objData, [objData.audioMoov, objData.videoMoov]);
        });
        observer.on(Event.FRAG_PARSING_DATA, function(ev, data) {
            var objData = {
                event: ev,
                type: data.type,
                startPTS: data.startPTS,
                endPTS: data.endPTS,
                startDTS: data.startDTS,
                endDTS: data.endDTS,
                moof: data.moof.buffer,
                mdat: data.mdat.buffer
            };
            // pass moof/mdat data as transferable object (no copy)
            self.postMessage(objData, [objData.moof, objData.mdat]);
        });
        observer.on(Event.FRAG_PARSED, function(ev) {
            var objData = { event: ev };
            self.postMessage(objData);
        });
    }
}

export default TSDemuxerWorker;
