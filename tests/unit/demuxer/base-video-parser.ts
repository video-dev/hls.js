import { expect } from 'chai';
import BaseVideoParser from '../../../src/demux/video/base-video-parser';
import type { PES } from '../../../src/demux/tsdemuxer';
import type {
  DemuxedUserdataTrack,
  DemuxedVideoTrack,
  VideoSampleUnit,
} from '../../../src/types/demuxer';
import type { ChunkMetadata } from '../../../src/types/transmuxer';

class TestVideoParser extends BaseVideoParser {
  public parse(track: DemuxedVideoTrack, data: number[]) {
    return this.parseNALu(track, new Uint8Array(data), false);
  }

  public parsePES(
    _track: DemuxedVideoTrack,
    _textTrack: DemuxedUserdataTrack,
    _pes: PES,
    _last: boolean,
    _chunkMeta?: ChunkMetadata,
  ) {}

  protected getNALuType(data: Uint8Array, offset: number): number {
    return data[offset] & 0x1f;
  }
}

describe('BaseVideoParser', function () {
  let parser: TestVideoParser;
  let track: DemuxedVideoTrack;

  beforeEach(function () {
    parser = new TestVideoParser();
    track = videoTrack();
  });

  it('parses three and four-byte NAL unit start codes', function () {
    const units = parser.parse(
      track,
      [0, 0, 1, 0x65, 0xaa, 0, 0, 0, 1, 0x06, 0xbb],
    );

    expectUnits(units, [
      { data: [0x65, 0xaa], type: 5 },
      { data: [0x06, 0xbb], type: 6, state: 0 },
    ]);
    expect(track.naluState).to.equal(0);
  });

  it('discards padding zeros preceding a start code', function () {
    const units = parser.parse(
      track,
      [0, 0, 1, 0x65, 0xaa, 0, 0, 0, 0, 1, 0x06],
    );

    expectUnits(units, [
      { data: [0x65, 0xaa], type: 5 },
      { data: [0x06], type: 6, state: 0 },
    ]);
  });

  it('requires the Annex-B marker byte to equal 0x01', function () {
    const units = parser.parse(
      track,
      [0, 0, 1, 0x65, 0xaa, 0, 0, 0x02, 0xbb, 0, 0, 0x81, 0xcc, 0, 0, 1, 0x06],
    );

    expectUnits(units, [
      {
        data: [0x65, 0xaa, 0, 0, 0x02, 0xbb, 0, 0, 0x81, 0xcc],
        type: 5,
      },
      { data: [0x06], type: 6, state: 0 },
    ]);
  });
  it('recognizes a start code split across PES packets', function () {
    const previousUnit = addLastUnit(track, [0x65, 0xaa, 0, 0], 2);

    const units = parser.parse(track, [1, 0x06, 0xbb]);

    expect(Array.from(previousUnit.data)).to.deep.equal([0x65, 0xaa]);
    expectUnits(units, [{ data: [0x06, 0xbb], type: 6, state: 0 }]);
    expect(track.naluState).to.equal(0);
  });

  it('reads the NAL unit type from the next packet', function () {
    const firstUnits = parser.parse(track, [0, 0, 1, 0x65, 0xaa, 0, 0, 1]);

    expectUnits(firstUnits, [{ data: [0x65, 0xaa], type: 5 }]);
    expect(track.naluState).to.equal(-1);

    const secondUnits = parser.parse(track, [0x06, 0xbb]);

    expectUnits(secondUnits, [{ data: [0x06, 0xbb], type: 6, state: 0 }]);
    expect(track.naluState).to.equal(0);
  });

  it('appends data without a start code to the previous NAL unit', function () {
    const previousUnit = addLastUnit(track, [0x65, 0xaa], 0);

    const units = parser.parse(track, [0xbb, 0]);

    expect(units).to.have.lengthOf(0);
    expect(Array.from(previousUnit.data)).to.deep.equal([0x65, 0xaa, 0xbb, 0]);
    expect(previousUnit.state).to.equal(1);
    expect(track.naluState).to.equal(1);
  });

  it('skips payload without zero bytes', function () {
    const previousUnit = addLastUnit(track, [0x65, 0xaa], 0);

    const units = parser.parse(track, [0xbb, 0xcc]);

    expect(units).to.have.lengthOf(0);
    expect(Array.from(previousUnit.data)).to.deep.equal([
      0x65, 0xaa, 0xbb, 0xcc,
    ]);
    expect(track.naluState).to.equal(0);
  });

  it('produces the same NAL units at every PES split boundary', function () {
    const data = [
      0, 0, 1, 0x65, 0x12, 0x34, 0x56, 0, 0, 0, 1, 0x06, 0x78, 0x9a, 0, 0, 0, 0,
      1, 0x61, 0xbc, 0xde,
    ];
    const expected = {
      state: 0,
      units: [
        { data: [0x65, 0x12, 0x34, 0x56], type: 5 },
        { data: [0x06, 0x78, 0x9a], type: 6 },
        { data: [0x61, 0xbc, 0xde], type: 1 },
      ],
    };

    expect(parseChunks([data])).to.deep.equal(expected);

    for (let split = 1; split < data.length; split++) {
      expect(
        parseChunks([data.slice(0, split), data.slice(split)]),
        `split at byte ${split}`,
      ).to.deep.equal(expected);
    }
  });

  it('recognizes a start code split across three PES packets', function () {
    expect(
      parseChunks([[0, 0, 1, 0x65, 0xaa, 0], [0], [1], [0x06, 0xbb]]),
    ).to.deep.equal({
      state: 0,
      units: [
        { data: [0x65, 0xaa], type: 5 },
        { data: [0x06, 0xbb], type: 6 },
      ],
    });
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
    segmentCodec: 'avc',
    pixelRatio: [1, 1],
    width: 0,
    height: 0,
  };
}

function addLastUnit(
  track: DemuxedVideoTrack,
  data: number[],
  state: number,
): VideoSampleUnit {
  const unit = {
    data: new Uint8Array(data),
    type: 5,
    state,
  };
  track.samples.push({
    dts: 0,
    pts: 0,
    key: true,
    frame: true,
    units: [unit],
    length: data.length,
  });
  track.naluState = state;
  return unit;
}

function expectUnits(
  actual: VideoSampleUnit[],
  expected: Array<{ data: number[]; type: number; state?: number }>,
) {
  const serialized = actual.map((unit) => {
    const result: { data: number[]; type: number; state?: number } = {
      data: Array.from(unit.data),
      type: unit.type,
    };
    if (unit.state !== undefined) {
      result.state = unit.state;
    }
    return result;
  });
  expect(serialized).to.deep.equal(expected);
}

function parseChunks(chunks: number[][]) {
  const parser = new TestVideoParser();
  const track = videoTrack();

  for (let i = 0; i < chunks.length; i++) {
    const units = parser.parse(track, chunks[i]);
    if (units.length) {
      track.samples.push({
        dts: 0,
        pts: 0,
        key: true,
        frame: true,
        units,
        length: units.reduce((length, unit) => length + unit.data.length, 0),
      });
    }
  }

  const units = track.samples.reduce<VideoSampleUnit[]>(
    (result, sample) => result.concat(sample.units),
    [],
  );
  return {
    state: track.naluState,
    units: units.map((unit) => ({
      data: Array.from(unit.data),
      type: unit.type,
    })),
  };
}
