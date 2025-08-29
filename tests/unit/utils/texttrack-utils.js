import { removeCuesInRange } from '../../../src/utils/texttrack-utils';

describe('text track utils', function () {
  const cues = [
    {
      begin: 0,
      end: 5,
      text: 'First 5',
    },
    {
      begin: 5,
      end: 10,
      text: 'Last 5',
    },
  ];

  let track;
  let video;

  beforeEach(function () {
    video = document.createElement('video');
    track = video.addTextTrack('subtitles', 'test');
    cues.forEach((cue) => {
      track.addCue(new VTTCue(cue.begin, cue.end, cue.text));
    });
  });

  describe('clear current cues', function () {
    it('should not fail with empty cue list', function () {
      const emptyTrack = video.addTextTrack('subtitles', 'empty');
      expect(removeCuesInRange(emptyTrack, 0, 10)).to.not.throw;
    });

    it('should clear the cues from track', function () {
      removeCuesInRange(track, 0, 10);
      expect(track.cues.length).to.equal(0);
    });
  });
});
