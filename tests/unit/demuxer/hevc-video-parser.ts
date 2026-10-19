import { expect } from 'chai';
import HevcVideoParser from '../../../src/demux/video/hevc-video-parser';
import type { PES } from '../../../src/demux/tsdemuxer';
import type {
  DemuxedUserdataTrack,
  DemuxedVideoTrack,
} from '../../../src/types/demuxer';

// Parameter-set readers are overridden so the test can feed synthetic NAL
// headers without a valid HEVC bitstream. The bug is in AU splitting, not
// ExpGolomb parsing.
class TestHevcParser extends HevcVideoParser {
  public readVPS() {
    return { numTemporalLayers: 1, temporalIdNested: false };
  }

  public readSPS() {
    return {
      codecString: 'hvc1.1.6.L93.B0',
      params: {},
      width: 320,
      height: 240,
      pixelRatio: [1, 1] as [number, number],
    };
  }

  public readPPS() {
    return { parallelismType: 1 };
  }
}

describe('HevcVideoParser', function () {
  let parser: TestHevcParser;
  let track: DemuxedVideoTrack;
  let textTrack: DemuxedUserdataTrack;

  beforeEach(function () {
    parser = new TestHevcParser();
    track = videoTrack();
    textTrack = userdataTrack();
  });

  it('collects PPS from an AUD-less stream with one NAL per PES', function () {
    // Hardware/CCTV HEVC-in-TS often has no AUD and one NAL per PES, so every
    // NAL arrives at nalIndex === 0. The AUD-less shortcut must not close a
    // sample that only holds prefix NALs, or pushAccessUnit nulls initVPS and
    // the PPS is dropped (issue #8022).
    parseNal(parser, track, textTrack, 32); // VPS
    parseNal(parser, track, textTrack, 33); // SPS
    parseNal(parser, track, textTrack, 34); // PPS
    parseNal(parser, track, textTrack, 19, true); // IDR_W_RADL, end of segment

    expect(track.vps, 'vps').to.have.lengthOf(1);
    expect(track.sps, 'sps').to.have.lengthOf(1);
    expect(track.pps, 'pps').to.have.lengthOf(1);
    expect(track.samples).to.have.lengthOf(1);
    expect(track.samples[0].key).to.equal(true);
    expect(track.samples[0].units.map((unit) => unit.type)).to.deep.equal([
      33, 34, 19,
    ]);
  });

  it('still starts a new sample on the next PES after a picture when AUDs are missing', function () {
    parseNal(parser, track, textTrack, 32);
    parseNal(parser, track, textTrack, 33);
    parseNal(parser, track, textTrack, 34);
    parseNal(parser, track, textTrack, 19);
    parseNal(parser, track, textTrack, 1, true); // TRAIL_R

    expect(track.samples).to.have.lengthOf(2);
    expect(track.samples[0].key).to.equal(true);
    expect(track.samples[0].units.map((unit) => unit.type)).to.include(19);
    expect(track.samples[1].key).to.equal(false);
    expect(track.samples[1].units.map((unit) => unit.type)).to.deep.equal([1]);
  });

  it('keeps each picture on its own PTS when a suffix SEI starts its own PES', function () {
    // kvazaar writes a decoded picture hash SEI (suffix SEI, type 40) after
    // every picture by default. On an AUD-less one-PES-per-NAL stream the SEI
    // PES must not open a new sample, or the next picture inherits the
    // previous frame's PTS/DTS.
    parseAu(parser, track, textTrack, [32, 33, 34, 19, 40], 90000);
    parseAu(parser, track, textTrack, [1, 40], 180000);
    parseAu(parser, track, textTrack, [1, 40], 270000, true);

    expect(track.samples).to.have.lengthOf(3);
    expect(track.samples.map((sample) => sample.pts)).to.deep.equal([
      90000, 180000, 270000,
    ]);
    expect(track.samples.map((sample) => sample.dts)).to.deep.equal([
      90000, 180000, 270000,
    ]);
  });

  it('keeps each picture on its own PTS when filler data or EOS starts its own PES', function () {
    // Filler data (38), EOS (36) and EOB (37) belong to the current access
    // unit just like suffix SEI: a PES boundary there must not split it.
    parseAu(parser, track, textTrack, [32, 33, 34, 19, 38], 90000);
    parseAu(parser, track, textTrack, [1, 36], 180000);
    parseAu(parser, track, textTrack, [1, 37], 270000, true);

    expect(track.samples).to.have.lengthOf(3);
    expect(track.samples.map((sample) => sample.pts)).to.deep.equal([
      90000, 180000, 270000,
    ]);
    expect(track.samples.map((sample) => sample.dts)).to.deep.equal([
      90000, 180000, 270000,
    ]);
  });

  it('produces one sample per picture when only the first PES of each access unit has a PTS', function () {
    parseAu(parser, track, textTrack, [32, 33, 34, 19, 40], 90000, false, true);
    parseAu(parser, track, textTrack, [1, 40], 180000, false, true);
    parseAu(parser, track, textTrack, [1, 40], 270000, true, true);

    expect(track.samples).to.have.lengthOf(3);
    expect(track.samples.map((sample) => sample.pts)).to.deep.equal([
      90000, 180000, 270000,
    ]);
    expect(track.dropped).to.equal(0);
  });
});

function videoTrack(): DemuxedVideoTrack {
  return {
    type: 'video',
    id: 1,
    pid: 0x100,
    inputTimeScale: 90000,
    sequenceNumber: 0,
    samples: [],
    dropped: 0,
    segmentCodec: 'hevc',
    pixelRatio: [1, 1],
    width: 0,
    height: 0,
  };
}

function userdataTrack(): DemuxedUserdataTrack {
  return {
    type: 'text',
    id: 3,
    pid: -1,
    inputTimeScale: 90000,
    sequenceNumber: 0,
    samples: [],
    dropped: 0,
  };
}

function parseNal(
  parser: HevcVideoParser,
  track: DemuxedVideoTrack,
  textTrack: DemuxedUserdataTrack,
  type: number,
  endOfSegment = false,
) {
  // 4-byte Annex-B prefix, 2-byte HEVC NAL header, first_slice flag set.
  const data = new Uint8Array([0, 0, 0, 1, (type << 1) & 0x7e, 0x01, 0x80]);
  const pes: PES = { data, pts: 90000, dts: 90000, len: data.length };
  parser.parsePES(track, textTrack, pes, endOfSegment);
}

function parseAu(
  parser: HevcVideoParser,
  track: DemuxedVideoTrack,
  textTrack: DemuxedUserdataTrack,
  types: number[],
  pts: number,
  endOfSegment = false,
  ptsOnFirstPesOnly = false,
) {
  // One PES per NAL, AUD-less, as produced by e.g. mpegtsmux alignment=nal.
  types.forEach((type, index) => {
    const firstPes = index === 0;
    const lastPes = index === types.length - 1;
    const data = new Uint8Array([0, 0, 0, 1, (type << 1) & 0x7e, 0x01, 0x80]);
    const pes: PES = {
      data,
      pts: firstPes || !ptsOnFirstPesOnly ? pts : undefined,
      dts: firstPes || !ptsOnFirstPesOnly ? pts : undefined,
      len: data.length,
    };
    parser.parsePES(track, textTrack, pes, endOfSegment && lastPes);
  });
}
