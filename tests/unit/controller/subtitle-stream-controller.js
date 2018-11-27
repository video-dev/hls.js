import sinon from 'sinon';

import Hls from '../../../src/hls';
import Event from '../../../src/events';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';
import { SubtitleStreamController } from '../../../src/controller/subtitle-stream-controller';

const mediaMock = {
  currentTime: 0
};

const tracksMock = [
  { id: 0, details: {} },
  { id: 1 }
];

describe('SubtitleStreamController', function () {
  let hls;
  let fragmentTracker;
  let streamController;

  beforeEach(function () {
    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);
    streamController = new SubtitleStreamController(hls, fragmentTracker);

    streamController.onMediaAttached(mediaMock);
  });

  afterEach(function () {
    streamController.onMediaDetaching(mediaMock);
  });

  describe('onSubtitleTracksUpdate', function () {
    beforeEach(function () {
      hls.trigger(Event.SUBTITLE_TRACKS_UPDATED, {
        subtitleTracks: tracksMock
      });
    });

    it('should update tracks list', function () {
      expect(streamController.tracks).to.equal(tracksMock);
    });
  });

  describe('onSubtitleTrackSwitch', function () {
    beforeEach(function () {
      streamController.tracks = tracksMock;
      streamController.clearInterval = sinon.spy();
      streamController.setInterval = sinon.spy();

      hls.trigger(Event.SUBTITLE_TRACK_SWITCH, {
        id: 0
      });
    });

    it('should call setInterval if details available', function () {
      expect(streamController.setInterval).to.have.been.calledOnce;
    });

    it('should call clearInterval if no tracks present', function () {
      streamController.tracks = null;
      hls.trigger(Event.SUBTITLE_TRACK_SWITCH, {
        id: 0
      });
      expect(streamController.clearInterval).to.have.been.calledOnce;
    });

    it('should call clearInterval if new track id === -1', function () {
      hls.trigger(Event.SUBTITLE_TRACK_SWITCH, {
        id: -1
      });
      expect(streamController.clearInterval).to.have.been.calledOnce;
    });
  });

  describe('onSubtitleTrackLoaded', function () {
    let detailsMock = {};

    beforeEach(function () {
      streamController.setInterval = sinon.spy();
      streamController.tracks = tracksMock;
      hls.trigger(Event.SUBTITLE_TRACK_LOADED, {
        id: 1, details: detailsMock
      });
    });

    it('should add details to track object in list', function () {
      expect(streamController.tracks[1].details).to.equal(detailsMock);
    });

    it('should call setInterval', function () {
      expect(streamController.setInterval).to.have.been.calledOnce;
    });

    it('should not crash when no tracks present', function () {
      streamController.tracks = null;
      hls.trigger(Event.SUBTITLE_TRACK_LOADED, {
        id: 0, details: {}
      });
    });

    it('should not crash when no track id does not exist', function () {
      streamController.tracks = null;
      hls.trigger(Event.SUBTITLE_TRACK_LOADED, {
        id: 5, details: {}
      });
    });
  });
});
