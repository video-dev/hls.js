 import Event                from '../events';
 import TSDemuxer            from './tsdemuxer';
 import TSDemuxerWorker      from './tsdemuxerworker';
 import observer             from '../observer';

class Demuxer {

  constructor(duration) {
    var enableWorker = true;
    if(enableWorker && (typeof(Worker) !== 'undefined')) {
      console.log('TS demuxing in webworker');
      var work = require('webworkify');
      this.w = work(TSDemuxerWorker);
      this.onwmsg = this.onWorkerMessage.bind(this);
      this.w.addEventListener('message', this.onwmsg);
      this.w.postMessage({ cmd : 'init' , data : duration});
    } else {
      this.demuxer = new TSDemuxer(duration);
    }
    this.demuxInitialized = true;
  }

  destroy() {
    if(this.w) {
      this.w.postMessage({ cmd : 'destroy'});
      this.w.removeEventListener('message',this.onwmsg);
      this.w.terminate();
      this.w = null;
    } else {
      this.demuxer.destroy();
    }
  }

  push(data, codecs) {
    if(this.w) {
      // post fragment payload as transferable objects (no copy)
      this.w.postMessage({ cmd : 'demux' , data : data, codecs : codecs },[data]);
    } else {
      this.demuxer.push(new Uint8Array(data), codecs);
      this.demuxer.end();
    }
  }

  switchLevel() {
    if(this.w) {
      // post fragment payload as transferable objects (no copy)
      this.w.postMessage({ cmd : 'switchLevel'});
    } else {
      this.demuxer.switchLevel();
    }
  }

  onWorkerMessage(ev) {
    //console.log('onWorkerMessage:' + ev.data.event);
    switch(ev.data.event) {
      case Event.INIT_SEGMENT:
        observer.trigger(Event.INIT_SEGMENT,{
          moov: new Uint8Array(ev.data.moov),
          codec : ev.data.codec
        });
      break;
      case Event.FRAGMENT_PARSING:
        observer.trigger(Event.FRAGMENT_PARSING,{
          moof : new Uint8Array(ev.data.moof),
          mdat : new Uint8Array(ev.data.mdat),
          start : ev.data.start,
          end : ev.data.end,
          type : ev.data.type
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
export default Demuxer;
