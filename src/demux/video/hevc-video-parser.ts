import BaseVideoParser from './base-video-parser';
import {
  DemuxedVideoTrack,
  DemuxedUserdataTrack,
  VideoSampleUnit,
} from '../../types/demuxer';
import {
  appendUint8Array,
  parseSEIMessageFromNALu,
} from '../../utils/mp4-tools';

import type { PES } from '../tsdemuxer';

import H265Parser from './hevc-parser';


class HevcVideoParser extends BaseVideoParser {
  public parseAVCPES(
    track: DemuxedVideoTrack,
    textTrack: DemuxedUserdataTrack,
    pes: PES,
    last: boolean,
    duration: number
  ) {
    const units = this.parseAVCNALu(track, pes.data);
    const debug = false;
    let VideoSample = this.VideoSample;
    let push: boolean;
    let spsfound = false;
    // free pes.data to save up some memory
    (pes as any).data = null;

    // if new NAL units found and last sample still there, let's push ...
    // this helps parsing streams with missing AUD (only do this if AUD never found)
    if (VideoSample && units.length && !track.audFound) {
      this.pushAccessUnit(VideoSample, track);
      VideoSample = this.VideoSample = this.createVideoSample(
        false,
        pes.pts,
        pes.dts,
        ''
      );
    }

    units.forEach((unit) => {
      switch (unit.type) {
        // NDR
        case 0:
        case 1: {
          push = true;
          if (!VideoSample) {
            VideoSample = this.VideoSample = this.createVideoSample(
              true,
              pes.pts,
              pes.dts,
              ''
            );
          }

          if (debug) {
            VideoSample.debug += 'NDR ';
          }

          VideoSample.frame = true;
          break;
          // IDR
        }
        case 19:
        case 20:
        case 21:
          push = true;
          // handle PES not starting with AUD
          if (!VideoSample) {
            VideoSample = this.VideoSample = this.createVideoSample(
              true,
              pes.pts,
              pes.dts,
              ''
            );
          }

          if (debug) {
            VideoSample.debug += 'IDR ';
          }

          VideoSample.key = true;
          VideoSample.frame = true;
          break;
        // SEI
        case 39: {
          push = true;
          if (debug && VideoSample) {
            VideoSample.debug += 'SEI ';
          }
          parseSEIMessageFromNALu(
            unit.data,
            1,
            pes.pts as number,
            textTrack.samples
          );
          break;

        }
        case 33:
          // SPS
          push = true;
          spsfound = true;
          if (debug && VideoSample) {
            VideoSample.debug += 'SPS ';
          }

          if (!track.sps) {
            const sps = unit.data;
            const config = H265Parser.parseSPS(sps);
            track.width = config.codec_size.width;
            track.height = config.codec_size.height;
            track.pixelRatio = [config.sar_ratio.width, config.sar_ratio.height];
            track.sps = [sps];
            track.duration = duration;
            track.codec = config.codec_mimetype;
            track.details = {
              ...track.details,
              ...config
            };
          }
          break;
        case 34:
          // hevc PPS
          push = true;
          if (debug && VideoSample) {
            VideoSample.debug += 'PPS ';
          }

          if (!track.pps) {
            track.pps = [unit.data];
            const details = H265Parser.parsePPS(unit.data);
            track.details = {
              ...track.details,
              ...details
            };
          }
          break;

        // AUD
        case 35:
          push = false;
          track.audFound = true;
          if (VideoSample) {
            this.pushAccessUnit(VideoSample, track);
          }

          VideoSample = this.VideoSample = this.createVideoSample(
            false,
            pes.pts,
            pes.dts,
            debug ? 'AUD ' : ''
          );
          break;
        default:
          push = true;
          break;
      }
      if (VideoSample && push) {
        const units = VideoSample.units;
        units.push(unit);
      }
    });
    debugger
    // if last PES packet, push samples
    if (last && VideoSample) {
      this.pushAccessUnit(VideoSample, track);
      this.VideoSample = null;
    }
  }

  private parseAVCNALu(
    track: DemuxedVideoTrack,
    array: Uint8Array
  ): Array<{
    data: Uint8Array;
    type: number;
    state?: number;
  }> {
    const len = array.byteLength;
    let state = track.naluState || 0;
    const lastState = state;
    const units: VideoSampleUnit[] = [];
    let i = 0;
    let value: number;
    let overflow: number;
    let unitType: number;
    let lastUnitStart = -1;
    let lastUnitType: number = 0;
    // logger.log('PES:' + Hex.hexDump(array));

    if (state === -1) {
      // special use case where we found 3 or 4-byte start codes exactly at the end of previous PES packet
      lastUnitStart = 0;
      lastUnitType = (array[0] >> 1) & 0x3f;
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
        overflow = i - state - 1;
        if (lastUnitStart >= 0) {
          const unit: VideoSampleUnit = {
            data: array.subarray(lastUnitStart, overflow),
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

            if (overflow > 0) {
              // logger.log('first NALU found with overflow:' + overflow);
              lastUnit.data = appendUint8Array(
                lastUnit.data,
                array.subarray(0, overflow)
              );
              lastUnit.state = 0;
            }
          }
        }
        // check if we can read unit type
        if (i < len) {
          unitType = (array[i] >> 1) & 0x3f;
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
      const unit: VideoSampleUnit = {
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
        lastUnit.data = appendUint8Array(lastUnit.data, array);
      }
    }
    track.naluState = state;
    return units;
  }
}

export default HevcVideoParser;
