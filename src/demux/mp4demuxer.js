/**
 * MP4 demuxer
 */
import {logger} from '../utils/logger';
import Event from '../events';

const UINT32_MAX = Math.pow(2, 32) - 1;

 class MP4Demuxer {

  constructor(observer, remuxer) {
    this.observer = observer;
    this.remuxer = remuxer;
  }

  resetTimeStamp(initPTS) {
    this.initPTS = initPTS;
  }

  resetInitSegment(initSegment,audioCodec,videoCodec, duration) {
    //jshint unused:false
    if (initSegment && initSegment.byteLength) {
      const initData = this.initData = MP4Demuxer.parseInitSegment(initSegment);

      // default audio codec if nothing specified
      // TODO : extract that from initsegment
      if (audioCodec == null) {
        audioCodec = 'mp4a.40.5';
      }
      if (videoCodec == null) {
        videoCodec = 'avc1.42e01e';

      }
      var tracks = {};
      if(initData.audio && initData.video) {
        tracks.audiovideo = { container : 'video/mp4', codec : audioCodec + ',' + videoCodec, initSegment : duration ? initSegment : null };
      } else {
        if (initData.audio) {
          tracks.audio = { container : 'audio/mp4', codec : audioCodec, initSegment : duration ? initSegment : null };
        }
        if (initData.video) {
          tracks.video = { container : 'video/mp4', codec : videoCodec, initSegment : duration ? initSegment : null };
        }
      }
      this.observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT,{ tracks : tracks });
    } else {
      if (audioCodec) {
        this.audioCodec = audioCodec;
      }
      if (videoCodec) {
        this.videoCodec = videoCodec;
      }
    }
  }

  static probe(data) {
    // ensure we find a moof box in the first 16 kB
    return MP4Demuxer.findBox( { data : data, start : 0, end : Math.min(data.length, 16384) } ,['moof']).length > 0;
  }


  static bin2str(buffer) {
    return String.fromCharCode.apply(null, buffer);
  }

  static readUint32(buffer, offset) {
    if (buffer.data) {
      offset += buffer.start;
      buffer = buffer.data;
    }

    const val = buffer[offset] << 24 |
                buffer[offset + 1] << 16 |
                buffer[offset + 2] << 8 |
                buffer[offset + 3];
    return val < 0 ? 4294967296 + val : val;
  }

  static writeUint32(buffer, offset, value) {
    if (buffer.data) {
      offset += buffer.start;
      buffer = buffer.data;
    }
    buffer[offset] = value >> 24;
    buffer[offset+1] = (value >> 16) & 0xff;
    buffer[offset+2] = (value >> 8) & 0xff;
    buffer[offset+3] = value & 0xff;
  }


  // Find the data for a box specified by its path
  static findBox(data,path) {
    var results = [],
        i, size, type, end, subresults, start, endbox;

    if (data.data) {
      start = data.start;
      end = data.end;
      data = data.data;
    } else {
      start = 0;
      end = data.byteLength;
    }

    if (!path.length) {
      // short-circuit the search for empty paths
      return null;
    }

    for (i = start; i < end;) {
      size = MP4Demuxer.readUint32(data, i);
      type = MP4Demuxer.bin2str(data.subarray(i + 4, i + 8));
      endbox = size > 1 ? i + size : end;

      if (type === path[0]) {

        if (path.length === 1) {
          // this is the end of the path and we've found the box we were
          // looking for
          results.push({ data : data, start : i + 8, end : endbox});
        } else {
          // recursively search for the next box along the path
          subresults = MP4Demuxer.findBox({ data : data, start : i +8, end : endbox }, path.slice(1));
          if (subresults.length) {
            results = results.concat(subresults);
          }
        }
      }
      i = endbox;
    }

    // we've finished searching all of data
    return results;
  }



/**
 * Parses an MP4 initialization segment and extracts stream type and
 * timescale values for any declared tracks. Timescale values indicate the
 * number of clock ticks per second to assume for time-based values
 * elsewhere in the MP4.
 *
 * To determine the start time of an MP4, you need two pieces of
 * information: the timescale unit and the earliest base media decode
 * time. Multiple timescales can be specified within an MP4 but the
 * base media decode time is always expressed in the timescale from
 * the media header box for the track:
 * ```
 * moov > trak > mdia > mdhd.timescale
 * moov > trak > mdia > hdlr
 * ```
 * @param init {Uint8Array} the bytes of the init segment
 * @return {object} a hash of track type to timescale values or null if
 * the init segment is malformed.
 */
  static parseInitSegment(initSegment) {
    var result = [];
    var traks = MP4Demuxer.findBox(initSegment, ['moov', 'trak']);

    traks.forEach(trak => {
      const tkhd = MP4Demuxer.findBox(trak, ['tkhd'])[0];
      if (tkhd) {
        let version = tkhd.data[tkhd.start];
        let index = version === 0 ? 12 : 20;
        let trackId = MP4Demuxer.readUint32(tkhd, index);

        const mdhd = MP4Demuxer.findBox(trak, ['mdia', 'mdhd'])[0];
        if (mdhd) {
          version = mdhd.data[mdhd.start];
          index = version === 0 ? 12 : 20;
          const timescale = MP4Demuxer.readUint32(mdhd, index);

          const hdlr = MP4Demuxer.findBox(trak, ['mdia', 'hdlr'])[0];
          if (hdlr) {
            const hdlrType = MP4Demuxer.bin2str(hdlr.data.subarray(hdlr.start+8, hdlr.start+12));
            let type = { 'soun' : 'audio', 'vide' : 'video'}[hdlrType];
            if (type) {
                 // extract codec info. TODO : parse codec details to be able to build MIME type
                  let codecBox = MP4Demuxer.findBox( trak, ['mdia','minf','stbl','stsd']);
                  if (codecBox.length) {
                    codecBox = codecBox[0];
                    let codecType = MP4Demuxer.bin2str(codecBox.data.subarray(codecBox.start+12, codecBox.start+16));
                    logger.log(`MP4Demuxer:${type}:${codecType} found`);
                  }
              result[trackId] = { timescale : timescale , type : type};
              result[type] = { timescale : timescale , id : trackId};
            }
          }
        }
      }
    });
    return result;
  }


/**
 * Determine the base media decode start time, in seconds, for an MP4
 * fragment. If multiple fragments are specified, the earliest time is
 * returned.
 *
 * The base media decode time can be parsed from track fragment
 * metadata:
 * ```
 * moof > traf > tfdt.baseMediaDecodeTime
 * ```
 * It requires the timescale value from the mdhd to interpret.
 *
 * @param timescale {object} a hash of track ids to timescale values.
 * @return {number} the earliest base media decode start time for the
 * fragment, in seconds
 */
static getStartDTS(initData, fragment) {
  var trafs, baseTimes, result;

  // we need info from two childrend of each track fragment box
  trafs = MP4Demuxer.findBox(fragment, ['moof', 'traf']);

  // determine the start times for each track
  baseTimes = [].concat.apply([], trafs.map(function(traf) {
    return MP4Demuxer.findBox(traf, ['tfhd']).map(function(tfhd) {
      var id, scale, baseTime;

      // get the track id from the tfhd
      id = MP4Demuxer.readUint32(tfhd, 4);
      // assume a 90kHz clock if no timescale was specified
      scale = initData[id].timescale || 90e3;

      // get the base media decode time from the tfdt
      baseTime = MP4Demuxer.findBox(traf, ['tfdt']).map(function(tfdt) {
        var version, result;

        version = tfdt.data[tfdt.start];
        result = MP4Demuxer.readUint32(tfdt, 4);
        if (version ===  1) {
          result *= Math.pow(2, 32);

          result += MP4Demuxer.readUint32(tfdt, 8);
        }
        return result;
      })[0];
      // convert base time to seconds
      return baseTime / scale;
    });
  }));

  // return the minimum
  result = Math.min.apply(null, baseTimes);
  return isFinite(result) ? result : 0;
}




static offsetStartDTS(initData,fragment,timeOffset) {
  MP4Demuxer.findBox(fragment, ['moof', 'traf']).map(function(traf) {
    return MP4Demuxer.findBox(traf, ['tfhd']).map(function(tfhd) {
      // get the track id from the tfhd
      var id = MP4Demuxer.readUint32(tfhd, 4);
      // assume a 90kHz clock if no timescale was specified
      var timescale = initData[id].timescale || 90e3;

      // get the base media decode time from the tfdt
      MP4Demuxer.findBox(traf, ['tfdt']).map(function(tfdt) {
        var version = tfdt.data[tfdt.start];
        var baseMediaDecodeTime = MP4Demuxer.readUint32(tfdt, 4);
        if (version === 0) {
          MP4Demuxer.writeUint32(tfdt, 4, baseMediaDecodeTime - timeOffset*timescale);
        } else {
          baseMediaDecodeTime *= Math.pow(2, 32);
          baseMediaDecodeTime += MP4Demuxer.readUint32(tfdt, 8);
          baseMediaDecodeTime -= timeOffset*timescale;
          baseMediaDecodeTime = Math.max(baseMediaDecodeTime,0);
          const upper = Math.floor(baseMediaDecodeTime / (UINT32_MAX + 1));
          const lower = Math.floor(baseMediaDecodeTime % (UINT32_MAX + 1));
          MP4Demuxer.writeUint32(tfdt, 4, upper);
          MP4Demuxer.writeUint32(tfdt, 8, lower);
        }
      });
    });
  });
}

  // feed incoming data to the front of the parsing pipeline
  append(data, timeOffset,contiguous,accurateTimeOffset) {
    let initData = this.initData;
    if(!initData) {
      this.resetInitSegment(data,this.audioCodec,this.videoCodec);
      initData = this.initData;
    }
    let startDTS, initPTS = this.initPTS;
    if (initPTS === undefined) {
      let startDTS = MP4Demuxer.getStartDTS(initData,data);
      this.initPTS = initPTS = startDTS - timeOffset;
      this.observer.trigger(Event.INIT_PTS_FOUND, { initPTS: initPTS});
    }
    MP4Demuxer.offsetStartDTS(initData,data,initPTS);
    startDTS = MP4Demuxer.getStartDTS(initData,data);
    this.remuxer.remux(initData.audio, initData.video, null, null, startDTS, contiguous,accurateTimeOffset,data);
  }

  destroy() {
  }

}

export default MP4Demuxer;
