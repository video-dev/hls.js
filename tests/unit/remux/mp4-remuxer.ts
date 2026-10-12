import { expect, use } from 'chai';
import EventEmitter from 'eventemitter3';
import sinonChai from 'sinon-chai';
import { hlsDefaultConfig } from '../../../src/config';
import MP4Remuxer from '../../../src/remux/mp4-remuxer';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import { logger } from '../../../src/utils/logger';
import { findBox } from '../../../src/utils/mp4-tools';
import type { HlsEventEmitter } from '../../../src/events';
import type {
  DemuxedAudioTrack,
  VideoSample,
} from '../../../src/types/demuxer';
import type { TypeSupported } from '../../../src/utils/codecs';

use(sinonChai);

describe('mp4-remuxer', function () {
  let mp4Remuxer: MP4Remuxer;

  beforeEach(function () {
    const observer: HlsEventEmitter = new EventEmitter() as HlsEventEmitter;
    const config = { ...hlsDefaultConfig };
    const typeSupported: TypeSupported = {
      mpeg: true,
      mp3: true,
      ac3: true,
    };
    mp4Remuxer = new MP4Remuxer(observer, config, typeSupported, logger);
  });

  afterEach(function () {
    mp4Remuxer.destroy();
  });

  it('should find the lowest PTS in video samples', function () {
    const videoSamples = [ptsDts(0, 0), ptsDts(3003, 3003), ptsDts(6006, 6006)];
    const minPts = mp4Remuxer.getVideoStartPts(videoSamples);
    expect(minPts).to.eq(0);
  });

  it('should find the lowest PTS in video samples with decrementing PTS samples', function () {
    const videoSamples = [
      ptsDts(3003, 0),
      ptsDts(1001, 3003),
      ptsDts(6006, 6006),
    ];
    const minPts = mp4Remuxer.getVideoStartPts(videoSamples);
    expect(minPts).to.eq(1001);
  });

  it('should find the lowest normalized PTS in video samples with wrapping timestamps 1/2', function () {
    const videoSamples = [
      ptsDts(8589925344, 8589922341),
      ptsDts(2765, 8589925344),
      ptsDts(8589931350, 8589928347),
      ptsDts(8589934353, 8589931350),
      ptsDts(11774, 8589934353),
      ptsDts(5768, 2765),
      ptsDts(8771, 5768),
      ptsDts(14777, 8771),
    ];
    const minPts = mp4Remuxer.getVideoStartPts(videoSamples);
    expect(minPts).to.eq(8589925344);
    expect(minPts).to.lessThanOrEqual(8589925344);
  });

  it('should find the lowest normalized PTS in video samples with wrapping timestamps 2/2', function () {
    const videoSamples = [
      ptsDts(8589931350, 8589922341),
      ptsDts(8589928347, 8589928347),
      ptsDts(8589934353, 8589931350),
      ptsDts(11774, 8589934353),
      ptsDts(5768, 2765),
      ptsDts(8771, 5768),
      ptsDts(14777, 8771),
    ];
    const minPts = mp4Remuxer.getVideoStartPts(videoSamples);
    expect(minPts).to.eq(8589928347);
  });

  it('computeInitPts() returns 0 for basetime 0 at presentationTime 0', function () {
    expect(mp4Remuxer.computeInitPts(0, 90000, 0, 'video')).to.eq(0);
  });

  it('computeInitPts() rolls forward when basetime has wrapped past 2^33', function () {
    const basetime = 8589000000; // near 2^33, pre-rollover segment
    const timeOffset = 583.595; // seek target after rollover
    const result = mp4Remuxer.computeInitPts(
      basetime,
      90000,
      timeOffset,
      'audio',
    );
    expect(result).to.be.gt(0);
  });

  it('computeInitPts() rolls forward when offset exceeds 2^33 and normalizePts does not wrap to negative', function () {
    const basetime = 100000;
    const timeOffset = 95600; // ~26.5 hours, offset = ~8604000000 > 2^33
    const timescale = 90000;
    const result = mp4Remuxer.computeInitPts(
      basetime,
      timescale,
      timeOffset,
      'audio',
    );
    expect(result).to.be.gt(0);
  });

  describe('remuxAudio', function () {
    beforeEach(function () {
      (mp4Remuxer as any)._initPTS = {
        baseTime: 0,
        timescale: 90000,
        trackId: 1,
      };
    });

    it('rounds the tfdt up when the first PTS is off the audio sample grid, and reports the residual', function () {
      // 132006 / (90000 / 44100) = 64682.94 audio ticks
      const firstPts = 132006;
      const audio = mp4Remuxer.remuxAudio(
        aacTrack(firstPts, 44100),
        0,
        false,
        false,
        undefined,
        new ChunkMetadata(0, 0, 0),
      );
      const raw = firstPts / (90000 / 44100);
      expect(raw % 1).to.not.eq(0);
      expect(readTfdt(audio!.data1)).to.eq(Math.ceil(raw));
      expect(audio!.timestampOffsetAdjustment).to.be.closeTo(
        (Math.ceil(raw) - raw) / 44100,
        1e-12,
      );
      expect(audio!.timestampOffsetAdjustment).to.be.gt(0);
    });

    it('reports no residual when the first PTS is on the audio sample grid', function () {
      // 90000 / (90000 / 48000) = 48000 audio ticks
      const firstPts = 90000;
      const audio = mp4Remuxer.remuxAudio(
        aacTrack(firstPts, 48000),
        0,
        false,
        false,
        undefined,
        new ChunkMetadata(0, 0, 0),
      );
      expect(readTfdt(audio!.data1)).to.eq(48000);
      expect(audio!.timestampOffsetAdjustment).to.eq(0);
    });
  });
});

function aacTrack(firstPts: number, samplerate: number): DemuxedAudioTrack {
  const inputSampleDuration = (1024 * 90000) / samplerate;
  return {
    type: 'audio',
    id: 2,
    pid: 257,
    inputTimeScale: 90000,
    sequenceNumber: 0,
    samples: [0, 1, 2].map((i) => ({
      unit: new Uint8Array(8),
      pts: firstPts + i * inputSampleDuration,
    })),
    dropped: 0,
    segmentCodec: 'aac',
    samplerate,
    channelCount: 2,
    config: [0x12, 0x10],
    codec: 'mp4a.40.2',
    manifestCodec: 'mp4a.40.2',
  };
}

function readTfdt(moof: Uint8Array): number {
  const tfdt = findBox(moof, ['moof', 'traf', 'tfdt'])[0];
  const view = new DataView(tfdt.buffer, tfdt.byteOffset, tfdt.byteLength);
  return tfdt[0] === 1
    ? view.getUint32(4) * 2 ** 32 + view.getUint32(8)
    : view.getUint32(4);
}

function ptsDts(pts: number, dts: number): VideoSample {
  return {
    dts,
    pts,
    key: true,
    frame: true,
    units: [
      {
        data: new Uint8Array(1),
        type: 0,
      },
    ],
    length: 1,
  };
}
