import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import { parseIMSC1 } from '../../../src/utils/imsc1-ttml-parser';
import type VTTCue from '../../../src/utils/vttcue';

use(sinonChai);

function mdat(ttml: string): ArrayBuffer {
  const body = new TextEncoder().encode(ttml);
  const box = new Uint8Array(8 + body.length);
  new DataView(box.buffer).setUint32(0, box.length);
  box.set([0x6d, 0x64, 0x61, 0x74], 4); // 'mdat'
  box.set(body, 8);
  return box.buffer;
}

function ttmlWith(begin: string, end: string, attrs: string = ''): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter"${attrs}>` +
    `<body><div><p begin="${begin}" end="${end}">Hello</p></div></body>` +
    `</tt>`
  );
}

function cuesFor(ttml: string): VTTCue[] {
  let cues: VTTCue[] = [];
  let error: Error | null = null;
  parseIMSC1(
    mdat(ttml),
    { baseTime: 0, timescale: 1, trackId: 1 },
    (parsed) => {
      cues = parsed;
    },
    (err) => {
      error = err;
    },
  );
  expect(error).to.equal(null);
  return cues;
}

describe('IMSC1 TTML parser', function () {
  it('reads a cue timed in seconds', function () {
    const cues = cuesFor(ttmlWith('1s', '3.5s'));
    expect(cues).to.have.lengthOf(1);
    expect(cues[0].startTime).to.equal(1);
    expect(cues[0].endTime).to.equal(3.5);
  });

  it('reads a cue timed in milliseconds', function () {
    const cues = cuesFor(ttmlWith('500ms', '2500ms'));
    expect(cues).to.have.lengthOf(1);
    expect(cues[0].startTime).to.equal(0.5);
    expect(cues[0].endTime).to.equal(2.5);
  });

  it('reads a cue timed in hours and minutes', function () {
    const cues = cuesFor(ttmlWith('1h', '90m'));
    expect(cues).to.have.lengthOf(1);
    expect(cues[0].startTime).to.equal(3600);
    expect(cues[0].endTime).to.equal(5400);
  });

  it('reads a cue timed in frames', function () {
    const cues = cuesFor(ttmlWith('15f', '45f', ' ttp:frameRate="30"'));
    expect(cues).to.have.lengthOf(1);
    expect(cues[0].startTime).to.equal(0.5);
    expect(cues[0].endTime).to.equal(1.5);
  });

  it('reads a clock time', function () {
    const cues = cuesFor(ttmlWith('00:00:01.500', '00:00:03.000'));
    expect(cues).to.have.lengthOf(1);
    expect(cues[0].startTime).to.equal(1.5);
    expect(cues[0].endTime).to.equal(3);
  });
});
