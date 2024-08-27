import EventEmitter from 'eventemitter3';
import {
  getAudioConfig,
  isHeaderPattern,
  getHeaderLength,
  getFullFrameLength,
  isHeader,
  probe,
  initTrackConfig,
  getFrameDuration,
  parseFrameHeader,
  appendFrame,
} from '../../../src/demux/audio/adts';
import { ErrorTypes } from '../../../src/errors';
import sinon from 'sinon';

describe('getAudioConfig', function () {
  it('should emit a MEDIA_ERROR event if sample index is invalid', function () {
    const observer = new EventEmitter();
    sinon.spy(observer, 'emit');
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x34; // sampling_frequency_index = 14, which is a reserved value

    expect(getAudioConfig(observer, data, 0, 'mp4a.40.29')).to.not.exist;
    expect(observer.emit).to.have.been.calledOnce;
    expect(observer.emit.args[0][2].type).to.equal(
      ErrorTypes.MEDIA_ERROR,
      JSON.stringify(observer.emit.args, null, 2),
    );
  });

  it('should return audio config for 48kHz', function () {
    const observer = new EventEmitter();
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x4c; // sampling_frequency_index = 3

    const result = getAudioConfig(observer, data, 0, 'mp4a.40.29');
    expect(result, JSON.stringify(result)).to.deep.equal({
      config: [17, 128],
      samplerate: 48000,
      channelCount: 0,
      codec: 'mp4a.40.2',
      parsedCodec: 'mp4a.40.2',
      manifestCodec: 'mp4a.40.29',
    });
  });

  it('should return audio config for 11025Hz', function () {
    const observer = new EventEmitter();
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    const result = getAudioConfig(observer, data, 0, 'mp4a.40.29');
    expect(result, JSON.stringify(result)).to.deep.equal({
      config: [13, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.1',
      parsedCodec: 'mp4a.40.1',
      manifestCodec: 'mp4a.40.29',
    });
  });

  it('should return audio config if there is no audio codec', function () {
    const observer = new EventEmitter();
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf1; // ID = 0 (MPEG-4), layer = 00
    data[2] = 0x5c; // sampling_frequency_index = 7
    data[3] = 0x80; // stereo channels

    const result = getAudioConfig(observer, data, 0, undefined);
    expect(result, JSON.stringify(result)).to.deep.equal({
      config: [19, 144],
      samplerate: 22050,
      channelCount: 2,
      codec: 'mp4a.40.2',
      parsedCodec: 'mp4a.40.2',
      manifestCodec: undefined,
    });
  });

  it('should return audio config for mono audio', function () {
    const observer = new EventEmitter();
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf1; // ID = 0 (MPEG-4), layer = 00
    data[2] = 0x50; // sampling_frequency_index = 4
    data[3] = 0x40; // mono channels

    const result = getAudioConfig(observer, data, 0, undefined);
    expect(result, JSON.stringify(result)).to.deep.equal({
      config: [18, 8],
      samplerate: 44100,
      channelCount: 1,
      codec: 'mp4a.40.2',
      parsedCodec: 'mp4a.40.2',
      manifestCodec: undefined,
    });
  });

  it('should return audio config if there is no audio codec and freq is high enough', function () {
    const observer = new EventEmitter();
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x08; // sampling_frequency_index = 2

    const result = getAudioConfig(observer, data, 0, undefined);
    expect(result, JSON.stringify(result)).to.deep.equal({
      config: [9, 0],
      samplerate: 64000,
      channelCount: 0,
      codec: 'mp4a.40.1',
      parsedCodec: 'mp4a.40.1',
      manifestCodec: undefined,
    });
  });
});

describe('isHeaderPattern', function () {
  it('should return true if the specified data slot is of header pattern', function () {
    const data = new Uint8Array(new ArrayBuffer(16));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[14] = 0xff;
    data[15] = 0xf9; // ID = 1 (MPEG-2), layer = 00, protection_absent = 1
    expect(isHeaderPattern(data, 0)).to.be.true;
    expect(isHeaderPattern(data, 14)).to.be.true;
  });

  it('should return false if the specific data is not of header pattern', function () {
    const data = new Uint8Array(new ArrayBuffer(4));
    data[1] = 0xff;
    data[2] = 0xff;
    expect(isHeaderPattern(data, 0)).to.be.false;
    expect(isHeaderPattern(data, 2)).to.be.false;
  });
});

describe('getHeaderLength', function () {
  it('should return 7 if there is no CRC', function () {
    const data = new Uint8Array(new ArrayBuffer(2));
    data[0] = 0xff;
    data[1] = 0xf9; // ID = 1 (MPEG-2), layer = 00, protection_absent = 1
    expect(getHeaderLength(data, 0)).to.equal(7);
  });

  it('should return 9 if there is CRC', function () {
    const data = new Uint8Array(new ArrayBuffer(2));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    expect(getHeaderLength(data, 0)).to.equal(9);
  });
});

describe('getFullFrameLength', function () {
  it('should extract frame_length field and return its value', function () {
    const data = new Uint8Array(new ArrayBuffer(8));
    data[0] = 0xff;
    data[1] = 0xf9;
    data[2] = 0x00;
    data[3] = 0x02; // the last 2 bits belong to frame_length
    data[4] = 0x00; // all 8 bits belong to frame_length
    data[5] = 0xe0; // the first 3 bits belong to frame_length
    expect(getFullFrameLength(data, 0)).to.equal(4103);
  });
});

describe('isHeader', function () {
  it('should return true if there are enough data and it is of header pattern', function () {
    const data = new Uint8Array(new ArrayBuffer(8));
    data[0] = 0xff;
    data[1] = 0xf9;
    expect(isHeader(data, 0)).to.be.true;
  });

  it('should return false if there are not enough data', function () {
    const data = new Uint8Array(new ArrayBuffer(1));
    expect(isHeader(data, 0)).to.be.false;
  });

  it('should return false if it is not of header pattern', function () {
    const data = new Uint8Array(new ArrayBuffer(8));
    expect(isHeader(data, 0)).to.be.false;
  });
});

describe('probe', function () {
  it('should return false if `isHeader` fails', function () {
    const data = new Uint8Array(new ArrayBuffer(8));
    expect(probe(data, 0)).to.be.false;
  });

  it('should return true if it contains the entire ADTS frame', function () {
    const data = new Uint8Array(new ArrayBuffer(16));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16
    expect(probe(data, 0)).to.be.true;
  });

  it('should return true if it contains an valid following frame header', function () {
    const data = new Uint8Array(new ArrayBuffer(18));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16
    data[16] = 0xff;
    data[17] = 0xf0;
    expect(probe(data, 0)).to.be.true;
  });

  it('should return false if it contains the entire ADTS frame with an incomplete following header', function () {
    const data = new Uint8Array(new ArrayBuffer(17));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16
    expect(probe(data, 0)).to.be.false;
  });

  it('should return false if it contains the entire ADTS frame with an invalid following frame header', function () {
    const data = new Uint8Array(new ArrayBuffer(18));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16
    expect(probe(data, 0)).to.be.false;
  });

  it('should return false if it does not contain the entire header', function () {
    const data = new Uint8Array(new ArrayBuffer(2));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    expect(probe(data, 0)).to.be.false;
  });

  it('should return false if the header is broken', function () {
    const data = new Uint8Array(new ArrayBuffer(9));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x00; // frame_length is 0
    expect(probe(data, 0)).to.be.false;
  });

  it('should return false if it does not contain the entire header (2)', function () {
    const data = new Uint8Array(new ArrayBuffer(8));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x00; // frame_length is 6
    data[5] = 0xc0;
    data[6] = 0xff;
    data[7] = 0xf0;
    expect(probe(data, 0)).to.be.false;
  });
});

describe('initTrackConfig', function () {
  it('should do nothing with track if track.samplerate is defined', function () {
    const track = {
      samplerate: 64000,
    };
    initTrackConfig(track);

    expect(track).to.deep.equal({
      samplerate: 64000,
    });
  });

  it('should call `getAudioConfig` and change track if track.samplerate is undefined', function () {
    const track = {};
    const observer = {
      trigger: sinon.spy(),
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    initTrackConfig(track, observer, data, 0, 'mp4a.40.29');

    expect(track).to.deep.equal({
      config: [13, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.1',
      parsedCodec: 'mp4a.40.1',
      manifestCodec: 'mp4a.40.29',
    });
  });
});

describe('getFrameDuration', function () {
  it('should compute frame duration from sample rate', function () {
    expect(getFrameDuration(64000)).to.equal(1440);
  });
});

describe('parseFrameHeader', function () {
  it('should return parsed result if data contains the entire frame', function () {
    const data = new Uint8Array(new ArrayBuffer(16));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16
    expect(parseFrameHeader(data, 0)).to.deep.equal({
      headerLength: 9,
      frameLength: 7,
    });
  });

  it('should return undefined if frame length is 0', function () {
    const data = new Uint8Array(new ArrayBuffer(12));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x00; // frame_length is 0
    expect(parseFrameHeader(data, 0)).to.be.undefined;
  });
});

describe('appendFrame', function () {
  it('should append the found sample to track and return frame information', function () {
    const track = {
      samplerate: 64000,
      samples: [],
      len: 0,
    };
    const data = new Uint8Array(new ArrayBuffer(16));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16

    const frame = appendFrame(track, data, 0, 0, 0);
    expect(frame, JSON.stringify(frame)).to.deep.equal({
      sample: {
        unit: data.subarray(9, 16),
        pts: 0,
      },
      length: 16,
      missing: 0,
    });
    expect(track.samples.length).to.equal(1);
  });

  it('should return an incomplete frame without appending when data is incomplete (aac overflow or progressive streaming)', function () {
    const track = {
      samplerate: 64000,
      samples: [],
      len: 0,
    };
    const data = new Uint8Array(new ArrayBuffer(20));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x03; // frame_length is 24

    const frame = appendFrame(track, data, 0, 0, 0);
    const unit = new Uint8Array(15);
    unit.set(data.subarray(9, 20), 0);

    expect(frame, JSON.stringify(frame)).to.deep.equal({
      sample: {
        unit,
        pts: 0,
      },
      length: 24,
      missing: 4,
    });
    expect(track.samples.length).to.equal(0);
  });

  it('should return an incomplete frame without appending when header is incomplete (aac overflow or progressive streaming)', function () {
    const track = {
      samplerate: 64000,
      samples: [],
      len: 0,
    };
    const data = new Uint8Array(new ArrayBuffer(2));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0

    const frame = appendFrame(track, data, 0, 0, 0);
    const unit = new Uint8Array(2);
    unit.set(data.subarray(0, 2), 0);

    expect(frame, JSON.stringify(frame)).to.deep.equal({
      sample: {
        unit,
        pts: 0,
      },
      length: 2,
      missing: -1,
    });
    expect(track.samples.length).to.equal(0);
  });
});
