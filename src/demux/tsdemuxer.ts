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

import * as ADTS from './adts';
import * as MpegAudio from './mpegaudio';
import { Events, HlsEventEmitter } from '../events';
import ExpGolomb from './exp-golomb';
import SampleAesDecrypter from './sample-aes';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';
import {
  DemuxedAvcTrack,
  DemuxedAudioTrack,
  DemuxedTrack,
  Demuxer,
  DemuxerResult,
  AvcSample, DemuxedMetadataTrack
} from '../types/demuxer';
import { appendUint8Array } from '../utils/mp4-tools';
import { utf8ArrayToStr } from '../demux/id3';
import { HlsConfig } from '../config';

// We are using fixed track IDs for driving the MP4 remuxer
// instead of following the TS PIDs.
// There is no reason not to do this and some browsers/SourceBuffer-demuxers
// may not like if there are TrackID "switches"
// See https://github.com/video-dev/hls.js/issues/1331
// Here we are mapping our internal track types to constant MP4 track IDs
// With MSE currently one can only have one track of each, and we are muxing
// whatever video/audio rendition in them.
const RemuxerTrackIdConfig = {
  video: 1,
  audio: 2,
  id3: 3,
  text: 4
};

class TSDemuxer implements Demuxer {
  static readonly minProbeByteLength = 188;

  private readonly observer: HlsEventEmitter;
  private readonly config: HlsConfig;
  private typeSupported: any;

  private sampleAes: any = null;
  private pmtParsed: boolean = false;
  private contiguous: boolean = false;
  private audioCodec!: string;
  private videoCodec!: string;
  private _duration: number = 0;
  private aacLastPTS: number | null = null;
  private _initPTS: number | null = null;
  private _initDTS?: number | null = null;
  private _pmtId: number = -1;

  private _avcTrack!: DemuxedAvcTrack;
  private _audioTrack!: DemuxedAudioTrack;
  private _id3Track!: DemuxedMetadataTrack;
  private _txtTrack!: DemuxedTrack;
  private aacOverFlow: any;
  private avcSample: AvcSample | null = null;
  private remainderData: Uint8Array | null = null;

  constructor (observer: HlsEventEmitter, config: HlsConfig, typeSupported) {
    this.observer = observer;
    this.config = config;
    this.typeSupported = typeSupported;
  }

  static probe (data) {
    const syncOffset = TSDemuxer._syncOffset(data);
    if (syncOffset < 0) {
      return false;
    } else {
      if (syncOffset) {
        logger.warn(`MPEG2-TS detected but first sync word found @ offset ${syncOffset}, junk ahead ?`);
      }

      return true;
    }
  }

  static _syncOffset (data) {
    // scan 1000 first bytes
    const scanwindow = Math.min(1000, data.length - 3 * 188);
    let i = 0;
    while (i < scanwindow) {
      // a TS fragment should contain at least 3 TS packets, a PAT, a PMT, and one PID, each starting with 0x47
      if (data[i] === 0x47 && data[i + 188] === 0x47 && data[i + 2 * 188] === 0x47) {
        return i;
      } else {
        i++;
      }
    }
    return -1;
  }

  /**
   * Creates a track model internal to demuxer used to drive remuxing input
   *
   * @param {string} type 'audio' | 'video' | 'id3' | 'text'
   * @param {number} duration
   * @return {object} TSDemuxer's internal track model
   */
  static createTrack (type, duration) : DemuxedTrack {
    return {
      container: type === 'video' || type === 'audio' ? 'video/mp2t' : undefined,
      type,
      id: RemuxerTrackIdConfig[type],
      pid: -1,
      inputTimeScale: 90000,
      sequenceNumber: 0,
      samples: [],
      dropped: 0,
      duration: type === 'audio' ? duration : undefined
    };
  }

  /**
   * Initializes a new init segment on the demuxer/remuxer interface. Needed for discontinuities/track-switches (or at stream start)
   * Resets all internal track instances of the demuxer.
  */
  resetInitSegment (audioCodec, videoCodec, duration) {
    this.pmtParsed = false;
    this._pmtId = -1;

    this._avcTrack = TSDemuxer.createTrack('video', duration);
    this._audioTrack = TSDemuxer.createTrack('audio', duration);
    this._id3Track = TSDemuxer.createTrack('id3', duration);
    this._txtTrack = TSDemuxer.createTrack('text', duration);
    this._audioTrack.isAAC = true;

    // flush any partial content
    this.aacOverFlow = null;
    this.aacLastPTS = null;
    this.avcSample = null;
    this.audioCodec = audioCodec;
    this.videoCodec = videoCodec;
    this._duration = duration;
  }

  resetTimeStamp () {
  }

  resetContiguity (): void {
    const { _audioTrack, _avcTrack, _id3Track } = this;
    if (_audioTrack) {
      _audioTrack.pesData = null;
    }
    if (_avcTrack) {
      _avcTrack.pesData = null;
    }
    if (_id3Track) {
      _id3Track.pesData = null;
    }
    this.aacOverFlow = null;
    this.aacLastPTS = null;
  }

  demux (data: Uint8Array, contiguous, timeOffset, isSampleAes = false, flush = false): DemuxerResult {
    if (!isSampleAes) {
      this.sampleAes = null;
    }

    this.contiguous = contiguous;
    let start;
    let stt;
    let pid;
    let atf;
    let offset;
    let pes;

    const avcTrack = this._avcTrack;
    const audioTrack = this._audioTrack;
    const id3Track = this._id3Track;

    let avcId = avcTrack.pid;
    let avcData = avcTrack.pesData;
    let audioId = audioTrack.pid;
    let id3Id = id3Track.pid;
    let audioData = audioTrack.pesData;
    let id3Data = id3Track.pesData;
    let unknownPIDs = false;
    let pmtParsed = this.pmtParsed;
    let pmtId = this._pmtId;

    let len = data.length;
    if (this.remainderData) {
      data = appendUint8Array(this.remainderData, data);
      len = data.length;
      this.remainderData = null;
    }

    if (len < 188 && !flush) {
      this.remainderData = data;
      return {
        audioTrack,
        avcTrack,
        id3Track,
        textTrack: this._txtTrack
      };
    }

    const syncOffset = Math.max(0, TSDemuxer._syncOffset(data));

    len -= (len + syncOffset) % 188;
    if (len < data.byteLength && !flush) {
      this.remainderData = new Uint8Array(data.buffer, len, data.buffer.byteLength - len);
    }

    // loop through TS packets
    for (start = syncOffset; start < len; start += 188) {
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
        switch (pid) {
        case avcId:
          if (stt) {
            if (avcData && (pes = parsePES(avcData))) {
              this._parseAVCPES(pes, false);
            }

            avcData = { data: [], size: 0 };
          }
          if (avcData) {
            avcData.data.push(data.subarray(offset, start + 188));
            avcData.size += start + 188 - offset;
          }
          break;
        case audioId:
          if (stt) {
            if (audioData && (pes = parsePES(audioData))) {
              if (audioTrack.isAAC) {
                this._parseAACPES(pes);
              } else {
                this._parseMPEGPES(pes);
              }
            }
            audioData = { data: [], size: 0 };
          }
          if (audioData) {
            audioData.data.push(data.subarray(offset, start + 188));
            audioData.size += start + 188 - offset;
          }
          break;
        case id3Id:
          if (stt) {
            if (id3Data && (pes = parsePES(id3Data))) {
              this._parseID3PES(pes);
            }

            id3Data = { data: [], size: 0 };
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
        case pmtId: {
          if (stt) {
            offset += data[offset] + 1;
          }

          const parsedPIDs = parsePMT(data, offset, this.typeSupported.mpeg === true || this.typeSupported.mp3 === true, isSampleAes);

          // only update track id if track PID found while parsing PMT
          // this is to avoid resetting the PID to -1 in case
          // track PID transiently disappears from the stream
          // this could happen in case of transient missing audio samples for example
          // NOTE this is only the PID of the track as found in TS,
          // but we are not using this for MP4 track IDs.
          avcId = parsedPIDs.avc;
          if (avcId > 0) {
            avcTrack.pid = avcId;
          }

          audioId = parsedPIDs.audio;
          if (audioId > 0) {
            audioTrack.pid = audioId;
            audioTrack.isAAC = parsedPIDs.isAAC;
          }
          id3Id = parsedPIDs.id3;
          if (id3Id > 0) {
            id3Track.pid = id3Id;
          }

          if (unknownPIDs && !pmtParsed) {
            logger.log('reparse from beginning');
            unknownPIDs = false;
            // we set it to -188, the += 188 in the for loop will reset start to 0
            start = syncOffset - 188;
          }
          pmtParsed = this.pmtParsed = true;
          break;
        }
        case 17:
        case 0x1fff:
          break;
        default:
          unknownPIDs = true;
          break;
        }
      } else {
        this.observer.emit(Events.ERROR, Events.ERROR, {
          type: ErrorTypes.MEDIA_ERROR,
          details: ErrorDetails.FRAG_PARSING_ERROR,
          fatal: false,
          reason: 'TS packet did not start with 0x47'
        });
      }
    }

    avcTrack.pesData = avcData;
    audioTrack.pesData = audioData;
    id3Track.pesData = id3Data;

    return {
      audioTrack,
      avcTrack,
      id3Track,
      textTrack: this._txtTrack
    };
  }

  flush () {
    const { remainderData } = this;
    this.remainderData = null;
    let result;
    if (remainderData) {
      result = this.demux(remainderData, this.contiguous, -1, false, true);
    } else {
      result = {
        audioTrack: this._audioTrack,
        avcTrack: this._avcTrack,
        textTrack: this._txtTrack,
        id3Track: this._id3Track
      };
    }
    this.extractRemainingSamples(result);
    return result;
  }

  private extractRemainingSamples (demuxResult: DemuxerResult) {
    const { audioTrack, avcTrack, id3Track } = demuxResult;
    const avcData = avcTrack.pesData;
    const audioData = audioTrack.pesData;
    const id3Data = id3Track.pesData;
    // try to parse last PES packets
    let pes;
    if (avcData && (pes = parsePES(avcData))) {
      this._parseAVCPES(pes, true);
      avcTrack.pesData = null;
    } else {
      // either avcData null or PES truncated, keep it for next frag parsing
      avcTrack.pesData = avcData;
    }

    if (audioData && (pes = parsePES(audioData))) {
      if (audioTrack.isAAC) {
        this._parseAACPES(pes);
      } else {
        this._parseMPEGPES(pes);
      }

      audioTrack.pesData = null;
    } else {
      if (audioData?.size) {
        logger.log('last AAC PES packet truncated,might overlap between fragments');
      }

      // either audioData null or PES truncated, keep it for next frag parsing
      audioTrack.pesData = audioData;
    }

    if (id3Data && (pes = parsePES(id3Data))) {
      this._parseID3PES(pes);
      id3Track.pesData = null;
    } else {
      // either id3Data null or PES truncated, keep it for next frag parsing
      id3Track.pesData = id3Data;
    }
  }

  demuxSampleAes (data, decryptData, timeOffset): Promise <DemuxerResult> {
    const demuxResult = this.demux(data, timeOffset, true);
    const sampleAes = this.sampleAes = new SampleAesDecrypter(this.observer, this.config, decryptData, this.discardEPB);
    return new Promise((resolve, reject) => {
      this.decrypt(demuxResult.audioTrack, demuxResult.avcTrack, sampleAes)
        .then(() => {
          resolve(demuxResult);
        });
    });
  }

  decrypt (audioTrack, videoTrack, sampleAes): Promise<void> {
    return new Promise((resolve) => {
      if (audioTrack.samples && audioTrack.isAAC) {
        sampleAes.decryptAacSamples(audioTrack.samples, 0, () => {
          if (videoTrack.samples) {
            sampleAes.decryptAvcSamples(videoTrack.samples, 0, 0, () => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else if (videoTrack.samples) {
        sampleAes.decryptAvcSamples(videoTrack.samples, 0, 0, () => {
          resolve();
        });
      }
    });
  }

  destroy () {
    this._initPTS = this._initDTS = null;
    this._duration = 0;
  }

  pushAccessUnit (avcSample, avcTrack) {
    if (avcSample.units.length && avcSample.frame) {
      // if sample does not have PTS/DTS, patch with last sample PTS/DTS
      if (isNaN(avcSample.pts)) {
        const samples = avcTrack.samples;
        const nbSamples = samples.length;
        if (nbSamples) {
          const lastSample = samples[nbSamples - 1];
          avcSample.pts = lastSample.pts;
          avcSample.dts = lastSample.dts;
        } else {
          // dropping samples, no timestamp found
          avcTrack.dropped++;
          return;
        }
      }
      avcTrack.samples.push(avcSample);
    }
    if (avcSample.debug.length) {
      logger.log(avcSample.pts + '/' + avcSample.dts + ':' + avcSample.debug);
    }
  }

  _parseAVCPES (pes, last) {
    // logger.log('parse new PES');
    const track = this._avcTrack;
    const units = this._parseAVCNALu(pes.data);
    const debug = false;
    let expGolombDecoder;
    let avcSample = this.avcSample;
    let push;
    let spsfound = false;
    let i;
    const pushAccessUnit = this.pushAccessUnit.bind(this);
    // free pes.data to save up some memory
    pes.data = null;

    // if new NAL units found and last sample still there, let's push ...
    // this helps parsing streams with missing AUD (only do this if AUD never found)
    if (avcSample && units.length && !track.audFound) {
      pushAccessUnit(avcSample, track);
      avcSample = this.avcSample = createAVCSample(false, pes.pts, pes.dts, '');
    }

    units.forEach(unit => {
      switch (unit.type) {
      // NDR
      case 1: {
        push = true;
        if (!avcSample) {
          avcSample = this.avcSample = createAVCSample(true, pes.pts, pes.dts, '');
        }

        if (debug) {
          avcSample.debug += 'NDR ';
        }

        avcSample.frame = true;
        const data = unit.data;
        // only check slice type to detect KF in case SPS found in same packet (any keyframe is preceded by SPS ...)
        if (spsfound && data.length > 4) {
          // retrieve slice type by parsing beginning of NAL unit (follow H264 spec, slice_header definition) to detect keyframe embedded in NDR
          const sliceType = new ExpGolomb(data).readSliceType();
          // 2 : I slice, 4 : SI slice, 7 : I slice, 9: SI slice
          // SI slice : A slice that is coded using intra prediction only and using quantisation of the prediction samples.
          // An SI slice can be coded such that its decoded samples can be constructed identically to an SP slice.
          // I slice: A slice that is not an SI slice that is decoded using intra prediction only.
          // if (sliceType === 2 || sliceType === 7) {
          if (sliceType === 2 || sliceType === 4 || sliceType === 7 || sliceType === 9) {
            avcSample.key = true;
          }
        }
        break;
        // IDR
      }
      case 5:
        push = true;
        // handle PES not starting with AUD
        if (!avcSample) {
          avcSample = this.avcSample = createAVCSample(true, pes.pts, pes.dts, '');
        }

        if (debug) {
          avcSample.debug += 'IDR ';
        }

        avcSample.key = true;
        avcSample.frame = true;
        break;
        // SEI
      case 6: {
        push = true;
        if (debug && avcSample) {
          avcSample.debug += 'SEI ';
        }

        expGolombDecoder = new ExpGolomb(this.discardEPB(unit.data));

        // skip frameType
        expGolombDecoder.readUByte();

        let payloadType = 0;
        let payloadSize = 0;
        let endOfCaptions = false;
        let b = 0;

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

            const countryCode = expGolombDecoder.readUByte();

            if (countryCode === 181) {
              const providerCode = expGolombDecoder.readUShort();

              if (providerCode === 49) {
                const userStructure = expGolombDecoder.readUInt();

                if (userStructure === 0x47413934) {
                  const userDataType = expGolombDecoder.readUByte();

                  // Raw CEA-608 bytes wrapped in CEA-708 packet
                  if (userDataType === 3) {
                    const firstByte = expGolombDecoder.readUByte();
                    const secondByte = expGolombDecoder.readUByte();

                    const totalCCs = 31 & firstByte;
                    const byteArray = [firstByte, secondByte];

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
          } else if (payloadType === 5 && expGolombDecoder.bytesAvailable !== 0) {
            endOfCaptions = true;

            if (payloadSize > 16) {
              const uuidStrArray: Array<string> = [];
              for (i = 0; i < 16; i++) {
                uuidStrArray.push(expGolombDecoder.readUByte().toString(16));

                if (i === 3 || i === 5 || i === 7 || i === 9) {
                  uuidStrArray.push('-');
                }
              }
              const length = payloadSize - 16;
              const userDataPayloadBytes = new Uint8Array(length);
              for (i = 0; i < length; i++) {
                userDataPayloadBytes[i] = expGolombDecoder.readUByte();
              }

              this._insertSampleInOrder(this._txtTrack.samples, {
                pts: pes.pts,
                payloadType: payloadType,
                uuid: uuidStrArray.join(''),
                userData: utf8ArrayToStr(userDataPayloadBytes),
                userDataBytes: userDataPayloadBytes
              });
            }
          } else if (payloadSize < expGolombDecoder.bytesAvailable) {
            for (i = 0; i < payloadSize; i++) {
              expGolombDecoder.readUByte();
            }
          }
        }
        break;
        // SPS
      }
      case 7:
        push = true;
        spsfound = true;
        if (debug && avcSample) {
          avcSample.debug += 'SPS ';
        }

        if (!track.sps) {
          expGolombDecoder = new ExpGolomb(unit.data);
          const config = expGolombDecoder.readSPS();
          track.width = config.width;
          track.height = config.height;
          track.pixelRatio = config.pixelRatio;
          track.sps = [unit.data];
          track.duration = this._duration;
          const codecarray = unit.data.subarray(1, 4);
          let codecstring = 'avc1.';
          for (i = 0; i < 3; i++) {
            let h = codecarray[i].toString(16);
            if (h.length < 2) {
              h = '0' + h;
            }

            codecstring += h;
          }
          track.codec = codecstring;
        }
        break;
        // PPS
      case 8:
        push = true;
        if (debug && avcSample) {
          avcSample.debug += 'PPS ';
        }

        if (!track.pps) {
          track.pps = [unit.data];
        }

        break;
        // AUD
      case 9:
        push = false;
        track.audFound = true;
        if (avcSample) {
          pushAccessUnit(avcSample, track);
        }

        avcSample = this.avcSample = createAVCSample(false, pes.pts, pes.dts, debug ? 'AUD ' : '');
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
      if (avcSample && push) {
        const units = avcSample.units;
        units.push(unit);
      }
    });
    // if last PES packet, push samples
    if (last && avcSample) {
      pushAccessUnit(avcSample, track);
      this.avcSample = null;
    }
  }

  _insertSampleInOrder (arr, data) {
    const len = arr.length;
    if (len > 0) {
      if (data.pts >= arr[len - 1].pts) {
        arr.push(data);
      } else {
        for (let pos = len - 1; pos >= 0; pos--) {
          if (data.pts < arr[pos].pts) {
            arr.splice(pos, 0, data);
            break;
          }
        }
      }
    } else {
      arr.push(data);
    }
  }

  _getLastNalUnit () {
    let avcSample = this.avcSample;
    let lastUnit;
    // try to fallback to previous sample if current one is empty
    if (!avcSample || avcSample.units.length === 0) {
      const samples = this._avcTrack.samples;
      avcSample = samples[samples.length - 1];
    }
    if (avcSample?.units) {
      const units = avcSample.units;
      lastUnit = units[units.length - 1];
    }
    return lastUnit;
  }

  _parseAVCNALu (array): Array<any> {
    const len = array.byteLength;
    const track = this._avcTrack;
    let state = track.naluState || 0;
    const lastState = state;
    const units = [] as Array<any>;
    let i = 0;
    let value;
    let overflow;
    let unit;
    let unitType;
    let lastUnitStart = -1;
    let lastUnitType;
    // logger.log('PES:' + Hex.hexDump(array));

    if (state === -1) {
    // special use case where we found 3 or 4-byte start codes exactly at the end of previous PES packet
      lastUnitStart = 0;
      // NALu type is value read from offset 0
      lastUnitType = array[0] & 0x1f;
      state = 0;
      i = 1;
    }

    while (i < len) {
      value = array[i++];
      // optimization. state 0 and 1 are the predominant case. let's handle them outside of the switch/case
      if (!state) {
        state = value ? 0 : 1;
        continue;
      }
      if (state === 1) {
        state = value ? 0 : 2;
        continue;
      }
      // here we have state either equal to 2 or 3
      if (!value) {
        state = 3;
      } else if (value === 1) {
        if (lastUnitStart >= 0) {
          unit = { data: array.subarray(lastUnitStart, i - state - 1), type: lastUnitType };
          // logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
          units.push(unit);
        } else {
          // lastUnitStart is undefined => this is the first start code found in this PES packet
          // first check if start code delimiter is overlapping between 2 PES packets,
          // ie it started in last packet (lastState not zero)
          // and ended at the beginning of this PES packet (i <= 4 - lastState)
          const lastUnit = this._getLastNalUnit();
          if (lastUnit) {
            if (lastState && (i <= 4 - lastState)) {
              // start delimiter overlapping between PES packets
              // strip start delimiter bytes from the end of last NAL unit
              // check if lastUnit had a state different from zero
              if (lastUnit.state) {
                // strip last bytes
                lastUnit.data = lastUnit.data.subarray(0, lastUnit.data.byteLength - lastState);
              }
            }
            // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
            overflow = i - state - 1;
            if (overflow > 0) {
              // logger.log('first NALU found with overflow:' + overflow);
              const tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
              tmp.set(lastUnit.data, 0);
              tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
              lastUnit.data = tmp;
            }
          }
        }
        // check if we can read unit type
        if (i < len) {
          unitType = array[i] & 0x1f;
          // logger.log('find NALU @ offset:' + i + ',type:' + unitType);
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
    }
    if (lastUnitStart >= 0 && state >= 0) {
      unit = { data: array.subarray(lastUnitStart, len), type: lastUnitType, state: state };
      units.push(unit);
      // logger.log('pushing NALU, type/size/state:' + unit.type + '/' + unit.data.byteLength + '/' + state);
    }
    // no NALu found
    if (units.length === 0) {
      // append pes.data to previous NAL unit
      const lastUnit = this._getLastNalUnit();
      if (lastUnit) {
        const tmp = new Uint8Array(lastUnit.data.byteLength + array.byteLength);
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
  discardEPB (data) {
    const length = data.byteLength;
    const EPBPositions = [] as Array<number>;
    let i = 1;

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
    const newLength = length - EPBPositions.length;
    const newData = new Uint8Array(newLength);
    let sourceIndex = 0;

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

  _parseAACPES (pes) {
    const startOffset = 0;
    const track = this._audioTrack;
    const aacLastPTS = this.aacLastPTS;
    let aacOverFlow = this.aacOverFlow;
    let data = pes.data;
    let pts = pes.pts;
    let frameIndex;
    let offset;
    let stamp;
    let len;
    if (aacOverFlow) {
      const tmp = new Uint8Array(aacOverFlow.byteLength + data.byteLength);
      tmp.set(aacOverFlow, 0);
      tmp.set(data, aacOverFlow.byteLength);
      // logger.log(`AAC: append overflowing ${aacOverFlow.byteLength} bytes to beginning of new PES`);
      data = tmp;
    }
    // look for ADTS header (0xFFFx)
    for (offset = startOffset, len = data.length; offset < len - 1; offset++) {
      if (ADTS.isHeader(data, offset)) {
        break;
      }
    }
    // if ADTS header does not start straight from the beginning of the PES payload, raise an error
    if (offset) {
      let reason;
      let fatal;
      if (offset < len - 1) {
        reason = `AAC PES did not start with ADTS header,offset:${offset}`;
        fatal = false;
      } else {
        reason = 'no ADTS header found in AAC PES';
        fatal = true;
      }
      logger.warn(`parsing error:${reason}`);
      this.observer.emit(Events.ERROR, Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.FRAG_PARSING_ERROR,
        fatal,
        reason
      });
      if (fatal) {
        return;
      }
    }

    ADTS.initTrackConfig(track, this.observer, data, offset, this.audioCodec);
    frameIndex = 0;
    const frameDuration = ADTS.getFrameDuration(track.samplerate);

    // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
    // first sample PTS should be equal to last sample PTS + frameDuration
    if (aacOverFlow && aacLastPTS) {
      const newPTS = aacLastPTS + frameDuration;
      if (Math.abs(newPTS - pts) > 1) {
        logger.log(`[tsdemuxer]: AAC: align PTS for overlapping frames by ${Math.round((newPTS - pts) / 90)}`);
        pts = newPTS;
      }
    }

    // scan for aac samples
    while (offset < len) {
      if (ADTS.isHeader(data, offset)) {
        if ((offset + 5) < len) {
          const frame = ADTS.appendFrame(track, data, offset, pts, frameIndex);
          if (frame) {
            offset += frame.length;
            stamp = frame.sample.pts;
            frameIndex++;
            continue;
          }
        }
        // We are at an ADTS header, but do not have enough data for a frame
        // Remaining data will be added to aacOverFlow
        break;
      } else {
        // nothing found, keep looking
        offset++;
      }
    }

    if (offset < len) {
      aacOverFlow = data.subarray(offset, len);
      // logger.log(`AAC: overflow detected:${len-offset}`);
    } else {
      aacOverFlow = null;
    }

    this.aacOverFlow = aacOverFlow;
    this.aacLastPTS = stamp;
  }

  _parseMPEGPES (pes) {
    const data = pes.data;
    const length = data.length;
    let frameIndex = 0;
    let offset = 0;
    const pts = pes.pts;

    while (offset < length) {
      if (MpegAudio.isHeader(data, offset)) {
        const frame = MpegAudio.appendFrame(this._audioTrack, data, offset, pts, frameIndex);
        if (frame) {
          offset += frame.length;
          frameIndex++;
        } else {
          // logger.log('Unable to parse Mpeg audio frame');
          break;
        }
      } else {
        // nothing found, keep looking
        offset++;
      }
    }
  }

  _parseID3PES (pes) {
    this._id3Track.samples.push(pes);
  }
}

function createAVCSample (key: boolean, pts: number, dts: number, debug: string): AvcSample {
  return {
    key,
    frame: false,
    pts,
    dts,
    units: [],
    debug,
    length: 0
  };
}

function parsePAT (data, offset) {
  // skip the PSI header and parse the first PMT entry
  return (data[offset + 10] & 0x1F) << 8 | data[offset + 11];
  // logger.log('PMT PID:'  + this._pmtId);
}

function parsePMT (data, offset, mpegSupported, isSampleAes) {
  const result = { audio: -1, avc: -1, id3: -1, isAAC: true };
  const sectionLength = (data[offset + 1] & 0x0f) << 8 | data[offset + 2];
  const tableEnd = offset + 3 + sectionLength - 4;
  // to determine where the table is, we have to figure out how
  // long the program info descriptors are
  const programInfoLength = (data[offset + 10] & 0x0f) << 8 | data[offset + 11];
  // advance the offset to the first entry in the mapping table
  offset += 12 + programInfoLength;
  while (offset < tableEnd) {
    const pid = (data[offset + 1] & 0x1F) << 8 | data[offset + 2];
    switch (data[offset]) {
    case 0xcf: // SAMPLE-AES AAC
      if (!isSampleAes) {
        logger.log('ADTS AAC with AES-128-CBC frame encryption found in unencrypted stream');
        break;
      }
    /* falls through */
    case 0x0f: // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
      // logger.log('AAC PID:'  + pid);
      if (result.audio === -1) {
        result.audio = pid;
      }

      break;

      // Packetized metadata (ID3)
    case 0x15:
      // logger.log('ID3 PID:'  + pid);
      if (result.id3 === -1) {
        result.id3 = pid;
      }

      break;

    case 0xdb: // SAMPLE-AES AVC
      if (!isSampleAes) {
        logger.log('H.264 with AES-128-CBC slice encryption found in unencrypted stream');
        break;
      }
      /* falls through */
    case 0x1b: // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
      // logger.log('AVC PID:'  + pid);
      if (result.avc === -1) {
        result.avc = pid;
      }

      break;

      // ISO/IEC 11172-3 (MPEG-1 audio)
      // or ISO/IEC 13818-3 (MPEG-2 halved sample rate audio)
    case 0x03:
    case 0x04:
      // logger.log('MPEG PID:'  + pid);
      if (!mpegSupported) {
        logger.log('MPEG audio found, not supported in this browser');
      } else if (result.audio === -1) {
        result.audio = pid;
        result.isAAC = false;
      }
      break;

    case 0x24:
      logger.warn('Unsupported HEVC stream type found');
      break;

    default:
      // logger.log('unknown stream type:' + data[offset]);
      break;
    }
    // move to the next table entry
    // skip past the elementary stream descriptors, if present
    offset += ((data[offset + 3] & 0x0F) << 8 | data[offset + 4]) + 5;
  }
  return result;
}

function parsePES (stream) {
  let i = 0;
  let frag;
  let pesFlags;
  let pesLen;
  let pesHdrLen;
  let pesData;
  let pesPts;
  let pesDts;
  let payloadStartOffset;
  const data = stream.data;
  // safety check
  if (!stream || stream.size === 0) {
    return null;
  }

  // we might need up to 19 bytes to read PES header
  // if first chunk of data is less than 19 bytes, let's merge it with following ones until we get 19 bytes
  // usually only one merge is needed (and this is rare ...)
  while (data[0].length < 19 && data.length > 1) {
    const newData = new Uint8Array(data[0].length + data[1].length);
    newData.set(data[0]);
    newData.set(data[1], data[0].length);
    data[0] = newData;
    data.splice(1, 1);
  }
  // retrieve PTS/DTS from first fragment
  frag = data[0];
  const pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
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
        pesDts = (frag[14] & 0x0E) * 536870912 +// 1 << 29
          (frag[15] & 0xFF) * 4194304 +// 1 << 22
          (frag[16] & 0xFE) * 16384 +// 1 << 14
          (frag[17] & 0xFF) * 128 +// 1 << 7
          (frag[18] & 0xFE) / 2;
        // check if greater than 2^32 -1
        if (pesDts > 4294967295) {
          // decrement 2^33
          pesDts -= 8589934592;
        }
        if (pesPts - pesDts > 60 * 90000) {
          logger.warn(`${Math.round((pesPts - pesDts) / 90000)}s delta between PTS and DTS, align them`);
          pesPts = pesDts;
        }
      } else {
        pesDts = pesPts;
      }
    }
    pesHdrLen = frag[8];
    // 9 bytes : 6 bytes for PES header + 3 bytes for PES extension
    payloadStartOffset = pesHdrLen + 9;
    if (stream.size <= payloadStartOffset) {
      return null;
    }
    stream.size -= payloadStartOffset;
    // reassemble PES packet
    pesData = new Uint8Array(stream.size);
    for (let j = 0, dataLen = data.length; j < dataLen; j++) {
      frag = data[j];
      let len = frag.byteLength;
      if (payloadStartOffset) {
        if (payloadStartOffset > len) {
          // trim full frag if PES header bigger than frag
          payloadStartOffset -= len;
          continue;
        } else {
          // trim partial frag if PES header smaller than frag
          frag = frag.subarray(payloadStartOffset);
          len -= payloadStartOffset;
          payloadStartOffset = 0;
        }
      }
      pesData.set(frag, i);
      i += len;
    }
    if (pesLen) {
      // payload size : remove PES header + PES extension
      pesLen -= pesHdrLen + 3;
    }
    return { data: pesData, pts: pesPts, dts: pesDts, len: pesLen };
  } else {
    return null;
  }
}

export default TSDemuxer;
