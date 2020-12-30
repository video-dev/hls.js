/**
 * AAC demuxer
 */
import BaseAudioDemuxer from './base-audio-demuxer';
import * as ADTS from './adts';
import { logger } from '../utils/logger';
import * as ID3 from '../demux/id3';
import type { HlsEventEmitter } from '../events';
import type { HlsConfig } from '../config';

class AACDemuxer extends BaseAudioDemuxer {
  private readonly observer: HlsEventEmitter;
  private readonly config: HlsConfig;
  static readonly minProbeByteLength: number = 9;

  constructor(observer, config) {
    super();
    this.observer = observer;
    this.config = config;
  }

  resetInitSegment(audioCodec, videoCodec, duration) {
    super.resetInitSegment(audioCodec, videoCodec, duration);
    this._audioTrack = {
      container: 'audio/adts',
      type: 'audio',
      id: 0,
      pid: -1,
      sequenceNumber: 0,
      isAAC: true,
      samples: [],
      manifestCodec: audioCodec,
      duration: duration,
      inputTimeScale: 90000,
      dropped: 0,
    };
  }

  // Source for probe info - https://wiki.multimedia.cx/index.php?title=ADTS
  static probe(data): boolean {
    if (!data) {
      return false;
    }

    // Check for the ADTS sync word
    // Look for ADTS header | 1111 1111 | 1111 X00X | where X can be either 0 or 1
    // Layer bits (position 14 and 15) in header should be always 0 for ADTS
    // More info https://wiki.multimedia.cx/index.php?title=ADTS
    const id3Data = ID3.getID3Data(data, 0) || [];
    let offset = id3Data.length;

    for (let length = data.length; offset < length; offset++) {
      if (ADTS.probe(data, offset)) {
        logger.log('ADTS sync word found !');
        return true;
      }
    }
    return false;
  }

  canParse(data, offset) {
    return ADTS.canParse(data, offset);
  }

  appendFrame(track, data, offset) {
    ADTS.initTrackConfig(
      track,
      this.observer,
      data,
      offset,
      track.manifestCodec
    );
    return ADTS.appendFrame(
      track,
      data,
      offset,
      this.initPTS as number,
      this.frameIndex
    );
  }
}

export default AACDemuxer;
