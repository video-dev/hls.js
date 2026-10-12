import { expect } from 'chai';
import EventEmitter from 'eventemitter3';
import { hlsDefaultConfig } from '../../../src/config';
import TSDemuxer from '../../../src/demux/tsdemuxer';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import { logger } from '../../../src/utils/logger';
import type { HlsEventEmitter } from '../../../src/events';
import type { DemuxerResult } from '../../../src/types/demuxer';

const PMT_PID = 0x1000;
const VIDEO_PID = 0x100;
const AUD = [0, 0, 0, 1, 0x09, 0xf0];
const IDR = [0, 0, 0, 1, 0x65, 0x88, 0x84];
const NON_IDR = [0, 0, 0, 1, 0x41, 0x9a, 0x02];

describe('TSDemuxer', function () {
  let demuxer: TSDemuxer;

  beforeEach(function () {
    demuxer = new TSDemuxer(
      new EventEmitter() as HlsEventEmitter,
      { ...hlsDefaultConfig },
      { mpeg: true, mp3: true, ac3: true },
      logger,
    );
    demuxer.resetInitSegment(
      undefined,
      '',
      '',
      10,
      null,
      new ChunkMetadata(0, 0, 0),
    );
  });

  it('drops a partly parsed video sample when contiguity is reset', function () {
    // a progressive load cancelled while the second frame is being parsed
    const { videoTrack } = demuxer.demux(
      segment([0, 3000, 6000]),
      0,
      new ChunkMetadata(0, 0, 0),
    );
    expect(videoTrack.samples.map((sample) => sample.pts)).to.deep.equal([0]);
    // the remuxer takes the parsed samples
    videoTrack.samples = [];

    demuxer.resetContiguity();
    const chunkMeta = new ChunkMetadata(0, 5, 0);
    demuxer.demux(segment([900000, 903000]), 50, chunkMeta);
    const result = demuxer.flush(50, chunkMeta) as DemuxerResult;

    expect(result.videoTrack.samples.map((sample) => sample.pts)).to.deep.equal(
      [900000, 903000],
    );
  });
});

function segment(ptsList: number[]): Uint8Array {
  // program 1 with its PMT on PID 0x1000
  const pat = [
    0, 0x00, 0xb0, 0x0d, 0, 1, 0xc1, 0, 0, 0, 1, 0xf0, 0x00, 0, 0, 0, 0,
  ];
  // one H.264 stream on PID 0x100
  const pmt = [
    0, 0x02, 0xb0, 0x12, 0, 1, 0xc1, 0, 0, 0xe1, 0x00, 0xf0, 0, 0x1b, 0xe1,
    0x00, 0xf0, 0, 0, 0, 0, 0,
  ];
  const packets = [packet(0, pat), packet(PMT_PID, pmt)];
  ptsList.forEach((pts, i) => {
    packets.push(packet(VIDEO_PID, pes(pts, [...AUD, ...(i ? NON_IDR : IDR)])));
  });
  return new Uint8Array(packets.flat());
}

// one TS packet, padded with adaptation field stuffing
function packet(pid: number, payload: number[]): number[] {
  const stuffing = 184 - payload.length;
  return [
    0x47,
    0x40 | (pid >> 8),
    pid & 0xff,
    0x30,
    stuffing - 1,
    ...(stuffing > 1 ? [0, ...new Array(stuffing - 2).fill(0xff)] : []),
    ...payload,
  ];
}

function pes(pts: number, data: number[]): number[] {
  // video PES header with a PTS only
  const header = [0, 0, 1, 0xe0, 0, 0, 0x80, 0x80, 5];
  const ptsBytes = [
    0x21 | ((pts >> 29) & 0x0e),
    (pts >> 22) & 0xff,
    ((pts >> 14) & 0xfe) | 1,
    (pts >> 7) & 0xff,
    ((pts << 1) & 0xfe) | 1,
  ];
  return [...header, ...ptsBytes, ...data];
}
