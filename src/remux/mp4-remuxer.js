/**
 * fMP4 remuxer
 */

import Event from '../events';
import { logger } from '../utils/logger';
import MP4 from '../remux/mp4-generator';

class MP4Remuxer {
    constructor(observer) {
        this.observer = observer;
        this._initSegGenerated = false;
        this.PES2MP4SCALEFACTOR = 4;
        this.PES_TIMESCALE = 90000;
        this.MP4_TIMESCALE = this.PES_TIMESCALE / this.PES2MP4SCALEFACTOR;
    }

    get timescale() {
        return this.MP4_TIMESCALE;
    }

    destroy() {}

    insertDiscontinuity() {
        this._initPTS = this._initDTS = undefined;
    }

    remux(audioTrack, videoTrack, timeOffset) {
        // generate Init Segment if needed
        if (!this._initSegGenerated) {
            this._generateInitSegment(audioTrack, videoTrack, timeOffset);
        }
        //logger.log('nb AVC samples:' + videoTrack.samples.length);
        if (videoTrack.samples.length) {
            this._remuxAVCSamples(videoTrack, timeOffset);
        }
        //logger.log('nb AAC samples:' + audioTrack.samples.length);
        if (audioTrack.samples.length) {
            this._remuxAACSamples(audioTrack, timeOffset);
        }
        //notify end of parsing
        this.observer.trigger(Event.FRAG_PARSED);
    }

    _generateInitSegment(audioTrack, videoTrack, timeOffset) {
        if (videoTrack.id === -1) {
            //audio only
            if (audioTrack.config) {
                this.observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
                    audioMoov: MP4.initSegment([audioTrack]),
                    audioCodec: audioTrack.codec,
                    audioChannelCount: audioTrack.channelCount
                });
                this._initSegGenerated = true;
            }
            if (this._initPTS === undefined) {
                // remember first PTS of this demuxing context
                this._initPTS =
                    audioTrack.samples[0].pts - this.PES_TIMESCALE * timeOffset;
                this._initDTS =
                    audioTrack.samples[0].dts - this.PES_TIMESCALE * timeOffset;
            }
        } else if (audioTrack.id === -1) {
            //video only
            if (videoTrack.sps && videoTrack.pps) {
                this.observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
                    videoMoov: MP4.initSegment([videoTrack]),
                    videoCodec: videoTrack.codec,
                    videoWidth: videoTrack.width,
                    videoHeight: videoTrack.height
                });
                this._initSegGenerated = true;
                if (this._initPTS === undefined) {
                    // remember first PTS of this demuxing context
                    this._initPTS =
                        videoTrack.samples[0].pts -
                        this.PES_TIMESCALE * timeOffset;
                    this._initDTS =
                        videoTrack.samples[0].dts -
                        this.PES_TIMESCALE * timeOffset;
                }
            }
        } else {
            //audio and video
            if (audioTrack.config && videoTrack.sps && videoTrack.pps) {
                this.observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
                    audioMoov: MP4.initSegment([audioTrack]),
                    audioCodec: audioTrack.codec,
                    audioChannelCount: audioTrack.channelCount,
                    videoMoov: MP4.initSegment([videoTrack]),
                    videoCodec: videoTrack.codec,
                    videoWidth: videoTrack.width,
                    videoHeight: videoTrack.height
                });
                this._initSegGenerated = true;
                if (this._initPTS === undefined) {
                    // remember first PTS of this demuxing context
                    this._initPTS =
                        Math.min(
                            videoTrack.samples[0].pts,
                            audioTrack.samples[0].pts
                        ) -
                        this.PES_TIMESCALE * timeOffset;
                    this._initDTS =
                        Math.min(
                            videoTrack.samples[0].dts,
                            audioTrack.samples[0].dts
                        ) -
                        this.PES_TIMESCALE * timeOffset;
                }
            }
        }
    }

    _remuxAVCSamples(track, timeOffset) {
        var view,
            i = 8,
            avcSample,
            mp4Sample,
            mp4SampleLength,
            unit,
            lastSampleDTS,
            mdat,
            moof,
            firstPTS,
            firstDTS,
            pts,
            dts,
            ptsnorm,
            dtsnorm,
            samples = [];
        /* concatenate the video data and construct the mdat in place
      (need 8 more bytes to fill length and mpdat type) */
        mdat = new Uint8Array(track.len + 4 * track.nbNalu + 8);
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
            //logger.log('Video/PTS/DTS:' + avcSample.pts + '/' + avcSample.dts);
            if (lastSampleDTS !== undefined) {
                ptsnorm = this._PTSNormalize(pts, lastSampleDTS);
                dtsnorm = this._PTSNormalize(dts, lastSampleDTS);
                mp4Sample.duration =
                    (dtsnorm - lastSampleDTS) / this.PES2MP4SCALEFACTOR;
                if (mp4Sample.duration < 0) {
                    //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
                    mp4Sample.duration = 0;
                }
            } else {
                ptsnorm = this._PTSNormalize(pts, this.nextAvcPts);
                dtsnorm = this._PTSNormalize(dts, this.nextAvcPts);
                // check if fragments are contiguous (i.e. no missing frames between fragment)
                if (this.nextAvcPts) {
                    var delta = Math.round((ptsnorm - this.nextAvcPts) / 90),
                        absdelta = Math.abs(delta);
                    //logger.log('absdelta/avcSample.pts:' + absdelta + '/' + avcSample.pts);
                    // if delta is less than 300 ms, next loaded fragment is assumed to be contiguous with last one
                    if (absdelta < 300) {
                        //logger.log('Video next PTS:' + this.nextAvcPts);
                        if (delta > 1) {
                            logger.log(
                                `AVC:${delta} ms hole between fragments detected,filling it`
                            );
                        } else if (delta < -1) {
                            logger.log(
                                `AVC:${-delta} ms overlapping between fragments detected`
                            );
                        }
                        // set PTS to next PTS
                        ptsnorm = this.nextAvcPts;
                        // offset DTS as well, ensure that DTS is smaller or equal than new PTS
                        dtsnorm = Math.max(dtsnorm - delta, this.lastAvcDts);
                        // logger.log('Video/PTS/DTS adjusted:' + avcSample.pts + '/' + avcSample.dts);
                    } else {
                        // not contiguous timestamp, check if PTS is within acceptable range
                        var expectedPTS = this.PES_TIMESCALE * timeOffset;
                        // check if there is any unexpected drift between expected timestamp and real one
                        if (
                            Math.abs(expectedPTS - ptsnorm) >
                            this.PES_TIMESCALE * 3600
                        ) {
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
        this.nextAvcPts =
            ptsnorm + mp4Sample.duration * this.PES2MP4SCALEFACTOR;
        //logger.log('Video/lastAvcDts/nextAvcPts:' + this.lastAvcDts + '/' + this.nextAvcPts);
        track.len = 0;
        track.nbNalu = 0;
        track.samples = samples;
        moof = MP4.moof(
            track.sequenceNumber++,
            firstDTS / this.PES2MP4SCALEFACTOR,
            track
        );
        track.samples = [];
        this.observer.trigger(Event.FRAG_PARSING_DATA, {
            moof: moof,
            mdat: mdat,
            startPTS: firstPTS / this.PES_TIMESCALE,
            endPTS: this.nextAvcPts / this.PES_TIMESCALE,
            startDTS: firstDTS / this.PES_TIMESCALE,
            endDTS:
                (dtsnorm + this.PES2MP4SCALEFACTOR * mp4Sample.duration) /
                this.PES_TIMESCALE,
            type: 'video',
            nb: samples.length
        });
    }

    _remuxAACSamples(track, timeOffset) {
        var view,
            i = 8,
            aacSample,
            mp4Sample,
            unit,
            lastSampleDTS,
            mdat,
            moof,
            firstPTS,
            firstDTS,
            pts,
            dts,
            ptsnorm,
            dtsnorm,
            samples = [];
        /* concatenate the audio data and construct the mdat in place
      (need 8 more bytes to fill length and mpdat type) */
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
            if (lastSampleDTS !== undefined) {
                ptsnorm = this._PTSNormalize(pts, lastSampleDTS);
                dtsnorm = this._PTSNormalize(dts, lastSampleDTS);
                // we use DTS to compute sample duration, but we use PTS to compute initPTS which is used to sync audio and video
                mp4Sample.duration =
                    (dtsnorm - lastSampleDTS) / this.PES2MP4SCALEFACTOR;
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
                    var delta = Math.round(
                            1000 *
                                (ptsnorm - this.nextAacPts) /
                                this.PES_TIMESCALE
                        ),
                        absdelta = Math.abs(delta);
                    // if delta is less than 300 ms, next loaded fragment is assumed to be contiguous with last one
                    if (absdelta > 1 && absdelta < 300) {
                        if (delta > 0) {
                            logger.log(
                                `AAC:${delta} ms hole between fragments detected,filling it`
                            );
                            // set PTS to next PTS, and ensure PTS is greater or equal than last DTS
                            ptsnorm = Math.max(
                                this.nextAacPts,
                                this.lastAacDts
                            );
                            dtsnorm = ptsnorm;
                            //logger.log('Audio/PTS/DTS adjusted:' + aacSample.pts + '/' + aacSample.dts);
                        } else {
                            logger.log(
                                `AAC:${-delta} ms overlapping between fragments detected`
                            );
                        }
                    } else if (absdelta) {
                        // not contiguous timestamp, check if PTS is within acceptable range
                        var expectedPTS = this.PES_TIMESCALE * timeOffset;
                        //logger.log('expectedPTS/PTSnorm:${expectedPTS}/${ptsnorm}/${expectedPTS-ptsnorm}');
                        // check if there is any unexpected drift between expected timestamp and real one
                        if (
                            Math.abs(expectedPTS - ptsnorm) >
                            this.PES_TIMESCALE * 3600
                        ) {
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
                duration: 0,
                flags: {
                    isLeading: 0,
                    isDependedOn: 0,
                    hasRedundancy: 0,
                    degradPrio: 0,
                    dependsOn: 1
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
        this.nextAacPts =
            ptsnorm + this.PES2MP4SCALEFACTOR * mp4Sample.duration;
        //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
        track.len = 0;
        track.samples = samples;
        moof = MP4.moof(
            track.sequenceNumber++,
            firstDTS / this.PES2MP4SCALEFACTOR,
            track
        );
        track.samples = [];
        this.observer.trigger(Event.FRAG_PARSING_DATA, {
            moof: moof,
            mdat: mdat,
            startPTS: firstPTS / this.PES_TIMESCALE,
            endPTS: this.nextAacPts / this.PES_TIMESCALE,
            startDTS: firstDTS / this.PES_TIMESCALE,
            endDTS:
                (dtsnorm + this.PES2MP4SCALEFACTOR * mp4Sample.duration) /
                this.PES_TIMESCALE,
            type: 'audio',
            nb: samples.length
        });
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
