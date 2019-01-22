import assert from 'assert';
import sinon from 'sinon';

import Hls from '../../../src/hls';
import Event from '../../../src/events';
import { FragmentTracker, FragmentState } from '../../../src/controller/fragment-tracker';
import { SubtitleStreamController, SubtitleStreamControllerState } from '../../../src/controller/subtitle-stream-controller';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { mockFragments } from '../../mocks/data';
import Fragment from '../../../src/loader/fragment';

const State = SubtitleStreamControllerState;

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

  beforeEach(() => {
    hls = new Hls({});
    fragmentTracker = new FragmentTracker(hls);
    streamController = new SubtitleStreamController(hls, fragmentTracker);

    streamController.onMediaAttached(mediaMock);
  });

  afterEach(() => {
    streamController.onMediaDetaching(mediaMock);
  });

  describe('onSubtitleTracksUpdate', () => {
    beforeEach(() => {
      hls.trigger(Event.SUBTITLE_TRACKS_UPDATED, {
        subtitleTracks: tracksMock
      });
    });

    it('should update tracks list', () => {
      assert(streamController.tracks === tracksMock);
    });
  });

  describe('onSubtitleTrackSwitch', () => {
    beforeEach(() => {
      streamController.tracks = tracksMock;
      streamController.clearInterval = sinon.spy();
      streamController.setInterval = sinon.spy();

      hls.trigger(Event.SUBTITLE_TRACK_SWITCH, {
        id: 0
      });
    });

    it('should call setInterval if details available', () => {
      assert(streamController.setInterval.calledOnce);
    });

    it('should call clearInterval if no tracks present', () => {
      streamController.tracks = null;
      hls.trigger(Event.SUBTITLE_TRACK_SWITCH, {
        id: 0
      });
      assert(streamController.clearInterval.calledOnce);
    });

    it('should call clearInterval if new track id === -1', () => {
      hls.trigger(Event.SUBTITLE_TRACK_SWITCH, {
        id: -1
      });
      assert(streamController.clearInterval.calledOnce);
    });
  });

  describe('onSubtitleTrackLoaded', () => {
    let detailsMock = {};

    beforeEach(() => {
      streamController.setInterval = sinon.spy();
      streamController.tracks = tracksMock;
      hls.trigger(Event.SUBTITLE_TRACK_LOADED, {
        id: 1, details: detailsMock
      });
    });

    it('should add details to track object in list', () => {
      assert(streamController.tracks[1].details === detailsMock);
    });

    it('should call setInterval', () => {
      assert(streamController.setInterval.calledOnce);
    });

    it('should not crash when no tracks present', () => {
      streamController.tracks = null;
      hls.trigger(Event.SUBTITLE_TRACK_LOADED, {
        id: 0, details: {}
      });
    });

    it('should not crash when no track id does not exist', () => {
      streamController.tracks = null;
      hls.trigger(Event.SUBTITLE_TRACK_LOADED, {
        id: 5, details: {}
      });
    });
  });
});
