/**
 * fMP4 remuxer
*/


import AAC from '../helper/aac';
import Event from '../events';
import {logger} from '../utils/logger';
import MP4 from '../remux/mp4-generator';
import {ErrorTypes, ErrorDetails} from '../errors';
import '../utils/polyfill';

class MP4Remuxer {
  constructor(observer, config) {
    this.observer = observer;
    this.config = config;
    this.ISGenerated = false;
    this.PES2MP4SCALEFACTOR = 4;
    this.PES_TIMESCALE = 90000;
    this.MP4_TIMESCALE = this.PES_TIMESCALE / this.PES2MP4SCALEFACTOR;
  }

  get passthrough() {
    return false;
  }

  destroy() {
  }

  insertDiscontinuity() {
    this._initPTS = this._initDTS = this.nextAacPts = this.nextAvcDts = undefined;
  }

  switchLevel() {
    this.ISGenerated = false;
  }

  remux(audioTrack,videoTrack,id3Track,textTrack,timeOffset, contiguous) {
    // generate Init Segment if needed
    if (!this.ISGenerated) {
      this.generateIS(audioTrack,videoTrack,timeOffset);
    }

    if (this.ISGenerated) {
      // Purposefully remuxing audio before video, so that remuxVideo can use nextAacPts, which is
      // calculated in remuxAudio.
      //logger.log('nb AAC samples:' + audioTrack.samples.length);
      if (audioTrack.samples.length) {
        let audioData = this.remuxAudio(audioTrack,timeOffset,contiguous);
        //logger.log('nb AVC samples:' + videoTrack.samples.length);
        if (videoTrack.samples.length) {
          let audioTrackLength;
          if (audioData) {
            audioTrackLength = audioData.endPTS - audioData.startPTS;
          }
          this.remuxVideo(videoTrack,timeOffset,contiguous,audioTrackLength);
        }
      } else {
        let videoData;
        //logger.log('nb AVC samples:' + videoTrack.samples.length);
        if (videoTrack.samples.length) {
          videoData = this.remuxVideo(videoTrack,timeOffset,contiguous);
        }
        if (videoData && audioTrack.codec) {
          this.remuxEmptyAudio(audioTrack, timeOffset, contiguous, videoData);
        }
      }
    }
    //logger.log('nb ID3 samples:' + audioTrack.samples.length);
    if (id3Track.samples.length) {
      this.remuxID3(id3Track,timeOffset);
    }
    //logger.log('nb ID3 samples:' + audioTrack.samples.length);
    if (textTrack.samples.length) {
      this.remuxText(textTrack,timeOffset);
    }
    //notify end of parsing
    this.observer.trigger(Event.FRAG_PARSED);
  }

  generateIS(audioTrack,videoTrack,timeOffset) {
    var observer = this.observer,
        audioSamples = audioTrack.samples,
        videoSamples = videoTrack.samples,
        pesTimeScale = this.PES_TIMESCALE,
        tracks = {},
        data = { tracks : tracks, unique : false },
        computePTSDTS = (this._initPTS === undefined),
        initPTS, initDTS;

    if (computePTSDTS) {
      initPTS = initDTS = Infinity;
    }
    if (audioTrack.config && audioSamples.length) {
      audioTrack.timescale = audioTrack.audiosamplerate;
      // MP4 duration (track duration in seconds multiplied by timescale) is coded on 32 bits
      // we know that each AAC sample contains 1024 frames....
      // in order to avoid overflowing the 32 bit counter for large duration, we use smaller timescale (timescale/gcd)
      // we just need to ensure that AAC sample duration will still be an integer (will be 1024/gcd)
      if (audioTrack.timescale * audioTrack.duration > Math.pow(2, 32)) {
        let greatestCommonDivisor = function(a, b) {
            if ( ! b) {
                return a;
            }
            return greatestCommonDivisor(b, a % b);
        };
        audioTrack.timescale = audioTrack.audiosamplerate / greatestCommonDivisor(audioTrack.audiosamplerate,1024);
      }
      logger.log ('audio mp4 timescale :'+ audioTrack.timescale);
      tracks.audio = {
        container : 'audio/mp4',
        codec :  audioTrack.codec,
        initSegment : MP4.initSegment([audioTrack]),
        metadata : {
          channelCount : audioTrack.channelCount
        }
      };
      if (computePTSDTS) {
        // remember first PTS of this demuxing context. for audio, PTS + DTS ...
        initPTS = initDTS = audioSamples[0].pts - pesTimeScale * timeOffset;
      }
    }

    if (videoTrack.sps && videoTrack.pps && videoSamples.length) {
      videoTrack.timescale = this.MP4_TIMESCALE;
      tracks.video = {
        container : 'video/mp4',
        codec :  videoTrack.codec,
        initSegment : MP4.initSegment([videoTrack]),
        metadata : {
          width : videoTrack.width,
          height : videoTrack.height
        }
      };
      if (computePTSDTS) {
        initPTS = Math.min(initPTS,videoSamples[0].pts - pesTimeScale * timeOffset);
        initDTS = Math.min(initDTS,videoSamples[0].dts - pesTimeScale * timeOffset);
      }
    }

    if(Object.keys(tracks).length) {
      observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT,data);
      this.ISGenerated = true;
      if (computePTSDTS) {
        this._initPTS = initPTS;
        this._initDTS = initDTS;
      }
    } else {
      observer.trigger(Event.ERROR, {type : ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'no audio/video samples found'});
    }
  }

  remuxVideo(track, timeOffset, contiguous, audioTrackLength) {
    var offset = 8,
        pesTimeScale = this.PES_TIMESCALE,
        pes2mp4ScaleFactor = this.PES2MP4SCALEFACTOR,
        mp4SampleDuration,
        mdat, moof,
        firstPTS, firstDTS,
        nextDTS,
        lastPTS, lastDTS,
        inputSamples = track.samples,
        outputSamples = [];

  // PTS is coded on 33bits, and can loop from -2^32 to 2^32
  // PTSNormalize will make PTS/DTS value monotonic, we use last known DTS value as reference value
   let nextAvcDts;
    if (contiguous) {
      // if parsed fragment is contiguous with last one, let's use last DTS value as reference
      nextAvcDts = this.nextAvcDts;
    } else {
      // if not contiguous, let's use target timeOffset
      nextAvcDts = timeOffset*pesTimeScale;
    }

    // compute first DTS and last DTS, normalize them against reference value
    let sample = inputSamples[0];
    firstDTS =  Math.max(this._PTSNormalize(sample.dts,nextAvcDts) - this._initDTS,0);
    firstPTS =  Math.max(this._PTSNormalize(sample.pts,nextAvcDts) - this._initDTS,0);

    // check timestamp continuity accross consecutive fragments (this is to remove inter-fragment gap/hole)
    let delta = Math.round((firstDTS - nextAvcDts) / 90);
    // if fragment are contiguous, detect hole/overlapping between fragments
    if (contiguous) {
      if (delta) {
        if (delta > 1) {
          logger.log(`AVC:${delta} ms hole between fragments detected,filling it`);
        } else if (delta < -1) {
          logger.log(`AVC:${(-delta)} ms overlapping between fragments detected`);
        }
        // remove hole/gap : set DTS to next expected DTS
        firstDTS = nextAvcDts;
        inputSamples[0].dts = firstDTS + this._initDTS;
        // offset PTS as well, ensure that PTS is smaller or equal than new DTS
        firstPTS = Math.max(firstPTS - delta, nextAvcDts);
        inputSamples[0].pts = firstPTS + this._initDTS;
        logger.log(`Video/PTS/DTS adjusted: ${firstPTS}/${firstDTS},delta:${delta}`);
      }
    }
    nextDTS = firstDTS;

    // compute lastPTS/lastDTS
    sample = inputSamples[inputSamples.length-1];
    lastDTS = Math.max(this._PTSNormalize(sample.dts,nextAvcDts) - this._initDTS,0);
    lastPTS = Math.max(this._PTSNormalize(sample.pts,nextAvcDts) - this._initDTS,0);
    lastPTS = Math.max(lastPTS, lastDTS);

    let vendor = navigator.vendor, userAgent = navigator.userAgent,
        isSafari = vendor && vendor.indexOf('Apple') > -1 && userAgent && !userAgent.match('CriOS');

      // on Safari let's signal the same sample duration for all samples
      // sample duration (as expected by trun MP4 boxes), should be the delta between sample DTS
      // set this constant duration as being the avg delta between consecutive DTS.
    if (isSafari) {
      mp4SampleDuration = Math.round((lastDTS-firstDTS)/(pes2mp4ScaleFactor*(inputSamples.length-1)));
    }

    // normalize all PTS/DTS now ...
    for (let i = 0; i < inputSamples.length; i++) {
      let sample = inputSamples[i];
      if (isSafari) {
        // sample DTS is computed using a constant decoding offset (mp4SampleDuration) between samples
        sample.dts = firstDTS + i*pes2mp4ScaleFactor*mp4SampleDuration;
      } else {
        // ensure sample monotonic DTS
        sample.dts = Math.max(this._PTSNormalize(sample.dts, nextAvcDts) - this._initDTS,firstDTS);
        // ensure dts is a multiple of scale factor to avoid rounding issues
        sample.dts = Math.round(sample.dts/pes2mp4ScaleFactor)*pes2mp4ScaleFactor;
      }
      // we normalize PTS against nextAvcDts, we also substract initDTS (some streams don't start @ PTS O)
      // and we ensure that computed value is greater or equal than sample DTS
      sample.pts = Math.max(this._PTSNormalize(sample.pts,nextAvcDts) - this._initDTS, sample.dts);
      // ensure pts is a multiple of scale factor to avoid rounding issues
      sample.pts = Math.round(sample.pts/pes2mp4ScaleFactor)*pes2mp4ScaleFactor;
    }

    /* concatenate the video data and construct the mdat in place
      (need 8 more bytes to fill length and mpdat type) */
    mdat = new Uint8Array(track.len + (4 * track.nbNalu) + 8);
    let view = new DataView(mdat.buffer);
    view.setUint32(0, mdat.byteLength);
    mdat.set(MP4.types.mdat, 4);

    for (let i = 0; i < inputSamples.length; i++) {
      let avcSample = inputSamples[i],
          mp4SampleLength = 0,
          compositionTimeOffset;
      // convert NALU bitstream to MP4 format (prepend NALU with size field)
      while (avcSample.units.units.length) {
        let unit = avcSample.units.units.shift();
        view.setUint32(offset, unit.data.byteLength);
        offset += 4;
        mdat.set(unit.data, offset);
        offset += unit.data.byteLength;
        mp4SampleLength += 4 + unit.data.byteLength;
      }

      if(!isSafari) {
        // expected sample duration is the Decoding Timestamp diff of consecutive samples
        if (i < inputSamples.length - 1) {
          mp4SampleDuration = inputSamples[i+1].dts - avcSample.dts;
        } else {
          let config = this.config,
              lastFrameDuration = avcSample.dts - inputSamples[i > 0 ? i-1 : i].dts;
          if (config.stretchShortVideoTrack) {
            // In some cases, a segment's audio track duration may exceed the video track duration.
            // Since we've already remuxed audio, and we know how long the audio track is, we look to
            // see if the delta to the next segment is longer than the minimum of maxBufferHole and
            // maxSeekHole. If so, playback would potentially get stuck, so we artificially inflate
            // the duration of the last frame to minimize any potential gap between segments.
            let maxBufferHole = config.maxBufferHole,
                maxSeekHole = config.maxSeekHole,
                gapTolerance = Math.floor(Math.min(maxBufferHole, maxSeekHole) * pesTimeScale),
                deltaToFrameEnd = (audioTrackLength ? firstPTS + audioTrackLength * pesTimeScale : this.nextAacPts) - avcSample.pts;
            if (deltaToFrameEnd > gapTolerance) {
              // We subtract lastFrameDuration from deltaToFrameEnd to try to prevent any video
              // frame overlap. maxBufferHole/maxSeekHole should be >> lastFrameDuration anyway.
              mp4SampleDuration = deltaToFrameEnd - lastFrameDuration;
              if (mp4SampleDuration < 0) {
                mp4SampleDuration = lastFrameDuration;
              }
              logger.log(`It is approximately ${deltaToFrameEnd/90} ms to the next segment; using duration ${mp4SampleDuration/90} ms for the last video frame.`);
            } else {
              mp4SampleDuration = lastFrameDuration;
            }
          } else {
            mp4SampleDuration = lastFrameDuration;
          }
        }
        mp4SampleDuration /= pes2mp4ScaleFactor;
        compositionTimeOffset = Math.round((avcSample.pts - avcSample.dts) / pes2mp4ScaleFactor);
      } else {
        compositionTimeOffset = Math.max(0,mp4SampleDuration*Math.round((avcSample.pts - avcSample.dts)/(pes2mp4ScaleFactor*mp4SampleDuration)));
      }


      //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${avcSample.pts}/${avcSample.dts}/${this._initDTS}/${ptsnorm}/${dtsnorm}/${(avcSample.pts/4294967296).toFixed(3)}');
      outputSamples.push({
        size: mp4SampleLength,
         // constant duration
        duration: mp4SampleDuration,
        cts: compositionTimeOffset,
        flags: {
          isLeading: 0,
          isDependedOn: 0,
          hasRedundancy: 0,
          degradPrio: 0,
          dependsOn : avcSample.key ? 2 : 1,
          isNonSync : avcSample.key ? 0 : 1
        }
      });
    }
    // next AVC sample DTS should be equal to last sample DTS + last sample duration (in PES timescale)
    this.nextAvcDts = lastDTS + mp4SampleDuration*pes2mp4ScaleFactor;
    track.len = 0;
    track.nbNalu = 0;
    if(outputSamples.length && navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
      let flags = outputSamples[0].flags;
    // chrome workaround, mark first sample as being a Random Access Point to avoid sourcebuffer append issue
    // https://code.google.com/p/chromium/issues/detail?id=229412
      flags.dependsOn = 2;
      flags.isNonSync = 0;
    }
    track.samples = outputSamples;
    moof = MP4.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
    track.samples = [];
    let data = {
      data1: moof,
      data2: mdat,
      startPTS: firstPTS / pesTimeScale,
      endPTS: (lastPTS + pes2mp4ScaleFactor * mp4SampleDuration) / pesTimeScale,
      startDTS: firstDTS / pesTimeScale,
      endDTS: this.nextAvcDts / pesTimeScale,
      type: 'video',
      nb: outputSamples.length
    };
    this.observer.trigger(Event.FRAG_PARSING_DATA, data);
    return data;
  }

  remuxAudio(track, timeOffset, contiguous) {
    let pesTimeScale = this.PES_TIMESCALE,
        mp4timeScale = track.timescale,
        pes2mp4ScaleFactor = pesTimeScale/mp4timeScale,
        expectedSampleDuration = track.timescale * 1024 / track.audiosamplerate;
    var view,
        offset = 8,
        aacSample, mp4Sample,
        unit,
        mdat, moof,
        firstPTS, firstDTS, lastDTS,
        pts, dts, ptsnorm, dtsnorm,
        samples = [],
        samples0 = [];

    track.samples.sort(function(a, b) {
      return (a.pts-b.pts);
    });
    samples0 = track.samples;

    let nextAacPts = (contiguous ? this.nextAacPts : timeOffset*pesTimeScale);

    // If the audio track is missing samples, the frames seem to get "left-shifted" within the
    // resulting mp4 segment, causing sync issues and leaving gaps at the end of the audio segment.
    // In an effort to prevent this from happening, we inject frames here where there are gaps.
    // When possible, we inject a silent frame; when that's not possible, we duplicate the last
    // frame.
    let firstPtsNorm = this._PTSNormalize(samples0[0].pts - this._initPTS, nextAacPts),
        pesFrameDuration = expectedSampleDuration * pes2mp4ScaleFactor;
    var nextPtsNorm = firstPtsNorm + pesFrameDuration;
    for (var i = 1; i < samples0.length; ) {
      // First, let's see how far off this frame is from where we expect it to be
      var sample = samples0[i],
          ptsNorm = this._PTSNormalize(sample.pts - this._initPTS, nextAacPts),
          delta = ptsNorm - nextPtsNorm;

      // If we're overlapping by more than half a duration, drop this sample
      if (delta < (-0.5 * pesFrameDuration)) {
        logger.log(`Dropping frame due to ${Math.abs(delta / 90)} ms overlap.`);
        samples0.splice(i, 1);
        track.len -= sample.unit.length;
        // Don't touch nextPtsNorm or i
      }
      // Otherwise, if we're more than half a frame away from where we should be, insert missing frames
      else if (delta > (0.5 * pesFrameDuration)) {
        var missing = Math.round(delta / pesFrameDuration);
        logger.log(`Injecting ${missing} frame${missing > 1 ? 's' : ''} of missing audio due to ${Math.round(delta / 90)} ms gap.`);
        for (var j = 0; j < missing; j++) {
          var newStamp = samples0[i - 1].pts + pesFrameDuration,
              fillFrame = AAC.getSilentFrame(track.channelCount);
          if (!fillFrame) {
            logger.log('Unable to get silent frame for given audio codec; duplicating last frame instead.');
            fillFrame = sample.unit.slice(0);
          }
          samples0.splice(i, 0, {unit: fillFrame, pts: newStamp, dts: newStamp});
          track.len += fillFrame.length;
          i += 1;
        }

        // Adjust sample to next expected pts
        nextPtsNorm += (missing + 1) * pesFrameDuration;
        sample.pts = samples0[i - 1].pts + pesFrameDuration;
        i += 1;
      }
      // Otherwise, we're within half a frame duration, so just adjust pts
      else {
        if (Math.abs(delta) > (0.1 * pesFrameDuration)) {
          logger.log(`Invalid frame delta ${ptsNorm - nextPtsNorm + pesFrameDuration} at PTS ${Math.round(ptsNorm / 90)} (should be ${pesFrameDuration}).`);
        }
        nextPtsNorm += pesFrameDuration;
        sample.pts = samples0[i - 1].pts + pesFrameDuration;
        i += 1;
      }
    }

    while (samples0.length) {
      aacSample = samples0.shift();
      unit = aacSample.unit;
      pts = aacSample.pts - this._initDTS;
      dts = aacSample.dts - this._initDTS;
      //logger.log(`Audio/PTS:${Math.round(pts/90)}`);
      // if not first sample
      if (lastDTS !== undefined) {
        ptsnorm = this._PTSNormalize(pts, lastDTS);
        dtsnorm = this._PTSNormalize(dts, lastDTS);
        mp4Sample.duration = (dtsnorm - lastDTS) / pes2mp4ScaleFactor;
      } else {
        ptsnorm = this._PTSNormalize(pts, nextAacPts);
        dtsnorm = this._PTSNormalize(dts, nextAacPts);
        let delta = Math.round(1000 * (ptsnorm - nextAacPts) / pesTimeScale);
        // if fragment are contiguous, detect hole/overlapping between fragments
        if (contiguous) {
          // log delta
          if (delta) {
            if (delta > 0) {
              logger.log(`${delta} ms hole between AAC samples detected,filling it`);
              // if we have frame overlap, overlapping for more than half a frame duraion
            } else if (delta < -12) {
              // drop overlapping audio frames... browser will deal with it
              logger.log(`${(-delta)} ms overlapping between AAC samples detected, drop frame`);
              track.len -= unit.byteLength;
              continue;
            }
            // set PTS/DTS to expected PTS/DTS
            ptsnorm = dtsnorm = nextAacPts;
          }
        }
        // remember first PTS of our aacSamples, ensure value is positive
        firstPTS = Math.max(0, ptsnorm);
        firstDTS = Math.max(0, dtsnorm);
        if(track.len > 0) {
          /* concatenate the audio data and construct the mdat in place
            (need 8 more bytes to fill length and mdat type) */
          mdat = new Uint8Array(track.len + 8);
          view = new DataView(mdat.buffer);
          view.setUint32(0, mdat.byteLength);
          mdat.set(MP4.types.mdat, 4);
        } else {
          // no audio samples
          return;
        }
      }
      mdat.set(unit, offset);
      offset += unit.byteLength;
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
    var lastSampleDuration = 0;
    var nbSamples = samples.length;
    //set last sample duration as being identical to previous sample
    if (nbSamples >= 2) {
      lastSampleDuration = samples[nbSamples - 2].duration;
      mp4Sample.duration = lastSampleDuration;
    }
    if (nbSamples) {
      // next aac sample PTS should be equal to last sample PTS + duration
      this.nextAacPts = ptsnorm + pes2mp4ScaleFactor * lastSampleDuration;
      //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
      track.len = 0;
      track.samples = samples;
      moof = MP4.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
      track.samples = [];
      let audioData = {
        data1: moof,
        data2: mdat,
        startPTS: firstPTS / pesTimeScale,
        endPTS: this.nextAacPts / pesTimeScale,
        startDTS: firstDTS / pesTimeScale,
        endDTS: (dtsnorm + pes2mp4ScaleFactor * lastSampleDuration) / pesTimeScale,
        type: 'audio',
        nb: nbSamples
      };
      this.observer.trigger(Event.FRAG_PARSING_DATA, audioData);
      return audioData;
    }
    return null;
  }

  remuxEmptyAudio(track, timeOffset, contiguous, videoData) {
    let pesTimeScale = this.PES_TIMESCALE,
        mp4timeScale = track.timescale ? track.timescale : track.audiosamplerate,
        pes2mp4ScaleFactor = pesTimeScale/mp4timeScale,

        // sync with video's timestamp
        startDTS = videoData.startDTS * pesTimeScale,
        endDTS = videoData.endDTS * pesTimeScale,

        // one sample's duration value
        sampleDuration = 1024,
        frameDuration = pes2mp4ScaleFactor * sampleDuration,

        // samples count of this segment's duration
        nbSamples = Math.ceil((endDTS - startDTS) / frameDuration),

        // silent frame
        silentFrame = AAC.getSilentFrame(track.channelCount);

    // Can't remux if we can't generate a silent frame...
    if (!silentFrame) {
      logger.trace('Unable to remuxEmptyAudio since we were unable to get a silent frame for given audio codec!');
      return;
    }

    let samples = [];
    for(var i = 0; i < nbSamples; i++) {
      var stamp = startDTS + i * frameDuration;
      samples.push({unit: silentFrame.slice(0), pts: stamp, dts: stamp});
      track.len += silentFrame.length;
    }
    track.samples = samples;

    this.remuxAudio(track, timeOffset, contiguous);
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

  remuxText(track,timeOffset) {
    track.samples.sort(function(a, b) {
      return (a.pts-b.pts);
    });

    var length = track.samples.length, sample;
    // consume samples
    if(length) {
      for(var index = 0; index < length; index++) {
        sample = track.samples[index];
        // setting text pts, dts to relative time
        // using this._initPTS and this._initDTS to calculate relative time
        sample.pts = ((sample.pts - this._initPTS) / this.PES_TIMESCALE);
      }
      this.observer.trigger(Event.FRAG_PARSING_USERDATA, {
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
