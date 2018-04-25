let assert = require('assert');
import WebVTTParser from '../../../src/utils/webvtt-parser';

const parse = function (webVttString, initPTS, fragStart) {
  const enc = new TextEncoder('utf-8');
  let result;

  let vttByteArray = enc.encode(webVttString.split('\n').map(s => s.trim()).join('\n'));

  const vttCCs = { ccOffset: 0, presentationOffset: 0 };
  const cc = 0;
  vttCCs[cc] = { start: fragStart || 0, prevCC: -1, new: true };

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

  it('can handle this webvtt from yospace after ads', () => {
    const vtt = `WEBVTT
                 X-TIMESTAMP-MAP=MPEGTS:2250000,LOCAL:00:00:00.000

                 00:00:00.000 --> 00:00:02.080
                 Här har vi text

                 00:00:02.240 --> 00:00:03.000
                 –Där någon säger saker
                 –Men det betyder inget`;

    const initPTS = 126000;
    const discontinoutyStart = 21;

    const cues = parse(vtt, initPTS, discontinoutyStart);
    assert.equal(2, cues.length);

    assert.equal(cues[0].startTime, discontinoutyStart);
    assert.equal(cues[0].endTime, discontinoutyStart + 2.08);
    assert.equal(cues[0].text, 'Här har vi text');

    assert.equal(cues[1].startTime, discontinoutyStart + 2.240);
    assert.equal(cues[1].endTime, discontinoutyStart + 3.0);
    assert.equal(cues[1].text, '–Där någon säger saker\n–Men det betyder inget');
  });
});
