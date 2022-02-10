/**
 * MP3 demuxer
 */
import BaseAudioDemuxer from './base-audio-demuxer';
import * as ID3 from '../demux/id3';
import { logger } from '../utils/logger';
import * as MpegAudio from './mpegaudio';

class MP3Demuxer extends BaseAudioDemuxer {
  static readonly minProbeByteLength: number = 4;

  resetInitSegment(
    initSegment: Uint8Array | undefined,
    audioCodec: string | undefined,
    videoCodec: string | undefined,
    trackDuration: number
  ) {
    super.resetInitSegment(initSegment, audioCodec, videoCodec, trackDuration);
    this._audioTrack = {
      container: 'audio/mpeg',
      type: 'audio',
      id: 2,
      pid: -1,
      sequenceNumber: 0,
      isAAC: false,
      samples: [],
      manifestCodec: audioCodec,
      duration: trackDuration,
      inputTimeScale: 90000,
      dropped: 0,
    };
  }

  static probe(data): boolean {
    if (!data) {
      return false;
    }

    // check if data contains ID3 timestamp and MPEG sync word
    // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
    // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
    // More info http://www.mp3-tech.org/programmer/frame_header.html
    const id3Data = ID3.getID3Data(data, 0) || [];
    let offset = id3Data.length;

    for (let length = data.length; offset < length; offset++) {
      if (MpegAudio.probe(data, offset)) {
        logger.log('MPEG Audio sync word found !');
        return true;
      }
    }
    return false;
  }

  canParse(data, offset) {
    return MpegAudio.canParse(data, offset);
  }

  appendFrame(track, data, offset) {
    if (this.initPTS === null) {
      return;
    }
    return MpegAudio.appendFrame(
      track,
      data,
      offset,
      this.initPTS,
      this.frameIndex
    );
  }
}

export default MP3Demuxer;
