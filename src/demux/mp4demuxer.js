/**
 * MP4 demuxer
 */
//import {logger} from '../utils/logger';
import Event from '../events';


 class MP4Demuxer {

  constructor(observer, remuxer) {
    this.observer = observer;
    this.remuxer = remuxer;
  }

  resetTimeStamp() {

  }

  resetInitSegment(initSegment,audioCodec,videoCodec, duration) {
    //jshint unused:false
    const initData = this.initData = MP4Demuxer.parseInitSegment(initSegment);
    var tracks = {};
    if (initData.audio) {
      tracks.audio = { container : 'audio/mp4', codec : audioCodec, initSegment : initSegment};
    }
    if (initData.video) {
      tracks.video = { container : 'video/mp4', codec : videoCodec, initSegment : initSegment};
    }
    this.observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT,{ unique : false, tracks : tracks });
  }

  static probe(data) {
    if (data.length >= 8) {
      const dataType = MP4Demuxer.bin2str(data.subarray(4,8));
      return (['moof','ftyp','styp'].indexOf(dataType) >= 0);
    }
    return false;
  }


  static bin2str(buffer) {
    return String.fromCharCode.apply(null, buffer);
  }

  // Find the data for a box specified by its path
  static findBox(data, path) {
    var results = [],
        i, size, type, end, subresults;

    if (!path.length) {
      // short-circuit the search for empty paths
      return null;
    }

    for (i = 0; i < data.byteLength;) {
      size  = data[i]     << 24;
      size |= data[i + 1] << 16;
      size |= data[i + 2] << 8;
      size |= data[i + 3];

      type = MP4Demuxer.bin2str(data.subarray(i + 4, i + 8));

      end = size > 1 ? i + size : data.byteLength;

      if (type === path[0]) {
        if (path.length === 1) {
          // this is the end of the path and we've found the box we were
          // looking for
          results.push(data.subarray(i + 8, end));
        } else {
          // recursively search for the next box along the path
          subresults = MP4Demuxer.findBox(data.subarray(i + 8, end), path.slice(1));
          if (subresults.length) {
            results = results.concat(subresults);
          }
        }
      }
      i = end;
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
        let version = tkhd[0];
        let index = version === 0 ? 12 : 20;
        let trackId = tkhd[index]     << 24 |
                      tkhd[index + 1] << 16 |
                      tkhd[index + 2] <<  8 |
                      tkhd[index + 3];

        trackId = trackId < 0 ? 4294967296 + trackId : trackId;

        const mdhd = MP4Demuxer.findBox(trak, ['mdia', 'mdhd'])[0];
        if (mdhd) {
          version = mdhd[0];
          index = version === 0 ? 12 : 20;
          const timescale = mdhd[index]     << 24 |
                            mdhd[index + 1] << 16 |
                            mdhd[index + 2] <<  8 |
                            mdhd[index + 3];

          const hdlr = MP4Demuxer.findBox(trak, ['mdia', 'hdlr'])[0];
          if (hdlr) {
            const hdlrType = MP4Demuxer.bin2str(hdlr.subarray(8, 12));
            let type = { 'soun' : 'audio', 'vide' : 'video'}[hdlrType];
            if (type) {
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
static startDTS(initData, fragment) {
  var trafs, baseTimes, result;

  // we need info from two childrend of each track fragment box
  trafs = MP4Demuxer.findBox(fragment, ['moof', 'traf']);

  // determine the start times for each track
  baseTimes = [].concat.apply([], trafs.map(function(traf) {
    return MP4Demuxer.findBox(traf, ['tfhd']).map(function(tfhd) {
      var id, scale, baseTime;

      // get the track id from the tfhd
      id = tfhd[4] << 24 |
           tfhd[5] << 16 |
           tfhd[6] << 8 |
           tfhd[7];
      // assume a 90kHz clock if no timescale was specified
      scale = initData[id].timescale || 90e3;

      // get the base media decode time from the tfdt
      baseTime = MP4Demuxer.findBox(traf, ['tfdt']).map(function(tfdt) {
        var version, result;

        version = tfdt[0];
        result = tfdt[4] << 24 |
                 tfdt[5] << 16 |
                 tfdt[6] <<  8 |
                 tfdt[7];
        if (version ===  1) {
          result *= Math.pow(2, 32);
          result += tfdt[8]  << 24 |
                    tfdt[9]  << 16 |
                    tfdt[10] <<  8 |
                    tfdt[11];
        }
        return result;
      })[0];
      baseTime = baseTime || Infinity;

      // convert base time to seconds
      return baseTime / scale;
    });
  }));

  // return the minimum
  result = Math.min.apply(null, baseTimes);
  return isFinite(result) ? result : 0;
}

  // feed incoming data to the front of the parsing pipeline
  append(data, timeOffset,contiguous,accurateTimeOffset) {
    const initData = this.initData;
    const startDTS = MP4Demuxer.startDTS(initData,data);
    this.remuxer.remux(initData.audio, initData.video, null, null, startDTS, contiguous,accurateTimeOffset,data);
  }

  destroy() {
  }

}

export default MP4Demuxer;
