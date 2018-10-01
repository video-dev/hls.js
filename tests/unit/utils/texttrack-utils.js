import { stub } from 'sinon';
import { clearPastCues } from '../../../src/utils/texttrack-utils';

const assert = require('assert');

function getTextTrackStub (cues) {
  const trackStub = {
    cues: cues.concat(),
    removeCue: stub().callsFake((cue) => trackStub.cues.splice(trackStub.cues.indexOf(cue), 1))
  };

  return trackStub;
}

describe('Texttrack utils', () => {
  describe('clearPastCues', () => {
    it('should remove cue past current time', () => {
      const cues = [
        { startTime: 1, endTime: 5 },
        { startTime: 5, endTime: 7 },
        { startTime: 7, endTime: 9 },
        { startTime: 9, endTime: 13 }
      ];

      const trackStub = getTextTrackStub(cues);

      clearPastCues(trackStub, 8);

      assert(trackStub.removeCue.calledTwice, 'proper cues count not removed');
      assert(trackStub.removeCue.calledWith(cues[0]));
      assert(trackStub.removeCue.calledWith(cues[1]));
    });
  });
});
