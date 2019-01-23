import {
  getAudioConfig, isHeaderPattern, getHeaderLength, getFullFrameLength, isHeader, probe,
  initTrackConfig, getFrameDuration, parseFrameHeader, appendFrame
} from '../../../src/demux/adts';
import { ErrorTypes } from '../../../src/errors';

const assert = require('assert');
const sinon = require('sinon');

describe('getAudioConfig', () => {
  it('should trigger a MEDIA_ERROR event if sample index is invalid', () => {
    const observer = {
      trigger: sinon.spy()
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x34; // sampling_frequency_index = 14, which is a reserved value

    assert.equal(getAudioConfig(observer, data, 0, 'mp4a.40.29'), undefined);
    assert.ok(observer.trigger.calledOnce);
    assert.equal(observer.trigger.args[0][1].type, ErrorTypes.MEDIA_ERROR);
  });

  it('should return audio config for firefox if the specified sampling frequency > 24kHz', () => {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'firefox')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x00; // sampling_frequency_index = 0

    assert.deepEqual(getAudioConfig(observer, data, 0, 'mp4a.40.29'), {
      config: [16, 0],
      samplerate: 96000,
      channelCount: 0,
      codec: 'mp4a.40.2',
      manifestCodec: 'mp4a.40.29'
    });
  });

  it('should return audio config with a different extension sampling index for Firefox if sampling freq is low', () => {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Firefox')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    assert.deepEqual(getAudioConfig(observer, data, 0, 'mp4a.40.29'), {
      config: [45, 3, 136, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.5',
      manifestCodec: 'mp4a.40.29'
    });
  });

  it('should return audio config for Android', () => {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Android')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    assert.deepEqual(getAudioConfig(observer, data, 0, 'mp4a.40.29'), {
      config: [21, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.2',
      manifestCodec: 'mp4a.40.29'
    });
  });

  it('should return audio config for Chrome', () => {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Chrome')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    assert.deepEqual(getAudioConfig(observer, data, 0, 'mp4a.40.29'), {
      config: [45, 3, 136, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.5',
      manifestCodec: 'mp4a.40.29'
    });
  });

  it('should return audio config for Chrome if there is no audio codec', () => {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Chrome')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    assert.deepEqual(getAudioConfig(observer, data, 0), {
      config: [45, 3, 136, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.5',
      manifestCodec: undefined
    });
  });

  it('should return audio config for Chrome if there is no audio codec and freq is high enough', () => {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Chrome')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x08; // sampling_frequency_index = 2

    assert.deepEqual(getAudioConfig(observer, data, 0), {
      config: [41, 1, 8, 0],
      samplerate: 64000,
      channelCount: 0,
      codec: 'mp4a.40.5',
      manifestCodec: undefined
    });
  });

  it('should return audio config for Chrome if audio codec is "mp4a.40.5"', () => {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Chrome')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    assert.deepEqual(getAudioConfig(observer, data, 0, 'mp4a.40.5'), {
      config: [45, 3, 136, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.5',
      manifestCodec: 'mp4a.40.5'
    });
  });

  it('should return audio config for Chrome if audio codec is "mp4a.40.2"', () => {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Chrome')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10
    data[3] = 0x40; // channel = 1

    assert.deepEqual(getAudioConfig(observer, data, 0, 'mp4a.40.2'), {
      config: [21, 8],
      samplerate: 11025,
      channelCount: 1,
      codec: 'mp4a.40.2',
      manifestCodec: 'mp4a.40.2'
    });
  });

  it('should return audio config for Vivaldi', () => {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Vivaldi')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x08; // sampling_frequency_index = 2

    assert.deepEqual(getAudioConfig(observer, data, 0, 'mp4a.40.2'), {
      config: [17, 0],
      samplerate: 64000,
      channelCount: 0,
      codec: 'mp4a.40.2',
      manifestCodec: 'mp4a.40.2'
    });
  });
});

describe('isHeaderPattern', () => {
  it('should return true if the specified data slot is of header pattern', () => {
    const data = new Uint8Array(new ArrayBuffer(16));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[14] = 0xff;
    data[15] = 0xf9; // ID = 1 (MPEG-2), layer = 00, protection_absent = 1
    assert.ok(isHeaderPattern(data, 0));
    assert.ok(isHeaderPattern(data, 14));
  });

  it('should return false if the specific data is not of header pattern', () => {
    const data = new Uint8Array(new ArrayBuffer(4));
    data[1] = 0xff;
    data[2] = 0xff;
    assert.equal(isHeaderPattern(data, 0), false);
    assert.equal(isHeaderPattern(data, 2), false);
  });
});

describe('getHeaderLength', () => {
  it('should return 7 if there is no CRC', () => {
    const data = new Uint8Array(new ArrayBuffer(2));
    data[0] = 0xff;
    data[1] = 0xf9; // ID = 1 (MPEG-2), layer = 00, protection_absent = 1
    assert.equal(getHeaderLength(data, 0), 7);
  });

  it('should return 9 if there is CRC', () => {
    const data = new Uint8Array(new ArrayBuffer(2));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    assert.equal(getHeaderLength(data, 0), 9);
  });
});

describe('getFullFrameLength', () => {
  it('should extract frame_length field and return its value', () => {
    const data = new Uint8Array(new ArrayBuffer(8));
    data[0] = 0xff;
    data[1] = 0xf9;
    data[2] = 0x00;
    data[3] = 0x02; // the last 2 bits belong to frame_length
    data[4] = 0x00; // all 8 bits belong to frame_length
    data[5] = 0xE0; // the first 3 bits belong to frame_length
    assert.equal(getFullFrameLength(data, 0), 4103);
  });
});

describe('isHeader', () => {
  it('should return true if there are enough data and it is of header pattern', () => {
    const data = new Uint8Array(new ArrayBuffer(8));
    data[0] = 0xff;
    data[1] = 0xf9;
    assert.ok(isHeader(data, 0));
  });

  it('should return false if there are not enough data', () => {
    const data = new Uint8Array(new ArrayBuffer(1));
    assert.equal(isHeader(data, 0), false);
  });

  it('should return false if it is not of header pattern', () => {
    const data = new Uint8Array(new ArrayBuffer(8));
    assert.equal(isHeader(data, 0), false);
  });
});

describe('probe', () => {
  it('should return false if `isHeader` fails', () => {
    const data = new Uint8Array(new ArrayBuffer(8));
    assert.equal(probe(data, 0), false);
  });

  it('should return true if it contains the entire ADTS frame', () => {
    const data = new Uint8Array(new ArrayBuffer(16));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16
    assert.ok(probe(data, 0));
  });

  it('should return true if it contains an valid following frame header', () => {
    const data = new Uint8Array(new ArrayBuffer(18));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16
    data[16] = 0xff;
    data[17] = 0xf0;
    console.log('hahah');
    assert.ok(probe(data, 0));
  });

  it('should return false if it contains the entire ADTS frame with an incomplete following header', () => {
    const data = new Uint8Array(new ArrayBuffer(17));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16
    assert.equal(probe(data, 0), false);
  });

  it('should return false if it contains the entire ADTS frame with an invalid following frame header', () => {
    const data = new Uint8Array(new ArrayBuffer(18));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16
    assert.equal(probe(data, 0), false);
  });

  it('should return false if it does not contain the entire header', () => {
    const data = new Uint8Array(new ArrayBuffer(2));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    assert.equal(probe(data, 0), false);
  });
});

describe('initTrackConfig', () => {
  it('should do nothing with track if track.samplerate is defined', () => {
    const track = {
      samplerate: 64000
    };
    initTrackConfig(track);

    assert.deepEqual(track, {
      samplerate: 64000
    });
  });

  it('should call `getAudioConfig` and change track if track.samplerate is undefined', () => {
    const track = {};
    const observer = {
      trigger: sinon.spy()
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    initTrackConfig(track, observer, data, 0, 'mp4a.40.29');

    assert.deepEqual(track, {
      config: [45, 3, 136, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.5',
      manifestCodec: 'mp4a.40.29'
    });
  });
});

describe('getFrameDuration', () => {
  it('should compute frame duration from sample rate', () => {
    assert.equal(getFrameDuration(64000), 1440);
  });
});

describe('parseFrameHeader', () => {
  it('should return parsed result if data contains the entire frame', () => {
    const data = new Uint8Array(new ArrayBuffer(16));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16
    assert.deepEqual(parseFrameHeader(data, 0, 0, 0, 0), {
      headerLength: 9,
      frameLength: 7,
      stamp: 0
    });
  });

  it('should return undefined if there is only the header part', () => {
    const data = new Uint8Array(new ArrayBuffer(9));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x01;
    data[5] = 0x40; // frame_length is 9
    assert.equal(parseFrameHeader(data, 0, 0, 0, 0), undefined);
  });

  it('should return undefined if data does not contain the entire frame', () => {
    const data = new Uint8Array(new ArrayBuffer(12));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16
    assert.equal(parseFrameHeader(data, 0, 0, 0, 0), undefined);
  });
});

describe('appendFrame', () => {
  it('should append the found sample to track and return some useful information', () => {
    const track = {
      samplerate: 64000,
      samples: [],
      len: 0
    };
    const data = new Uint8Array(new ArrayBuffer(16));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16

    assert.deepEqual(appendFrame(track, data, 0, 0, 0), {
      sample: {
        unit: data.subarray(9, 16),
        pts: 0,
        dts: 0
      },
      length: 16
    });
    assert.equal(track.samples.length, 1);
    assert.equal(track.len, 7);
  });

  it('should not append sample if `parseFrameHeader` fails', () => {
    const track = {
      samplerate: 64000,
      samples: [],
      len: 0
    };
    const data = new Uint8Array(new ArrayBuffer(12));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16

    assert.equal(appendFrame(track, data, 0, 0, 0), undefined);
    assert.equal(track.samples.length, 0);
    assert.equal(track.len, 0);
  });
});
