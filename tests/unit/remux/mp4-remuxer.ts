import { expect, use } from 'chai';
import EventEmitter from 'eventemitter3';
import sinonChai from 'sinon-chai';
import { hlsDefaultConfig } from '../../../src/config';
import { dummyTrack } from '../../../src/demux/dummy-demuxed-track';
import MP4Remuxer from '../../../src/remux/mp4-remuxer';
import { PlaylistLevelType } from '../../../src/types/loader';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import { logger } from '../../../src/utils/logger';
import { findBox } from '../../../src/utils/mp4-tools';
import type { HlsEventEmitter } from '../../../src/events';
import type {
  AudioSample,
  DemuxedAudioTrack,
  DemuxedMetadataTrack,
  DemuxedUserdataTrack,
  DemuxedVideoTrack,
  VideoSample,
} from '../../../src/types/demuxer';
import type { TypeSupported } from '../../../src/utils/codecs';

use(sinonChai);

const VIDEO_FRAME_DURATION = 3600; // 25 fps in 90 kHz ticks
const AAC_FRAME_DURATION = 1920; // 1024 samples at 48 kHz in 90 kHz ticks

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

  describe('initPTS anchoring', function () {
    const frames = 100; // 4 seconds at 25 fps
    const fragmentDuration = (frames * VIDEO_FRAME_DURATION) / 90000;

    it('anchors the first segment of a session on video DTS so earlier segments keep composition headroom', function () {
      // start mid-stream at playlist time 20 (#7932): the first DTS maps to 20, the first PTS to 20 + cts
      const firstDts = 1800000 + 7830;
      const result = remuxFragment(
        mp4Remuxer,
        3,
        makeVideoTrack(firstDts, 7200, frames),
        makeAudioTrack(firstDts + 9200, 185),
        20,
      );
      expect(result.initSegment?.initPTS).to.equal(firstDts - 20 * 90000);
      expect(result.video?.startPTS).to.be.closeTo(20 + 7200 / 90000, 0.001);
    });

    it('anchors on video DTS after seeking (non-contiguous) into another discontinuity sequence', function () {
      remuxFragment(
        mp4Remuxer,
        3,
        makeVideoTrack(1800000, 7200, frames),
        makeAudioTrack(1800000 + 9200, 185),
        20,
      );
      // seek: the transmuxer resets the init segment, the timestamp offset (new cc, no cached initPTS) and contiguity
      mp4Remuxer.resetInitSegment();
      mp4Remuxer.resetTimeStamp(null);
      mp4Remuxer.resetNextTimestamp();
      const firstDts = 30000000;
      const result = remuxFragment(
        mp4Remuxer,
        40,
        makeVideoTrack(firstDts, 7200, frames),
        makeAudioTrack(firstDts + 9200, 185),
        300,
      );
      expect(result.initSegment?.initPTS).to.equal(firstDts - 300 * 90000);
    });

    it('does not shift the timeline by the composition offset at each discontinuity (#8064)', function () {
      // cc 0 mirrors the first segment of the deltatre DAI test stream: cts 40 ms, first audio 99 ms after the first video DTS
      let result = remuxFragment(
        mp4Remuxer,
        0,
        makeVideoTrack(900000, 3600, frames),
        makeAudioTrack(900000 + 8951, 185),
        0,
      );
      let timeOffset = Math.max(result.video!.endPTS, result.audio!.endPTS);
      // cc 1 to 3 mirror the ad segments: cts 80 ms, first audio 101 ms then 80 ms after the first video DTS
      const sequences = [
        { dts: 118800, cts: 7200, audioOffset: 9119 },
        { dts: 118800, cts: 7200, audioOffset: 7200 },
        { dts: 118800, cts: 7200, audioOffset: 7200 },
      ];
      sequences.forEach(({ dts, cts, audioOffset }, i) => {
        // contiguous discontinuity: the transmuxer resets the init segment and the timestamp offset, but not contiguity
        mp4Remuxer.resetInitSegment();
        mp4Remuxer.resetTimeStamp(null);
        result = remuxFragment(
          mp4Remuxer,
          i + 1,
          makeVideoTrack(dts, cts, frames),
          makeAudioTrack(dts + audioOffset, 185),
          timeOffset,
        );
        // the remuxed video must end one fragment duration after the timeOffset it was asked to start at
        expect(result.video!.endPTS, `cc ${i + 1} video endPTS`).to.be.closeTo(
          timeOffset + fragmentDuration,
          0.001,
        );
        timeOffset = Math.max(result.video!.endPTS, result.audio!.endPTS);
      });
    });

    it('anchors on video DTS at a discontinuity reached with a level switch (not contiguous)', function () {
      let result = remuxFragment(
        mp4Remuxer,
        0,
        makeVideoTrack(900000, 3600, frames),
        makeAudioTrack(900000 + 8951, 185),
        0,
      );
      const timeOffset = Math.max(result.video!.endPTS, result.audio!.endPTS);
      // level switch at the discontinuity: the transmuxer resets the init segment, the timestamp
      // offset and contiguity
      mp4Remuxer.resetInitSegment();
      mp4Remuxer.resetTimeStamp(null);
      mp4Remuxer.resetNextTimestamp();
      // timestamps above the playlist time, so computeInitPts needs no 33-bit rollover adjustment
      const dts = 9000000;
      const cts = 7200;
      result = remuxFragment(
        mp4Remuxer,
        1,
        makeVideoTrack(dts, cts, frames),
        makeAudioTrack(dts + 9119, 185),
        timeOffset,
      );
      // the DTS anchor keeps its headroom across the switch, at the cost of one composition offset
      expect(result.initSegment?.initPTS).to.equal(
        dts - Math.round(timeOffset * 90000),
      );
      expect(result.video!.endPTS).to.be.closeTo(
        timeOffset + fragmentDuration + cts / 90000,
        0.001,
      );
    });
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

    describe('over many fragments', function () {
      // 29.97 fps iPhone source: first PTS 132006 at 90 kHz, 44.1 kHz AAC,
      // 258 frames per 6 s fragment (258 * 1024 / 44100 = 5.9907 s).
      const initBaseTime = 132006;
      const samplerate = 44100;
      const framesPerFragment = 258;
      const scaleFactor = 90000 / samplerate;
      const inputSampleDuration = (1024 * 90000) / samplerate;

      function placedStart(audio: ReturnType<MP4Remuxer['remuxAudio']>) {
        return (
          readTfdt(audio!.data1) / samplerate -
          audio!.timestampOffsetAdjustment!
        );
      }

      function checkFragment(
        audio: ReturnType<MP4Remuxer['remuxAudio']>,
        expectedFirstPts: number,
      ) {
        const raw = expectedFirstPts / scaleFactor;
        const tfdt = readTfdt(audio!.data1);
        const residual = audio!.timestampOffsetAdjustment!;
        expect(tfdt).to.eq(Math.ceil(raw));
        expect(residual).to.be.at.least(0);
        expect(residual).to.be.lt(1 / samplerate);
        // tfdt minus residual lands on the input time to within float noise,
        // three orders of magnitude under one 44.1 kHz tick (22.7 µs)
        expect(placedStart(audio)).to.be.closeTo(
          expectedFirstPts / 90000,
          1e-8,
        );
        return { raw, tfdt, residual };
      }

      beforeEach(function () {
        (mp4Remuxer as any)._initPTS = {
          baseTime: initBaseTime,
          timescale: 90000,
          trackId: 1,
        };
      });

      it('keeps every fragment of a contiguous hour on its exact input time', function () {
        const fragments = 600; // 600 * 5.99 s ≈ 1 hour
        let pts = initBaseTime;
        let firstTfdt = 0;
        for (let sn = 0; sn < fragments; sn++) {
          const timeOffset = (pts - initBaseTime) / 90000;
          const audio = mp4Remuxer.remuxAudio(
            aacFragment(pts, samplerate, framesPerFragment),
            timeOffset,
            sn > 0,
            true,
            undefined,
            new ChunkMetadata(0, sn, 0),
          );
          const expectedFirstPts =
            initBaseTime + sn * framesPerFragment * inputSampleDuration;
          const { tfdt } = checkFragment(audio, expectedFirstPts);
          if (sn === 0) {
            firstTfdt = tfdt;
          }
          // the tfdt advances by exactly the samples remuxed, never by an extra tick
          expect(tfdt - firstTfdt).to.eq(sn * framesPerFragment * 1024);
          pts += framesPerFragment * inputSampleDuration;
        }
      });

      it('bounds the residual to under one tick on every fragment after a seek', function () {
        // playlist with 6.006 s fragments (29.97 fps GOP boundaries): starts are
        // off the 44.1 kHz grid by a different amount each time. Each seek jumps
        // seven fragments, well past the 100 ms within which the remuxer still
        // treats a fragment as consecutive and keeps the previous chain.
        const fragmentDuration = 6.006;
        const seen = new Set<string>();
        for (let seek = 0; seek < 50; seek++) {
          const sn = seek * 7;
          mp4Remuxer.resetNextTimestamp();
          const timeOffset = sn * fragmentDuration;
          const pts = initBaseTime + timeOffset * 90000;
          const audio = mp4Remuxer.remuxAudio(
            aacFragment(pts, samplerate, framesPerFragment),
            timeOffset,
            false,
            true,
            undefined,
            new ChunkMetadata(0, sn, 0),
          );
          const { residual } = checkFragment(audio, pts);
          seen.add((residual * samplerate).toFixed(2));
        }
        // the residual really varies per fragment; it is not one constant offset
        expect(seen.size).to.be.gt(1);
      });
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

function aacFragment(
  firstPts: number,
  samplerate: number,
  frames: number,
): DemuxedAudioTrack {
  const track = aacTrack(firstPts, samplerate);
  const inputSampleDuration = (1024 * 90000) / samplerate;
  // the TS demuxer hands over integer 90 kHz timestamps
  track.samples = Array.from({ length: frames }, (_, i) => ({
    unit: new Uint8Array(8),
    pts: Math.round(firstPts + i * inputSampleDuration),
  }));
  return track;
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

function makeVideoTrack(
  firstDts: number,
  cts: number,
  frames: number,
): DemuxedVideoTrack {
  const samples: VideoSample[] = [];
  for (let i = 0; i < frames; i++) {
    const dts = firstDts + i * VIDEO_FRAME_DURATION;
    samples.push({
      dts,
      pts: dts + cts,
      key: i === 0,
      frame: true,
      units: [{ data: new Uint8Array(8), type: i === 0 ? 5 : 1 }],
      length: 8,
    });
  }
  return {
    ...dummyTrack('video'),
    type: 'video',
    id: 1,
    pid: 256,
    segmentCodec: 'avc',
    codec: 'avc1.64001f',
    duration: 10,
    sps: [new Uint8Array([0x67, 0x64, 0x00, 0x1f, 0xac, 0xd9, 0x40])],
    pps: [new Uint8Array([0x68, 0xeb, 0xe3, 0xcb, 0x22, 0xc0])],
    width: 720,
    height: 408,
    pixelRatio: [1, 1],
    samples,
  };
}

function makeAudioTrack(firstPts: number, frames: number): DemuxedAudioTrack {
  const samples: AudioSample[] = [];
  for (let i = 0; i < frames; i++) {
    samples.push({
      pts: firstPts + i * AAC_FRAME_DURATION,
      unit: new Uint8Array(16),
    });
  }
  return {
    ...dummyTrack('audio'),
    type: 'audio',
    id: 0,
    pid: 257,
    segmentCodec: 'aac',
    codec: 'mp4a.40.2',
    manifestCodec: 'mp4a.40.2',
    duration: 10,
    config: [0x11, 0x90],
    samplerate: 48000,
    channelCount: 2,
    samples,
  };
}

function remuxFragment(
  remuxer: MP4Remuxer,
  sn: number,
  video: DemuxedVideoTrack,
  audio: DemuxedAudioTrack,
  timeOffset: number,
) {
  return remuxer.remux(
    audio,
    video,
    dummyTrack('id3') as DemuxedMetadataTrack,
    dummyTrack('text') as DemuxedUserdataTrack,
    timeOffset,
    true,
    true,
    PlaylistLevelType.MAIN,
    new ChunkMetadata(0, sn, 1, 0),
  );
}
