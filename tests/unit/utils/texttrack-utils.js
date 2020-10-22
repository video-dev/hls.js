import { sendAddTrackEvent, clearCurrentCues, addCue } from '../../../src/utils/texttrack-utils';
import sinon from 'sinon';

describe('text track utils', function () {
  let cues = [{
    begin: 0,
    end: 5,
    text: 'First 5'
  }, {
    begin: 5,
    end: 10,
    text: 'Last 5'
  }];

  let track;
  let video;

  beforeEach(function () {
    video = document.createElement('video');
    track = video.addTextTrack('subtitles', 'test');
    cues.forEach((cue) => {
      // eslint-disable-next-line no-restricted-properties
      track.addCue(new VTTCue(cue.begin, cue.end, cue.text));
    });
  });

  describe('synthetic addtrack event', function () {
    it('should have the provided track as data', function (done) {
      const dispatchSpy = sinon.spy(video, 'dispatchEvent');
      video.addEventListener('addtrack', function (e) {
        expect(e.track).to.equal(track);
        done();
      });

      sendAddTrackEvent(track, video);
      expect(dispatchSpy.calledOnce).to.be.true;
    });

    it('should fallback to document.createEvent if window.Event constructor throws', function (done) {
      const stub = sinon.stub(window, 'Event');
      stub.throws();

      const spy = sinon.spy(document, 'createEvent');

      video.addEventListener('addtrack', function (e) {
        expect(e.track).to.equal(track);
        done();
      });

      sendAddTrackEvent(track, video);
      expect(spy.calledOnce).to.be.true;
    });
  });

  describe('clear current cues', function () {
    it('should not fail with empty cue list', function () {
      const emptyTrack = video.addTextTrack('subtitles', 'empty');
      expect(clearCurrentCues(emptyTrack)).to.not.throw;
    });

    it('should clear the cues from track', function () {
      clearCurrentCues(track);
      expect(track.cues.length).to.equal(0);
    });
  });

  describe('adds cue', function () {
    it('should add cue', function () {
      const cue = new VTTCue(100, 110, 'foobar');
      addCue(track, cue);
      expect(track.cues.length).to.equal(3);
    });

    it('should add cue if track.addCue throws an error', function () {
      const cue = new VTTCue(4, 6, 'foobar');
      /* eslint-disable no-restricted-properties */
      let originalAddCue = track.addCue;
      track.addCue = () => {
        track.addCue = originalAddCue;
        throw new Error('test error');
      };
      /* eslint-enable no-restricted-properties */
      addCue(track, cue);
      expect(track.cues.length).to.equal(3);
      // check cues order
      expect(track.cues[0].text).to.equal(cues[0].text);
      expect(track.cues[1].text).to.equal(cue.text);
      expect(track.cues[2].text).to.equal(cues[1].text);
    });
  });
});
