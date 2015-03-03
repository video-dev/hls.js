/**
 * A stream-based mp2ts to mp4 converter. This utility is used to
 * deliver mp4s to a SourceBuffer on platforms that support native
 * Media Source Extensions.
 */

 import Event           from '../events';
 import ExpGolomb       from './exp-golomb';
// import Hex             from '../utils/hex';
 import MP4             from '../remux/mp4-generator';
// import MP4Inspect      from '../remux/mp4-inspector';
 import observer        from '../observer';
 import {logger}        from '../utils/logger';

 class TSDemuxer {

  constructor() {
    this.switchLevel();
  }

  switchLevel() {
    this.pmtParsed = false;
    this._pmtId = this._avcId = this._aacId = -1;
    this._avcTrack = {type : 'video', sequenceNumber : 0};
    this._aacTrack = {type : 'audio', sequenceNumber : 0};
    this._avcSamples = [];
    this._avcSamplesLength = 0;
    this._avcSamplesNbNalu = 0;
    this._aacSamples = [];
    this._aacSamplesLength = 0;
    this._initSegGenerated = false;
  }

  set duration(duration) {
    this._duration = duration;
  }

  get duration() {
    return this._duration;
  }

  // feed incoming data to the front of the parsing pipeline
  push(data) {
    var offset;
    for(offset = 0; offset < data.length ; offset += 188) {
      this._parseTSPacket(data,offset);
    }
  }
  // flush any buffered data
  end() {
    if(this._avcData) {
      this._parseAVCPES(this._parsePES(this._avcData));
      this._avcData = null;
    }
    //logger.log('nb AVC samples:' + this._avcSamples.length);
    if(this._avcSamples.length) {
      this._flushAVCSamples();
    }
    if(this._aacData) {
      this._parseAACPES(this._parsePES(this._aacData));
      this._aacData = null;
    }
    //logger.log('nb AAC samples:' + this._aacSamples.length);
    if(this._aacSamples.length) {
      this._flushAACSamples();
    }
    //notify end of parsing
    observer.trigger(Event.FRAGMENT_PARSED);
  }

  destroy() {
    this._duration = 0;
  }

  _parseTSPacket(data,start) {
    var stt,pid,atf,offset;
    if(data[start] === 0x47) {
      stt = !!(data[start+1] & 0x40);
      // pid is a 13-bit field starting at the last bit of TS[1]
      pid = ((data[start+1] & 0x1f) << 8) + data[start+2];
      atf = (data[start+3] & 0x30) >> 4;
      // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
      if(atf > 1) {
        offset = start+5+data[start+4];
        // return if there is only adaptation field
        if(offset === (start+188)) {
          return;
        }
      } else {
        offset = start+4;
      }
      if(this.pmtParsed) {
        if(pid === this._avcId) {
          if(stt) {
            if(this._avcData) {
              this._parseAVCPES(this._parsePES(this._avcData));
            }
            this._avcData = {data: [],size: 0};
          }
          this._avcData.data.push(data.subarray(offset,start+188));
          this._avcData.size+=start+188-offset;
        } else if(pid === this._aacId) {
          if(stt) {
            if(this._aacData) {
              this._parseAACPES(this._parsePES(this._aacData));
            }
            this._aacData = {data: [],size: 0};
          }
          this._aacData.data.push(data.subarray(offset,start+188));
          this._aacData.size+=start+188-offset;
        }
      } else {
        if(stt) {
          offset += data[offset] + 1;
        }
        if(pid === 0) {
          this._parsePAT(data,offset);
        } else if(pid === this._pmtId) {
          this._parsePMT(data,offset);
          this.pmtParsed = true;
        }
      }
    } else {
      logger.log('parsing error');
    }
  }

  _parsePAT(data,offset) {
    // skip the PSI header and parse the first PMT entry
    this._pmtId  = (data[offset+10] & 0x1F) << 8 | data[offset+11];
    logger.log('PMT PID:'  + this._pmtId);
  }

  _parsePMT(data,offset) {
    var sectionLength,tableEnd,programInfoLength,pid;
    sectionLength = (data[offset+1] & 0x0f) << 8 | data[offset+2];
    tableEnd = offset + 3 + sectionLength - 4;
    // to determine where the table is, we have to figure out how
    // long the program info descriptors are
    programInfoLength = (data[offset+10] & 0x0f) << 8 | data[offset+11];

    // advance the offset to the first entry in the mapping table
    offset += 12 + programInfoLength;
    while (offset < tableEnd) {
      pid = (data[offset + 1] & 0x1F) << 8 | data[offset + 2];
      switch(data[offset]) {
        // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
        case 0x0f:
        logger.log('AAC PID:'  + pid);
        this._aacId = pid;
        this._aacTrack.id = pid;
        break;
        // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
        case 0x1b:
        logger.log('AVC PID:'  + pid);
        this._avcId = pid;
        this._avcTrack.id = pid;
        break;
        default:
        logger.log('unkown stream type:'  + data[offset]);
        break;
      }
      // move to the next table entry
      // skip past the elementary stream descriptors, if present
      offset += ((data[offset + 3] & 0x0F) << 8 | data[offset + 4]) + 5;
    }
  }

  _parsePES(stream) {
    var i = 0,frag,pesFlags,pesPrefix,pesLen,pesHdrLen,pesData,pesPts,pesDts,payloadStartOffset;
    //retrieve PTS/DTS from first fragment
    frag = stream.data[0];
    pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
    if(pesPrefix === 1) {
      pesLen = (frag[4] << 8) + frag[5];
      pesFlags = frag[7];
      if (pesFlags & 0xC0) {
        // PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
        pesPts = (frag[9] & 0x0E) << 28
          | (frag[10] & 0xFF) << 21
          | (frag[11] & 0xFE) << 13
          | (frag[12] & 0xFF) <<  6
          | (frag[13] & 0xFE) >>>  2;
        pesPts /= 45;
        if (pesFlags & 0x40) {
          pesDts = (frag[14] & 0x0E ) << 28
            | (frag[15] & 0xFF ) << 21
            | (frag[16] & 0xFE ) << 13
            | (frag[17] & 0xFF ) << 6
            | (frag[18] & 0xFE ) >>> 2;
          pesDts /= 45;
        } else {
          pesDts = pesPts;
        }
      }
      pesHdrLen = frag[8];
      payloadStartOffset = pesHdrLen+9;
      // trim PES header
      stream.data[0] = stream.data[0].subarray(payloadStartOffset);
      stream.size -= payloadStartOffset;
      //reassemble PES packet
      pesData = new Uint8Array(stream.size);
      // reassemble the packet
      while (stream.data.length) {
        frag = stream.data.shift();
        pesData.set(frag, i);
        i += frag.byteLength;
      }
      return { data : pesData, pts : pesPts, dts : pesDts, len : pesLen};
    } else {
      return null;
    }
  }

  _parseAVCPES(pes) {
    var units,track = this._avcTrack,avcSample,key = false;
    units = this._parseAVCNALu(pes.data);
    //free pes.data to save up some memory
    pes.data = null;
    units.units.forEach(unit => {
      switch(unit.type) {
        //IDR
        case 5:
          key = true;
          break;
        //SPS
        case 7:
          if(!track.sps) {
            var expGolombDecoder = new ExpGolomb(unit.data);
            var config = expGolombDecoder.readSequenceParameterSet();
            track.width = config.width;
            track.height = config.height;
            track.sps = [unit.data];
            track.duration = 90000*this._duration;
            var codecarray = unit.data.subarray(1,4);
            var codecstring  = 'avc1.';
            for(var i = 0; i < 3; i++) {
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
          if(!track.pps) {
            track.pps = [unit.data];
          }
          break;
        default:
          break;
      }
    });
    //build sample from PES
    // Annex B to MP4 conversion to be done
    avcSample = { units : units, pts : pes.pts, dts : pes.dts , key : key};
    this._avcSamples.push(avcSample);
    this._avcSamplesLength += units.length;
    this._avcSamplesNbNalu += units.units.length;
    // generate Init Segment if needed
    if(!this._initSegGenerated) {
      this._generateInitSegment();
    }
  }


  _flushAVCSamples() {
    var view,i=8,avcSample,mp4Sample,mp4SampleLength,unit,track = this._avcTrack,
        lastSampleDTS,mdat,moof,startOffset,endOffset,
        firstPTS;
    track.samples = [];

    /* concatenate the video data and construct the mdat in place
      (need 8 more bytes to fill length and mpdat type) */
    mdat = new Uint8Array(this._avcSamplesLength + (4 * this._avcSamplesNbNalu)+8);
    view = new DataView(mdat.buffer);
    view.setUint32(0,mdat.byteLength);
    mdat.set(MP4.types.mdat,4);
    while(this._avcSamples.length) {
      avcSample = this._avcSamples.shift();
      mp4SampleLength = 0;

      // convert NALU bitstream to MP4 format (prepend NALU with size field)
      while(avcSample.units.units.length) {
        unit = avcSample.units.units.shift();
        view.setUint32(i, unit.data.byteLength);
        i += 4;
        mdat.set(unit.data, i);
        i += unit.data.byteLength;
        mp4SampleLength+=4+unit.data.byteLength;
      }

      if(lastSampleDTS !== undefined) {
        mp4Sample.duration = (avcSample.dts - lastSampleDTS)*90;
      } else {
        //logger.log('Video/PTS/PTSend:' + avcSample.pts.toFixed(0) + '/unknown');
        // check if fragments are contiguous (i.e. no missing frames between fragment)
        if(this.nextAvcDts && this.nextAvcDts !== avcSample.pts) {
          var delta = avcSample.pts - this.nextAvcDts;
          if(delta > 0 && delta < 300) {
          //logger.log('firstPTS != nextAvcDts:' + avcSample.pts + '/' + this.nextAvcDts);
          avcSample.pts = this.nextAvcDts;
          }
        }
        // remember first PTS of our avcSamples
        firstPTS = avcSample.pts;
      }

      mp4Sample = {
        size: mp4SampleLength,
        compositionTimeOffset: (avcSample.pts - avcSample.dts)*90,
        flags: {
          isLeading: 0,
          isDependedOn: 0,
          hasRedundancy: 0,
          degradationPriority: 0
        }
      };

      if(avcSample.key === true) {
        // the current sample is a key frame
        mp4Sample.flags.dependsOn = 2;
        mp4Sample.flags.isNonSyncSample = 0;
      } else {
        mp4Sample.flags.dependsOn = 1;
        mp4Sample.flags.isNonSyncSample = 1;
      }
      track.samples.push(mp4Sample);
      lastSampleDTS = avcSample.dts;
    }
    mp4Sample.duration = track.samples[track.samples.length-2].duration;
    // next aac sample DTS should be equal to last sample DTS + duration
    this.nextAvcDts = avcSample.dts + mp4Sample.duration/90;
    //logger.log('Video/PTS/PTSend:' + avcSample.pts.toFixed(0) + '/' + (avcSample.pts+(mp4Sample.duration/90)).toFixed(0));

    this._avcSamplesLength = 0;
    this._avcSamplesNbNalu = 0;

    startOffset = (firstPTS - this._initPTS)/1000;
    endOffset = (avcSample.pts - this._initPTS)/1000;

    moof = MP4.moof(track.sequenceNumber++,(firstPTS - this._initPTS)*90,track);
    observer.trigger(Event.FRAGMENT_PARSING,{
      moof: moof,
      mdat: mdat,
      start : startOffset,
      end : endOffset,
      type : 'video'
    });
  }

  _parseAVCNALu(array) {
    var i = 0,len = array.byteLength,value,state = 0;
    var units = [], unit, unitType, lastUnitStart,lastUnitType,length = 0;
    //logger.log('PES:' + Hex.hexDump(array));

    while(i< len) {
      value = array[i++];
      // finding 3 or 4-byte start codes (00 00 01 OR 00 00 00 01)
      switch(state) {
        case 0:
          if(value === 0) {
            state = 1;
          }
          break;
        case 1:
          if(value === 0) {
            state = 2;
          } else {
            state = 0;
          }
          break;
        case 2:
        case 3:
          if(value === 0) {
            state = 3;
          } else if(value === 1) {
            unitType = array[i] & 0x1f;
            //logger.log('find NALU @ offset:' + i + ',type:' + unitType);
            if(lastUnitStart) {
              unit = { data : array.subarray(lastUnitStart,i-state-1), type : lastUnitType};
              length+=i-state-1-lastUnitStart;
              //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
              units.push(unit);
            }
            lastUnitStart = i;
            lastUnitType = unitType;
            if(unitType === 1 || unitType === 5) {
              // OPTI !!! if IDR/NDR unit, consider it is last NALu
              i = len;
            }
            state = 0;
          } else {
            state = 0;
          }
          break;
        default:
          break;
      }
    }
    if(lastUnitStart) {
      unit = { data : array.subarray(lastUnitStart,len), type : lastUnitType};
      length+=len-lastUnitStart;
      units.push(unit);
      //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
    }
    return { units : units , length : length};
  }

  _parseAACPES(pes) {
    //logger.log('PES:' + Hex.hexDump(pes.data));
    var track = this._aacTrack,aacSample,data = pes.data,config,adtsFrameSize,adtsStartOffset,adtsHeaderLen,stamp,i;
    if(data[0] === 0xff) {
      if(!track.audiosamplerate) {
        config = this._parseADTSHeader(pes.data);
        track.config = config.config;
        track.audiosamplerate = config.samplerate;
        track.duration = 90000*this._duration;
        // implicit SBR signalling (HE-AAC) : if sampling rate less than 24kHz
        var codec = (config.samplerate <= 24000) ? 5 : ((track.config[0] & 0xF8) >> 3);
        track.codec = 'mp4a.40.' + codec;
        console.log(track.codec +',rate:' + config.samplerate);
      }
      adtsStartOffset = i = 0;
      while(adtsStartOffset < data.length) {
        // retrieve frame size
        adtsFrameSize = ((data[adtsStartOffset+3] & 0x03) << 11);
        // byte 4
        adtsFrameSize |= (data[adtsStartOffset+4] << 3);
        // byte 5
        adtsFrameSize |= ((data[adtsStartOffset+5] & 0xE0) >>> 5);
        adtsHeaderLen = (!!(data[adtsStartOffset+1] & 0x01) ? 7 : 9);
        adtsFrameSize -= adtsHeaderLen;
        stamp = pes.pts + i*1024*1000/track.audiosamplerate;
        //stamp = pes.pts;
        //console.log('AAC frame, offset/length/pts:' + (adtsStartOffset+7) + '/' + adtsFrameSize + '/' + stamp.toFixed(0));
        aacSample = { unit : pes.data.subarray(adtsStartOffset+adtsHeaderLen,adtsStartOffset+adtsHeaderLen+adtsFrameSize) , pts : stamp, dts : stamp};
        adtsStartOffset+=adtsFrameSize+adtsHeaderLen;
        this._aacSamples.push(aacSample);
        this._aacSamplesLength += adtsFrameSize;
        i++;
      }
    } else {
      observer.trigger(Event.PARSING_ERROR,'Stream did not start with ADTS header.');
      return;
    }
    if(!this._initSegGenerated) {
      this._generateInitSegment();
    }
  }

  _flushAACSamples() {
    var view,i=8,aacSample,mp4Sample,unit,track = this._aacTrack,
        lastSampleDTS,mdat,moof,startOffset,endOffset,
        firstPTS;
    track.samples = [];

    /* concatenate the audio data and construct the mdat in place
      (need 8 more bytes to fill length and mpdat type) */
    mdat = new Uint8Array(this._aacSamplesLength+8);
    view = new DataView(mdat.buffer);
    view.setUint32(0,mdat.byteLength);
    mdat.set(MP4.types.mdat,4);
    while(this._aacSamples.length) {
      aacSample = this._aacSamples.shift();
      unit = aacSample.unit;
      mdat.set(unit, i);
      i += unit.byteLength;

      if(lastSampleDTS !== undefined) {
        // we use DTS to compute sample duration, but we use PTS to compute initPTS which is used to sync audio and video
        mp4Sample.duration = (aacSample.dts - lastSampleDTS)*90;
      } else {
        //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/unknown');
        // check if fragments are contiguous (i.e. no missing frames between fragment)
        if(this.nextAacDts && this.nextAacDts !== aacSample.pts) {
          var delta = aacSample.pts - this.nextAacDts;
          if(delta > 0 && delta < 300) {
          //logger.log('firstPTS != nextAacDts:' + aacSample.pts + '/' + this.nextAacDts);
          aacSample.pts = this.nextAacDts;
          }
        }
        // remember first PTS of our aacSamples
        firstPTS = aacSample.pts;
      }

      mp4Sample = {
        size: unit.byteLength,
        compositionTimeOffset: 0,
        flags: {
          isLeading: 0,
          isDependedOn: 0,
          hasRedundancy: 0,
          degradationPriority: 0,
          dependsOn : 1,
        }
      };
      track.samples.push(mp4Sample);
      lastSampleDTS = aacSample.dts;
    }
    //set last sample duration as being identical to previous sample
    mp4Sample.duration = track.samples[track.samples.length-2].duration;
    // next aac sample DTS should be equal to last sample DTS + duration
    this.nextAacDts = aacSample.dts + mp4Sample.duration/90;
    //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + (aacSample.pts+(mp4Sample.duration/90)).toFixed(0));

    this._aacSamplesLength = 0;

    startOffset = (firstPTS - this._initPTS)/1000;
    endOffset = (aacSample.pts - this._initPTS)/1000;

    moof = MP4.moof(track.sequenceNumber++,(firstPTS - this._initPTS)*90,track);
    observer.trigger(Event.FRAGMENT_PARSING,{
      moof: moof,
      mdat: mdat,
      start : startOffset,
      end : endOffset,
      type : 'audio'
    });
  }

  _parseADTSHeader(data) {
    var adtsObjectType, // :int
        adtsSampleingIndex, // :int
        adtsChanelConfig, // :int
        config,
        adtsSampleingRates = [
            96000, 88200,
            64000, 48000,
            44100, 32000,
            24000, 22050,
            16000, 12000
          ];

    // byte 2
    adtsObjectType = ((data[2] & 0xC0) >>> 6) + 1;
    adtsSampleingIndex = ((data[2] & 0x3C) >>> 2);
    adtsChanelConfig = ((data[2] & 0x01) << 2);

    // byte 3
    adtsChanelConfig |= ((data[3] & 0xC0) >>> 6);
    config = new Uint8Array(2);
  /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config
    Audio Profile
    0: Null
    1: AAC Main
    2: AAC LC (Low Complexity)
    3: AAC SSR (Scalable Sample Rate)
    4: AAC LTP (Long Term Prediction)
    5: SBR (Spectral Band Replication)
    6: AAC Scalable
   sampling freq
    0: 96000 Hz
    1: 88200 Hz
    2: 64000 Hz
    3: 48000 Hz
    4: 44100 Hz
    5: 32000 Hz
    6: 24000 Hz
    7: 22050 Hz
    8: 16000 Hz
    9: 12000 Hz
    10: 11025 Hz
    11: 8000 Hz
    12: 7350 Hz
    13: Reserved
    14: Reserved
    15: frequency is written explictly
    Channel Configurations
    These are the channel configurations:
    0: Defined in AOT Specifc Config
    1: 1 channel: front-center
    2: 2 channels: front-left, front-right
  */
    // audioObjectType = profile => profile, the MPEG-4 Audio Object Type minus 1
    config[0] = adtsObjectType << 3;
    // samplingFrequencyIndex
    config[0] |= (adtsSampleingIndex & 0x0E) >> 1;
    config[1] |= (adtsSampleingIndex & 0x01) << 7;
    // channelConfiguration
    config[1] |= adtsChanelConfig << 3;
    return { config : config, samplerate : adtsSampleingRates[adtsSampleingIndex]};
  }

  _generateInitSegment() {
    if(this._avcId === -1) {
      //audio only
      if(this._aacTrack.config) {
         observer.trigger(Event.INIT_SEGMENT,{
          moov: MP4.initSegment([this._aacTrack]),
          codec : this._aacTrack.codec
        });
        this._initSegGenerated = true;
      }
      if(this._initPTS === undefined) {
        // remember first PTS of this demuxing context
        this._initPTS = this._aacSamples[0].pts;
      }
    } else
    if(this._aacId === -1) {
      //video only
      if(this._avcTrack.sps && this._avcTrack.pps) {
         observer.trigger(Event.INIT_SEGMENT,{
          moov: MP4.initSegment([this._avcTrack]),
          codec : this._avcTrack.codec
        });
        this._initSegGenerated = true;
        if(this._initPTS === undefined) {
          // remember first PTS of this demuxing context
          this._initPTS = this._avcSamples[0].pts;
        }
      }
    } else {
      //audio and video
      if(this._aacTrack.config && this._avcTrack.sps && this._avcTrack.pps) {
         observer.trigger(Event.INIT_SEGMENT,{
          moov: MP4.initSegment([this._avcTrack, this._aacTrack]),
          codec : this._avcTrack.codec + ',' + this._aacTrack.codec
        });
        this._initSegGenerated = true;
        if(this._initPTS === undefined) {
          // remember first PTS of this demuxing context
          this._initPTS = Math.min(this._avcSamples[0].pts,this._aacSamples[0].pts);
        }
      }
    }
  }
}

export default TSDemuxer;
