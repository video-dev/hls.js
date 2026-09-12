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
