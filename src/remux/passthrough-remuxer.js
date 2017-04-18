/**
 * passthrough remuxer
*/
import Event from '../events';

class PassThroughRemuxer {
  constructor(observer) {
    this.observer = observer;
  }

  destroy() {
  }

  resetTimeStamp() {
  }

  resetInitSegment() {
  }

  remux(audioTrack,videoTrack,id3Track,textTrack,timeOffset, contiguous,accurateTimeOffset,rawData) {
    var observer = this.observer;
    var streamType = '';
    if (audioTrack) {
      streamType += 'audio';
    }
    if (videoTrack) {
      streamType += 'video';
    }
    observer.trigger(Event.FRAG_PARSING_DATA, {
      data1: rawData,
      startPTS: timeOffset,
      startDTS: timeOffset,
      type: streamType,
      nb: 1,
      dropped : 0
    });
    //notify end of parsing
    observer.trigger(Event.FRAG_PARSED);
  }
}

export default PassThroughRemuxer;
