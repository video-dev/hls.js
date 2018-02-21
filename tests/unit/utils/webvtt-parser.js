let assert = require('assert');
import WebVTTParser from '../../../src/utils/webvtt-parser';

const parse = function (webVttString, initPTS) {
  const enc = new TextEncoder('utf-8');
  let result;

  let vttByteArray = enc.encode(webVttString.split('\n').map(s => s.trim()).join('\n'));

  const vttCCs = { ccOffset: 0, presentationOffset: 0 };
  const cc = 0;
  vttCCs[cc] = { start: 0, prevCC: -1, new: true };

  WebVTTParser.parse(vttByteArray, initPTS, vttCCs, cc, function (cues) {
    result = cues;
  }, function (e) {
    result = e;
  });

  return result;
};

describe('WebVTTParser', function () {
  it('can parse webvtt without X-TIMESTAMP-MAP', () => {
    const vtt = `WEBVTT

                 00:01.000 --> 00:04.000
                 Never drink liquid nitrogen.`;

    const cues = parse(vtt, 0);
    assert.equal(1, cues.length);

    const cue = cues[0];
    assert.equal(cue.startTime, 1);
    assert.equal(cue.endTime, 4);
    assert.equal(cue.text, 'Never drink liquid nitrogen.');
  });

  it('can parse webvtt with X-TIMESTAMP-MAP', () => {
    const vtt = `WEBVTT
                 X-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000

                 00:01.000 --> 00:04.000
                 Never drink liquid nitrogen.`;

    const cues = parse(vtt, 900000);
    assert.equal(1, cues.length);

    const cue = cues[0];
    assert.equal(cue.startTime, 1);
    assert.equal(cue.endTime, 4);
    assert.equal(cue.text, 'Never drink liquid nitrogen.');
  });

  it('can handle PTS rollovers', () => {
    const vtt = `WEBVTT
                 X-TIMESTAMP-MAP=MPEGTS:0,LOCAL:00:00:00.000

                 100:00:01.000 --> 100:00:04.000
                 Never drink liquid nitrogen.`;

    const initPTS = 100 * 3600 * 90000 % Math.pow(2, 33); // 100 hours, with wrapping

    const cues = parse(vtt, initPTS);
    assert.equal(1, cues.length);

    const cue = cues[0];
    assert.equal(cue.startTime, 1);
    assert.equal(cue.endTime, 4);
    assert.equal(cue.text, 'Never drink liquid nitrogen.');
  });
});
