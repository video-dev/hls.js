/**
 * highly optimized TS demuxer:
 * parse PAT, PMT
 * extract PES packet from audio and video PIDs
 * extract AVC/H264 NAL units and AAC/ADTS samples from PES packet
 * trigger the remuxer upon parsing completion
 * it also tries to workaround as best as it can audio codec switch (HE-AAC to AAC and vice versa), without having to restart the MediaSource.
 * it also controls the remuxing process :
 * upon discontinuity or level switch detection, it will also notifies the remuxer so that it can reset its state.
*/

 import ADTS from './adts';
 import Event from '../events';
 import ExpGolomb from './exp-golomb';
// import Hex from '../utils/hex';
 import {logger} from '../utils/logger';
 import {ErrorTypes, ErrorDetails} from '../errors';

 class TSDemuxer {

  constructor(observer, id, remuxerClass, config) {
    this.observer = observer;
    this.id = id;
    this.remuxerClass = remuxerClass;
    this.config = config;
    this.lastCC = 0;
    this.remuxer = new this.remuxerClass(observer, id, config);
  }

  static probe(data) {
    // a TS fragment should contain at least 3 TS packets, a PAT, a PMT, and one PID, each starting with 0x47
    if (data.length >= 3*188 && data[0] === 0x47 && data[188] === 0x47 && data[2*188] === 0x47) {
      return true;
    } else {
      return false;
    }
  }

  switchLevel() {
    this.pmtParsed = false;
    this._pmtId = -1;
    this._avcTrack = {container : 'video/mp2t', type: 'video', id :-1, sequenceNumber: 0, samples : [], len : 0, dropped : 0};
    this._aacTrack = {container : 'video/mp2t', type: 'audio', id :-1, sequenceNumber: 0, samples : [], len : 0};
    this._id3Track = {type: 'id3', id :-1, sequenceNumber: 0, samples : [], len : 0};
    this._txtTrack = {type: 'text', id: -1, sequenceNumber: 0, samples : [], len : 0};
    // flush any partial content
    this.aacOverFlow = null;
    this.aacLastPTS = null;
    this.avcSample = null;
    this.remuxer.switchLevel();
  }

  insertDiscontinuity() {
    this.switchLevel();
    this.remuxer.insertDiscontinuity();
  }

  // feed incoming data to the front of the parsing pipeline
  push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration,accurateTimeOffset) {
    var start, len = data.length, stt, pid, atf, offset,pes,
        codecsOnly = this.remuxer.passthrough,
        unknownPIDs = false;

    this.audioCodec = audioCodec;
    this.videoCodec = videoCodec;
    this._duration = duration;
    this.contiguous = false;
    this.accurateTimeOffset = accurateTimeOffset;
    if (cc !== this.lastCC) {
      logger.log('discontinuity detected');
      this.insertDiscontinuity();
      this.lastCC = cc;
    }
    if (level !== this.lastLevel) {
      logger.log('level switch detected');
      this.switchLevel();
      this.lastLevel = level;
    } else if (sn === (this.lastSN+1)) {
      this.contiguous = true;
    }
    this.lastSN = sn;

    var pmtParsed = this.pmtParsed,
        avcTrack = this._avcTrack,
        aacTrack = this._aacTrack,
        id3Track = this._id3Track,
        avcId = avcTrack.id,
        aacId = aacTrack.id,
        id3Id = id3Track.id,
        pmtId = this._pmtId,
        avcData = avcTrack.pesData,
        aacData = aacTrack.pesData,
        id3Data = id3Track.pesData,
        parsePAT = this._parsePAT,
        parsePMT = this._parsePMT,
        parsePES = this._parsePES,
        parseAVCPES = this._parseAVCPES.bind(this),
        parseAACPES = this._parseAACPES.bind(this),
        parseID3PES  = this._parseID3PES.bind(this);

    // don't parse last TS packet if incomplete
    len -= len % 188;
    // loop through TS packets
    for (start = 0; start < len; start += 188) {
      if (data[start] === 0x47) {
        stt = !!(data[start + 1] & 0x40);
        // pid is a 13-bit field starting at the last bit of TS[1]
        pid = ((data[start + 1] & 0x1f) << 8) + data[start + 2];
        atf = (data[start + 3] & 0x30) >> 4;
        // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
        if (atf > 1) {
          offset = start + 5 + data[start + 4];
          // continue if there is only adaptation field
          if (offset === (start + 188)) {
            continue;
          }
        } else {
          offset = start + 4;
        }
        switch(pid) {
          case avcId:
            if (stt) {
              if (avcData && (pes = parsePES(avcData))) {
                parseAVCPES(pes,false);
                if (codecsOnly) {
                  // if we have video codec info AND
                  // if audio PID is undefined OR if we have audio codec info,
                  // we have all codec info !
                  if (avcTrack.codec && (aacId === -1 || aacTrack.codec)) {
                    this.remux(level,sn,data,timeOffset);
                    return;
                  }
                }
              }
              avcData = {data: [], size: 0};
            }
            if (avcData) {
              avcData.data.push(data.subarray(offset, start + 188));
              avcData.size += start + 188 - offset;
            }
            break;
          case aacId:
            if (stt) {
              if (aacData && (pes = parsePES(aacData))) {
                parseAACPES(pes);
                if (codecsOnly) {
                  // here we now that we have audio codec info
                  // if video PID is undefined OR if we have video codec info,
                  // we have all codec infos !
                  if (aacTrack.codec && (avcId === -1 || avcTrack.codec)) {
                    this.remux(level,sn,data,timeOffset);
                    return;
                  }
                }
              }
              aacData = {data: [], size: 0};
            }
            if (aacData) {
              aacData.data.push(data.subarray(offset, start + 188));
              aacData.size += start + 188 - offset;
            }
            break;
          case id3Id:
            if (stt) {
              if (id3Data && (pes = parsePES(id3Data))) {
                parseID3PES(pes);
              }
              id3Data = {data: [], size: 0};
            }
            if (id3Data) {
              id3Data.data.push(data.subarray(offset, start + 188));
              id3Data.size += start + 188 - offset;
            }
            break;
          case 0:
            if (stt) {
              offset += data[offset] + 1;
            }
            pmtId = this._pmtId = parsePAT(data, offset);
            break;
          case pmtId:
            if (stt) {
              offset += data[offset] + 1;
            }
            let parsedPIDs = parsePMT(data, offset);

            // only update track id if track PID found while parsing PMT
            // this is to avoid resetting the PID to -1 in case
            // track PID transiently disappears from the stream
            // this could happen in case of transient missing audio samples for example
            avcId = parsedPIDs.avc;
            if (avcId > 0) {
              avcTrack.id = avcId;
            }
            aacId = parsedPIDs.aac;
            if (aacId > 0) {
              aacTrack.id = aacId;
            }
            id3Id = parsedPIDs.id3;
            if (id3Id > 0) {
              id3Track.id = id3Id;
            }
            if (unknownPIDs && !pmtParsed) {
              logger.log('reparse from beginning');
              unknownPIDs = false;
              // we set it to -188, the += 188 in the for loop will reset start to 0
              start = -188;
            }
            pmtParsed = this.pmtParsed = true;
            break;
          case 17:
          case 0x1fff:
            break;
          default:
            unknownPIDs = true;
            break;
        }
      } else {
        this.observer.trigger(Event.ERROR, {type : ErrorTypes.MEDIA_ERROR, id : this.id, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'TS packet did not start with 0x47'});
      }
    }
    // try to parse last PES packets
    if (avcData && (pes = parsePES(avcData))) {
      parseAVCPES(pes,true);
      avcTrack.pesData = null;
    } else {
      // either avcData null or PES truncated, keep it for next frag parsing
      avcTrack.pesData = avcData;
    }

    if (aacData && (pes = parsePES(aacData))) {
      parseAACPES(pes);
      aacTrack.pesData = null;
    } else {
      if (aacData && aacData.size) {
        logger.log('last AAC PES packet truncated,might overlap between fragments');
      }
     // either aacData null or PES truncated, keep it for next frag parsing
      aacTrack.pesData = aacData;
    }

    if (id3Data && (pes = parsePES(id3Data))) {
      parseID3PES(pes);
      id3Track.pesData = null;
    } else {
      // either id3Data null or PES truncated, keep it for next frag parsing
      id3Track.pesData = id3Data;
    }
    this.remux(level,sn,null,timeOffset);
  }

  remux(level, sn, data, timeOffset) {
    let avcTrack = this._avcTrack, samples = avcTrack.samples;

    // compute total/avc sample length and nb of NAL units
    let trackData = samples.reduce(function(prevSampleData,curSample) {
      let sampleData = curSample.units.units.reduce(function(prevUnitData,curUnit) {
      return {
        len : prevUnitData.len+curUnit.data.length,
        nbNalu : prevUnitData.nbNalu+1
        };
      },{len : 0, nbNalu : 0});
      curSample.length = sampleData.len;
      return {
        len : prevSampleData.len+sampleData.len,
        nbNalu : prevSampleData.nbNalu+sampleData.nbNalu
    };},{len : 0, nbNalu : 0});
     avcTrack.len = trackData.len;
     avcTrack.nbNalu = trackData.nbNalu;
    this.remuxer.remux(level, sn, this._aacTrack, this._avcTrack, this._id3Track, this._txtTrack, timeOffset, this.contiguous, this.accurateTimeOffset, data);
  }

  destroy() {
    this.switchLevel();
    this._initPTS = this._initDTS = undefined;
    this._duration = 0;
  }

  _parsePAT(data, offset) {
    // skip the PSI header and parse the first PMT entry
    return (data[offset + 10] & 0x1F) << 8 | data[offset + 11];
    //logger.log('PMT PID:'  + this._pmtId);
  }

  _parsePMT(data, offset) {
    var sectionLength, tableEnd, programInfoLength, pid, result = { aac : -1, avc : -1, id3 : -1};
    sectionLength = (data[offset + 1] & 0x0f) << 8 | data[offset + 2];
    tableEnd = offset + 3 + sectionLength - 4;
    // to determine where the table is, we have to figure out how
    // long the program info descriptors are
    programInfoLength = (data[offset + 10] & 0x0f) << 8 | data[offset + 11];
    // advance the offset to the first entry in the mapping table
    offset += 12 + programInfoLength;
    while (offset < tableEnd) {
      pid = (data[offset + 1] & 0x1F) << 8 | data[offset + 2];
      switch(data[offset]) {
        // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
        case 0x0f:
          //logger.log('AAC PID:'  + pid);
          if (result.aac === -1) {
            result.aac = pid;
          }
          break;
        // Packetized metadata (ID3)
        case 0x15:
          //logger.log('ID3 PID:'  + pid);
          if (result.id3 === -1) {
            result.id3 = pid;
          }
          break;
        // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
        case 0x1b:
          //logger.log('AVC PID:'  + pid);
          if (result.avc === -1) {
            result.avc = pid;
          }
          break;
        case 0x24:
          logger.warn('HEVC stream type found, not supported for now');
          break;
        default:
          logger.log('unkown stream type:'  + data[offset]);
          break;
      }
      // move to the next table entry
      // skip past the elementary stream descriptors, if present
      offset += ((data[offset + 3] & 0x0F) << 8 | data[offset + 4]) + 5;
    }
    return result;
  }

  _parsePES(stream) {
    var i = 0, frag, pesFlags, pesPrefix, pesLen, pesHdrLen, pesData, pesPts, pesDts, payloadStartOffset, data = stream.data;
    // safety check
    if (!stream || stream.size === 0) {
      return null;
    }

    // we might need up to 19 bytes to read PES header
    // if first chunk of data is less than 19 bytes, let's merge it with following ones until we get 19 bytes
    // usually only one merge is needed (and this is rare ...)
    while(data[0].length < 19 && data.length > 1) {
      let newData = new Uint8Array(data[0].length + data[1].length);
      newData.set(data[0]);
      newData.set(data[1], data[0].length);
      data[0] = newData;
      data.splice(1,1);
    }
    //retrieve PTS/DTS from first fragment
    frag = data[0];
    pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
    if (pesPrefix === 1) {
      pesLen = (frag[4] << 8) + frag[5];
      // if PES parsed length is not zero and greater than total received length, stop parsing. PES might be truncated
      // minus 6 : PES header size
      if (pesLen && pesLen > stream.size - 6) {
        return null;
      }
      pesFlags = frag[7];
      if (pesFlags & 0xC0) {
        /* PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
            as PTS / DTS is 33 bit we cannot use bitwise operator in JS,
            as Bitwise operators treat their operands as a sequence of 32 bits */
        pesPts = (frag[9] & 0x0E) * 536870912 +// 1 << 29
          (frag[10] & 0xFF) * 4194304 +// 1 << 22
          (frag[11] & 0xFE) * 16384 +// 1 << 14
          (frag[12] & 0xFF) * 128 +// 1 << 7
          (frag[13] & 0xFE) / 2;
          // check if greater than 2^32 -1
          if (pesPts > 4294967295) {
            // decrement 2^33
            pesPts -= 8589934592;
          }
        if (pesFlags & 0x40) {
          pesDts = (frag[14] & 0x0E ) * 536870912 +// 1 << 29
            (frag[15] & 0xFF ) * 4194304 +// 1 << 22
            (frag[16] & 0xFE ) * 16384 +// 1 << 14
            (frag[17] & 0xFF ) * 128 +// 1 << 7
            (frag[18] & 0xFE ) / 2;
          // check if greater than 2^32 -1
          if (pesDts > 4294967295) {
            // decrement 2^33
            pesDts -= 8589934592;
          }
        } else {
          pesDts = pesPts;
        }
      }
      pesHdrLen = frag[8];
      // 9 bytes : 6 bytes for PES header + 3 bytes for PES extension
      payloadStartOffset = pesHdrLen + 9;

      stream.size -= payloadStartOffset;
      //reassemble PES packet
      pesData = new Uint8Array(stream.size);
      while (data.length) {
        frag = data.shift();
        var len = frag.byteLength;
        if (payloadStartOffset) {
          if (payloadStartOffset > len) {
            // trim full frag if PES header bigger than frag
            payloadStartOffset-=len;
            continue;
          } else {
            // trim partial frag if PES header smaller than frag
            frag = frag.subarray(payloadStartOffset);
            len-=payloadStartOffset;
            payloadStartOffset = 0;
          }
        }
        pesData.set(frag, i);
        i+=len;
      }
      if (pesLen) {
        // payload size : remove PES header + PES extension
        pesLen -= pesHdrLen+3;
      }
      return {data: pesData, pts: pesPts, dts: pesDts, len: pesLen};
    } else {
      return null;
    }
  }

  pushAccesUnit(avcSample,avcTrack) {
    if (avcSample.units.units.length) {
      // only push AVC sample if starting with a keyframe is not mandatory OR
      //    if keyframe already found in this fragment OR
      //       keyframe found in last fragment (track.sps) AND
      //          samples already appended (we already found a keyframe in this fragment) OR fragment is contiguous
      if (!this.config.forceKeyFrameOnDiscontinuity ||
          avcSample.key === true ||
          (avcTrack.sps && (avcTrack.samples.length || this.contiguous))) {
        avcTrack.samples.push(avcSample);
      } else {
        // dropped samples, track it
        avcTrack.dropped++;
      }
    }
    if(avcSample.debug.length) {
      logger.log(avcSample.pts + '/' + avcSample.dts + ':' + avcSample.debug + ',' + avcSample.units.length);
    }
  }

  _parseAVCPES(pes,last) {
    //logger.log('parse new PES');
    var track = this._avcTrack,
        units = this._parseAVCNALu(pes.data),
        debug = false,
        expGolombDecoder,
        avcSample = this.avcSample,
        push,
        i;
    //free pes.data to save up some memory
    pes.data = null;

    units.forEach(unit => {
      switch(unit.type) {
        //NDR
         case 1:
           push = true;
           if(debug && avcSample) {
            avcSample.debug += 'NDR ';
           }
           break;
        //IDR
        case 5:
          push = true;
          // handle PES not starting with AUD
          if (!avcSample) {
            avcSample = this.avcSample = this._createAVCSample(true,pes.pts,pes.dts,'');
          }
          if(debug) {
            avcSample.debug += 'IDR ';
          }
          avcSample.key = true;
          break;
        //SEI
        case 6:
          push = true;
          if(debug && avcSample) {
            avcSample.debug += 'SEI ';
          }
          expGolombDecoder = new ExpGolomb(this.discardEPB(unit.data));

          // skip frameType
          expGolombDecoder.readUByte();

          var payloadType = 0;
          var payloadSize = 0;
          var endOfCaptions = false;
          var b = 0;

          while (!endOfCaptions && expGolombDecoder.bytesAvailable > 1) {
            payloadType = 0;
            do {
                b = expGolombDecoder.readUByte();
                payloadType += b;
            } while (b === 0xFF);

            // Parse payload size.
            payloadSize = 0;
            do {
                b = expGolombDecoder.readUByte();
                payloadSize += b;
            } while (b === 0xFF);

            // TODO: there can be more than one payload in an SEI packet...
            // TODO: need to read type and size in a while loop to get them all
            if (payloadType === 4 && expGolombDecoder.bytesAvailable !== 0) {

              endOfCaptions = true;

              var countryCode = expGolombDecoder.readUByte();

              if (countryCode === 181) {
                var providerCode = expGolombDecoder.readUShort();

                if (providerCode === 49) {
                  var userStructure = expGolombDecoder.readUInt();

                  if (userStructure === 0x47413934) {
                    var userDataType = expGolombDecoder.readUByte();

                    // Raw CEA-608 bytes wrapped in CEA-708 packet
                    if (userDataType === 3) {
                      var firstByte = expGolombDecoder.readUByte();
                      var secondByte = expGolombDecoder.readUByte();

                      var totalCCs = 31 & firstByte;
                      var byteArray = [firstByte, secondByte];

                      for (i = 0; i < totalCCs; i++) {
                        // 3 bytes per CC
                        byteArray.push(expGolombDecoder.readUByte());
                        byteArray.push(expGolombDecoder.readUByte());
                        byteArray.push(expGolombDecoder.readUByte());
                      }

                      this._insertSampleInOrder(this._txtTrack.samples, { type: 3, pts: pes.pts, bytes: byteArray });
                    }
                  }
                }
              }
            }
            else if (payloadSize < expGolombDecoder.bytesAvailable)
            {
              for (i = 0; i<payloadSize; i++)
              {
                expGolombDecoder.readUByte();
              }
            }
          }
          break;
        //SPS
        case 7:
          push = true;
          if(debug && avcSample) {
            avcSample.debug += 'SPS ';
          }
          if(!track.sps) {
            expGolombDecoder = new ExpGolomb(unit.data);
            var config = expGolombDecoder.readSPS();
            track.width = config.width;
            track.height = config.height;
            track.sps = [unit.data];
            track.duration = this._duration;
            var codecarray = unit.data.subarray(1, 4);
            var codecstring = 'avc1.';
            for (i = 0; i < 3; i++) {
              var h = codecarray[i].toString(16);
              if (h.length < 2) {
                h = '0' + h;
              }
              codecstring += h;
            }
            track.codec = codecstring;
          }
          break;
        //PPS
        case 8:
          push = true;
          if(debug && avcSample) {
            avcSample.debug += 'PPS ';
          }
          if (!track.pps) {
            track.pps = [unit.data];
          }
          break;
        // AUD
        case 9:
          push = false;
          if (avcSample) {
            this.pushAccesUnit(avcSample,track);
          }
          avcSample = this.avcSample = this._createAVCSample(false,pes.pts,pes.dts,debug ? 'AUD ': '');
          break;
        // Filler Data
        case 12:
          push = false;
          break;
        default:
          push = false;
          if (avcSample) {
            avcSample.debug += 'unknown NAL ' + unit.type + ' ';
          }
          break;
      }
      if(avcSample && push) {
        let units = avcSample.units;
        units.units.push(unit);
      }
    });
    // if last PES packet, push samples
    if (last && avcSample) {
      this.pushAccesUnit(avcSample,track);
      this.avcSample = null;
    }
  }

  _createAVCSample(key,pts,dts,debug) {
    return { key : key, pts : pts, dts : dts, units : { units : [], length : 0}, debug : debug};
  }

  _insertSampleInOrder(arr, data) {
    var len = arr.length;
    if (len > 0) {
      if (data.pts >= arr[len-1].pts)
      {
        arr.push(data);
      }
      else {
        for (var pos = len - 1; pos >= 0; pos--) {
          if (data.pts < arr[pos].pts) {
            arr.splice(pos, 0, data);
            break;
          }
        }
      }
    }
    else {
      arr.push(data);
    }
  }

  _getLastNalUnit() {
    let avcSample = this.avcSample, lastUnit;
    // try to fallback to previous sample if current one is empty
    if (!avcSample || avcSample.units.units.length === 0) {
      let track = this._avcTrack, samples = track.samples;
      avcSample = samples[samples.length-1];
    }
    if (avcSample) {
      let units = avcSample.units.units;
      lastUnit = units[units.length - 1];
    }
    return lastUnit;
  }

  _parseAVCNALu(array) {
    var i = 0, len = array.byteLength, value, overflow, track = this._avcTrack, state = track.naluState || 0, lastState = state;
    var units = [], unit, unitType, lastUnitStart = -1, lastUnitType;
    //logger.log('PES:' + Hex.hexDump(array));
    while (i < len) {
      value = array[i++];
      // finding 3 or 4-byte start codes (00 00 01 OR 00 00 00 01)
      switch (state) {
        case 0:
          if (value === 0) {
            state = 1;
          }
          break;
        case 1:
          if( value === 0) {
            state = 2;
          } else {
            state = 0;
          }
          break;
        case 2:
        case 3:
          if( value === 0) {
            state = 3;
          } else if (value === 1) {
            if (lastUnitStart >=0) {
              unit = {data: array.subarray(lastUnitStart, i - state - 1), type: lastUnitType};
              //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
              units.push(unit);
            } else {
              // lastUnitStart is undefined => this is the first start code found in this PES packet
              // first check if start code delimiter is overlapping between 2 PES packets,
              // ie it started in last packet (lastState not zero)
              // and ended at the beginning of this PES packet (i <= 4 - lastState)
              let lastUnit = this._getLastNalUnit();
              if (lastUnit) {
                if(lastState &&  (i <= 4 - lastState)) {
                  // start delimiter overlapping between PES packets
                  // strip start delimiter bytes from the end of last NAL unit
                    // check if lastUnit had a state different from zero
                  if (lastUnit.state) {
                    // strip last bytes
                    lastUnit.data = lastUnit.data.subarray(0,lastUnit.data.byteLength - lastState);
                  }
                }
                // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
                overflow  = i - state - 1;
                if (overflow > 0) {
                  //logger.log('first NALU found with overflow:' + overflow);
                  let tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
                  tmp.set(lastUnit.data, 0);
                  tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
                  lastUnit.data = tmp;
                }
              }
            }
            // check if we can read unit type
            if (i < len) {
              unitType = array[i] & 0x1f;
              //logger.log('find NALU @ offset:' + i + ',type:' + unitType);
              lastUnitStart = i;
              lastUnitType = unitType;
              state = 0;
            } else {
              // not enough byte to read unit type. let's read it on next PES parsing
              state = -1;
            }
          } else {
            state = 0;
          }
          break;
        case -1:
        // special use case where we found 3 or 4-byte start codes exactly at the end of previous PES packet
          lastUnitStart = 0;
          // NALu type is value read from offset 0
          lastUnitType = value & 0x1f;
          state = 0;
          break;
        default:
          break;
      }
    }
    if (lastUnitStart >=0 && state >=0) {
      unit = {data: array.subarray(lastUnitStart, len), type: lastUnitType, state : state};
      units.push(unit);
      //logger.log('pushing NALU, type/size/state:' + unit.type + '/' + unit.data.byteLength + '/' + state);
    }
    // no NALu found
    if (units.length === 0) {
      // append pes.data to previous NAL unit
      let  lastUnit = this._getLastNalUnit();
      if (lastUnit) {
        let tmp = new Uint8Array(lastUnit.data.byteLength + array.byteLength);
        tmp.set(lastUnit.data, 0);
        tmp.set(array, lastUnit.data.byteLength);
        lastUnit.data = tmp;
      }
    }
    track.naluState = state;
    return units;
  }

  /**
   * remove Emulation Prevention bytes from a RBSP
   */
  discardEPB(data) {
    var length = data.byteLength,
        EPBPositions = [],
        i = 1,
        newLength, newData;

    // Find all `Emulation Prevention Bytes`
    while (i < length - 2) {
      if (data[i] === 0 &&
          data[i + 1] === 0 &&
          data[i + 2] === 0x03) {
        EPBPositions.push(i + 2);
        i += 2;
      } else {
        i++;
      }
    }

    // If no Emulation Prevention Bytes were found just return the original
    // array
    if (EPBPositions.length === 0) {
      return data;
    }

    // Create a new array to hold the NAL unit data
    newLength = length - EPBPositions.length;
    newData = new Uint8Array(newLength);
    var sourceIndex = 0;

    for (i = 0; i < newLength; sourceIndex++, i++) {
      if (sourceIndex === EPBPositions[0]) {
        // Skip this byte
        sourceIndex++;
        // Remove this position index
        EPBPositions.shift();
      }
      newData[i] = data[sourceIndex];
    }
    return newData;
  }

  _parseAACPES(pes) {
    var track = this._aacTrack,
        data = pes.data,
        pts = pes.pts,
        startOffset = 0,
        aacOverFlow = this.aacOverFlow,
        aacLastPTS = this.aacLastPTS,
        config, frameLength, frameDuration, frameIndex, offset, headerLength, stamp, len, aacSample;
    if (aacOverFlow) {
      var tmp = new Uint8Array(aacOverFlow.byteLength + data.byteLength);
      tmp.set(aacOverFlow, 0);
      tmp.set(data, aacOverFlow.byteLength);
      //logger.log(`AAC: append overflowing ${aacOverFlow.byteLength} bytes to beginning of new PES`);
      data = tmp;
    }
    // look for ADTS header (0xFFFx)
    for (offset = startOffset, len = data.length; offset < len - 1; offset++) {
      if ((data[offset] === 0xff) && (data[offset+1] & 0xf0) === 0xf0) {
        break;
      }
    }
    // if ADTS header does not start straight from the beginning of the PES payload, raise an error
    if (offset) {
      var reason, fatal;
      if (offset < len - 1) {
        reason = `AAC PES did not start with ADTS header,offset:${offset}`;
        fatal = false;
      } else {
        reason = 'no ADTS header found in AAC PES';
        fatal = true;
      }
      logger.warn(`parsing error:${reason}`);
      this.observer.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, id : this.id, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: fatal, reason: reason});
      if (fatal) {
        return;
      }
    }
    if (!track.audiosamplerate) {
      config = ADTS.getAudioConfig(this.observer,data, offset, this.audioCodec);
      track.config = config.config;
      track.audiosamplerate = config.samplerate;
      track.channelCount = config.channelCount;
      track.codec = config.codec;
      track.duration = this._duration;
      logger.log(`parsed codec:${track.codec},rate:${config.samplerate},nb channel:${config.channelCount}`);
    }
    frameIndex = 0;
    frameDuration = 1024 * 90000 / track.audiosamplerate;

    // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
    // first sample PTS should be equal to last sample PTS + frameDuration
    if(aacOverFlow && aacLastPTS) {
      var newPTS = aacLastPTS+frameDuration;
      if(Math.abs(newPTS-pts) > 1) {
        logger.log(`AAC: align PTS for overlapping frames by ${Math.round((newPTS-pts)/90)}`);
        pts=newPTS;
      }
    }

    while ((offset + 5) < len) {
      // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
      headerLength = (!!(data[offset + 1] & 0x01) ? 7 : 9);
      // retrieve frame size
      frameLength = ((data[offset + 3] & 0x03) << 11) |
                     (data[offset + 4] << 3) |
                    ((data[offset + 5] & 0xE0) >>> 5);
      frameLength  -= headerLength;
      //stamp = pes.pts;

      if ((frameLength > 0) && ((offset + headerLength + frameLength) <= len)) {
        stamp = pts + frameIndex * frameDuration;
        //logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);
        aacSample = {unit: data.subarray(offset + headerLength, offset + headerLength + frameLength), pts: stamp, dts: stamp};
        track.samples.push(aacSample);
        track.len += frameLength;
        offset += frameLength + headerLength;
        frameIndex++;
        // look for ADTS header (0xFFFx)
        for ( ; offset < (len - 1); offset++) {
          if ((data[offset] === 0xff) && ((data[offset + 1] & 0xf0) === 0xf0)) {
            break;
          }
        }
      } else {
        break;
      }
    }
    if (offset < len) {
      aacOverFlow = data.subarray(offset, len);
      //logger.log(`AAC: overflow detected:${len-offset}`);
    } else {
      aacOverFlow = null;
    }
    this.aacOverFlow = aacOverFlow;
    this.aacLastPTS = stamp;
  }

  _parseID3PES(pes) {
    this._id3Track.samples.push(pes);
  }
}

export default TSDemuxer;
