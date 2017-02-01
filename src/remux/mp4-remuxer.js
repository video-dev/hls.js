/**
 * fMP4 remuxer
*/


import AAC from '../helper/aac';
import Event from '../events';
import {logger} from '../utils/logger';
import MP4 from '../remux/mp4-generator';
import {ErrorTypes, ErrorDetails} from '../errors';

class MP4Remuxer {
  constructor(observer, id, config, typeSupported) {
    this.observer = observer;
    this.id = id;
    this.config = config;
    this.typeSupported = typeSupported;
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
    this._initPTS = this._initDTS = undefined;
  }

  switchLevel() {
    this.ISGenerated = false;
  }

  remux(level,sn,cc,audioTrack,videoTrack,id3Track,textTrack,timeOffset, contiguous,accurateTimeOffset,defaultInitPTS) {
    this.level = level;
    this.sn = sn;
    // generate Init Segment if needed
    if (!this.ISGenerated) {
      this.generateIS(audioTrack,videoTrack,timeOffset,cc);
    }

    if((defaultInitPTS!==null)){
      this._initPTS=this._initDTS= defaultInitPTS;
    }

    if (this.ISGenerated) {
      // Purposefully remuxing audio before video, so that remuxVideo can use nextAudioPts, which is
      // calculated in remuxAudio.
      //logger.log('nb AAC samples:' + audioTrack.samples.length);
      if (audioTrack.samples.length) {
        let audioData = this.remuxAudio(audioTrack,timeOffset,contiguous,accurateTimeOffset);
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
    this.observer.trigger(Event.FRAG_PARSED, { id : this.id , level : this.level, sn : this.sn});
  }

  generateIS(audioTrack,videoTrack,timeOffset,cc) {
    var observer = this.observer,
        audioSamples = audioTrack.samples,
        videoSamples = videoTrack.samples,
        pesTimeScale = this.PES_TIMESCALE,
        typeSupported = this.typeSupported,
        container = 'audio/mp4',
        tracks = {},
        data = { id : this.id, level : this.level, sn : this.sn, tracks : tracks, unique : false },
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
        audioTrack.timescale = audioTrack.audiosamplerate / greatestCommonDivisor(audioTrack.audiosamplerate,(audioTrack.isAAC ? 1024 : 1152));
      }
      logger.log ('audio mp4 timescale :'+ audioTrack.timescale);
      if (!audioTrack.isAAC) {
        if (typeSupported.mpeg) { // Chrome and Safari
          container = 'audio/mpeg';
          audioTrack.codec = '';
        } else if (typeSupported.mp3) { // Firefox
          audioTrack.codec = 'mp3';
        }
      }
      tracks.audio = {
        container : container,
        codec :  audioTrack.codec,
        initSegment : !audioTrack.isAAC && typeSupported.mpeg ? new Uint8Array() : MP4.initSegment([audioTrack]),
        metadata : {
          channelCount : audioTrack.channelCount
        }
      };
      if (computePTSDTS) {
        // remember first PTS of this demuxing context. for audio, PTS = DTS
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
        this.observer.trigger(Event.INIT_PTS_FOUND, { id: this.id, initPTS: initPTS, cc: cc});
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
      observer.trigger(Event.ERROR, {type : ErrorTypes.MEDIA_ERROR, id : this.id, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'no audio/video samples found'});
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
        outputSamples = [],
        nbSamples = inputSamples.length,
        ptsNormalize = this._PTSNormalize,
        initDTS = this._initDTS;

  // for (let i = 0; i < track.samples.length; i++) {
  //   let avcSample = track.samples[i];
  //   let units = avcSample.units.units;
  //   let unitsString = '';
  //   for (let j = 0; j < units.length ; j++) {
  //     unitsString += units[j].type + ',';
  //     if (units[j].data.length < 500) {
  //       unitsString += Hex.hexDump(units[j].data);
  //     }
  //   }
  //   logger.log(avcSample.pts + '/' + avcSample.dts + ',' + unitsString + avcSample.units.length);
  // }

    // sort video samples by DTS then PTS order
    inputSamples.sort(function(a, b) {
      const deltadts = a.dts - b.dts;
      return deltadts ? deltadts : (a.pts - b.pts);
    });

    // handle broken streams with PTS < DTS, tolerance up 200ms (18000 in 90kHz timescale)
    let PTSDTSshift = inputSamples.reduce( (prev, curr) => Math.max(Math.min(prev,curr.pts-curr.dts),-18000),0);
    if (PTSDTSshift < 0) {
      logger.warn(`PTS < DTS detected in video samples, shifting DTS by ${Math.round(PTSDTSshift/90)} ms to overcome this issue`);
      for (let i = 0; i < inputSamples.length; i++) {
        inputSamples[i].dts += PTSDTSshift;
      }
    }

  // PTS is coded on 33bits, and can loop from -2^32 to 2^32
  // ptsNormalize will make PTS/DTS value monotonic, we use last known DTS value as reference value
   let nextAvcDts;
   // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
    if (contiguous) {
      // if parsed fragment is contiguous with last one, let's use last DTS value as reference
      nextAvcDts = this.nextAvcDts;
    } else {
      // if not contiguous, let's use target timeOffset
      nextAvcDts = timeOffset*pesTimeScale;
    }

    // compute first DTS and last DTS, normalize them against reference value
    let sample = inputSamples[0];
    firstDTS =  Math.max(ptsNormalize(sample.dts - initDTS,nextAvcDts),0);
    firstPTS =  Math.max(ptsNormalize(sample.pts - initDTS,nextAvcDts),0);

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
        inputSamples[0].dts = firstDTS + initDTS;
        // offset PTS as well, ensure that PTS is smaller or equal than new DTS
        firstPTS = Math.max(firstPTS - delta, nextAvcDts);
        inputSamples[0].pts = firstPTS + initDTS;
        logger.log(`Video/PTS/DTS adjusted: ${Math.round(firstPTS/90)}/${Math.round(firstDTS/90)},delta:${delta} ms`);
      }
    }
    nextDTS = firstDTS;

    // compute lastPTS/lastDTS
    sample = inputSamples[inputSamples.length-1];
    lastDTS = Math.max(ptsNormalize(sample.dts - initDTS,nextAvcDts) ,0);
    lastPTS = Math.max(ptsNormalize(sample.pts - initDTS,nextAvcDts) ,0);
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
    for (let i = 0 ; i < nbSamples; i++) {
      let sample = inputSamples[i];
      if (isSafari) {
        // sample DTS is computed using a constant decoding offset (mp4SampleDuration) between samples
        sample.dts = firstDTS + i*pes2mp4ScaleFactor*mp4SampleDuration;
      } else {
        // ensure sample monotonic DTS
        sample.dts = Math.max(ptsNormalize(sample.dts - initDTS, nextAvcDts),firstDTS);
        // ensure dts is a multiple of scale factor to avoid rounding issues
        sample.dts = Math.round(sample.dts/pes2mp4ScaleFactor)*pes2mp4ScaleFactor;
      }
      // we normalize PTS against nextAvcDts, we also substract initDTS (some streams don't start @ PTS O)
      // and we ensure that computed value is greater or equal than sample DTS
      sample.pts = Math.max(ptsNormalize(sample.pts - initDTS,nextAvcDts) , sample.dts);
      // ensure pts is a multiple of scale factor to avoid rounding issues
      sample.pts = Math.round(sample.pts/pes2mp4ScaleFactor)*pes2mp4ScaleFactor;
    }

    /* concatenate the video data and construct the mdat in place
      (need 8 more bytes to fill length and mpdat type) */
    let mdatSize = track.len + (4 * track.nbNalu) + 8;
    try {
      mdat = new Uint8Array(mdatSize);
    } catch(err) {
      this.observer.trigger(Event.ERROR, {type : ErrorTypes.MUX_ERROR, level: this.level, id : this.id, details: ErrorDetails.REMUX_ALLOC_ERROR, fatal: false, bytes : mdatSize, reason: `fail allocating video mdat ${mdatSize}`});
      return;
    }
    let view = new DataView(mdat.buffer);
    view.setUint32(0, mdatSize);
    mdat.set(MP4.types.mdat, 4);

    for (let i = 0 ; i < nbSamples; i++) {
      let avcSample = inputSamples[i],
          avcSampleUnits = avcSample.units.units,
          mp4SampleLength = 0,
          compositionTimeOffset;
      // convert NALU bitstream to MP4 format (prepend NALU with size field)
      for(let j = 0, nbUnits = avcSampleUnits.length; j < nbUnits ; j++) {
        let unit = avcSampleUnits[j],
            unitData = unit.data,
            unitDataLen = unit.data.byteLength;
        view.setUint32(offset, unitDataLen);
        offset += 4;
        mdat.set(unitData, offset);
        offset += unitDataLen;
        mp4SampleLength += 4 + unitDataLen;
      }

      if(!isSafari) {
        // expected sample duration is the Decoding Timestamp diff of consecutive samples
        if (i < nbSamples - 1) {
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
                deltaToFrameEnd = (audioTrackLength ? firstPTS + audioTrackLength * pesTimeScale : this.nextAudioPts) - avcSample.pts;
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


      //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${avcSample.pts}/${avcSample.dts}/${initDTS}/${ptsnorm}/${dtsnorm}/${(avcSample.pts/4294967296).toFixed(3)}');
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
    let dropped = track.dropped;
    track.len = 0;
    track.nbNalu = 0;
    track.dropped = 0;
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
      id : this.id,
      level : this.level,
      sn : this.sn,
      data1: moof,
      data2: mdat,
      startPTS: firstPTS / pesTimeScale,
      endPTS: (lastPTS + pes2mp4ScaleFactor * mp4SampleDuration) / pesTimeScale,
      startDTS: firstDTS / pesTimeScale,
      endDTS: this.nextAvcDts / pesTimeScale,
      type: 'video',
      nb: outputSamples.length,
      dropped : dropped
    };
    this.observer.trigger(Event.FRAG_PARSING_DATA, data);
    return data;
  }

  remuxAudio(track, timeOffset, contiguous,accurateTimeOffset) {
    const pesTimeScale = this.PES_TIMESCALE,
          mp4timeScale = track.timescale,
          pes2mp4ScaleFactor = pesTimeScale/mp4timeScale,
          expectedSampleDuration = track.timescale * (track.isAAC ? 1024 : 1152) / track.audiosamplerate,
          pesFrameDuration = expectedSampleDuration * pes2mp4ScaleFactor,
          ptsNormalize = this._PTSNormalize,
          initDTS = this._initDTS,
          rawMPEG = !track.isAAC && this.typeSupported.mpeg;

    var view,
        offset = rawMPEG ? 0 : 8,
        audioSample, mp4Sample,
        unit,
        mdat, moof,
        firstPTS, firstDTS, lastDTS,
        pts, dts, ptsnorm, dtsnorm,
        outputSamples = [],
        inputSamples = [],
        fillFrame, newStamp,
        nextAudioPts;

    track.samples.sort(function(a, b) {
      return (a.pts-b.pts);
    });
    inputSamples = track.samples;

    // for audio samples, also consider consecutive fragments as being contiguous (even if a level switch occurs),
    // for sake of clarity:
    // consecutive fragments are frags with
    //  - less than 100ms gaps between new time offset and next expected PTS OR
    //  - less than 20 audio frames distance
    // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
    // this helps ensuring audio continuity
    // and this also avoids audio glitches/cut when switching quality, or reporting wrong duration on first audio frame

    nextAudioPts = this.nextAudioPts;
    contiguous |= (inputSamples.length && nextAudioPts &&
                   (Math.abs(timeOffset-nextAudioPts/pesTimeScale) < 0.1 ||
                    Math.abs((inputSamples[0].pts-nextAudioPts-this._initDTS)) < 20*pesFrameDuration)
                    );

    if (!contiguous) {
      // if fragments are not contiguous, let's use timeOffset to compute next Audio PTS
      nextAudioPts = timeOffset*pesTimeScale;
    }
    // If the audio track is missing samples, the frames seem to get "left-shifted" within the
    // resulting mp4 segment, causing sync issues and leaving gaps at the end of the audio segment.
    // In an effort to prevent this from happening, we inject frames here where there are gaps.
    // When possible, we inject a silent frame; when that's not possible, we duplicate the last
    // frame.

    // only inject/drop audio frames in case time offset is accurate
    if (accurateTimeOffset && track.isAAC) {
      for (let i = 0, nextPtsNorm = nextAudioPts; i < inputSamples.length; ) {
        // First, let's see how far off this frame is from where we expect it to be
        var sample = inputSamples[i],
            ptsNorm = ptsNormalize(sample.pts - initDTS, nextAudioPts),
            delta = ptsNorm - nextPtsNorm;

        // If we're overlapping by more than a duration, drop this sample
        if (delta <= -pesFrameDuration) {
          logger.warn(`Dropping 1 audio frame @ ${Math.round(nextPtsNorm/90)/1000}s due to ${Math.round(Math.abs(delta / 90))} ms overlap.`);
          inputSamples.splice(i, 1);
          track.len -= sample.unit.length;
          // Don't touch nextPtsNorm or i
        }
        // Otherwise, if we're more than a frame away from where we should be, insert missing frames
        // also only inject silent audio frames if currentTime !== 0 (nextPtsNorm !== 0)
        else if (delta >= pesFrameDuration && nextPtsNorm) {
          var missing = Math.round(delta / pesFrameDuration);
          logger.warn(`Injecting ${missing} audio frame @ ${Math.round(nextPtsNorm/90)/1000}s due to ${Math.round(delta / 90)} ms gap.`);
          for (var j = 0; j < missing; j++) {
            newStamp = nextPtsNorm + initDTS;
            newStamp = Math.max(newStamp, initDTS);
            fillFrame = AAC.getSilentFrame(track.manifestCodec || track.codec,track.channelCount);
            if (!fillFrame) {
              logger.log('Unable to get silent frame for given audio codec; duplicating last frame instead.');
              fillFrame = sample.unit.subarray();
            }
            inputSamples.splice(i, 0, {unit: fillFrame, pts: newStamp, dts: newStamp});
            track.len += fillFrame.length;
            nextPtsNorm += pesFrameDuration;
            i += 1;
          }

          // Adjust sample to next expected pts
          sample.pts = sample.dts = nextPtsNorm + initDTS;
          nextPtsNorm += pesFrameDuration;
          i += 1;
        }
        // Otherwise, we're within half a frame duration, so just adjust pts
        else {
          if (Math.abs(delta) > (0.1 * pesFrameDuration)) {
            //logger.log(`Invalid frame delta ${Math.round(ptsNorm - nextPtsNorm + pesFrameDuration)} at PTS ${Math.round(ptsNorm / 90)} (should be ${Math.round(pesFrameDuration)}).`);
          }
          nextPtsNorm += pesFrameDuration;
          if (i === 0) {
            sample.pts = sample.dts = initDTS + nextAudioPts;
          } else {
            sample.pts = sample.dts = inputSamples[i - 1].pts + pesFrameDuration;
          }
          i += 1;
        }
      }
    }


    for (let j =0 , nbSamples = inputSamples.length; j < nbSamples ; j++) {
      audioSample = inputSamples[j];
      unit = audioSample.unit;
      pts = audioSample.pts - initDTS;
      dts = audioSample.dts - initDTS;
      //logger.log(`Audio/PTS:${Math.round(pts/90)}`);
      // if not first sample
      if (lastDTS !== undefined) {
        ptsnorm = ptsNormalize(pts, lastDTS);
        dtsnorm = ptsNormalize(dts, lastDTS);
        mp4Sample.duration = Math.round((dtsnorm - lastDTS) / pes2mp4ScaleFactor);
      } else {
        ptsnorm = ptsNormalize(pts, nextAudioPts);
        dtsnorm = ptsNormalize(dts, nextAudioPts);
        let delta = Math.round(1000 * (ptsnorm - nextAudioPts) / pesTimeScale),
            numMissingFrames = 0;
        // if fragment are contiguous, detect hole/overlapping between fragments
        // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
        if (contiguous && track.isAAC) {
          // log delta
          if (delta) {
            if (delta > 0) {
              numMissingFrames = Math.round((ptsnorm - nextAudioPts) / pesFrameDuration);
              logger.log(`${delta} ms hole between AAC samples detected,filling it`);
              if (numMissingFrames > 0) {
                fillFrame = AAC.getSilentFrame(track.manifestCodec || track.codec,track.channelCount);
                if (!fillFrame) {
                  fillFrame = unit.subarray();
                }
                track.len += numMissingFrames * fillFrame.length;
              }
              // if we have frame overlap, overlapping for more than half a frame duraion
            } else if (delta < -12) {
              // drop overlapping audio frames... browser will deal with it
              logger.log(`${(-delta)} ms overlapping between AAC samples detected, drop frame`);
              track.len -= unit.byteLength;
              continue;
            }
            // set PTS/DTS to expected PTS/DTS
            ptsnorm = dtsnorm = nextAudioPts;
          }
        }
        // remember first PTS of our audioSamples, ensure value is positive
        firstPTS = Math.max(0, ptsnorm);
        firstDTS = Math.max(0, dtsnorm);
        if(track.len > 0) {
          /* concatenate the audio data and construct the mdat in place
            (need 8 more bytes to fill length and mdat type) */


          let mdatSize = rawMPEG ? track.len : track.len + 8;
          try {
            mdat = new Uint8Array(mdatSize);
          } catch(err) {
            this.observer.trigger(Event.ERROR, {type : ErrorTypes.MUX_ERROR, level: this.level, id : this.id, details: ErrorDetails.REMUX_ALLOC_ERROR, fatal: false, bytes : mdatSize, reason: `fail allocating audio mdat ${mdatSize}`});
            return;
          }
          if (!rawMPEG) {
            view = new DataView(mdat.buffer);
            view.setUint32(0, mdatSize);
            mdat.set(MP4.types.mdat, 4);
          }
        } else {
          // no audio samples
          return;
        }
        for (let i = 0; i < numMissingFrames; i++) {
          newStamp = ptsnorm - (numMissingFrames - i) * pesFrameDuration;
          fillFrame = AAC.getSilentFrame(track.manifestCodec || track.codec,track.channelCount);
          if (!fillFrame) {
            logger.log('Unable to get silent frame for given audio codec; duplicating this frame instead.');
            fillFrame = unit.subarray();
          }
          mdat.set(fillFrame, offset);
          offset += fillFrame.byteLength;
          mp4Sample = {
            size: fillFrame.byteLength,
            cts: 0,
            duration: 1024,
            flags: {
              isLeading: 0,
              isDependedOn: 0,
              hasRedundancy: 0,
              degradPrio: 0,
              dependsOn: 1,
            }
          };
          outputSamples.push(mp4Sample);
        }
      }
      mdat.set(unit, offset);
      let unitLen = unit.byteLength;
      offset += unitLen;
      //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${audioSample.pts}/${audioSample.dts}/${initDTS}/${ptsnorm}/${dtsnorm}/${(audioSample.pts/4294967296).toFixed(3)}');
      mp4Sample = {
        size: unitLen,
        cts: 0,
        duration: 0,
        flags: {
          isLeading: 0,
          isDependedOn: 0,
          hasRedundancy: 0,
          degradPrio: 0,
          dependsOn: 1,
        }
      };
      outputSamples.push(mp4Sample);
      lastDTS = dtsnorm;
    }
    var lastSampleDuration = 0;
    var nbSamples = outputSamples.length;
    //set last sample duration as being identical to previous sample
    if (nbSamples >= 2) {
      lastSampleDuration = outputSamples[nbSamples - 2].duration;
      mp4Sample.duration = lastSampleDuration;
    }
    if (nbSamples) {
      // next audio sample PTS should be equal to last sample PTS + duration
      this.nextAudioPts = ptsnorm + pes2mp4ScaleFactor * lastSampleDuration;
      //logger.log('Audio/PTS/PTSend:' + audioSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
      track.len = 0;
      track.samples = outputSamples;
      if (rawMPEG) {
        moof = new Uint8Array();
      } else {
        moof = MP4.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
      }
      track.samples = [];
      let audioData = {
        id : this.id,
        level : this.level,
        sn : this.sn,
        data1: moof,
        data2: mdat,
        startPTS: firstPTS / pesTimeScale,
        endPTS: this.nextAudioPts / pesTimeScale,
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
        nextAudioPts = this.nextAudioPts,

        // sync with video's timestamp
        startDTS = (nextAudioPts !== undefined ? nextAudioPts : videoData.startDTS * pesTimeScale) + this._initDTS,
        endDTS = videoData.endDTS * pesTimeScale + this._initDTS,
        // one sample's duration value
        sampleDuration = 1024,
        frameDuration = pes2mp4ScaleFactor * sampleDuration,

        // samples count of this segment's duration
        nbSamples = Math.ceil((endDTS - startDTS) / frameDuration),

        // silent frame
        silentFrame = AAC.getSilentFrame(track.manifestCodec || track.codec,track.channelCount);

        logger.warn('remux empty Audio');
    // Can't remux if we can't generate a silent frame...
    if (!silentFrame) {
      logger.trace('Unable to remuxEmptyAudio since we were unable to get a silent frame for given audio codec!');
      return;
    }

    let samples = [];
    for(var i = 0; i < nbSamples; i++) {
      var stamp = startDTS + i * frameDuration;
      samples.push({unit: silentFrame, pts: stamp, dts: stamp});
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
        id : this.id,
        level : this.level,
        sn : this.sn,
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
        id : this.id,
        level : this.level,
        sn : this.sn,
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
