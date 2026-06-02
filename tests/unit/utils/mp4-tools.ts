import { expect } from 'chai';
import { ElementaryStreamTypes } from '../../../src/loader/fragment';
import MP4 from '../../../src/remux/mp4-generator';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import { logger } from '../../../src/utils/logger';
import {
  appendUint8Array,
  getSampleData,
  types,
} from '../../../src/utils/mp4-tools';
import type { InitData } from '../../../src/utils/mp4-tools';

describe('mp4-tools', function () {
  it('reads tfhd default sample duration and size in declaration order', function () {
    const sampleData = getSampleData(
      fragmentWithTfhdDefaults(
        0x000019,
        appendBytes(uint64(0), uint32(3003), uint32(1234)),
        1234,
      ),
      initData(),
      new ChunkMetadata(0, 0, 0),
      logger,
    );

    expect(sampleData[1].duration).to.equal(3003);
    expect(sampleData[1].trun[0].samples[0].size).to.equal(1234);
  });

  it('does not treat trex default sample flags as tfhd field flags', function () {
    const data = initData();
    data[1]!.default!.flags = 0x00010001;

    const sampleData = getSampleData(
      fragmentWithTfhdDefaults(
        0x000018,
        appendBytes(uint32(3003), uint32(1234)),
        1234,
      ),
      data,
      new ChunkMetadata(0, 0, 0),
      logger,
    );

    expect(sampleData[1].duration).to.equal(3003);
    expect(sampleData[1].trun[0].samples[0].size).to.equal(1234);
  });
});

function initData(): InitData {
  const data = [] as unknown as InitData;
  data[1] = {
    timescale: 90000,
    type: ElementaryStreamTypes.VIDEO,
    stsd: {
      codec: 'avc1.42001e',
      encrypted: false,
      supplemental: undefined,
    },
    default: {
      duration: 1001,
      sampleSize: 0,
      flags: 0,
    },
  };
  return data;
}

function fragmentWithTfhdDefaults(
  tfhdFlags: number,
  tfhdFields: Uint8Array,
  mdatSize: number,
): Uint8Array<ArrayBuffer> {
  const moof = MP4.box(
    types.moof,
    MP4.box(types.mfhd, appendBytes(uint32(0), uint32(1))),
    MP4.box(
      types.traf,
      MP4.box(
        types.tfhd,
        appendBytes(fullBoxHeader(tfhdFlags), uint32(1), tfhdFields),
      ),
      MP4.box(types.tfdt, appendBytes(uint32(0), uint32(0))),
      MP4.box(types.trun, appendBytes(fullBoxHeader(0), uint32(1))),
    ),
  );
  return appendUint8Array(moof, MP4.mdat(new Uint8Array(mdatSize)));
}

function fullBoxHeader(flags: number): Uint8Array {
  return new Uint8Array([
    0,
    (flags >>> 16) & 0xff,
    (flags >>> 8) & 0xff,
    flags & 0xff,
  ]);
}

function uint32(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function uint64(value: number): Uint8Array {
  return appendBytes(uint32(Math.floor(value / 2 ** 32)), uint32(value));
}

function appendBytes(...arrays: Uint8Array[]): Uint8Array<ArrayBuffer> {
  return arrays.reduce(
    (result, data) => appendUint8Array(result, data),
    new Uint8Array(0),
  ) as Uint8Array<ArrayBuffer>;
}
