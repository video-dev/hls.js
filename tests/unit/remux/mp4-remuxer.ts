import { expect, use } from 'chai';
import EventEmitter from 'eventemitter3';
import sinonChai from 'sinon-chai';
import { hlsDefaultConfig } from '../../../src/config';
import MP4Remuxer from '../../../src/remux/mp4-remuxer';
import { logger } from '../../../src/utils/logger';
import type { HlsEventEmitter } from '../../../src/events';
import type { VideoSample } from '../../../src/types/demuxer';
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
});

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
