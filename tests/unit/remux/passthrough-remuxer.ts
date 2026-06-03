import { expect } from 'chai';
import EventEmitter from 'eventemitter3';
import { hlsDefaultConfig } from '../../../src/config';
import MP4 from '../../../src/remux/mp4-generator';
import PassThroughRemuxer from '../../../src/remux/passthrough-remuxer';
import { PlaylistLevelType } from '../../../src/types/loader';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import { logger } from '../../../src/utils/logger';
import { appendUint8Array } from '../../../src/utils/mp4-tools';
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
  ) {
    const initSegment = MP4.initSegment([videoInitTrack()]);
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

  it('remuxes a single-keyframe iframe segment whose native sample duration is far short of EXTINF', function () {
    // Dedicated i-frame segment: one keyframe carrying ~one-frame duration
    // (3003/90000 ≈ 0.033s) while the playlist advertises a multi-second EXTINF.
    // The duration ratio is well above the 1.5 heuristic, so the remuxer rewrites
    // the moof, stretching the keyframe to the EXTINF window.
    const extinfDuration = 4;
    const fragmentData = mp4Fragment([sample(3003, 4, 0)]);

    const result = remuxIFrameFragment(fragmentData, extinfDuration);

    expect(result.video, 'video track').to.exist;
    // data2 is only populated when the iframe moof is rewritten (remuxed)
    expect(result.video!.data2, 'remuxed mdat').to.exist;
    expect(result.video!.endDTS - result.video!.startDTS).to.equal(
      extinfDuration,
    );
    // track.nb stays an informative parse count, not forced to 1
    expect(result.video!.nb).to.equal(1);
  });

  it('does not remux a byte-range iframe segment whose sample duration already matches EXTINF', function () {
    // Byte-range addressed iframe (single sample spanning the whole playback
    // segment): sample duration == EXTINF, so the ratio is ~1 and the heuristic
    // keeps the more-accurate sample-based timing instead of remuxing.
    const extinfDuration = 4;
    const fragmentData = mp4Fragment([sample(extinfDuration * 90000, 4, 0)]);

    const result = remuxIFrameFragment(fragmentData, extinfDuration);

    expect(result.video, 'video track').to.exist;
    // not remuxed: the original fragment is passed through and no mdat is split out
    expect(result.video!.data2, 'remuxed mdat').to.not.exist;
    expect(result.video!.data1).to.equal(fragmentData);
  });

  it('remuxes a multi-sample in-range iframe fragment, preserving every sample', function () {
    // Several samples fully present in the mdat (e.g. a byte-range that spans a
    // multi-sample moof). The sampleCount > 1 branch must still emit all samples,
    // back-loading the EXTINF remainder onto the last sample's duration.
    const extinfDuration = 4;
    const fragmentData = mp4Fragment([
      sample(3003, 4, 0),
      sample(3003, 4, 0),
      sample(3003, 4, 0),
    ]);

    const result = remuxIFrameFragment(fragmentData, extinfDuration);

    expect(result.video, 'video track').to.exist;
    expect(result.video!.data2, 'remuxed mdat').to.exist;
    // all three parsed samples are reported, not collapsed to one
    expect(result.video!.nb).to.equal(3);
    expect(result.video!.endDTS - result.video!.startDTS).to.equal(
      extinfDuration,
    );
  });
});

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
