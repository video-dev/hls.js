import { expect } from 'chai';
import sinon from 'sinon';
import Transmuxer, {
  TransmuxConfig,
  TransmuxState,
} from '../../../src/demux/transmuxer';
import AvcVideoParser from '../../../src/demux/video/avc-video-parser';
import HevcVideoParser from '../../../src/demux/video/hevc-video-parser';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import type { PES } from '../../../src/demux/tsdemuxer';
import type {
  DemuxedAudioTrack,
  DemuxedMetadataTrack,
  DemuxedUserdataTrack,
  DemuxedVideoTrack,
  DemuxerResult,
  VideoConfig,
  VideoSample,
} from '../../../src/types/demuxer';
import type { TransmuxerResult } from '../../../src/types/transmuxer';

// Real parameter sets from the stream in https://github.com/video-dev/hls.js/issues/3179
// (320x180 switching to 1280x720 in-band, mid-segment, without a discontinuity)
const SPS_320x180 = [
  0x67, 0x42, 0xc0, 0x1f, 0xda, 0x05, 0x06, 0x7e, 0x7c, 0x04, 0x40, 0x00, 0x00,
  0x03, 0x00, 0x40, 0x00, 0x00, 0x0f, 0x23, 0xc6, 0x0c, 0xa8,
];
const SPS_1280x720 = [
  0x67, 0x42, 0xc0, 0x1f, 0xda, 0x01, 0x40, 0x16, 0xec, 0x04, 0x40, 0x00, 0x00,
  0x03, 0x00, 0x40, 0x00, 0x00, 0x0f, 0x23, 0xc6, 0x0c, 0xa8,
];
const PPS = [0x68, 0xce, 0x3c, 0x80];
const AUD = [0x09, 0xf0];
const IDR = [0x65, 0x88, 0x80, 0x40];

// Parameter sets from two x265 streams (testsrc2, 320x180 and 640x360). 180 is
// not a multiple of the minimum coding block size, so the 320x180 SPS carries a
// conformance window crop.
const HEVC_VPS_320x180 = [
  0x40, 0x01, 0x0c, 0x01, 0xff, 0xff, 0x01, 0x60, 0x00, 0x00, 0x03, 0x00, 0x90,
  0x00, 0x00, 0x03, 0x00, 0x00, 0x03, 0x00, 0x3c, 0x95, 0x98, 0x09,
];
const HEVC_SPS_320x180 = [
  0x42, 0x01, 0x01, 0x01, 0x60, 0x00, 0x00, 0x03, 0x00, 0x90, 0x00, 0x00, 0x03,
  0x00, 0x00, 0x03, 0x00, 0x3c, 0xa0, 0x0a, 0x08, 0x0b, 0x9f, 0x79, 0x65, 0x66,
  0x92, 0x4c, 0xaf, 0x01, 0x68, 0x08, 0x00, 0x00, 0x03, 0x00, 0x08, 0x00, 0x00,
  0x03, 0x00, 0xf0, 0x40,
];
const HEVC_VPS_640x360 = [
  0x40, 0x01, 0x0c, 0x01, 0xff, 0xff, 0x01, 0x60, 0x00, 0x00, 0x03, 0x00, 0x90,
  0x00, 0x00, 0x03, 0x00, 0x00, 0x03, 0x00, 0x3f, 0x95, 0x98, 0x09,
];
const HEVC_SPS_640x360 = [
  0x42, 0x01, 0x01, 0x01, 0x60, 0x00, 0x00, 0x03, 0x00, 0x90, 0x00, 0x00, 0x03,
  0x00, 0x00, 0x03, 0x00, 0x3f, 0xa0, 0x05, 0x02, 0x01, 0x69, 0x65, 0x95, 0x9a,
  0x49, 0x32, 0xbc, 0x05, 0xa0, 0x20, 0x00, 0x00, 0x03, 0x00, 0x20, 0x00, 0x00,
  0x03, 0x03, 0xc1,
];
const HEVC_PPS = [0x44, 0x01, 0xc1, 0x72, 0xb4, 0x62, 0x40];
const HEVC_AUD = [0x46, 0x01, 0x50];
const HEVC_IDR = [0x26, 0x01, 0xaf, 0x08];

const startCode = [0, 0, 0, 1];

function annexB(nalus: number[][]): Uint8Array {
  const bytes: number[] = [];
  nalus.forEach((nalu) => {
    bytes.push(...startCode, ...nalu);
  });
  return new Uint8Array(bytes);
}

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

describe('AvcVideoParser in-band config switch', function () {
  it('records a config switch boundary when SPS dimensions change mid-stream', function () {
    const parser = new AvcVideoParser();
    const track = videoTrack();
    const textTrack = { samples: [] } as unknown as DemuxedUserdataTrack;
    const chunkMeta = new ChunkMetadata(0, 1, 0);
    const pes = (pts: number, data: Uint8Array): PES => ({
      data,
      pts,
      dts: pts,
      len: data.length,
    });

    parser.parsePES(
      track,
      textTrack,
      pes(0, annexB([AUD, SPS_320x180, PPS, IDR])),
      false,
      chunkMeta,
    );
    parser.parsePES(
      track,
      textTrack,
      pes(3000, annexB([AUD, IDR])),
      false,
      chunkMeta,
    );
    parser.parsePES(
      track,
      textTrack,
      pes(6000, annexB([AUD, IDR])),
      false,
      chunkMeta,
    );
    const spsBeforeSwitch = track.sps;
    parser.parsePES(
      track,
      textTrack,
      pes(9000, annexB([AUD, SPS_1280x720, PPS, IDR])),
      false,
      chunkMeta,
    );
    parser.parsePES(
      track,
      textTrack,
      pes(12000, annexB([AUD, IDR])),
      true,
      chunkMeta,
    );

    expect(track.samples).to.have.lengthOf(5);
    expect(track.width).to.equal(1280);
    expect(track.height).to.equal(720);
    expect(track.configSwitches).to.have.lengthOf(1);
    const configSwitch = track.configSwitches![0];
    expect(configSwitch.sampleIndex).to.equal(3);
    expect(configSwitch.prev.width).to.equal(320);
    expect(configSwitch.prev.height).to.equal(180);
    expect(configSwitch.prev.sps).to.equal(spsBeforeSwitch);
  });

  it('does not record a boundary for the initial SPS or without pending samples', function () {
    const parser = new AvcVideoParser();
    const track = videoTrack();
    const textTrack = { samples: [] } as unknown as DemuxedUserdataTrack;
    const chunkMeta = new ChunkMetadata(0, 1, 0);

    parser.parsePES(
      track,
      textTrack,
      {
        data: annexB([AUD, SPS_320x180, PPS, IDR]),
        pts: 0,
        dts: 0,
        len: 0,
      },
      true,
      chunkMeta,
    );

    expect(track.width).to.equal(320);
    expect(track.configSwitches).to.equal(undefined);
  });
});

describe('HevcVideoParser in-band config switch', function () {
  function hevcParser() {
    const parser = new HevcVideoParser();
    const track = videoTrack();
    track.segmentCodec = 'hevc';
    const textTrack = { samples: [] } as unknown as DemuxedUserdataTrack;
    let pts = 0;
    const feed = (nalus: number[][], endOfSegment: boolean = false) => {
      const data = annexB(nalus);
      parser.parsePES(
        track,
        textTrack,
        { data, pts, dts: pts, len: data.length },
        endOfSegment,
      );
      pts += 3000;
    };
    return { track, feed };
  }

  it('records a config switch boundary when the SPS changes mid-stream', function () {
    const { track, feed } = hevcParser();

    feed([HEVC_AUD, HEVC_VPS_320x180, HEVC_SPS_320x180, HEVC_PPS, HEVC_IDR]);
    feed([HEVC_AUD, HEVC_IDR]);
    feed([HEVC_AUD, HEVC_IDR]);
    const spsBeforeSwitch = track.sps;
    const ppsBeforeSwitch = track.pps;
    const vpsBeforeSwitch = track.vps;
    const paramsBeforeSwitch = { ...track.params };
    feed([HEVC_AUD, HEVC_VPS_640x360, HEVC_SPS_640x360, HEVC_PPS, HEVC_IDR]);
    feed([HEVC_AUD, HEVC_IDR], true);

    expect(track.samples).to.have.lengthOf(5);
    expect(track.width).to.equal(640);
    expect(track.height).to.equal(360);
    expect(track.configSwitches).to.have.lengthOf(1);
    const configSwitch = track.configSwitches![0];
    expect(configSwitch.sampleIndex).to.equal(3);
    expect(configSwitch.prev.width).to.equal(320);
    expect(configSwitch.prev.height).to.equal(180);
    expect(configSwitch.prev.sps).to.equal(spsBeforeSwitch);
    expect(configSwitch.prev.pps).to.equal(ppsBeforeSwitch);
    // The VPS of the outgoing config is overwritten before the SPS arrives
    expect(configSwitch.prev.vps).to.equal(vpsBeforeSwitch);
    expect(track.vps).to.not.equal(vpsBeforeSwitch);
    expect(configSwitch.prev.vps).to.not.equal(track.vps);
    expect(configSwitch.prev.params).to.deep.equal(paramsBeforeSwitch);
    expect(configSwitch.prev.params).to.not.equal(track.params);
    (track.params as any).probe = true;
    expect(configSwitch.prev.params).to.not.have.property('probe');
  });

  it('keeps the outgoing VPS when the switch access unit repeats its VPS', function () {
    const { track, feed } = hevcParser();

    feed([HEVC_AUD, HEVC_VPS_320x180, HEVC_SPS_320x180, HEVC_PPS, HEVC_IDR]);
    feed([HEVC_AUD, HEVC_IDR]);
    const vpsBeforeSwitch = track.vps;
    feed([
      HEVC_AUD,
      HEVC_VPS_640x360,
      HEVC_VPS_640x360,
      HEVC_SPS_640x360,
      HEVC_PPS,
      HEVC_IDR,
    ]);
    feed([HEVC_AUD, HEVC_IDR], true);

    expect(track.configSwitches).to.have.lengthOf(1);
    const configSwitch = track.configSwitches![0];
    expect(configSwitch.sampleIndex).to.equal(2);
    expect(configSwitch.prev.vps).to.equal(vpsBeforeSwitch);
    expect(configSwitch.prev.vps).to.not.equal(track.vps);
  });

  it('records a boundary for an SPS change without a new VPS', function () {
    const { track, feed } = hevcParser();

    feed([HEVC_AUD, HEVC_VPS_320x180, HEVC_SPS_320x180, HEVC_PPS, HEVC_IDR]);
    feed([HEVC_AUD, HEVC_IDR]);
    feed([HEVC_AUD, HEVC_SPS_640x360, HEVC_PPS, HEVC_IDR]);
    feed([HEVC_AUD, HEVC_IDR], true);

    expect(track.width).to.equal(640);
    expect(track.configSwitches).to.have.lengthOf(1);
    const configSwitch = track.configSwitches![0];
    expect(configSwitch.sampleIndex).to.equal(2);
    expect(configSwitch.prev.width).to.equal(320);
    expect(configSwitch.prev.vps).to.equal(track.vps);
  });

  it('does not record a boundary for the initial parameter sets', function () {
    const { track, feed } = hevcParser();

    feed(
      [HEVC_AUD, HEVC_VPS_320x180, HEVC_SPS_320x180, HEVC_PPS, HEVC_IDR],
      true,
    );

    expect(track.width).to.equal(320);
    expect(track.height).to.equal(180);
    expect(track.configSwitches).to.equal(undefined);
  });
});

describe('Transmuxer video config switch splitting', function () {
  const config320: VideoConfig = {
    sps: [new Uint8Array(SPS_320x180)],
    pps: [new Uint8Array(PPS)],
    width: 320,
    height: 180,
    pixelRatio: [1, 1],
    codec: 'avc1.42c01f',
  };
  const config640: VideoConfig = {
    sps: [new Uint8Array(SPS_320x180)],
    pps: [new Uint8Array(PPS)],
    width: 640,
    height: 360,
    pixelRatio: [1, 1],
    codec: 'avc1.42c01f',
  };

  function fakeSamples(count: number, firstPts: number): VideoSample[] {
    const samples: VideoSample[] = [];
    for (let i = 0; i < count; i++) {
      samples.push({
        pts: firstPts + i * 3000,
        dts: firstPts + i * 3000,
        key: i === 0,
        frame: true,
        units: [],
        length: 0,
      });
    }
    return samples;
  }

  function demuxResultWith(track: DemuxedVideoTrack): DemuxerResult {
    return {
      audioTrack: { pid: -1, samples: [] } as unknown as DemuxedAudioTrack,
      videoTrack: track,
      id3Track: { samples: [] } as unknown as DemuxedMetadataTrack,
      textTrack: { samples: [] } as unknown as DemuxedUserdataTrack,
    };
  }

  function setupTransmuxer(
    demuxResult: DemuxerResult,
    consumeSamples: boolean,
  ) {
    const observer = {
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    };
    const logger = {
      log: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      info: () => {},
      trace: () => {},
    };
    const transmuxer = new Transmuxer(
      observer as any,
      { mpeg: false, mp3: false, ac3: false } as any,
      { progressive: false } as any,
      '',
      'main' as any,
      logger as any,
    );
    transmuxer.configure(
      new TransmuxConfig(undefined, undefined, undefined, 10),
    );
    const remuxCalls: Array<{
      sampleCount: number;
      firstPts: number | undefined;
      width: number | undefined;
      sps: Uint8Array[] | undefined;
      vps: Uint8Array[] | undefined;
      params: object | undefined;
      flush: boolean;
    }> = [];
    const remux = sinon.spy(
      (
        audioTrack,
        video: DemuxedVideoTrack,
        id3,
        text,
        offset,
        accurate,
        flush,
      ) => {
        remuxCalls.push({
          sampleCount: video.samples.length,
          firstPts: video.samples[0]?.pts,
          width: video.width,
          sps: video.sps,
          vps: video.vps,
          params: video.params,
          flush,
        });
        if (consumeSamples) {
          video.samples = [];
        }
        return {};
      },
    );
    (transmuxer as any).demuxer = {
      demux: () => demuxResult,
      flush: () => demuxResult,
      resetTimeStamp: () => {},
      resetContiguity: () => {},
      resetInitSegment: () => {},
      destroy: () => {},
    };
    (transmuxer as any).remuxer = {
      remux,
      resetTimeStamp: () => {},
      resetNextTimestamp: () => {},
      resetInitSegment: () => {},
      destroy: () => {},
    };
    return { transmuxer, remuxCalls };
  }

  function pushState(): TransmuxState {
    return new TransmuxState(false, true, true, false, 0, false);
  }

  it('remuxes samples preceding the switch under the previous config on push', function () {
    const track = videoTrack();
    Object.assign(track, {
      width: 1280,
      height: 720,
      sps: [new Uint8Array(SPS_1280x720)],
      pps: [new Uint8Array(PPS)],
      codec: 'avc1.42c01f',
    });
    track.samples = fakeSamples(5, 0);
    track.configSwitches = [{ sampleIndex: 3, prev: config320 }];
    const demuxResult = demuxResultWith(track);
    const { transmuxer, remuxCalls } = setupTransmuxer(demuxResult, true);

    const chunkMeta = new ChunkMetadata(0, 1, 0);
    const result = transmuxer.push(
      new ArrayBuffer(8),
      null,
      chunkMeta,
      pushState(),
    ) as TransmuxerResult;

    expect(result.chunkMeta).to.equal(chunkMeta);
    expect(remuxCalls).to.have.lengthOf(1);
    expect(remuxCalls[0].sampleCount).to.equal(3);
    expect(remuxCalls[0].firstPts).to.equal(0);
    expect(remuxCalls[0].width).to.equal(320);
    expect(remuxCalls[0].sps).to.equal(config320.sps);
    // Samples after the switch are held back with the new config restored
    expect(track.samples).to.have.lengthOf(2);
    expect(track.samples[0].pts).to.equal(9000);
    expect(track.width).to.equal(1280);
    expect(track.configSwitches).to.have.lengthOf(0);

    const flushResults = transmuxer.flush(chunkMeta) as TransmuxerResult[];
    expect(flushResults).to.have.lengthOf(1);
    expect(remuxCalls).to.have.lengthOf(2);
    expect(remuxCalls[1].sampleCount).to.equal(2);
    expect(remuxCalls[1].firstPts).to.equal(9000);
    expect(remuxCalls[1].width).to.equal(1280);
    expect(remuxCalls[1].flush).to.equal(true);
  });

  it('keeps deferred samples ahead of held back samples when the remuxer does not consume them', function () {
    const track = videoTrack();
    Object.assign(track, {
      width: 1280,
      height: 720,
      sps: [new Uint8Array(SPS_1280x720)],
      pps: [new Uint8Array(PPS)],
      codec: 'avc1.42c01f',
    });
    track.samples = fakeSamples(5, 0);
    track.configSwitches = [{ sampleIndex: 3, prev: config320 }];
    const demuxResult = demuxResultWith(track);
    const { transmuxer, remuxCalls } = setupTransmuxer(demuxResult, false);

    const chunkMeta = new ChunkMetadata(0, 1, 0);
    const result = transmuxer.push(
      new ArrayBuffer(8),
      null,
      chunkMeta,
      pushState(),
    ) as TransmuxerResult;
    expect(result.chunkMeta).to.equal(chunkMeta);

    expect(remuxCalls).to.have.lengthOf(1);
    expect(track.samples).to.have.lengthOf(5);
    expect(track.samples[0].pts).to.equal(0);
    expect(track.width).to.equal(1280);
    expect(track.configSwitches).to.have.lengthOf(1);
    expect(track.configSwitches![0].sampleIndex).to.equal(3);
  });

  it('emits one result per config on flush with multiple switches', function () {
    const track = videoTrack();
    Object.assign(track, {
      width: 1280,
      height: 720,
      sps: [new Uint8Array(SPS_1280x720)],
      pps: [new Uint8Array(PPS)],
      codec: 'avc1.42c01f',
    });
    track.samples = fakeSamples(7, 0);
    track.configSwitches = [
      { sampleIndex: 3, prev: config320 },
      { sampleIndex: 5, prev: config640 },
    ];
    const demuxResult = demuxResultWith(track);
    const { transmuxer, remuxCalls } = setupTransmuxer(demuxResult, true);
    (transmuxer as any).currentTransmuxState = pushState();

    const chunkMeta = new ChunkMetadata(0, 1, 0);
    const flushResults = transmuxer.flush(chunkMeta) as TransmuxerResult[];

    expect(flushResults).to.have.lengthOf(3);
    expect(remuxCalls).to.have.lengthOf(3);
    expect(remuxCalls[0].sampleCount).to.equal(3);
    expect(remuxCalls[0].firstPts).to.equal(0);
    expect(remuxCalls[0].width).to.equal(320);
    expect(remuxCalls[1].sampleCount).to.equal(2);
    expect(remuxCalls[1].firstPts).to.equal(9000);
    expect(remuxCalls[1].width).to.equal(640);
    expect(remuxCalls[2].sampleCount).to.equal(2);
    expect(remuxCalls[2].firstPts).to.equal(15000);
    expect(remuxCalls[2].width).to.equal(1280);
    expect(track.samples).to.have.lengthOf(0);
    expect(track.configSwitches).to.have.lengthOf(0);
  });

  it('remuxes hevc samples preceding the switch under the previous vps and params', function () {
    const hevcConfig320: VideoConfig = {
      sps: [new Uint8Array(HEVC_SPS_320x180)],
      pps: [new Uint8Array(HEVC_PPS)],
      vps: [new Uint8Array(HEVC_VPS_320x180)],
      params: { general_level_idc: 60 },
      width: 320,
      height: 180,
      pixelRatio: [1, 1],
      codec: 'hvc1.1.6.L60.90',
    };
    const track = videoTrack();
    Object.assign(track, {
      segmentCodec: 'hevc',
      width: 640,
      height: 360,
      sps: [new Uint8Array(HEVC_SPS_640x360)],
      pps: [new Uint8Array(HEVC_PPS)],
      vps: [new Uint8Array(HEVC_VPS_640x360)],
      params: { general_level_idc: 63 },
      codec: 'hvc1.1.6.L63.90',
    });
    const currentVps = track.vps;
    const currentParams = track.params;
    track.samples = fakeSamples(5, 0);
    track.configSwitches = [{ sampleIndex: 3, prev: hevcConfig320 }];
    const demuxResult = demuxResultWith(track);
    const { transmuxer, remuxCalls } = setupTransmuxer(demuxResult, true);

    const chunkMeta = new ChunkMetadata(0, 1, 0);
    const result = transmuxer.push(
      new ArrayBuffer(8),
      null,
      chunkMeta,
      pushState(),
    ) as TransmuxerResult;
    expect(result.chunkMeta).to.equal(chunkMeta);

    expect(remuxCalls).to.have.lengthOf(1);
    expect(remuxCalls[0].sampleCount).to.equal(3);
    expect(remuxCalls[0].width).to.equal(320);
    expect(remuxCalls[0].sps).to.equal(hevcConfig320.sps);
    expect(remuxCalls[0].vps).to.equal(hevcConfig320.vps);
    expect(remuxCalls[0].params).to.equal(hevcConfig320.params);
    // Samples after the switch are held back with the new config restored
    expect(track.samples).to.have.lengthOf(2);
    expect(track.vps).to.equal(currentVps);
    expect(track.params).to.equal(currentParams);

    const flushResults = transmuxer.flush(chunkMeta) as TransmuxerResult[];
    expect(flushResults).to.have.lengthOf(1);
    expect(remuxCalls).to.have.lengthOf(2);
    expect(remuxCalls[1].sampleCount).to.equal(2);
    expect(remuxCalls[1].width).to.equal(640);
    expect(remuxCalls[1].vps).to.equal(currentVps);
    expect(remuxCalls[1].params).to.equal(currentParams);
  });

  it('ignores a boundary at sample index 0', function () {
    const track = videoTrack();
    Object.assign(track, {
      width: 1280,
      height: 720,
      sps: [new Uint8Array(SPS_1280x720)],
      pps: [new Uint8Array(PPS)],
      codec: 'avc1.42c01f',
    });
    track.samples = fakeSamples(5, 0);
    track.configSwitches = [{ sampleIndex: 0, prev: config320 }];
    const demuxResult = demuxResultWith(track);
    const { transmuxer, remuxCalls } = setupTransmuxer(demuxResult, true);

    const chunkMeta = new ChunkMetadata(0, 1, 0);
    const result = transmuxer.push(
      new ArrayBuffer(8),
      null,
      chunkMeta,
      pushState(),
    ) as TransmuxerResult;
    expect(result.chunkMeta).to.equal(chunkMeta);

    expect(remuxCalls).to.have.lengthOf(1);
    expect(remuxCalls[0].sampleCount).to.equal(5);
    expect(remuxCalls[0].width).to.equal(1280);
    expect(track.configSwitches).to.have.lengthOf(0);
  });
});
