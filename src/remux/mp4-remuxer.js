/**
 * fMP4 remuxer
*/


import Event from '../events';
import {logger} from '../utils/logger';
import MP4 from '../remux/mp4-generator';
import {ErrorTypes, ErrorDetails} from '../errors';

class MP4Remuxer {
  constructor(observer) {
    this.observer = observer;
    this.ISGenerated = false;
    this.PES2MP4SCALEFACTOR = 4;
    this.PES_TIMESCALE = 90000;
    this.MP4_TIMESCALE = this.PES_TIMESCALE / this.PES2MP4SCALEFACTOR;
  }

  get timescale() {
    return this.MP4_TIMESCALE;
  }

  destroy() {
  }

  insertDiscontinuity() {
    this._initPTS = this._initDTS = this.nextAacPts = this.nextAvcDts = undefined;
  }

  switchLevel() {
    this.ISGenerated = false;
  }

  remux(audioTrack,videoTrack,id3Track,timeOffset) {
    // generate Init Segment if needed
    if (!this.ISGenerated) {
      this.generateIS(audioTrack,videoTrack,timeOffset);
    }
    //logger.log('nb AVC samples:' + videoTrack.samples.length);
    if (videoTrack.samples.length) {
      this.remuxVideo(videoTrack,timeOffset);
    }
    //logger.log('nb AAC samples:' + audioTrack.samples.length);
    if (audioTrack.samples.length) {
      this.remuxAudio(audioTrack,timeOffset);
    }
    //logger.log('nb ID3 samples:' + audioTrack.samples.length);
    if (id3Track.samples.length) {
      this.remuxID3(id3Track,timeOffset);
    }
    //notify end of parsing
    this.observer.trigger(Event.FRAG_PARSED);
  }

  generateIS(audioTrack,videoTrack,timeOffset) {
    var observer = this.observer,
        audioSamples = audioTrack.samples,
        videoSamples = videoTrack.samples,
        nbAudio = audioSamples.length,
        nbVideo = videoSamples.length,
        pesTimeScale = this.PES_TIMESCALE;

    if(nbAudio === 0 && nbVideo === 0) {
      observer.trigger(Event.ERROR, {type : ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'no audio/video samples found'});
    } else if (nbVideo === 0) {
      //audio only
      if (audioTrack.config) {
         observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
          audioMoov: MP4.initSegment([audioTrack]),
          audioCodec : audioTrack.codec,
          audioChannelCount : audioTrack.channelCount
        });
        this.ISGenerated = true;
      }
      if (this._initPTS === undefined) {
        // remember first PTS of this demuxing context
        this._initPTS = audioSamples[0].pts - pesTimeScale * timeOffset;
        this._initDTS = audioSamples[0].dts - pesTimeScale * timeOffset;
      }
    } else
    if (nbAudio === 0) {
      //video only
      if (videoTrack.sps && videoTrack.pps) {
         observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
          videoMoov: MP4.initSegment([videoTrack]),
          videoCodec: videoTrack.codec,
          videoWidth: videoTrack.width,
          videoHeight: videoTrack.height
        });
        this.ISGenerated = true;
        if (this._initPTS === undefined) {
          // remember first PTS of this demuxing context
          this._initPTS = videoSamples[0].pts - pesTimeScale * timeOffset;
          this._initDTS = videoSamples[0].dts - pesTimeScale * timeOffset;
        }
      }
    } else {
      //audio and video
      if (audioTrack.config && videoTrack.sps && videoTrack.pps) {
          observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
          audioMoov: MP4.initSegment([audioTrack]),
          audioCodec: audioTrack.codec,
          audioChannelCount: audioTrack.channelCount,
          videoMoov: MP4.initSegment([videoTrack]),
          videoCodec: videoTrack.codec,
          videoWidth: videoTrack.width,
          videoHeight: videoTrack.height
        });
        this.ISGenerated = true;
        if (this._initPTS === undefined) {
          // remember first PTS of this demuxing context
          this._initPTS = Math.min(videoSamples[0].pts, audioSamples[0].pts) - pesTimeScale * timeOffset;
          this._initDTS = Math.min(videoSamples[0].dts, audioSamples[0].dts) - pesTimeScale * timeOffset;
        }
      }
    }
  }

  remuxVideo(track, timeOffset) {
    var view,
        i = 8,
        pesTimeScale = this.PES_TIMESCALE,
        pes2mp4ScaleFactor = this.PES2MP4SCALEFACTOR,
        avcSample,
        mp4Sample,
        mp4SampleLength,
        unit,
        mdat, moof,
        firstPTS, firstDTS, lastDTS,
        pts, dts, ptsnorm, dtsnorm,
        samples = [];
    /* concatenate the video data and construct the mdat in place
      (need 8 more bytes to fill length and mpdat type) */
    mdat = new Uint8Array(track.len + (4 * track.nbNalu) + 8);
    view = new DataView(mdat.buffer);
    view.setUint32(0, mdat.byteLength);
    mdat.set(MP4.types.mdat, 4);
    while (track.samples.length) {
      avcSample = track.samples.shift();
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
      //logger.log('Video/PTS/DTS:' + pts + '/' + dts);
      // if not first AVC sample of video track, normalize PTS/DTS with previous sample value
      // and ensure that sample duration is positive
      if (lastDTS !== undefined) {
        ptsnorm = this._PTSNormalize(pts, lastDTS);
        dtsnorm = this._PTSNormalize(dts, lastDTS);
        mp4Sample.duration = (dtsnorm - lastDTS) / pes2mp4ScaleFactor;
        if (mp4Sample.duration < 0) {
          //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
          mp4Sample.duration = 0;
        }
      } else {
        // first AVC sample of video track, normalize PTS/DTS
        ptsnorm = this._PTSNormalize(pts, this.nextAvcDts);
        dtsnorm = this._PTSNormalize(dts, this.nextAvcDts);
        // check if first AVC sample is contiguous with last sample of previous track
        // delta between next DTS and dtsnorm should be less than 1
        if (this.nextAvcDts) {
          var delta = Math.round((dtsnorm - this.nextAvcDts) / 90), absdelta = Math.abs(delta);
          //logger.log('absdelta/dts:' + absdelta + '/' + dtsnorm);
          // if delta is less than 300 ms, next loaded fragment is assumed to be contiguous with last one
          if (absdelta < 300) {
            if (delta > 1) {
              logger.log(`AVC:${delta} ms hole between fragments detected,filling it`);
            } else if (delta < -1) {
              logger.log(`AVC:${(-delta)} ms overlapping between fragments detected`);
            }
            if(absdelta) {
              // set DTS to next DTS
              dtsnorm = this.nextAvcDts;
              // offset PTS as well, ensure that PTS is smaller or equal than new DTS
              ptsnorm = Math.max(ptsnorm - delta, dtsnorm);
              logger.log('Video/PTS/DTS adjusted:' + ptsnorm + '/' + dtsnorm);
            }
          } else {
            // not contiguous timestamp, check if DTS is within acceptable range
            var expectedDTS = pesTimeScale * timeOffset;
            // check if there is any unexpected drift between expected timestamp and real one
            if (Math.abs(expectedDTS - dtsnorm) > (pesTimeScale * 3600)) {
              //logger.log('PTS looping ??? AVC PTS delta:${expectedPTS-ptsnorm}');
              var dtsOffset = expectedDTS - dtsnorm;
              // set PTS to next expected PTS;
              dtsnorm = expectedDTS;
              ptsnorm = dtsnorm;
              // offset initPTS/initDTS to fix computation for following samples
              this._initPTS -= dtsOffset;
              this._initDTS -= dtsOffset;
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
        cts: (ptsnorm - dtsnorm) / pes2mp4ScaleFactor,
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
      lastDTS = dtsnorm;
    }
    if (samples.length >= 2) {
      mp4Sample.duration = samples[samples.length - 2].duration;
    }
    // next AVC sample DTS should be equal to last sample DTS + last sample duration
    this.nextAvcDts = dtsnorm + mp4Sample.duration * pes2mp4ScaleFactor;
    track.len = 0;
    track.nbNalu = 0;
    if(navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
    // chrome workaround, mark first sample as being a Random Access Point to avoid sourcebuffer append issue
    // https://code.google.com/p/chromium/issues/detail?id=229412
      samples[0].flags.dependsOn = 2;
      samples[0].flags.isNonSync = 0;
    }
    track.samples = samples;
    moof = MP4.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
    track.samples = [];
    this.observer.trigger(Event.FRAG_PARSING_DATA, {
      moof: moof,
      mdat: mdat,
      startPTS: firstPTS / pesTimeScale,
      endPTS: (ptsnorm + pes2mp4ScaleFactor * mp4Sample.duration) / pesTimeScale,
      startDTS: firstDTS / pesTimeScale,
      endDTS: (dtsnorm + pes2mp4ScaleFactor * mp4Sample.duration) / pesTimeScale,
      type: 'video',
      nb: samples.length
    });
  }

  remuxAudio(track,timeOffset) {
    var view,
        i = 8,
        pesTimeScale = this.PES_TIMESCALE,
        pes2mp4ScaleFactor = this.PES2MP4SCALEFACTOR,
        aacSample, mp4Sample,
        unit,
        mdat, moof,
        firstPTS, firstDTS, lastDTS,
        pts, dts, ptsnorm, dtsnorm,
        samples = [];
    /* concatenate the audio data and construct the mdat in place
      (need 8 more bytes to fill length and mdat type) */
    mdat = new Uint8Array(track.len + 8);
    view = new DataView(mdat.buffer);
    view.setUint32(0, mdat.byteLength);
    mdat.set(MP4.types.mdat, 4);
    while (track.samples.length) {
      aacSample = track.samples.shift();
      unit = aacSample.unit;
      mdat.set(unit, i);
      i += unit.byteLength;
      pts = aacSample.pts - this._initDTS;
      dts = aacSample.dts - this._initDTS;
      //logger.log('Audio/PTS:' + aacSample.pts.toFixed(0));
      if (lastDTS !== undefined) {
        ptsnorm = this._PTSNormalize(pts, lastDTS);
        dtsnorm = this._PTSNormalize(dts, lastDTS);
        // we use DTS to compute sample duration, but we use PTS to compute initPTS which is used to sync audio and video
        mp4Sample.duration = (dtsnorm - lastDTS) / pes2mp4ScaleFactor;
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
          var delta = Math.round(1000 * (ptsnorm - this.nextAacPts) / pesTimeScale), absdelta = Math.abs(delta);
          // if delta is less than 300 ms, next loaded fragment is assumed to be contiguous with last one
          if (absdelta > 1 && absdelta < 300) {
            if (delta > 0) {
              logger.log(`AAC:${delta} ms hole between fragments detected,filling it`);
              // set PTS to next PTS, and ensure PTS is greater or equal than last DTS
              //logger.log('Audio/PTS/DTS adjusted:' + aacSample.pts + '/' + aacSample.dts);
            } else {
              logger.log(`AAC:${(-delta)} ms overlapping between fragments detected`);
            }
            // set DTS to next DTS
            ptsnorm = dtsnorm = this.nextAacPts;
            logger.log('Audio/PTS/DTS adjusted:' + ptsnorm + '/' + dtsnorm);
          }
          else if (absdelta) {
            // not contiguous timestamp, check if PTS is within acceptable range
            var expectedPTS = pesTimeScale * timeOffset;
            //logger.log('expectedPTS/PTSnorm:${expectedPTS}/${ptsnorm}/${expectedPTS-ptsnorm}');
            // check if there is any unexpected drift between expected timestamp and real one
            if (Math.abs(expectedPTS - ptsnorm) > pesTimeScale * 3600) {
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
      lastDTS = dtsnorm;
    }
    //set last sample duration as being identical to previous sample
    if (samples.length >= 2) {
      mp4Sample.duration = samples[samples.length - 2].duration;
    }
    // next aac sample PTS should be equal to last sample PTS + duration
    this.nextAacPts = ptsnorm + pes2mp4ScaleFactor * mp4Sample.duration;
    //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
    track.len = 0;
    track.samples = samples;
    moof = MP4.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
    track.samples = [];
    this.observer.trigger(Event.FRAG_PARSING_DATA, {
      moof: moof,
      mdat: mdat,
      startPTS: firstPTS / pesTimeScale,
      endPTS: this.nextAacPts / pesTimeScale,
      startDTS: firstDTS / pesTimeScale,
      endDTS: (dtsnorm + pes2mp4ScaleFactor * mp4Sample.duration) / pesTimeScale,
      type: 'audio',
      nb: samples.length
    });
  }

  remuxID3(track,timeOffset) {
    var length = track.samples.length, sample;
    // consume samples
    if(length) {
      for(var index = 0; index < length; index++) {
        sample = track.samples[index];
        // setting id3 pts, dts to relative time
        // using this._initPTS and this._initDTS to calculate relative time
        sample.pts = ((sample.pts - this._initPTS) / this.PES_TIMESCALE);
        sample.dts = ((sample.dts - this._initDTS) / this.PES_TIMESCALE);
      }
      this.observer.trigger(Event.FRAG_PARSING_METADATA, {
        samples:track.samples
      });
    }

    track.samples = [];
    timeOffset = timeOffset;
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

}

export default MP4Remuxer;
