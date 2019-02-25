import {
  getAudioConfig, isHeaderPattern, getHeaderLength, getFullFrameLength, isHeader, probe,
  initTrackConfig, getFrameDuration, parseFrameHeader, appendFrame
} from '../../../src/demux/adts';
import { ErrorTypes } from '../../../src/errors';

const sinon = require('sinon');

describe('getAudioConfig', function () {
  it('should trigger a MEDIA_ERROR event if sample index is invalid', function () {
    const observer = {
      trigger: sinon.spy()
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x34; // sampling_frequency_index = 14, which is a reserved value

    expect(getAudioConfig(observer, data, 0, 'mp4a.40.29')).to.not.exist;
    expect(observer.trigger).to.have.been.calledOnce;
    expect(observer.trigger.args[0][1].type).to.equal(ErrorTypes.MEDIA_ERROR);
  });

  it('should return audio config for firefox if the specified sampling frequency > 24kHz', function () {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'firefox')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x00; // sampling_frequency_index = 0

    expect(getAudioConfig(observer, data, 0, 'mp4a.40.29')).to.deep.equal({
      config: [16, 0],
      samplerate: 96000,
      channelCount: 0,
      codec: 'mp4a.40.2',
      manifestCodec: 'mp4a.40.29'
    });
  });

  it('should return audio config with a different extension sampling index for Firefox if sampling freq is low', function () {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Firefox')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    expect(getAudioConfig(observer, data, 0, 'mp4a.40.29')).to.deep.equal({
      config: [45, 3, 136, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.5',
      manifestCodec: 'mp4a.40.29'
    });
  });

  it('should return audio config for Android', function () {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Android')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    expect(getAudioConfig(observer, data, 0, 'mp4a.40.29')).to.deep.equal({
      config: [21, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.2',
      manifestCodec: 'mp4a.40.29'
    });
  });

  it('should return audio config for Chrome', function () {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Chrome')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    expect(getAudioConfig(observer, data, 0, 'mp4a.40.29')).to.deep.equal({
      config: [45, 3, 136, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.5',
      manifestCodec: 'mp4a.40.29'
    });
  });

  it('should return audio config for Chrome if there is no audio codec', function () {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Chrome')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    expect(getAudioConfig(observer, data, 0)).to.deep.equal({
      config: [45, 3, 136, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.5',
      manifestCodec: undefined
    });
  });

  it('should return audio config for Chrome if there is no audio codec and freq is high enough', function () {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Chrome')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x08; // sampling_frequency_index = 2

    expect(getAudioConfig(observer, data, 0)).to.deep.equal({
      config: [41, 1, 8, 0],
      samplerate: 64000,
      channelCount: 0,
      codec: 'mp4a.40.5',
      manifestCodec: undefined
    });
  });

  it('should return audio config for Chrome if audio codec is "mp4a.40.5"', function () {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Chrome')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    expect(getAudioConfig(observer, data, 0, 'mp4a.40.5')).to.deep.equal({
      config: [45, 3, 136, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.5',
      manifestCodec: 'mp4a.40.5'
    });
  });

  it('should return audio config for Chrome if audio codec is "mp4a.40.2"', function () {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Chrome')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10
    data[3] = 0x40; // channel = 1

    expect(getAudioConfig(observer, data, 0, 'mp4a.40.2')).to.deep.equal({
      config: [21, 8],
      samplerate: 11025,
      channelCount: 1,
      codec: 'mp4a.40.2',
      manifestCodec: 'mp4a.40.2'
    });
  });

  it('should return audio config for Vivaldi', function () {
    const observer = {
      trigger: sinon.stub(navigator, 'userAgent').get(() => 'Vivaldi')
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x08; // sampling_frequency_index = 2

    expect(getAudioConfig(observer, data, 0, 'mp4a.40.2')).to.deep.equal({
      config: [17, 0],
      samplerate: 64000,
      channelCount: 0,
      codec: 'mp4a.40.2',
      manifestCodec: 'mp4a.40.2'
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
    data[5] = 0xE0; // the first 3 bits belong to frame_length
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
    console.log('hahah');
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
});

describe('initTrackConfig', function () {
  it('should do nothing with track if track.samplerate is defined', function () {
    const track = {
      samplerate: 64000
    };
    initTrackConfig(track);

    expect(track).to.deep.equal({
      samplerate: 64000
    });
  });

  it('should call `getAudioConfig` and change track if track.samplerate is undefined', function () {
    const track = {};
    const observer = {
      trigger: sinon.spy()
    };
    const data = new Uint8Array(new ArrayBuffer(4));
    data[0] = 0xff;
    data[1] = 0xf0; // ID = 0 (MPEG-4), layer = 00, protection_absent = 0
    data[2] = 0x28; // sampling_frequency_index = 10

    initTrackConfig(track, observer, data, 0, 'mp4a.40.29');

    expect(track).to.deep.equal({
      config: [45, 3, 136, 0],
      samplerate: 11025,
      channelCount: 0,
      codec: 'mp4a.40.5',
      manifestCodec: 'mp4a.40.29'
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
    expect(parseFrameHeader(data, 0, 0, 0, 0)).to.deep.equal({
      headerLength: 9,
      frameLength: 7,
      stamp: 0
    });
  });

  it('should return undefined if there is only the header part', function () {
    const data = new Uint8Array(new ArrayBuffer(9));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x01;
    data[5] = 0x40; // frame_length is 9
    expect(parseFrameHeader(data, 0, 0, 0, 0)).to.be.undefined;
  });

  it('should return undefined if data does not contain the entire frame', function () {
    const data = new Uint8Array(new ArrayBuffer(12));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16
    expect(parseFrameHeader(data, 0, 0, 0, 0)).to.be.undefined;
  });
});

describe('appendFrame', function () {
  it('should append the found sample to track and return some useful information', function () {
    const track = {
      samplerate: 64000,
      samples: [],
      len: 0
    };
    const data = new Uint8Array(new ArrayBuffer(16));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16

    expect(appendFrame(track, data, 0, 0, 0)).to.deep.equal({
      sample: {
        unit: data.subarray(9, 16),
        pts: 0,
        dts: 0
      },
      length: 16
    });
    expect(track.samples.length).to.equal(1);
  });

  it('should not append sample if `parseFrameHeader` fails', function () {
    const track = {
      samplerate: 64000,
      samples: [],
      len: 0
    };
    const data = new Uint8Array(new ArrayBuffer(12));
    data[0] = 0xff;
    data[1] = 0xf0; // protection_absent = 0
    data[4] = 0x02; // frame_length is 16

    expect(appendFrame(track, data, 0, 0, 0)).to.be.undefined;
    expect(track.samples.length).to.equal(0);
  });
});
