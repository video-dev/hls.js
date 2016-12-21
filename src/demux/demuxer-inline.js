/*  inline demuxer.
 *   probe fragments and instantiate appropriate demuxer depending on content type (TSDemuxer, AACDemuxer, ...)
 */

import Event from '../events';
import {ErrorTypes, ErrorDetails} from '../errors';
import AACDemuxer from '../demux/aacdemuxer';
import TSDemuxer from '../demux/tsdemuxer';
import MP4Remuxer from '../remux/mp4-remuxer';
import PassThroughRemuxer from '../remux/passthrough-remuxer';

class DemuxerInline {

  constructor(hls,id, typeSupported, config=null) {
    this.hls = hls;
    this.id = id;
    this.config = this.hls.config || config;
    this.typeSupported = typeSupported;
  }

  destroy() {
    var demuxer = this.demuxer;
    if (demuxer) {
      demuxer.destroy();
    }
  }

  append(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration,accurateTimeOffset,defaultInitPTS) {
    var demuxer = this.demuxer;
    if (!demuxer || 
       // in case of continuity change, we might switch from content type (AAC container to TS container for example)
       // so let's check that current demuxer is still valid
        (cc !== this.cc && !demuxer.probe(data))) {
      let hls = this.hls,
          id = this.id,
          config = this.config,
          typeSupported = this.typeSupported;
      // probe for content type
      if (TSDemuxer.probe(data)) {
        if (this.typeSupported.mp2t === true) {
          demuxer = new TSDemuxer(hls, id, PassThroughRemuxer, config, typeSupported);
        } else {
          demuxer = new TSDemuxer(hls, id, MP4Remuxer, config, typeSupported);
        }
        demuxer.probe = TSDemuxer.probe;
      } else if(AACDemuxer.probe(data)) {
        demuxer = new AACDemuxer(hls, id, MP4Remuxer, config, typeSupported);
        demuxer.probe = AACDemuxer.probe;
      } else {
        hls.trigger(Event.ERROR, {type : ErrorTypes.MEDIA_ERROR, id : id, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'no demux matching with content found'});
        return;
      }
      this.demuxer = demuxer;
    }
    demuxer.append(data,audioCodec,videoCodec,timeOffset,cc,level,sn,duration,accurateTimeOffset,defaultInitPTS);
    this.cc = cc;
  }

  notifycomplete() {
    var demuxer = this.demuxer;
    if(demuxer) {
      demuxer.notifycomplete();
    }
  }
}

export default DemuxerInline;
