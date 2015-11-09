/**
 * AAC demuxer
 */

 class AACDemuxer {

  constructor(observer,remuxerClass) {
    this.observer = observer;
    this.remuxerClass = remuxerClass;
    this.remuxer = new this.remuxerClass(observer);
  }

  static probe(data) {
    this.data = data;
    return false;
  }


  // feed incoming data to the front of the parsing pipeline
  push(data, audioCodec, videoCodec, timeOffset, cc, level, duration) {
    this.data = data;
    this.audioCodec = audioCodec;
    this.videoCodec = videoCodec;
    this.timeOffset = timeOffset;
    this.cc = cc;
    this.level = level;
    this.duration = duration;
  }

  remux() {
    //this.remuxer.remux(this._aacTrack,null, this._id3Track, this.timeOffset);
  }

  destroy() {
  }

}

export default AACDemuxer;
