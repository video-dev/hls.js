/**
 * A stream-based mp2ts to mp4 converter. This utility is used to
 * deliver mp4s to a SourceBuffer on platforms that support native
 * Media Source Extensions.
*/

 import Event from '../events';
 import ExpGolomb from './exp-golomb';
// import Hex from '../utils/hex';
 import MP4 from '../remux/mp4-generator';
 import observer from '../observer';
 import {logger} from '../utils/logger';
 import {ErrorTypes, ErrorDetails} from '../errors';

 class TSDemuxer {

  constructor() {
    this.lastCC = 0;
    this.PES_TIMESCALE = 90000;
    this.PES2MP4SCALEFACTOR = 4;
    this.MP4_TIMESCALE = this.PES_TIMESCALE / this.PES2MP4SCALEFACTOR;
  }

  switchLevel() {
    this.pmtParsed = false;
    this._pmtId = this._avcId = this._aacId = -1;
    this._avcTrack = {type: 'video', sequenceNumber: 0};
    this._aacTrack = {type: 'audio', sequenceNumber: 0};
    this._avcSamples = [];
    this._avcSamplesLength = 0;
    this._avcSamplesNbNalu = 0;
    this._aacSamples = [];
    this._aacSamplesLength = 0;
    this._initSegGenerated = false;
  }

  insertDiscontinuity() {
    this.switchLevel();
    this._initPTS = this._initDTS = undefined;
  }

  // feed incoming data to the front of the parsing pipeline
  push(data, audioCodec, videoCodec, timeOffset, cc, level, duration) {
    var avcData, aacData, start, len = data.length, stt, pid, atf, offset;
    this.audioCodec = audioCodec;
    this.videoCodec = videoCodec;
    this.timeOffset = timeOffset;
    this._duration = duration;
    if (cc !== this.lastCC) {
      logger.log('discontinuity detected');
      this.insertDiscontinuity();
      this.lastCC = cc;
    } else if (level !== this.lastLevel) {
      logger.log('level switch detected');
      this.switchLevel();
      this.lastLevel = level;
    }
    var pmtParsed = this.pmtParsed, avcId = this._avcId, aacId = this._aacId;
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
        if (pmtParsed) {
          if (pid === avcId) {
            if (stt) {
              if (avcData) {
                this._parseAVCPES(this._parsePES(avcData));
              }
              avcData = {data: [], size: 0};
            }
            if (avcData) {
              avcData.data.push(data.subarray(offset, start + 188));
              avcData.size += start + 188 - offset;
            }
          } else if (pid === aacId) {
            if (stt) {
              if (aacData) {
                this._parseAACPES(this._parsePES(aacData));
              }
              aacData = {data: [], size: 0};
            }
            if (aacData) {
              aacData.data.push(data.subarray(offset, start + 188));
              aacData.size += start + 188 - offset;
            }
          }
        } else {
          if (stt) {
            offset += data[offset] + 1;
          }
          if (pid === 0) {
            this._parsePAT(data, offset);
          } else if (pid === this._pmtId) {
            this._parsePMT(data, offset);
            pmtParsed = this.pmtParsed = true;
            avcId = this._avcId;
            aacId = this._aacId;
          }
        }
      } else {
        observer.trigger(Event.ERROR, {type : ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'TS packet did not start with 0x47'});
      }
    }
    // parse last PES packet
    if (avcData) {
      this._parseAVCPES(this._parsePES(avcData));
    }
    if (aacData) {
      this._parseAACPES(this._parsePES(aacData));
    }
  }

  end() {
    // generate Init Segment if needed
    if (!this._initSegGenerated) {
      this._generateInitSegment();
    }
    //logger.log('nb AVC samples:' + this._avcSamples.length);
    if (this._avcSamples.length) {
      this._flushAVCSamples();
    }
    //logger.log('nb AAC samples:' + this._aacSamples.length);
    if (this._aacSamples.length) {
      this._flushAACSamples();
    }
    //notify end of parsing
    observer.trigger(Event.FRAG_PARSED);
  }

  destroy() {
    this.switchLevel();
    this._initPTS = this._initDTS = undefined;
    this._duration = 0;
  }

  _parsePAT(data, offset) {
    // skip the PSI header and parse the first PMT entry
    this._pmtId  = (data[offset + 10] & 0x1F) << 8 | data[offset + 11];
    //logger.log('PMT PID:'  + this._pmtId);
  }

  _parsePMT(data, offset) {
    var sectionLength, tableEnd, programInfoLength, pid;
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
          this._aacId = pid;
          this._aacTrack.id = pid;
        break;
        // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
        case 0x1b:
        //logger.log('AVC PID:'  + pid);
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
    var i = 0, frag, pesFlags, pesPrefix, pesLen, pesHdrLen, pesData, pesPts, pesDts, payloadStartOffset;
    //retrieve PTS/DTS from first fragment
    frag = stream.data[0];
    pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
    if (pesPrefix === 1) {
      pesLen = (frag[4] << 8) + frag[5];
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
      payloadStartOffset = pesHdrLen + 9;
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
      return {data: pesData, pts: pesPts, dts: pesDts, len: pesLen};
    } else {
      return null;
    }
  }

  _parseAVCPES(pes) {
    var units,track = this._avcTrack, avcSample, key = false;
    units = this._parseAVCNALu(pes.data);
    // no NALu found
    if (units.length === 0 & this._avcSamples.length > 0) {
      // append pes.data to previous NAL unit
      var lastavcSample = this._avcSamples[this._avcSamples.length - 1];
      var lastUnit = lastavcSample.units.units[lastavcSample.units.units.length - 1];
      var tmp = new Uint8Array(lastUnit.data.byteLength + pes.data.byteLength);
      tmp.set(lastUnit.data, 0);
      tmp.set(pes.data, lastUnit.data.byteLength);
      lastUnit.data = tmp;
      lastavcSample.units.length += pes.data.byteLength;
      this._avcSamplesLength += pes.data.byteLength;
    }
    //free pes.data to save up some memory
    pes.data = null;
    units.units.forEach(unit => {
      switch(unit.type) {
        //NDR
        case 1:
          // check if slice_type matches with a keyframe
          var sliceType = new ExpGolomb(unit.data).readSliceType();
          if(sliceType === 2 || // I-slice
             sliceType === 4 || // SI-slice
             sliceType === 7 || // I-slice
             sliceType === 9) { // SI-slice
            key = true;
          }
          break;
        //IDR
        case 5:
          key = true;
          break;
        //SPS
        case 7:
          if(!track.sps) {
            var expGolombDecoder = new ExpGolomb(unit.data);
            var config = expGolombDecoder.readSPS();
            track.width = config.width;
            track.height = config.height;
            track.profileIdc = config.profileIdc;
            track.profileCompat = config.profileCompat;
            track.levelIdc = config.levelIdc;
            track.sps = [unit.data];
            track.timescale = this.MP4_TIMESCALE;
            track.duration = this.MP4_TIMESCALE * this._duration;
            var codecarray = unit.data.subarray(1, 4);
            var codecstring = 'avc1.';
            for (var i = 0; i < 3; i++) {
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
          if (!track.pps) {
            track.pps = [unit.data];
          }
          break;
        default:
          break;
      }
    });
    //build sample from PES
    // Annex B to MP4 conversion to be done
    if (units.length) {
      // only push AVC sample if keyframe already found. browsers expect a keyframe at first to start decoding
      if (key === true || track.sps ) {
        avcSample = {units: units, pts: pes.pts, dts: pes.dts, key: key};
        this._avcSamples.push(avcSample);
        this._avcSamplesLength += units.length;
        this._avcSamplesNbNalu += units.units.length;
      }
    }
  }

  _flushAVCSamples() {
    var view, i = 8, avcSample, mp4Sample, mp4SampleLength, unit, track = this._avcTrack, lastSampleDTS, mdat, moof, firstPTS, firstDTS, pts, dts, ptsnorm, dtsnorm, samples = [];
    /* concatenate the video data and construct the mdat in place
      (need 8 more bytes to fill length and mpdat type) */
    mdat = new Uint8Array(this._avcSamplesLength + (4 * this._avcSamplesNbNalu) + 8);
    view = new DataView(mdat.buffer);
    view.setUint32(0, mdat.byteLength);
    mdat.set(MP4.types.mdat, 4);
    while (this._avcSamples.length) {
      avcSample = this._avcSamples.shift();
      mp4SampleLength = 0;
      // convert NALU bitstream to MP4 format (prepend NALU with size field)
      while (avcSample.units.units.length) {
        unit = avcSample.units.units.shift();
        view.setUint32(i, unit.data.byteLength);
        i += 4;
        mdat.set(unit.data, i);
        i += unit.data.byteLength;
        mp4SampleLength += 4 + unit.data.byteLength;
      }
      pts = avcSample.pts - this._initDTS;
      dts = avcSample.dts - this._initDTS;
      //logger.log('Video/PTS/DTS:' + avcSample.pts + '/' + avcSample.dts);
      if (lastSampleDTS !== undefined) {
        ptsnorm = this._PTSNormalize(pts, lastSampleDTS);
        dtsnorm = this._PTSNormalize(dts, lastSampleDTS);
        mp4Sample.duration = (dtsnorm - lastSampleDTS) / this.PES2MP4SCALEFACTOR;
        if (mp4Sample.duration < 0) {
          //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
          mp4Sample.duration = 0;
        }
      } else {
        ptsnorm = this._PTSNormalize(pts, this.nextAvcPts);
        dtsnorm = this._PTSNormalize(dts, this.nextAvcPts);
        // check if fragments are contiguous (i.e. no missing frames between fragment)
        if (this.nextAvcPts) {
          var delta = Math.round((ptsnorm - this.nextAvcPts) / 90), absdelta = Math.abs(delta);
          //logger.log('absdelta/avcSample.pts:' + absdelta + '/' + avcSample.pts);
          // if delta is less than 300 ms, next loaded fragment is assumed to be contiguous with last one
          if (absdelta < 300) {
            //logger.log('Video next PTS:' + this.nextAvcPts);
            if (delta > 1) {
              logger.log(`AVC:${delta} ms hole between fragments detected,filling it`);
            } else if (delta < -1) {
              logger.log(`AVC:${(-delta)} ms overlapping between fragments detected`);
            }
            // set PTS to next PTS
            ptsnorm = this.nextAvcPts;
            // offset DTS as well, ensure that DTS is smaller or equal than new PTS
            dtsnorm = Math.max(dtsnorm - delta, this.lastAvcDts);
           // logger.log('Video/PTS/DTS adjusted:' + avcSample.pts + '/' + avcSample.dts);
          }
          else {
            // not contiguous timestamp, check if PTS is within acceptable range
            var expectedPTS = this.PES_TIMESCALE * this.timeOffset;
            // check if there is any unexpected drift between expected timestamp and real one
            if (Math.abs(expectedPTS - ptsnorm) > (this.PES_TIMESCALE * 3600)) {
              //logger.log('PTS looping ??? AVC PTS delta:${expectedPTS-ptsnorm}');
              var ptsOffset = expectedPTS - ptsnorm;
              // set PTS to next expected PTS;
              ptsnorm = expectedPTS;
              dtsnorm = ptsnorm;
              // offset initPTS/initDTS to fix computation for following samples
              this._initPTS -= ptsOffset;
              this._initDTS -= ptsOffset;
            }
          }
        }
        // remember first PTS of our avcSamples, ensure value is positive
        firstPTS = Math.max(0, ptsnorm);
        firstDTS = Math.max(0, dtsnorm);
      }
      //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${avcSample.pts}/${avcSample.dts}/${this._initDTS}/${ptsnorm}/${dtsnorm}/${(avcSample.pts/4294967296).toFixed(3)}');
      mp4Sample = {
        size: mp4SampleLength,
        duration: 0,
        cts: (ptsnorm - dtsnorm) / this.PES2MP4SCALEFACTOR,
        flags: {
          isLeading: 0,
          isDependedOn: 0,
          hasRedundancy: 0,
          degradPrio: 0
        }
      };
      if (avcSample.key === true) {
        // the current sample is a key frame
        mp4Sample.flags.dependsOn = 2;
        mp4Sample.flags.isNonSync = 0;
      } else {
        mp4Sample.flags.dependsOn = 1;
        mp4Sample.flags.isNonSync = 1;
      }
      samples.push(mp4Sample);
      lastSampleDTS = dtsnorm;
    }
    if (samples.length >= 2) {
      mp4Sample.duration = samples[samples.length - 2].duration;
    }
    this.lastAvcDts = dtsnorm;
    // next AVC sample PTS should be equal to last sample PTS + duration
    this.nextAvcPts = ptsnorm + mp4Sample.duration * this.PES2MP4SCALEFACTOR;
    //logger.log('Video/lastAvcDts/nextAvcPts:' + this.lastAvcDts + '/' + this.nextAvcPts);
    this._avcSamplesLength = 0;
    this._avcSamplesNbNalu = 0;
    track.samples = samples;
    moof = MP4.moof(track.sequenceNumber++, firstDTS / this.PES2MP4SCALEFACTOR, track);
    track.samples = [];
    observer.trigger(Event.FRAG_PARSING_DATA, {
      moof: moof,
      mdat: mdat,
      startPTS: firstPTS / this.PES_TIMESCALE,
      endPTS: this.nextAvcPts / this.PES_TIMESCALE,
      startDTS: firstDTS / this.PES_TIMESCALE,
      endDTS: (dtsnorm + this.PES2MP4SCALEFACTOR * mp4Sample.duration) / this.PES_TIMESCALE,
      type: 'video',
      nb: samples.length
    });
  }

  _parseAVCNALu(array) {
    var i = 0, len = array.byteLength, value, overflow, state = 0;
    var units = [], unit, unitType, lastUnitStart, lastUnitType, length = 0;
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
            unitType = array[i] & 0x1f;
            //logger.log('find NALU @ offset:' + i + ',type:' + unitType);
            if (lastUnitStart) {
              unit = {data: array.subarray(lastUnitStart, i - state - 1), type: lastUnitType};
              length += i - state - 1 - lastUnitStart;
              //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
              units.push(unit);
            } else {
              // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
              overflow  = i - state - 1;
              if (overflow) {
                //logger.log('first NALU found with overflow:' + overflow);
                if (this._avcSamples.length) {
                  var lastavcSample = this._avcSamples[this._avcSamples.length - 1];
                  var lastUnit = lastavcSample.units.units[lastavcSample.units.units.length - 1];
                  var tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
                  tmp.set(lastUnit.data, 0);
                  tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
                  lastUnit.data = tmp;
                  lastavcSample.units.length += overflow;
                  this._avcSamplesLength += overflow;
                }
              }
            }
            lastUnitStart = i;
            lastUnitType = unitType;
            if (unitType === 1 || unitType === 5) {
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
    if (lastUnitStart) {
      unit = {data: array.subarray(lastUnitStart, len), type: lastUnitType};
      length += len - lastUnitStart;
      units.push(unit);
      //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
    }
    return {units: units , length: length};
  }

  _PTSNormalize(value, reference) {
    var offset;
    if (reference === undefined) {
      return value;
    }
    if (reference < value) {
      // - 2^33
      offset = -8589934592;
    } else {
      // + 2^33
      offset = 8589934592;
    }
    /* PTS is 33bit (from 0 to 2^33 -1)
      if diff between value and reference is bigger than half of the amplitude (2^32) then it means that
      PTS looping occured. fill the gap */
    while (Math.abs(value - reference) > 4294967296) {
        value += offset;
    }
    return value;
  }

  _parseAACPES(pes) {
    var track = this._aacTrack, aacSample, data = pes.data, config, adtsFrameSize, adtsStartOffset, adtsHeaderLen, stamp, nbSamples, len;
    if (this.aacOverFlow) {
      var tmp = new Uint8Array(this.aacOverFlow.byteLength + data.byteLength);
      tmp.set(this.aacOverFlow, 0);
      tmp.set(data, this.aacOverFlow.byteLength);
      data = tmp;
    }
    // look for ADTS header (0xFFFx)
    for (adtsStartOffset = 0, len = data.length; adtsStartOffset < len - 1; adtsStartOffset++) {
      if ((data[adtsStartOffset] === 0xff) && (data[adtsStartOffset+1] & 0xf0) === 0xf0) {
        break;
      }
    }
    // if ADTS header does not start straight from the beginning of the PES payload, raise an error
    if (adtsStartOffset) {
      var reason, fatal;
      if (adtsStartOffset < len - 1) {
        reason = `AAC PES did not start with ADTS header,offset:${adtsStartOffset}`;
        fatal = false;
      } else {
        reason = 'no ADTS header found in AAC PES';
        fatal = true;
      }
      observer.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: fatal, reason: reason});
      if (fatal) {
        return;
      }
    }
    if (!track.audiosamplerate) {
      config = this._ADTStoAudioConfig(data, adtsStartOffset, this.audioCodec);
      track.config = config.config;
      track.audiosamplerate = config.samplerate;
      track.channelCount = config.channelCount;
      track.codec = config.codec;
      track.timescale = this.MP4_TIMESCALE;
      track.duration = this.MP4_TIMESCALE * this._duration;
      logger.log(`parsed codec:${track.codec},rate:${config.samplerate},nb channel:${config.channelCount}`);
    }
    nbSamples = 0;
    while ((adtsStartOffset + 5) < len) {
      // retrieve frame size
      adtsFrameSize = ((data[adtsStartOffset + 3] & 0x03) << 11);
      // byte 4
      adtsFrameSize |= (data[adtsStartOffset + 4] << 3);
      // byte 5
      adtsFrameSize |= ((data[adtsStartOffset + 5] & 0xE0) >>> 5);
      adtsHeaderLen = (!!(data[adtsStartOffset + 1] & 0x01) ? 7 : 9);
      adtsFrameSize -= adtsHeaderLen;
      stamp = Math.round(pes.pts + nbSamples * 1024 * this.PES_TIMESCALE / track.audiosamplerate);
      //stamp = pes.pts;
      //console.log('AAC frame, offset/length/pts:' + (adtsStartOffset+7) + '/' + adtsFrameSize + '/' + stamp.toFixed(0));
      if (adtsStartOffset + adtsHeaderLen + adtsFrameSize <= len) {
        aacSample = {unit: data.subarray(adtsStartOffset + adtsHeaderLen, adtsStartOffset + adtsHeaderLen + adtsFrameSize), pts: stamp, dts: stamp};
        this._aacSamples.push(aacSample);
        this._aacSamplesLength += adtsFrameSize;
        adtsStartOffset += adtsFrameSize + adtsHeaderLen;
        nbSamples++;
      } else {
        break;
      }
    }
    if (adtsStartOffset < len) {
      this.aacOverFlow = data.subarray(adtsStartOffset, len);
    } else {
      this.aacOverFlow = null;
    }
  }

  _flushAACSamples() {
    var view, i = 8, aacSample, mp4Sample, unit, track = this._aacTrack, lastSampleDTS, mdat, moof, firstPTS, firstDTS, pts, dts, ptsnorm, dtsnorm, samples = [];
    /* concatenate the audio data and construct the mdat in place
      (need 8 more bytes to fill length and mpdat type) */
    mdat = new Uint8Array(this._aacSamplesLength + 8);
    view = new DataView(mdat.buffer);
    view.setUint32(0, mdat.byteLength);
    mdat.set(MP4.types.mdat, 4);
    while (this._aacSamples.length) {
      aacSample = this._aacSamples.shift();
      unit = aacSample.unit;
      mdat.set(unit, i);
      i += unit.byteLength;
      pts = aacSample.pts - this._initDTS;
      dts = aacSample.dts - this._initDTS;
      //logger.log('Audio/PTS:' + aacSample.pts.toFixed(0));
      if (lastSampleDTS !== undefined) {
        ptsnorm = this._PTSNormalize(pts, lastSampleDTS);
        dtsnorm = this._PTSNormalize(dts, lastSampleDTS);
        // we use DTS to compute sample duration, but we use PTS to compute initPTS which is used to sync audio and video
        mp4Sample.duration = (dtsnorm - lastSampleDTS) / this.PES2MP4SCALEFACTOR;
        if (mp4Sample.duration < 0) {
          //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
          mp4Sample.duration = 0;
        }
      } else {
        ptsnorm = this._PTSNormalize(pts, this.nextAacPts);
        dtsnorm = this._PTSNormalize(dts, this.nextAacPts);
        // check if fragments are contiguous (i.e. no missing frames between fragment)
        if (this.nextAacPts && this.nextAacPts !== ptsnorm) {
          //logger.log('Audio next PTS:' + this.nextAacPts);
          var delta = Math.round(1000 * (ptsnorm - this.nextAacPts) / this.PES_TIMESCALE), absdelta = Math.abs(delta);
          // if delta is less than 300 ms, next loaded fragment is assumed to be contiguous with last one
          if (absdelta > 1 && absdelta < 300) {
            if (delta > 0) {
              logger.log(`AAC:${delta} ms hole between fragments detected,filling it`);
              // set PTS to next PTS, and ensure PTS is greater or equal than last DTS
              ptsnorm = Math.max(this.nextAacPts, this.lastAacDts);
              dtsnorm = ptsnorm;
              //logger.log('Audio/PTS/DTS adjusted:' + aacSample.pts + '/' + aacSample.dts);
            } else {
              logger.log(`AAC:${(-delta)} ms overlapping between fragments detected`);
            }
          }
          else if (absdelta) {
            // not contiguous timestamp, check if PTS is within acceptable range
            var expectedPTS = this.PES_TIMESCALE * this.timeOffset;
            //logger.log('expectedPTS/PTSnorm:${expectedPTS}/${ptsnorm}/${expectedPTS-ptsnorm}');
            // check if there is any unexpected drift between expected timestamp and real one
            if (Math.abs(expectedPTS - ptsnorm) > this.PES_TIMESCALE * 3600) {
              //logger.log('PTS looping ??? AAC PTS delta:${expectedPTS-ptsnorm}');
              var ptsOffset = expectedPTS - ptsnorm;
              // set PTS to next expected PTS;
              ptsnorm = expectedPTS;
              dtsnorm = ptsnorm;
              // offset initPTS/initDTS to fix computation for following samples
              this._initPTS -= ptsOffset;
              this._initDTS -= ptsOffset;
            }
          }
        }
        // remember first PTS of our aacSamples, ensure value is positive
        firstPTS = Math.max(0, ptsnorm);
        firstDTS = Math.max(0, dtsnorm);
      }
      //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${aacSample.pts}/${aacSample.dts}/${this._initDTS}/${ptsnorm}/${dtsnorm}/${(aacSample.pts/4294967296).toFixed(3)}');
      mp4Sample = {
        size: unit.byteLength,
        cts: 0,
        duration:0,
        flags: {
          isLeading: 0,
          isDependedOn: 0,
          hasRedundancy: 0,
          degradPrio: 0,
          dependsOn: 1,
        }
      };
      samples.push(mp4Sample);
      lastSampleDTS = dtsnorm;
    }
    //set last sample duration as being identical to previous sample
    if (samples.length >= 2) {
      mp4Sample.duration = samples[samples.length - 2].duration;
    }
    this.lastAacDts = dtsnorm;
    // next aac sample PTS should be equal to last sample PTS + duration
    this.nextAacPts = ptsnorm + this.PES2MP4SCALEFACTOR * mp4Sample.duration;
    //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
    this._aacSamplesLength = 0;
    track.samples = samples;
    moof = MP4.moof(track.sequenceNumber++, firstDTS / this.PES2MP4SCALEFACTOR, track);
    track.samples = [];
    observer.trigger(Event.FRAG_PARSING_DATA, {
      moof: moof,
      mdat: mdat,
      startPTS: firstPTS / this.PES_TIMESCALE,
      endPTS: this.nextAacPts / this.PES_TIMESCALE,
      startDTS: firstDTS / this.PES_TIMESCALE,
      endDTS: (dtsnorm + this.PES2MP4SCALEFACTOR * mp4Sample.duration) / this.PES_TIMESCALE,
      type: 'audio',
      nb: samples.length
    });
  }

  _ADTStoAudioConfig(data, offset, audioCodec) {
    var adtsObjectType, // :int
        adtsSampleingIndex, // :int
        adtsExtensionSampleingIndex, // :int
        adtsChanelConfig, // :int
        config,
        userAgent = navigator.userAgent.toLowerCase(),
        adtsSampleingRates = [
            96000, 88200,
            64000, 48000,
            44100, 32000,
            24000, 22050,
            16000, 12000,
            11025, 8000,
            7350];
    // byte 2
    adtsObjectType = ((data[offset + 2] & 0xC0) >>> 6) + 1;
    adtsSampleingIndex = ((data[offset + 2] & 0x3C) >>> 2);
    if(adtsSampleingIndex > adtsSampleingRates.length-1) {
      observer.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: `invalid ADTS sampling index:${adtsSampleingIndex}`});
      return;
    }
    adtsChanelConfig = ((data[offset + 2] & 0x01) << 2);
    // byte 3
    adtsChanelConfig |= ((data[offset + 3] & 0xC0) >>> 6);
    logger.log(`manifest codec:${audioCodec},ADTS data:type:${adtsObjectType},sampleingIndex:${adtsSampleingIndex}[${adtsSampleingRates[adtsSampleingIndex]}kHz],channelConfig:${adtsChanelConfig}`);
    // firefox: freq less than 24kHz = AAC SBR (HE-AAC)
    if (userAgent.indexOf('firefox') !== -1) {
      if (adtsSampleingIndex >= 6) {
        adtsObjectType = 5;
        config = new Array(4);
        // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
        // there is a factor 2 between frame sample rate and output sample rate
        // multiply frequency by 2 (see table below, equivalent to substract 3)
        adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
      } else {
        adtsObjectType = 2;
        config = new Array(2);
        adtsExtensionSampleingIndex = adtsSampleingIndex;
      }
      // Android : always use AAC
    } else if (userAgent.indexOf('android') !== -1) {
      adtsObjectType = 2;
      config = new Array(2);
      adtsExtensionSampleingIndex = adtsSampleingIndex;
    } else {
      /*  for other browsers (chrome ...)
          always force audio type to be HE-AAC SBR, as some browsers do not support audio codec switch properly (like Chrome ...)
      */
      adtsObjectType = 5;
      config = new Array(4);
      // if (manifest codec is HE-AAC) OR (manifest codec not specified AND frequency less than 24kHz)
      if ((audioCodec && audioCodec.indexOf('mp4a.40.5') !== -1) || (!audioCodec && adtsSampleingIndex >= 6)) {
        // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
        // there is a factor 2 between frame sample rate and output sample rate
        // multiply frequency by 2 (see table below, equivalent to substract 3)
        adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
      } else {
        // if (manifest codec is AAC) AND (frequency less than 24kHz OR nb channel is 1)
        if (audioCodec && audioCodec.indexOf('mp4a.40.2') !== -1 && (adtsSampleingIndex >= 6 || adtsChanelConfig === 1)) {
          adtsObjectType = 2;
          config = new Array(2);
        }
        adtsExtensionSampleingIndex = adtsSampleingIndex;
      }
    }
    /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config
        ISO 14496-3 (AAC).pdf - Table 1.13 — Syntax of AudioSpecificConfig()
      Audio Profile / Audio Object Type
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
    if (adtsObjectType === 5) {
      // adtsExtensionSampleingIndex
      config[1] |= (adtsExtensionSampleingIndex & 0x0E) >> 1;
      config[2] = (adtsExtensionSampleingIndex & 0x01) << 7;
      // adtsObjectType (force to 2, chrome is checking that object type is less than 5 ???
      //    https://chromium.googlesource.com/chromium/src.git/+/master/media/formats/mp4/aac.cc
      config[2] |= 2 << 2;
      config[3] = 0;
    }
    return {config: config, samplerate: adtsSampleingRates[adtsSampleingIndex], channelCount: adtsChanelConfig, codec: ('mp4a.40.' + adtsObjectType)};
  }

  _generateInitSegment() {
    if (this._avcId === -1) {
      //audio only
      if (this._aacTrack.config) {
         observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
          audioMoov: MP4.initSegment([this._aacTrack]),
          audioCodec : this._aacTrack.codec,
          audioChannelCount : this._aacTrack.channelCount
        });
        this._initSegGenerated = true;
      }
      if (this._initPTS === undefined) {
        // remember first PTS of this demuxing context
        this._initPTS = this._aacSamples[0].pts - this.PES_TIMESCALE * this.timeOffset;
        this._initDTS = this._aacSamples[0].dts - this.PES_TIMESCALE * this.timeOffset;
      }
    } else
    if (this._aacId === -1) {
      //video only
      if (this._avcTrack.sps && this._avcTrack.pps) {
         observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
          videoMoov: MP4.initSegment([this._avcTrack]),
          videoCodec: this._avcTrack.codec,
          videoWidth: this._avcTrack.width,
          videoHeight: this._avcTrack.height
        });
        this._initSegGenerated = true;
        if (this._initPTS === undefined) {
          // remember first PTS of this demuxing context
          this._initPTS = this._avcSamples[0].pts - this.PES_TIMESCALE * this.timeOffset;
          this._initDTS = this._avcSamples[0].dts - this.PES_TIMESCALE * this.timeOffset;
        }
      }
    } else {
      //audio and video
      if (this._aacTrack.config && this._avcTrack.sps && this._avcTrack.pps) {
         observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
          audioMoov: MP4.initSegment([this._aacTrack]),
          audioCodec: this._aacTrack.codec,
          audioChannelCount: this._aacTrack.channelCount,
          videoMoov: MP4.initSegment([this._avcTrack]),
          videoCodec: this._avcTrack.codec,
          videoWidth: this._avcTrack.width,
          videoHeight: this._avcTrack.height
        });
        this._initSegGenerated = true;
        if (this._initPTS === undefined) {
          // remember first PTS of this demuxing context
          this._initPTS = Math.min(this._avcSamples[0].pts, this._aacSamples[0].pts) - this.PES_TIMESCALE * this.timeOffset;
          this._initDTS = Math.min(this._avcSamples[0].dts, this._aacSamples[0].dts) - this.PES_TIMESCALE * this.timeOffset;
        }
      }
    }
  }
}

export default TSDemuxer;

