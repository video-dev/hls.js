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
const AUDIO_PID = 0x101;
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

  it('keeps an AAC frame that spans more than two PES', function () {
    const frameA = adtsFrame(40, 1);
    const frameB = adtsFrame(300, 2);
    const frameC = adtsFrame(50, 3);
    // frame B starts in the first PES, fills the whole second PES and ends in the third
    const pesList = [
      audioPes(90000, [...frameA, ...frameB.slice(0, 20)]),
      audioPes(undefined, frameB.slice(20, 120)),
      audioPes(undefined, [...frameB.slice(120), ...frameC]),
    ];
    const errors: unknown[] = [];
    (demuxer as any).observer.on('hlsError', (_event, data) =>
      errors.push(data),
    );

    const chunkMeta = new ChunkMetadata(0, 0, 0);
    demuxer.demux(audioSegment(pesList), 0, chunkMeta);
    const result = demuxer.flush(0, chunkMeta) as DemuxerResult;

    expect(errors).to.deep.equal([]);
    const units = result.audioTrack.samples.map((sample) =>
      Array.from(sample.unit),
    );
    expect(units).to.deep.equal([
      frameA.slice(7),
      frameB.slice(7),
      frameC.slice(7),
    ]);
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

// ADTS frame (AAC-LC, 48 kHz, stereo) of the given total length, with a recognisable payload
function adtsFrame(length: number, fill: number): number[] {
  return [
    0xff,
    0xf1,
    0x4c,
    0x80 | ((length >> 11) & 3),
    (length >> 3) & 0xff,
    ((length & 7) << 5) | 0x1f,
    0xfc,
    ...Array.from({ length: length - 7 }, (_, i) => (fill * 50 + i) & 0xff),
  ];
}

function audioPes(pts: number | undefined, data: number[]): number[] {
  const ptsBytes =
    pts === undefined
      ? []
      : [
          0x21 | ((pts >> 29) & 0x0e),
          (pts >> 22) & 0xff,
          ((pts >> 14) & 0xfe) | 1,
          (pts >> 7) & 0xff,
          ((pts << 1) & 0xfe) | 1,
        ];
  const header = [
    0,
    0,
    1,
    0xc0,
    0,
    0,
    0x80,
    pts === undefined ? 0 : 0x80,
    ptsBytes.length,
  ];
  return [...header, ...ptsBytes, ...data];
}

function audioSegment(pesList: number[][]): Uint8Array {
  const pat = [
    0, 0x00, 0xb0, 0x0d, 0, 1, 0xc1, 0, 0, 0, 1, 0xf0, 0x00, 0, 0, 0, 0,
  ];
  // one AAC (ADTS) stream on PID 0x101
  const pmt = [
    0, 0x02, 0xb0, 0x12, 0, 1, 0xc1, 0, 0, 0xe1, 0x01, 0xf0, 0, 0x0f, 0xe1,
    0x01, 0xf0, 0, 0, 0, 0, 0,
  ];
  return new Uint8Array([
    ...packet(0, pat),
    ...packet(PMT_PID, pmt),
    ...pesList.flatMap((data) => packets(AUDIO_PID, data)),
  ]);
}

// split one PES over as many TS packets as needed; the last one is padded
function packets(pid: number, data: number[]): number[] {
  const out: number[] = [];
  for (let start = 0; start < data.length; start += 184) {
    const chunk = data.slice(start, start + 184);
    const stuffing = 184 - chunk.length;
    out.push(
      0x47,
      (start === 0 ? 0x40 : 0) | (pid >> 8),
      pid & 0xff,
      stuffing ? 0x30 : 0x10,
      ...(stuffing
        ? [
            stuffing - 1,
            ...(stuffing > 1 ? [0, ...new Array(stuffing - 2).fill(0xff)] : []),
          ]
        : []),
      ...chunk,
    );
  }
  return out;
}
