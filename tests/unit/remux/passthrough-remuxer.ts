import { expect } from 'chai';
import EventEmitter from 'eventemitter3';
import { hlsDefaultConfig } from '../../../src/config';
import MP4 from '../../../src/remux/mp4-generator';
import PassThroughRemuxer from '../../../src/remux/passthrough-remuxer';
import { PlaylistLevelType } from '../../../src/types/loader';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import { logger } from '../../../src/utils/logger';
import {
  appendUint8Array,
  findBox,
  parseInitSegment,
  types,
  writeUint32,
} from '../../../src/utils/mp4-tools';
import type { HlsEventEmitter } from '../../../src/events';
import type { TrackFragmentSample } from '../../../src/remux/mp4-generator';
import type {
  DemuxedAudioTrack,
  DemuxedMetadataTrack,
  DemuxedUserdataTrack,
  PassthroughTrack,
} from '../../../src/types/demuxer';
import type { TypeSupported } from '../../../src/utils/codecs';

describe('passthrough-remuxer', function () {
  let remuxer: PassThroughRemuxer;

  beforeEach(function () {
    const observer: HlsEventEmitter = new EventEmitter() as HlsEventEmitter;
    const typeSupported: TypeSupported = {
      ac3: true,
      mpeg: true,
      mp3: true,
    };
    remuxer = new PassThroughRemuxer(
      observer,
      { ...hlsDefaultConfig },
      typeSupported,
      logger,
    );
  });

  afterEach(function () {
    remuxer.destroy();
  });

  function remuxIFrameFragment(
    fragmentData: Uint8Array<ArrayBuffer>,
    extinfDuration: number,
    encrypted = false,
  ) {
    const initSegment = MP4.initSegment([videoInitTrack()]);
    if (encrypted) {
      markVideoInitSegmentEncrypted(initSegment);
    }
    remuxer.resetInitSegment(initSegment, undefined, 'avc1.42001e', null);

    return remuxer.remux(
      audioTrack(),
      passthroughTrack(fragmentData),
      metadataTrack(),
      userdataTrack(),
      0,
      true,
      true,
      PlaylistLevelType.MAIN,
      new ChunkMetadata(
        0,
        0,
        0,
        fragmentData.byteLength,
        -1,
        false,
        extinfDuration,
        true,
      ),
    );
  }

  function remuxIFrame(
    fragmentData: Uint8Array<ArrayBuffer>,
    extinfDuration: number,
  ) {
    return remuxer.remux(
      audioTrack(),
      passthroughTrack(fragmentData),
      metadataTrack(),
      userdataTrack(),
      0,
      true,
      true,
      PlaylistLevelType.MAIN,
      new ChunkMetadata(
        0,
        0,
        0,
        fragmentData.byteLength,
        -1,
        false,
        extinfDuration,
        true,
      ),
    );
  }

  it('remuxes moof+mdat to stretch a single-keyframe iframe to the EXTINF duration', function () {
    const extinfDuration = 4;
    const fragmentData = mp4Fragment([sample(3003, 4, 0)]);

    const result = remuxIFrameFragment(fragmentData, extinfDuration);

    expect(result.video, 'video track').to.exist;
    // regenerated: a fresh moof in data1 and a separate mdat in data2
    expect(result.video!.data1, 'data1').to.not.equal(fragmentData);
    expect(result.video!.data2, 'data2').to.exist;
    expect(result.video!.endDTS - result.video!.startDTS).to.equal(
      extinfDuration,
    );
    // The reported PTS range must cover the stretched sample so that
    // fragment start/end updates match the appended media.
    expect(result.video!.endPTS - result.video!.startPTS).to.equal(
      extinfDuration,
    );
    expect(result.video!.nb).to.equal(1);
  });

  it('does not remux a byte-range iframe segment whose sample duration already matches EXTINF', function () {
    // Byte-range addressed iframe (single sample spanning the whole playback segment)
    const extinfDuration = 4;
    const fragmentData = mp4Fragment([sample(extinfDuration * 90000, 4, 0)]);

    const result = remuxIFrameFragment(fragmentData, extinfDuration);

    expect(result.video, 'video track').to.exist;
    expect(result.video!.data2, 'data2').to.not.exist;
    expect(result.video!.data1).to.equal(fragmentData);
  });

  it('regenerates moof+mdat for a multi-sample iframe fragment, keeping every sample', function () {
    const extinfDuration = 4;
    const fragmentData = mp4Fragment([
      sample(3003, 4, 0),
      sample(3003, 4, 0),
      sample(3003, 4, 0),
    ]);

    const result = remuxIFrameFragment(fragmentData, extinfDuration);

    expect(result.video, 'video track').to.exist;
    expect(result.video!.data1, 'data1').to.not.equal(fragmentData);
    expect(result.video!.data2, 'data2').to.exist;
    // all three parsed samples are reported, not collapsed to one
    expect(result.video!.nb).to.equal(3);
    expect(result.video!.endDTS - result.video!.startDTS).to.equal(
      extinfDuration,
    );
    expect(result.video!.endPTS - result.video!.startPTS).to.equal(
      extinfDuration,
    );
    // Each sample keeps its own duration; only the last is stretched to
    // balance EXTINF.
    expect(trunSampleDurations(result.video!.data1)).to.deep.equal([
      3003,
      3003,
      extinfDuration * 90000 - 6006,
    ]);
  });

  it('reports the presentation end of stretched samples with composition offsets', function () {
    const extinfDuration = 4;
    const fragmentData = mp4Fragment([
      sample(3003, 4, 9000),
      sample(3003, 4, 0),
    ]);

    const result = remuxIFrameFragment(fragmentData, extinfDuration);

    expect(result.video, 'video track').to.exist;
    expect(result.video!.startPTS).to.equal(3003 / 90000);
    expect(result.video!.endPTS).to.equal(extinfDuration);
  });

  it('keeps native sample durations when EXTINF is shorter than the preceding samples', function () {
    // Stretching would make the last sample duration negative (writing an
    // unsigned wrap-around value into the trun).
    const extinfDuration = 1;
    const fragmentData = mp4Fragment([
      sample(45045, 4, 0),
      sample(45045, 4, 0),
      sample(45045, 4, 0),
    ]);

    const result = remuxIFrameFragment(fragmentData, extinfDuration);

    expect(result.video, 'video track').to.exist;
    expect(trunSampleDurations(result.video!.data1)).to.deep.equal([
      45045, 45045, 45045,
    ]);
    expect(result.video!.endPTS - result.video!.startPTS).to.equal(
      (3 * 45045) / 90000,
    );
  });

  it('rewrites the sample duration of encrypted iframe fragments in place', function () {
    const extinfDuration = 4;
    const fragmentData = mp4Fragment([sample(3003, 4, 9000)]);

    const result = remuxIFrameFragment(fragmentData, extinfDuration, true);

    expect(result.video, 'video track').to.exist;
    // The original moof is retained so encryption boxes survive intact
    expect(result.video!.data1).to.equal(fragmentData);
    expect(result.video!.data2, 'data2').to.not.exist;
    expect(result.video!.encrypted).to.equal(true);
    expect(trunSampleDurations(fragmentData)).to.deep.equal([
      extinfDuration * 90000,
    ]);
    expect(result.video!.endPTS - result.video!.startPTS).to.be.closeTo(
      extinfDuration,
      1 / 90000,
    );
  });

  it('converts muxed input to video-only for iframe fragments', function () {
    const extinfDuration = 4;
    const initSegment = MP4.initSegment([
      videoInitTrack(),
      audioInitTrack(),
    ] as any);
    remuxer.resetInitSegment(initSegment, 'mp4a.40.2', 'avc1.42001e', null);
    // Video sample duration matches EXTINF: the muxed moof must still be
    // regenerated so the audio track fragment is not appended
    const fragmentData = muxedMp4Fragment(
      [sample(extinfDuration * 90000, 24, 0)],
      [50, 60],
    );

    const result = remuxer.remux(
      audioTrack(),
      passthroughTrack(fragmentData),
      metadataTrack(),
      userdataTrack(),
      0,
      true,
      true,
      PlaylistLevelType.MAIN,
      new ChunkMetadata(
        0,
        0,
        0,
        fragmentData.byteLength,
        -1,
        false,
        extinfDuration,
        true,
      ),
    );

    // The emitted init segment is converted to video-only
    const videoInitTrackInfo = result.initSegment?.tracks?.video;
    expect(videoInitTrackInfo, 'video init track').to.exist;
    expect(result.initSegment?.tracks?.audiovideo, 'audiovideo init track').to
      .not.exist;
    const parsedInit = parseInitSegment(videoInitTrackInfo!.initSegment!);
    expect(parsedInit.video, 'filtered init video').to.exist;
    expect(parsedInit.audio, 'filtered init audio').to.not.exist;

    // Video-only output: regenerated moof and an mdat with only video bytes
    expect(result.video, 'video track').to.exist;
    expect(result.video!.type).to.equal('video');
    expect(result.video!.hasAudio).to.equal(false);
    expect(result.video!.data1, 'data1 regenerated').to.not.equal(fragmentData);
    expect(result.video!.data2!.byteLength, 'video-only mdat').to.equal(24 + 8);
    expect(result.video!.endPTS - result.video!.startPTS).to.equal(
      extinfDuration,
    );
  });

  it('remuxes muxed iframe fragments with the audio run first in the mdat', function () {
    const extinfDuration = 4;
    const initSegment = MP4.initSegment([
      videoInitTrack(),
      audioInitTrack(),
    ] as any);
    remuxer.resetInitSegment(initSegment, 'mp4a.40.2', 'avc1.42001e', null);
    const fragmentData = muxedMp4Fragment(
      [sample(3003, 24, 0)],
      [50, 60],
      true,
    );

    const result = remuxIFrame(fragmentData, extinfDuration);

    expect(result.video, 'video track').to.exist;
    expect(result.video!.type).to.equal('video');
    expect(result.video!.data2!.byteLength, 'video-only mdat').to.equal(24 + 8);
    expect(result.video!.endPTS - result.video!.startPTS).to.equal(
      extinfDuration,
    );
  });

  it('remuxes iframe fragments with multiple video track fragment runs', function () {
    const extinfDuration = 4;
    const initSegment = MP4.initSegment([
      videoInitTrack(),
      audioInitTrack(),
    ] as any);
    remuxer.resetInitSegment(initSegment, 'mp4a.40.2', 'avc1.42001e', null);
    const fragmentData = withSecondVideoTraf(
      muxedMp4Fragment([sample(3003, 24, 0)], [50]),
    );

    const result = remuxIFrame(fragmentData, extinfDuration);

    expect(result.video, 'video track').to.exist;
    expect(result.video!.data2!.byteLength, 'gathered mdat').to.equal(24 + 8);
    expect(result.video!.endPTS - result.video!.startPTS).to.equal(
      extinfDuration,
    );
  });

  it('drops muxed iframe fragments with no video sample in range', function () {
    const extinfDuration = 4;
    const initSegment = MP4.initSegment([
      videoInitTrack(),
      audioInitTrack(),
    ] as any);
    remuxer.resetInitSegment(initSegment, 'mp4a.40.2', 'avc1.42001e', null);
    // Audio-first layout sliced before the video sample: nothing can be
    // appended to the video-only SourceBuffer
    const fragmentData = muxedMp4Fragment([sample(3003, 24, 0)], [50], true);
    const moofSize = findBox(fragmentData, ['moof'])[0].byteLength + 8;
    const partialFragment = fragmentData.subarray(0, moofSize + 8 + 30);

    const result = remuxIFrame(partialFragment, extinfDuration);

    expect(result.initSegment?.tracks?.video, 'video init track').to.exist;
    expect(result.video, 'video track').to.equal(undefined);
  });

  it('truncates encrypted partial-mdat iframe fragments on the mdat box boundary', function () {
    const extinfDuration = 4;
    const samples = [sample(3003, 10, 0), sample(3003, 20, 0)];
    const fragmentData = mp4Fragment(samples);
    // Slice mid-way through the second sample's data, as a byte-range
    // addressed I-Frame request would.
    const mdatPayloadOffset = fragmentData.byteLength - 30;
    const partialFragment = fragmentData.subarray(0, mdatPayloadOffset + 13);

    const result = remuxIFrameFragment(partialFragment, extinfDuration, true);

    expect(result.video, 'video track').to.exist;
    expect(result.video!.encrypted).to.equal(true);
    // Appended data ends at the rewritten mdat boundary, dropping the
    // partially loaded sample's bytes.
    expect(result.video!.data1.byteLength).to.equal(mdatPayloadOffset + 10);
    expect(readUint32(result.video!.data1, mdatPayloadOffset - 8)).to.equal(18);
    const trun = findBox(result.video!.data1, ['moof', 'traf', 'trun'])[0];
    expect(readUint32(trun, 4), 'trun sample_count').to.equal(1);
    expect(trunSampleDurations(result.video!.data1)).to.deep.equal([
      extinfDuration * 90000,
    ]);
    expect(result.video!.endPTS - result.video!.startPTS).to.equal(
      extinfDuration,
    );
  });
});

function markVideoInitSegmentEncrypted(
  initSegment: Uint8Array<ArrayBuffer>,
): void {
  const stsd = findBox(initSegment, [
    'moov',
    'trak',
    'mdia',
    'minf',
    'stbl',
    'stsd',
  ])[0];
  const sampleEntry = findBox(stsd.subarray(8), ['avc1'])[0];
  const typeOffset = sampleEntry.byteOffset - initSegment.byteOffset - 4;
  initSegment.set([0x65, 0x6e, 0x63, 0x76], typeOffset); // 'encv'
}

function readUint32(buffer: Uint8Array, offset: number): number {
  return (
    ((buffer[offset] << 24) |
      (buffer[offset + 1] << 16) |
      (buffer[offset + 2] << 8) |
      buffer[offset + 3]) >>>
    0
  );
}

function trunSampleDurations(data: Uint8Array): number[] {
  const trun = findBox(data, ['moof', 'traf', 'trun'])[0];
  const sampleCount = readUint32(trun, 4);
  const durations: number[] = [];
  // full box header (4) + sample_count (4) + data_offset (4);
  // entries are duration, size, flags, cts (16 bytes each)
  for (let i = 0; i < sampleCount; i++) {
    durations.push(readUint32(trun, 12 + i * 16));
  }
  return durations;
}

function videoInitTrack(): any {
  return {
    codec: 'avc1.42001e',
    dropped: 0,
    duration: 4,
    id: 1,
    inputTimeScale: 90000,
    len: 0,
    nbNalu: 0,
    pid: -1,
    pixelRatio: [1, 1],
    pps: [new Uint8Array([0x68, 0xce, 0x06, 0xe2])],
    samples: [],
    segmentCodec: 'avc',
    sequenceNumber: 0,
    sps: [new Uint8Array([0x67, 0x42, 0x00, 0x1e, 0xab, 0x40])],
    timescale: 90000,
    type: 'video',
    width: 16,
    height: 16,
  };
}

function audioInitTrack(): any {
  return {
    codec: 'mp4a.40.2',
    segmentCodec: 'aac',
    channelCount: 2,
    samplerate: 48000,
    config: [0x11, 0x90],
    duration: 4,
    id: 2,
    timescale: 48000,
    type: 'audio',
  };
}

// moof with a video traf (track 1) and an audio traf (track 2) sharing one
// mdat: video run first, audio run after (ffmpeg muxed fMP4 layout)
function muxedMp4Fragment(
  videoSamples: TrackFragmentSample[],
  audioSampleSizes: number[],
  audioFirst = false,
): Uint8Array<ArrayBuffer> {
  const videoBytes = videoSamples.reduce((total, s) => total + s.size, 0);
  const audioBytes = audioSampleSizes.reduce((total, s) => total + s, 0);
  const videoMoof = MP4.moof(0, 0, {
    type: 'video',
    id: 1,
    samples: videoSamples,
  });

  const tfhd = new Uint8Array(8);
  tfhd.set([0x00, 0x02, 0x00, 0x00]); // version 0, default-base-is-moof
  writeUint32(tfhd, 4, 2); // track_ID
  const tfdt = new Uint8Array(8);
  const audioTrun = new Uint8Array(12 + audioSampleSizes.length * 8);
  audioTrun.set([0x00, 0x00, 0x03, 0x01]); // data-offset + duration + size
  writeUint32(audioTrun, 4, audioSampleSizes.length);
  audioSampleSizes.forEach((size, i) => {
    writeUint32(audioTrun, 12 + i * 8, 1024);
    writeUint32(audioTrun, 12 + i * 8 + 4, size);
  });
  const audioTraf = MP4.box(
    types.traf,
    MP4.box(types.tfhd, tfhd),
    MP4.box(types.tfdt, tfdt),
    MP4.box(types.trun, audioTrun),
  );

  // Splice the audio traf into the moof, then patch the moof size and both
  // trun data offsets for the combined mdat layout
  const moof = new Uint8Array(videoMoof.byteLength + audioTraf.byteLength);
  moof.set(videoMoof, 0);
  moof.set(audioTraf, videoMoof.byteLength);
  writeUint32(moof, 0, moof.byteLength);
  const truns = findBox(moof, ['moof', 'traf', 'trun']);
  writeUint32(
    moof,
    truns[0].byteOffset - moof.byteOffset + 8,
    moof.byteLength + 8 + (audioFirst ? audioBytes : 0),
  );
  writeUint32(
    moof,
    truns[1].byteOffset - moof.byteOffset + 8,
    moof.byteLength + 8 + (audioFirst ? 0 : videoBytes),
  );

  return appendUint8Array(
    moof,
    MP4.mdat(new Uint8Array(videoBytes + audioBytes)),
  ) as Uint8Array<ArrayBuffer>;
}

// Appends a second (empty) video track fragment to the moof so the video
// track has more than one trun
function withSecondVideoTraf(
  fragment: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  const tfhd = new Uint8Array(8);
  tfhd.set([0x00, 0x02, 0x00, 0x00]);
  writeUint32(tfhd, 4, 1); // video track_ID
  const trun = new Uint8Array(12);
  trun[2] = 0x01; // data-offset present
  const traf = MP4.box(
    types.traf,
    MP4.box(types.tfhd, tfhd),
    MP4.box(types.trun, trun),
  );
  const moofSize = findBox(fragment, ['moof'])[0].byteLength + 8;
  const result = new Uint8Array(fragment.byteLength + traf.byteLength);
  result.set(fragment.subarray(0, moofSize), 0);
  result.set(traf, moofSize);
  result.set(fragment.subarray(moofSize), moofSize + traf.byteLength);
  writeUint32(result, 0, moofSize + traf.byteLength);
  return result;
}

function mp4Fragment(samples: TrackFragmentSample[]): Uint8Array<ArrayBuffer> {
  const mdatPayload = new Uint8Array(
    samples.reduce((total, sample) => total + sample.size, 0),
  );
  return appendUint8Array(
    MP4.moof(0, 0, { type: 'video', id: 1, samples }),
    MP4.mdat(mdatPayload),
  );
}

function sample(
  duration: number,
  size: number,
  cts: number,
): TrackFragmentSample {
  return {
    cts,
    duration,
    flags: {
      degradPrio: 0,
      dependsOn: 2,
      hasRedundancy: 0,
      isDependedOn: 0,
      isLeading: 0,
      isNonSync: 0,
      paddingValue: 0,
    },
    size,
  };
}

function passthroughTrack(samples: Uint8Array<ArrayBuffer>): PassthroughTrack {
  return {
    codec: 'avc1.42001e',
    dropped: 0,
    duration: 4,
    id: 1,
    inputTimeScale: 90000,
    pid: -1,
    sampleDuration: 3003,
    samples,
    sequenceNumber: 0,
    supplemental: undefined,
    timescale: 90000,
    type: 'video',
  };
}

function audioTrack(): DemuxedAudioTrack {
  return {
    dropped: 0,
    id: 2,
    inputTimeScale: 90000,
    pid: -1,
    samples: [],
    segmentCodec: 'aac',
    sequenceNumber: 0,
    type: 'audio',
  };
}

function metadataTrack(): DemuxedMetadataTrack {
  return {
    dropped: 0,
    id: 3,
    inputTimeScale: 90000,
    pid: -1,
    samples: [],
    sequenceNumber: 0,
    type: 'id3',
  };
}

function userdataTrack(): DemuxedUserdataTrack {
  return {
    dropped: 0,
    id: 4,
    inputTimeScale: 90000,
    pid: -1,
    samples: [],
    sequenceNumber: 0,
    type: 'text',
  };
}
