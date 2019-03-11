import sinon from 'sinon';

import Hls from '../../../src/hls';
import Event from '../../../src/events';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';
import { SubtitleStreamController } from '../../../src/controller/subtitle-stream-controller';
const assert = require('assert');

const mediaMock = {
  currentTime: 0,
  addEventListener () {},
  removeEventListener () {}
};

const tracksMock = [
  { id: 0, details: {} },
  { id: 1 }
];

describe('SubtitleStreamController', function () {
  let hls;
  let fragmentTracker;
  let subtitleStreamController;

  beforeEach(function () {
    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);
    subtitleStreamController = new SubtitleStreamController(hls, fragmentTracker);

    subtitleStreamController.onMediaAttached({ media: mediaMock });
  });

  afterEach(function () {
    subtitleStreamController.onMediaDetaching({ media: mediaMock });
  });

  describe('onSubtitleTracksUpdate', function () {
    beforeEach(function () {
      hls.trigger(Event.SUBTITLE_TRACKS_UPDATED, {
        subtitleTracks: tracksMock
      });
    });

    it('should update tracks list', function () {
      assert.strictEqual(subtitleStreamController.tracks, tracksMock);
    });
  });

  describe('onSubtitleTrackSwitch', function () {
    beforeEach(function () {
      subtitleStreamController.tracks = tracksMock;
      subtitleStreamController.clearInterval = sinon.spy();
      subtitleStreamController.setInterval = sinon.spy();

      hls.trigger(Event.SUBTITLE_TRACK_SWITCH, {
        id: 0
      });
    });

    it('should call setInterval if details available', function () {
      assert.strictEqual(subtitleStreamController.setInterval.callCount, 1);
    });

    it('should call clearInterval if no tracks present', function () {
      subtitleStreamController.tracks = null;
      hls.trigger(Event.SUBTITLE_TRACK_SWITCH, {
        id: 0
      });
      assert.strictEqual(subtitleStreamController.clearInterval.callCount, 1);
    });

    it('should call clearInterval if new track id === -1', function () {
      hls.trigger(Event.SUBTITLE_TRACK_SWITCH, {
        id: -1
      });
      assert.strictEqual(subtitleStreamController.clearInterval.callCount, 1);
    });
  });

  describe('onSubtitleTrackLoaded', function () {
    beforeEach(function () {
      subtitleStreamController.setInterval = sinon.spy();
      subtitleStreamController.tracks = tracksMock;
    });

    // Details are in subtitle-track-controller.js' onSubtitleTrackLoaded handler
    it('should handle the event if the data matches the current track', function () {
      const details = { foo: 'bar' };
      subtitleStreamController.currentTrackId = 1;
      hls.trigger(Event.SUBTITLE_TRACK_LOADED, {
        id: 1, details
      });
      assert.strictEqual(subtitleStreamController.tracks[1].details, details);
      assert.strictEqual(subtitleStreamController.setInterval.callCount, 1);
    });

    it('should ignore the event if the data does not match the current track', function () {
      const details = { foo: 'bar' };
      subtitleStreamController.currentTrackId = 0;
      hls.trigger(Event.SUBTITLE_TRACK_LOADED, {
        id: 1, details
      });
      assert.strictEqual(subtitleStreamController.tracks[0].details !== details, true);
      assert.strictEqual(subtitleStreamController.setInterval.callCount, 0);
    });

    it('should ignore the event if there are no tracks, or the id is not within the tracks array', function () {
      subtitleStreamController.tracks = [];
      subtitleStreamController.trackId = 0;
      const details = { foo: 'bar' };
      hls.trigger(Event.SUBTITLE_TRACK_LOADED, {
        id: 0, details
      });
      assert.strictEqual(subtitleStreamController.tracks[0], undefined);
      assert.strictEqual(subtitleStreamController.setInterval.callCount, 0);
    });
  });

  describe('onLevelLoaded', function () {
    it('records the start time of the last known A/V track', function () {
      hls.trigger(Event.LEVEL_UPDATED, {
        details: { fragments: [{ start: 5 }] }
      });
      assert.strictEqual(subtitleStreamController.lastAVStart, 5);

      hls.trigger(Event.LEVEL_UPDATED, {
        details: { fragments: [] }
      });
      assert.strictEqual(subtitleStreamController.lastAVStart, 0);
    });
  });

  describe('onMediaSeeking', function () {
    it('nulls fragPrevious', function () {
      subtitleStreamController.fragPrevious = {};
      subtitleStreamController.onMediaSeeking();
      assert.strictEqual(subtitleStreamController.fragPrevious, null);
    });
  });
});
