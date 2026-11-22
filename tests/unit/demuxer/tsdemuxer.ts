import { expect } from 'chai';
import EventEmitter from 'eventemitter3';
import { hlsDefaultConfig } from '../../../src/config';
import TSDemuxer from '../../../src/demux/tsdemuxer';
import { MetadataSchema } from '../../../src/types/demuxer';
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
const KLV_PID = 257;

function tsPacket(pid: number, payload: Uint8Array, unitStart: boolean) {
  const packet = new Uint8Array(188).fill(0xff);
  packet[0] = 0x47;
  packet[1] = (unitStart ? 0x40 : 0) | ((pid >> 8) & 0x1f);
  packet[2] = pid & 0xff;
  const stuffing = 184 - payload.length;
  if (stuffing > 0) {
    // adaptation field + payload, stuffed so the payload ends the packet
    packet[3] = 0x30;
    packet[4] = stuffing - 1;
    if (stuffing > 1) {
      packet[5] = 0;
    }
    packet.set(payload, 4 + stuffing);
  } else {
    packet[3] = 0x10;
    packet.set(payload, 4);
  }
  return packet;
}

function psiPacket(pid: number, section: number[]) {
  return tsPacket(pid, new Uint8Array([0, ...section]), true);
}

const pat = psiPacket(0, [
  0x00,
  0xb0,
  0x0d,
  0x00,
  0x01,
  0xc1,
  0x00,
  0x00,
  0x00,
  0x01,
  0xe0 | (PMT_PID >> 8),
  PMT_PID & 0xff,
  0,
  0,
  0,
  0,
]);

// One stream: stream_type 0x06 with a KLVA registration descriptor on the KLV PID
const pmt = psiPacket(PMT_PID, [
  0x02,
  0xb0,
  0x18,
  0x00,
  0x01,
  0xc1,
  0x00,
  0x00,
  0xe0 | (KLV_PID >> 8),
  KLV_PID & 0xff,
  0xf0,
  0x00,
  0x06,
  0xe0 | (KLV_PID >> 8),
  KLV_PID & 0xff,
  0xf0,
  0x06,
  0x05,
  0x04,
  0x4b,
  0x4c,
  0x56,
  0x41,
  0,
  0,
  0,
  0,
]);

// A KLV item too long for one TS packet: 16-byte key, BER length 300, 300-byte value
function klvPes(pts: number) {
  const key = [
    0x06, 0x0e, 0x2b, 0x34, 0x02, 0x0b, 0x01, 0x01, 0x0e, 0x01, 0x03, 0x01,
    0x01, 0x00, 0x00, 0x00,
  ];
  const klv = new Uint8Array(16 + 3 + 300).fill(0x2a);
  klv.set(key);
  klv.set([0x82, 0x01, 0x2c], 16);
  const header = new Uint8Array([
    0x00,
    0x00,
    0x01,
    0xfc,
    ((klv.length + 8) >> 8) & 0xff,
    (klv.length + 8) & 0xff,
    0x80,
    0x80,
    0x05,
    0x21 | ((pts / 536870912) & 0x0e),
    (pts >> 22) & 0xff,
    ((pts >> 14) & 0xfe) | 1,
    (pts >> 7) & 0xff,
    ((pts << 1) & 0xfe) | 1,
  ]);
  const pes = new Uint8Array(header.length + klv.length);
  pes.set(header);
  pes.set(klv, header.length);
  return [
    tsPacket(KLV_PID, pes.subarray(0, 184), true),
    tsPacket(KLV_PID, pes.subarray(184), false),
  ];
}

function join(...packets: Uint8Array[]) {
  const out = new Uint8Array(packets.length * 188);
  packets.forEach((p, i) => out.set(p, i * 188));
  return out;
}

describe('TSDemuxer KLV metadata', function () {
  let demuxer: TSDemuxer;

  beforeEach(function () {
    const config = { ...hlsDefaultConfig, enableEmsgKLVMetadata: true };
    const observer = { emit() {}, trigger() {} } as unknown as HlsEventEmitter;
    demuxer = new TSDemuxer(observer, config, {} as any, logger);
    demuxer.resetInitSegment(undefined, '', '', 4, null, meta(0));
  });

  function meta(id: number) {
    return new ChunkMetadata(0, 0, id, 0, -1, false);
  }

  // Every demux call returns the same metadata track, so read it once at the end
  function klvSamples(result) {
    return result.id3Track.samples.filter(
      (s) => s.type === MetadataSchema.misbklv,
    );
  }

  it('reads the last KLV item of a segment when the segment ends', function () {
    const [start, rest] = klvPes(90000);
    demuxer.demux(join(pat, pmt, start, rest), 0, meta(1));
    const result = demuxer.flush(0, meta(1));

    const samples = klvSamples(result);
    expect(samples).to.have.length(1);
    expect(samples[0].len).to.equal(319);
  });

  it('reads a KLV item split across two chunks (low-latency parts)', function () {
    const [start, rest] = klvPes(90000);
    demuxer.demux(join(pat, pmt, start), 0, meta(1));
    demuxer.demux(join(rest), 0, meta(2));
    const result = demuxer.flush(0, meta(2));

    const samples = klvSamples(result);
    expect(samples).to.have.length(1);
    expect(samples[0].len).to.equal(319);
    expect(samples[0].pts).to.equal(90000);
  });
});
