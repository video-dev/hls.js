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


  it('can handle this redbull.tv stream', () => {
    const vtt = `WEBVTT
                 X-TIMESTAMP-MAP=MPEGTS:131940,LOCAL:00:00:00.000

                 00:00:15.548 --> 00:00:17.684
                 I'm thinking if possible,

                 00:00:17.851 --> 00:00:20.954
                 in a perfect world,`;

    const initPTS = 132006;

    const cues = parse(vtt, initPTS);
    assert.equal(2, cues.length);

    // Start and end times extracted from Safari using something like this:
    //   document.getElementsByTagName('video')[0].textTracks[1].cues[0].startTime
    assert.equal(cues[0].startTime, 15.547266666666667);
    assert.equal(cues[0].endTime, 17.68326666666667);
    assert.equal(cues[0].text, `I'm thinking if possible,`)

    assert.equal(cues[1].startTime, 17.850266666666666);
    assert.equal(cues[1].endTime, 20.953266666666668);
    assert.equal(cues[1].text, `in a perfect world,`)
  });

  it('can handle this stream from SVT', () => {
    const vtt = `WEBVTT
                 X-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000

                 00:00:23.280 --> 00:00:29.520 line:44%
                 Det är onsdag, och jag hoppas
                 att ni har papper och penna-

                 00:00:29.680 --> 00:00:35.680
                 -sinnet vaket och öronen spetsade. Vi
                 tävlar i konst, litteratur och musik.`;

    const initPTS = 908970;

    const cues = parse(vtt, initPTS);
    assert.equal(2, cues.length);

    assert.equal(cues[0].startTime, 23.180333333333332);  // safari says 23.18
    assert.equal(cues[0].endTime,   29.420333333333332);  // safari says 29.419
    assert.equal(cues[0].text, `Det är onsdag, och jag hoppas\natt ni har papper och penna-`)

    assert.equal(cues[1].startTime, 29.580333333333332);  // safari says 29.58
    assert.equal(cues[1].endTime,   35.580333333333336);  // safari says 35.58
    assert.equal(cues[1].text, `-sinnet vaket och öronen spetsade. Vi\ntävlar i konst, litteratur och musik.`)
  });
});
