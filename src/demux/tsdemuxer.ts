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
import ExpGolomb from './exp-golomb';
import SampleAesDecrypter from './sample-aes';
import { Events } from '../events';
import {
  appendUint8Array,
  parseSEIMessageFromNALu,
  RemuxerTrackIdConfig,
} from '../utils/mp4-tools';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';
import type { HlsConfig } from '../config';
import type { HlsEventEmitter } from '../events';
import {
  DemuxedAvcTrack,
  DemuxedAudioTrack,
  DemuxedTrack,
  Demuxer,
  DemuxerResult,
  AvcSample,
  DemuxedMetadataTrack,
  DemuxedUserdataTrack,
  ElementaryStreamData,
  KeyData,
  MetadataSchema,
} from '../types/demuxer';
import { AudioFrame } from '../types/demuxer';

type ParsedTimestamp = {
  pts?: number;
  dts?: number;
};

type PES = ParsedTimestamp & {
  data: Uint8Array;
  len: number;
};

type ParsedAvcSample = ParsedTimestamp & Omit<AvcSample, 'pts' | 'dts'>;

export interface TypeSupported {
  mpeg: boolean;
  mp3: boolean;
  mp4: boolean;
}

const PACKET_LENGTH = 188;

class TSDemuxer implements Demuxer {
  private readonly observer: HlsEventEmitter;
  private readonly config: HlsConfig;
  private typeSupported: TypeSupported;

  private sampleAes: SampleAesDecrypter | null = null;
  private pmtParsed: boolean = false;
  private audioCodec?: string;
  private videoCodec?: string;
  private _duration: number = 0;
  private _pmtId: number = -1;

  private _avcTrack?: DemuxedAvcTrack;
  private _audioTrack?: DemuxedAudioTrack;
  private _id3Track?: DemuxedMetadataTrack;
  private _txtTrack?: DemuxedUserdataTrack;
  private aacOverFlow: AudioFrame | null = null;
  private avcSample: ParsedAvcSample | null = null;
  private remainderData: Uint8Array | null = null;

  constructor(
    observer: HlsEventEmitter,
    config: HlsConfig,
    typeSupported: TypeSupported
  ) {
    this.observer = observer;
    this.config = config;
    this.typeSupported = typeSupported;
  }

  static probe(data: Uint8Array) {
    const syncOffset = TSDemuxer.syncOffset(data);
    if (syncOffset > 0) {
      logger.warn(
        `MPEG2-TS detected but first sync word found @ offset ${syncOffset}`
      );
    }
    return syncOffset !== -1;
  }

  static syncOffset(data: Uint8Array): number {
    const length = data.length;
    const scanwindow =
      Math.min(PACKET_LENGTH * 5, data.length - PACKET_LENGTH) + 1;
    let i = 0;
    while (i < scanwindow) {
      // a TS init segment should contain at least 2 TS packets: PAT and PMT, each starting with 0x47
      let foundPat = false;
      for (let j = i; j < length; j += PACKET_LENGTH) {
        if (data[j] === 0x47) {
          if (!foundPat && parsePID(data, j) === 0) {
            foundPat = true;
          }
          if (foundPat && j + PACKET_LENGTH > scanwindow) {
            return i;
          }
        } else {
          break;
        }
      }
      i++;
    }
    return -1;
  }

  /**
   * Creates a track model internal to demuxer used to drive remuxing input
   */
  static createTrack(
    type: 'audio' | 'video' | 'id3' | 'text',
    duration?: number
  ): DemuxedTrack {
    return {
      container:
        type === 'video' || type === 'audio' ? 'video/mp2t' : undefined,
      type,
      id: RemuxerTrackIdConfig[type],
      pid: -1,
      inputTimeScale: 90000,
      sequenceNumber: 0,
      samples: [],
      dropped: 0,
      duration: type === 'audio' ? duration : undefined,
    };
  }

  /**
   * Initializes a new init segment on the demuxer/remuxer interface. Needed for discontinuities/track-switches (or at stream start)
   * Resets all internal track instances of the demuxer.
   */
  public resetInitSegment(
    initSegment: Uint8Array | undefined,
    audioCodec: string,
    videoCodec: string,
    trackDuration: number
  ) {
    this.pmtParsed = false;
    this._pmtId = -1;

    this._avcTrack = TSDemuxer.createTrack('video') as DemuxedAvcTrack;
    this._audioTrack = TSDemuxer.createTrack(
      'audio',
      trackDuration
    ) as DemuxedAudioTrack;
    this._id3Track = TSDemuxer.createTrack('id3') as DemuxedMetadataTrack;
    this._txtTrack = TSDemuxer.createTrack('text') as DemuxedUserdataTrack;
    this._audioTrack.segmentCodec = 'aac';

    // flush any partial content
    this.aacOverFlow = null;
    this.avcSample = null;
    this.remainderData = null;
    this.audioCodec = audioCodec;
    this.videoCodec = videoCodec;
    this._duration = trackDuration;
  }

  public resetTimeStamp() {}

  public resetContiguity(): void {
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
    this.avcSample = null;
    this.remainderData = null;
  }

  public demux(
    data: Uint8Array,
    timeOffset: number,
    isSampleAes = false,
    flush = false
  ): DemuxerResult {
    if (!isSampleAes) {
      this.sampleAes = null;
    }

    let pes: PES | null;

    const videoTrack = this._avcTrack as DemuxedAvcTrack;
    const audioTrack = this._audioTrack as DemuxedAudioTrack;
    const id3Track = this._id3Track as DemuxedMetadataTrack;
    const textTrack = this._txtTrack as DemuxedUserdataTrack;

    let avcId = videoTrack.pid;
    let avcData = videoTrack.pesData;
    let audioId = audioTrack.pid;
    let id3Id = id3Track.pid;
    let audioData = audioTrack.pesData;
    let id3Data = id3Track.pesData;
    let unknownPID: number | null = null;
    let pmtParsed = this.pmtParsed;
    let pmtId = this._pmtId;

    let len = data.length;
    if (this.remainderData) {
      data = appendUint8Array(this.remainderData, data);
      len = data.length;
      this.remainderData = null;
    }

    if (len < PACKET_LENGTH && !flush) {
      this.remainderData = data;
      return {
        audioTrack,
        videoTrack,
        id3Track,
        textTrack,
      };
    }

    const syncOffset = Math.max(0, TSDemuxer.syncOffset(data));
    len -= (len - syncOffset) % PACKET_LENGTH;
    if (len < data.byteLength && !flush) {
      this.remainderData = new Uint8Array(
        data.buffer,
        len,
        data.buffer.byteLength - len
      );
    }

    // loop through TS packets
    let tsPacketErrors = 0;
    for (let start = syncOffset; start < len; start += PACKET_LENGTH) {
      if (data[start] === 0x47) {
        const stt = !!(data[start + 1] & 0x40);
        const pid = parsePID(data, start);
        const atf = (data[start + 3] & 0x30) >> 4;

        // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
        let offset: number;
        if (atf > 1) {
          offset = start + 5 + data[start + 4];
          // continue if there is only adaptation field
          if (offset === start + PACKET_LENGTH) {
            continue;
          }
        } else {
          offset = start + 4;
        }
        switch (pid) {
          case avcId:
            if (stt) {
              if (avcData && (pes = parsePES(avcData))) {
                this.parseAVCPES(videoTrack, textTrack, pes, false);
              }

              avcData = { data: [], size: 0 };
            }
            if (avcData) {
              avcData.data.push(data.subarray(offset, start + PACKET_LENGTH));
              avcData.size += start + PACKET_LENGTH - offset;
            }
            break;
          case audioId:
            if (stt) {
              if (audioData && (pes = parsePES(audioData))) {
                switch (audioTrack.segmentCodec) {
                  case 'aac':
                    this.parseAACPES(audioTrack, pes);
                    break;
                  case 'mp3':
                    this.parseMPEGPES(audioTrack, pes);
                    break;
                }
              }
              audioData = { data: [], size: 0 };
            }
            if (audioData) {
              audioData.data.push(data.subarray(offset, start + PACKET_LENGTH));
              audioData.size += start + PACKET_LENGTH - offset;
            }
            break;
          case id3Id:
            if (stt) {
              if (id3Data && (pes = parsePES(id3Data))) {
                this.parseID3PES(id3Track, pes);
              }

              id3Data = { data: [], size: 0 };
            }
            if (id3Data) {
              id3Data.data.push(data.subarray(offset, start + PACKET_LENGTH));
              id3Data.size += start + PACKET_LENGTH - offset;
            }
            break;
          case 0:
            if (stt) {
              offset += data[offset] + 1;
            }

            pmtId = this._pmtId = parsePAT(data, offset);
            // logger.log('PMT PID:'  + this._pmtId);
            break;
          case pmtId: {
            if (stt) {
              offset += data[offset] + 1;
            }

            const parsedPIDs = parsePMT(
              data,
              offset,
              this.typeSupported,
              isSampleAes
            );

            // only update track id if track PID found while parsing PMT
            // this is to avoid resetting the PID to -1 in case
            // track PID transiently disappears from the stream
            // this could happen in case of transient missing audio samples for example
            // NOTE this is only the PID of the track as found in TS,
            // but we are not using this for MP4 track IDs.
            avcId = parsedPIDs.avc;
            if (avcId > 0) {
              videoTrack.pid = avcId;
            }

            audioId = parsedPIDs.audio;
            if (audioId > 0) {
              audioTrack.pid = audioId;
              audioTrack.segmentCodec = parsedPIDs.segmentCodec;
            }
            id3Id = parsedPIDs.id3;
            if (id3Id > 0) {
              id3Track.pid = id3Id;
            }

            if (unknownPID !== null && !pmtParsed) {
              logger.warn(
                `MPEG-TS PMT found at ${start} after unknown PID '${unknownPID}'. Backtracking to sync byte @${syncOffset} to parse all TS packets.`
              );
              unknownPID = null;
              // we set it to -188, the += 188 in the for loop will reset start to 0
              start = syncOffset - 188;
            }
            pmtParsed = this.pmtParsed = true;
            break;
          }
          case 0x11:
          case 0x1fff:
            break;
          default:
            unknownPID = pid;
            break;
        }
      } else {
        tsPacketErrors++;
      }
    }

    if (tsPacketErrors > 0) {
      const error = new Error(
        `Found ${tsPacketErrors} TS packet/s that do not start with 0x47`
      );
      this.observer.emit(Events.ERROR, Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.FRAG_PARSING_ERROR,
        fatal: false,
        error,
        reason: error.message,
      });
    }

    videoTrack.pesData = avcData;
    audioTrack.pesData = audioData;
    id3Track.pesData = id3Data;

    const demuxResult: DemuxerResult = {
      audioTrack,
      videoTrack,
      id3Track,
      textTrack,
    };

    if (flush) {
      this.extractRemainingSamples(demuxResult);
    }

    return demuxResult;
  }

  public flush(): DemuxerResult | Promise<DemuxerResult> {
    const { remainderData } = this;
    this.remainderData = null;
    let result: DemuxerResult;
    if (remainderData) {
      result = this.demux(remainderData, -1, false, true);
    } else {
      result = {
        videoTrack: this._avcTrack as DemuxedAvcTrack,
        audioTrack: this._audioTrack as DemuxedAudioTrack,
        id3Track: this._id3Track as DemuxedMetadataTrack,
        textTrack: this._txtTrack as DemuxedUserdataTrack,
      };
    }
    this.extractRemainingSamples(result);
    if (this.sampleAes) {
      return this.decrypt(result, this.sampleAes);
    }
    return result;
  }

  private extractRemainingSamples(demuxResult: DemuxerResult) {
    const { audioTrack, videoTrack, id3Track, textTrack } = demuxResult;
    const avcData = videoTrack.pesData;
    const audioData = audioTrack.pesData;
    const id3Data = id3Track.pesData;
    // try to parse last PES packets
    let pes: PES | null;
    if (avcData && (pes = parsePES(avcData))) {
      this.parseAVCPES(
        videoTrack as DemuxedAvcTrack,
        textTrack as DemuxedUserdataTrack,
        pes,
        true
      );
      videoTrack.pesData = null;
    } else {
      // either avcData null or PES truncated, keep it for next frag parsing
      videoTrack.pesData = avcData;
    }

    if (audioData && (pes = parsePES(audioData))) {
      switch (audioTrack.segmentCodec) {
        case 'aac':
          this.parseAACPES(audioTrack, pes);
          break;
        case 'mp3':
          this.parseMPEGPES(audioTrack, pes);
          break;
      }
      audioTrack.pesData = null;
    } else {
      if (audioData?.size) {
        logger.log(
          'last AAC PES packet truncated,might overlap between fragments'
        );
      }

      // either audioData null or PES truncated, keep it for next frag parsing
      audioTrack.pesData = audioData;
    }

    if (id3Data && (pes = parsePES(id3Data))) {
      this.parseID3PES(id3Track, pes);
      id3Track.pesData = null;
    } else {
      // either id3Data null or PES truncated, keep it for next frag parsing
      id3Track.pesData = id3Data;
    }
  }

  public demuxSampleAes(
    data: Uint8Array,
    keyData: KeyData,
    timeOffset: number
  ): Promise<DemuxerResult> {
    const demuxResult = this.demux(
      data,
      timeOffset,
      true,
      !this.config.progressive
    );
    const sampleAes = (this.sampleAes = new SampleAesDecrypter(
      this.observer,
      this.config,
      keyData
    ));
    return this.decrypt(demuxResult, sampleAes);
  }

  private decrypt(
    demuxResult: DemuxerResult,
    sampleAes: SampleAesDecrypter
  ): Promise<DemuxerResult> {
    return new Promise((resolve) => {
      const { audioTrack, videoTrack } = demuxResult;
      if (audioTrack.samples && audioTrack.segmentCodec === 'aac') {
        sampleAes.decryptAacSamples(audioTrack.samples, 0, () => {
          if (videoTrack.samples) {
            sampleAes.decryptAvcSamples(videoTrack.samples, 0, 0, () => {
              resolve(demuxResult);
            });
          } else {
            resolve(demuxResult);
          }
        });
      } else if (videoTrack.samples) {
        sampleAes.decryptAvcSamples(videoTrack.samples, 0, 0, () => {
          resolve(demuxResult);
        });
      }
    });
  }

  public destroy() {
    this._duration = 0;
  }

  private parseAVCPES(
    track: DemuxedAvcTrack,
    textTrack: DemuxedUserdataTrack,
    pes: PES,
    last: boolean
  ) {
    const units = this.parseAVCNALu(track, pes.data);
    const debug = false;
    let avcSample = this.avcSample;
    let push: boolean;
    let spsfound = false;
    // free pes.data to save up some memory
    (pes as any).data = null;

    // if new NAL units found and last sample still there, let's push ...
    // this helps parsing streams with missing AUD (only do this if AUD never found)
    if (avcSample && units.length && !track.audFound) {
      pushAccessUnit(avcSample, track);
      avcSample = this.avcSample = createAVCSample(false, pes.pts, pes.dts, '');
    }

    units.forEach((unit) => {
      switch (unit.type) {
        // NDR
        case 1: {
          push = true;
          if (!avcSample) {
            avcSample = this.avcSample = createAVCSample(
              true,
              pes.pts,
              pes.dts,
              ''
            );
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
            if (
              sliceType === 2 ||
              sliceType === 4 ||
              sliceType === 7 ||
              sliceType === 9
            ) {
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
            avcSample = this.avcSample = createAVCSample(
              true,
              pes.pts,
              pes.dts,
              ''
            );
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
          parseSEIMessageFromNALu(
            unit.data,
            1,
            pes.pts as number,
            textTrack.samples
          );
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
            const sps = unit.data;
            const expGolombDecoder = new ExpGolomb(sps);
            const config = expGolombDecoder.readSPS();
            track.width = config.width;
            track.height = config.height;
            track.pixelRatio = config.pixelRatio;
            track.sps = [sps];
            track.duration = this._duration;
            const codecarray = sps.subarray(1, 4);
            let codecstring = 'avc1.';
            for (let i = 0; i < 3; i++) {
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

          avcSample = this.avcSample = createAVCSample(
            false,
            pes.pts,
            pes.dts,
            debug ? 'AUD ' : ''
          );
          break;
        // Filler Data
        case 12:
          push = true;
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

  private getLastNalUnit(samples: AvcSample[]) {
    let avcSample = this.avcSample;
    let lastUnit;
    // try to fallback to previous sample if current one is empty
    if (!avcSample || avcSample.units.length === 0) {
      avcSample = samples[samples.length - 1];
    }
    if (avcSample?.units) {
      const units = avcSample.units;
      lastUnit = units[units.length - 1];
    }
    return lastUnit;
  }

  private parseAVCNALu(
    track: DemuxedAvcTrack,
    array: Uint8Array
  ): Array<{
    data: Uint8Array;
    type: number;
    state?: number;
  }> {
    const len = array.byteLength;
    let state = track.naluState || 0;
    const lastState = state;
    const units = [] as Array<{
      data: Uint8Array;
      type: number;
      state?: number;
    }>;
    let i = 0;
    let value;
    let overflow;
    let unitType;
    let lastUnitStart = -1;
    let lastUnitType: number = 0;
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
          const unit = {
            data: array.subarray(lastUnitStart, i - state - 1),
            type: lastUnitType,
          };
          // logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
          units.push(unit);
        } else {
          // lastUnitStart is undefined => this is the first start code found in this PES packet
          // first check if start code delimiter is overlapping between 2 PES packets,
          // ie it started in last packet (lastState not zero)
          // and ended at the beginning of this PES packet (i <= 4 - lastState)
          const lastUnit = this.getLastNalUnit(track.samples);
          if (lastUnit) {
            if (lastState && i <= 4 - lastState) {
              // start delimiter overlapping between PES packets
              // strip start delimiter bytes from the end of last NAL unit
              // check if lastUnit had a state different from zero
              if (lastUnit.state) {
                // strip last bytes
                lastUnit.data = lastUnit.data.subarray(
                  0,
                  lastUnit.data.byteLength - lastState
                );
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
              lastUnit.state = 0;
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
      const unit = {
        data: array.subarray(lastUnitStart, len),
        type: lastUnitType,
        state: state,
      };
      units.push(unit);
      // logger.log('pushing NALU, type/size/state:' + unit.type + '/' + unit.data.byteLength + '/' + state);
    }
    // no NALu found
    if (units.length === 0) {
      // append pes.data to previous NAL unit
      const lastUnit = this.getLastNalUnit(track.samples);
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

  private parseAACPES(track: DemuxedAudioTrack, pes: PES) {
    let startOffset = 0;
    const aacOverFlow = this.aacOverFlow;
    let data = pes.data;
    if (aacOverFlow) {
      this.aacOverFlow = null;
      const frameMissingBytes = aacOverFlow.missing;
      const sampleLength = aacOverFlow.sample.unit.byteLength;
      // logger.log(`AAC: append overflowing ${sampleLength} bytes to beginning of new PES`);
      if (frameMissingBytes === -1) {
        const tmp = new Uint8Array(sampleLength + data.byteLength);
        tmp.set(aacOverFlow.sample.unit, 0);
        tmp.set(data, sampleLength);
        data = tmp;
      } else {
        const frameOverflowBytes = sampleLength - frameMissingBytes;
        aacOverFlow.sample.unit.set(
          data.subarray(0, frameMissingBytes),
          frameOverflowBytes
        );
        track.samples.push(aacOverFlow.sample);
        startOffset = aacOverFlow.missing;
      }
    }
    // look for ADTS header (0xFFFx)
    let offset: number;
    let len: number;
    for (offset = startOffset, len = data.length; offset < len - 1; offset++) {
      if (ADTS.isHeader(data, offset)) {
        break;
      }
    }
    // if ADTS header does not start straight from the beginning of the PES payload, raise an error
    if (offset !== startOffset) {
      let reason: string;
      const recoverable = offset < len - 1;
      if (recoverable) {
        reason = `AAC PES did not start with ADTS header,offset:${offset}`;
      } else {
        reason = 'No ADTS header found in AAC PES';
      }
      const error = new Error(reason);
      logger.warn(`parsing error: ${reason}`);
      this.observer.emit(Events.ERROR, Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.FRAG_PARSING_ERROR,
        fatal: false,
        levelRetry: recoverable,
        error,
        reason,
      });
      if (!recoverable) {
        return;
      }
    }

    ADTS.initTrackConfig(
      track,
      this.observer,
      data,
      offset,
      this.audioCodec as string
    );

    let pts: number;
    if (pes.pts !== undefined) {
      pts = pes.pts;
    } else if (aacOverFlow) {
      // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
      // first sample PTS should be equal to last sample PTS + frameDuration
      const frameDuration = ADTS.getFrameDuration(track.samplerate as number);
      pts = aacOverFlow.sample.pts + frameDuration;
    } else {
      logger.warn('[tsdemuxer]: AAC PES unknown PTS');
      return;
    }

    // scan for aac samples
    let frameIndex = 0;
    let frame;
    while (offset < len) {
      frame = ADTS.appendFrame(track, data, offset, pts, frameIndex);
      offset += frame.length;
      if (!frame.missing) {
        frameIndex++;
        for (; offset < len - 1; offset++) {
          if (ADTS.isHeader(data, offset)) {
            break;
          }
        }
      } else {
        this.aacOverFlow = frame;
        break;
      }
    }
  }

  private parseMPEGPES(track: DemuxedAudioTrack, pes: PES) {
    const data = pes.data;
    const length = data.length;
    let frameIndex = 0;
    let offset = 0;
    const pts = pes.pts;
    if (pts === undefined) {
      logger.warn('[tsdemuxer]: MPEG PES unknown PTS');
      return;
    }

    while (offset < length) {
      if (MpegAudio.isHeader(data, offset)) {
        const frame = MpegAudio.appendFrame(
          track,
          data,
          offset,
          pts,
          frameIndex
        );
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

  private parseID3PES(id3Track: DemuxedMetadataTrack, pes: PES) {
    if (pes.pts === undefined) {
      logger.warn('[tsdemuxer]: ID3 PES unknown PTS');
      return;
    }
    const id3Sample = Object.assign({}, pes as Required<PES>, {
      type: this._avcTrack ? MetadataSchema.emsg : MetadataSchema.audioId3,
      duration: Number.POSITIVE_INFINITY,
    });
    id3Track.samples.push(id3Sample);
  }
}

function createAVCSample(
  key: boolean,
  pts: number | undefined,
  dts: number | undefined,
  debug: string
): ParsedAvcSample {
  return {
    key,
    frame: false,
    pts,
    dts,
    units: [],
    debug,
    length: 0,
  };
}

function parsePID(data: Uint8Array, offset: number): number {
  // pid is a 13-bit field starting at the last bit of TS[1]
  return ((data[offset + 1] & 0x1f) << 8) + data[offset + 2];
}

function parsePAT(data: Uint8Array, offset: number): number {
  // skip the PSI header and parse the first PMT entry
  return ((data[offset + 10] & 0x1f) << 8) | data[offset + 11];
}

function parsePMT(
  data: Uint8Array,
  offset: number,
  typeSupported: TypeSupported,
  isSampleAes: boolean
) {
  const result = { audio: -1, avc: -1, id3: -1, segmentCodec: 'aac' };
  const sectionLength = ((data[offset + 1] & 0x0f) << 8) | data[offset + 2];
  const tableEnd = offset + 3 + sectionLength - 4;
  // to determine where the table is, we have to figure out how
  // long the program info descriptors are
  const programInfoLength =
    ((data[offset + 10] & 0x0f) << 8) | data[offset + 11];
  // advance the offset to the first entry in the mapping table
  offset += 12 + programInfoLength;
  while (offset < tableEnd) {
    const pid = parsePID(data, offset);
    switch (data[offset]) {
      case 0xcf: // SAMPLE-AES AAC
        if (!isSampleAes) {
          logger.log(
            'ADTS AAC with AES-128-CBC frame encryption found in unencrypted stream'
          );
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
          logger.log(
            'H.264 with AES-128-CBC slice encryption found in unencrypted stream'
          );
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
        if (typeSupported.mpeg !== true && typeSupported.mp3 !== true) {
          logger.log('MPEG audio found, not supported in this browser');
        } else if (result.audio === -1) {
          result.audio = pid;
          result.segmentCodec = 'mp3';
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
    offset += (((data[offset + 3] & 0x0f) << 8) | data[offset + 4]) + 5;
  }
  return result;
}

function parsePES(stream: ElementaryStreamData): PES | null {
  let i = 0;
  let frag: Uint8Array;
  let pesLen: number;
  let pesHdrLen: number;
  let pesPts: number | undefined;
  let pesDts: number | undefined;
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

    const pesFlags = frag[7];
    if (pesFlags & 0xc0) {
      /* PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
          as PTS / DTS is 33 bit we cannot use bitwise operator in JS,
          as Bitwise operators treat their operands as a sequence of 32 bits */
      pesPts =
        (frag[9] & 0x0e) * 536870912 + // 1 << 29
        (frag[10] & 0xff) * 4194304 + // 1 << 22
        (frag[11] & 0xfe) * 16384 + // 1 << 14
        (frag[12] & 0xff) * 128 + // 1 << 7
        (frag[13] & 0xfe) / 2;

      if (pesFlags & 0x40) {
        pesDts =
          (frag[14] & 0x0e) * 536870912 + // 1 << 29
          (frag[15] & 0xff) * 4194304 + // 1 << 22
          (frag[16] & 0xfe) * 16384 + // 1 << 14
          (frag[17] & 0xff) * 128 + // 1 << 7
          (frag[18] & 0xfe) / 2;

        if (pesPts - pesDts > 60 * 90000) {
          logger.warn(
            `${Math.round(
              (pesPts - pesDts) / 90000
            )}s delta between PTS and DTS, align them`
          );
          pesPts = pesDts;
        }
      } else {
        pesDts = pesPts;
      }
    }
    pesHdrLen = frag[8];
    // 9 bytes : 6 bytes for PES header + 3 bytes for PES extension
    let payloadStartOffset = pesHdrLen + 9;
    if (stream.size <= payloadStartOffset) {
      return null;
    }
    stream.size -= payloadStartOffset;
    // reassemble PES packet
    const pesData = new Uint8Array(stream.size);
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
  }
  return null;
}

function pushAccessUnit(avcSample: ParsedAvcSample, avcTrack: DemuxedAvcTrack) {
  if (avcSample.units.length && avcSample.frame) {
    // if sample does not have PTS/DTS, patch with last sample PTS/DTS
    if (avcSample.pts === undefined) {
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
    avcTrack.samples.push(avcSample as AvcSample);
  }
  if (avcSample.debug.length) {
    logger.log(avcSample.pts + '/' + avcSample.dts + ':' + avcSample.debug);
  }
}

export default TSDemuxer;
