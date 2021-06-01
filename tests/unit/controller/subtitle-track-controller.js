import SubtitleTrackController from '../../../src/controller/subtitle-track-controller';
import Hls from '../../../src/hls';
import sinon from 'sinon';
import { LoadStats } from '../../../src/loader/load-stats';
import { LevelDetails } from '../../../src/loader/level-details';
import { Events } from '../../../src/events';

describe('SubtitleTrackController', function () {
  let subtitleTrackController;
  let videoElement;
  let sandbox;

  beforeEach(function () {
    const hls = new Hls({
      renderNatively: true,
    });

    videoElement = document.createElement('video');
    subtitleTrackController = new SubtitleTrackController(hls);
    subtitleTrackController.media = videoElement;
    subtitleTrackController.tracks = subtitleTrackController.tracksInGroup = [
      {
        id: 0,
        groupId: 'default-text-group',
        lang: 'en',
        name: 'English',
        type: 'SUBTITLES',
        url: 'baz',
        details: { live: false },
      },
      {
        id: 1,
        groupId: 'default-text-group',
        lang: 'en',
        name: 'English',
        type: 'SUBTITLES',
        url: 'bar',
      },
      {
        id: 2,
        groupId: 'default-text-group',
        lang: 'en',
        name: 'English',
        type: 'SUBTITLES',
        url: 'foo',
        details: { live: true },
      },
    ];

    const textTrack1 = videoElement.addTextTrack('subtitles', 'English', 'en');
    const textTrack2 = videoElement.addTextTrack('subtitles', 'Swedish', 'se');
    textTrack1.groupId = 'default-text-group';
    textTrack2.groupId = 'default-text-group';
    subtitleTrackController.groupId = 'default-text-group';

    textTrack1.mode = 'disabled';
    textTrack2.mode = 'disabled';
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('onTextTrackChanged', function () {
    it('should set subtitleTrack to -1 if disabled', function () {
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

      videoElement.textTracks[0].mode = 'disabled';
      subtitleTrackController.onTextTracksChanged();

      expect(subtitleTrackController.subtitleTrack).to.equal(-1);
    });

    it('should set subtitleTrack to 0 if hidden', function () {
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

      videoElement.textTracks[0].mode = 'hidden';
      subtitleTrackController.onTextTracksChanged();

      expect(subtitleTrackController.subtitleTrack).to.equal(0);
    });

    it('should set subtitleTrack to 0 if showing', function () {
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

      videoElement.textTracks[0].mode = 'showing';
      subtitleTrackController.onTextTracksChanged();

      expect(subtitleTrackController.subtitleTrack).to.equal(0);
    });
  });

  describe('set subtitleTrack', function () {
    it('should set active text track mode to showing', function () {
      videoElement.textTracks[0].mode = 'disabled';

      subtitleTrackController.subtitleDisplay = true;
      subtitleTrackController.subtitleTrack = 0;

      expect(videoElement.textTracks[0].mode).to.equal('showing');
    });

    it('should set active text track mode to hidden', function () {
      videoElement.textTracks[0].mode = 'disabled';
      subtitleTrackController.subtitleDisplay = false;
      subtitleTrackController.subtitleTrack = 0;

      expect(videoElement.textTracks[0].mode).to.equal('hidden');
    });

    it('should disable previous track', function () {
      // Change active track without triggering setSubtitleTrackInternal
      subtitleTrackController.trackId = 0;
      // Change active track and trigger setSubtitleTrackInternal
      subtitleTrackController.subtitleTrack = 1;

      expect(videoElement.textTracks[0].mode).to.equal('disabled');
    });

    it('should trigger SUBTITLE_TRACK_SWITCH', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.canLoad = true;
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 1;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.firstCall).to.have.been.calledWith(
        'hlsSubtitleTrackSwitch',
        {
          id: 1,
          groupId: 'default-text-group',
          name: 'English',
          type: 'SUBTITLES',
          url: 'bar',
        }
      );
    });

    it('should trigger SUBTITLE_TRACK_LOADING if the track has no details', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.canLoad = true;
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 1;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.secondCall).to.have.been.calledWith(
        'hlsSubtitleTrackLoading',
        {
          url: 'bar',
          id: 1,
          groupId: 'default-text-group',
          deliveryDirectives: null,
        }
      );
    });

    it('should not trigger SUBTITLE_TRACK_LOADING if the track has details and is not live', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 1;
      subtitleTrackController.subtitleTrack = 0;

      expect(triggerSpy).to.have.been.calledOnce;
      expect(triggerSpy.firstCall).to.have.been.calledWith(
        'hlsSubtitleTrackSwitch',
        {
          id: 0,
          groupId: 'default-text-group',
          name: 'English',
          type: 'SUBTITLES',
          url: 'baz',
        }
      );
    });

    it('should trigger SUBTITLE_TRACK_SWITCH if passed -1', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = -1;

      expect(triggerSpy.firstCall).to.have.been.calledWith(
        'hlsSubtitleTrackSwitch',
        { id: -1 }
      );
    });

    it('should trigger SUBTITLE_TRACK_LOADING if the track is live, even if it has details', function () {
      const triggerSpy = sandbox.spy(subtitleTrackController.hls, 'trigger');
      subtitleTrackController.canLoad = true;
      subtitleTrackController.trackId = 0;
      subtitleTrackController.subtitleTrack = 2;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.secondCall).to.have.been.calledWith(
        'hlsSubtitleTrackLoading',
        {
          url: 'foo',
          id: 2,
          groupId: 'default-text-group',
          deliveryDirectives: null,
        }
      );
    });

    it('should do nothing if called with out of bound indices', function () {
      const clearReloadSpy = sandbox.spy(subtitleTrackController, 'clearTimer');
      subtitleTrackController.subtitleTrack = 5;
      subtitleTrackController.subtitleTrack = -2;

      expect(clearReloadSpy).to.have.not.been.called;
    });

    it('should do nothing if called with a non-number', function () {
      subtitleTrackController.subtitleTrack = undefined;
      subtitleTrackController.subtitleTrack = null;
    });

    describe('toggleTrackModes', function () {
      // This can be the case when setting the subtitleTrack before Hls.js attaches to the mediaElement
      it('should not throw an exception if trackId is out of the mediaElement text track bounds', function () {
        subtitleTrackController.trackId = 3;
        subtitleTrackController.toggleTrackModes(1);
      });

      it('should disable all textTracks if called with -1', function () {
        [].slice.call(videoElement.textTracks).forEach((t) => {
          t.mode = 'showing';
        });
        subtitleTrackController.toggleTrackModes(-1);
        [].slice.call(videoElement.textTracks).forEach((t) => {
          expect(t.mode).to.equal('disabled');
        });
      });

      it('should not throw an exception if the mediaElement does not exist', function () {
        subtitleTrackController.media = null;
        subtitleTrackController.toggleTrackModes(1);
      });
    });

    describe('onSubtitleTrackLoaded', function () {
      it('exits early if the loaded track does not match the requested track', function () {
        const playlistLoadedSpy = sandbox.spy(
          subtitleTrackController,
          'playlistLoaded'
        );
        subtitleTrackController.canLoad = true;
        subtitleTrackController.trackId = 1;

        const mockLoadedEvent = {
          id: 999,
          details: { foo: 'bar' },
          stats: new LoadStats(),
        };
        subtitleTrackController.onSubtitleTrackLoaded(
          Events.SUBTITLE_TRACK_LOADED,
          mockLoadedEvent
        );
        expect(subtitleTrackController.timer).to.equal(-1);
        expect(playlistLoadedSpy).to.have.not.been.called;

        mockLoadedEvent.id = 0;
        subtitleTrackController.onSubtitleTrackLoaded(
          Events.SUBTITLE_TRACK_LOADED,
          mockLoadedEvent
        );
        expect(subtitleTrackController.timer).to.equal(-1);
        expect(playlistLoadedSpy).to.have.not.been.called;

        mockLoadedEvent.id = 1;
        subtitleTrackController.onSubtitleTrackLoaded(
          Events.SUBTITLE_TRACK_LOADED,
          mockLoadedEvent
        );
        expect(subtitleTrackController.timer).to.equal(-1);
        expect(playlistLoadedSpy).to.have.been.calledOnce;
      });

      it('does not set the reload timer if the canLoad flag is set to false', function () {
        const details = new LevelDetails('');
        subtitleTrackController.canLoad = false;
        subtitleTrackController.trackId = 1;
        subtitleTrackController.onSubtitleTrackLoaded(
          Events.SUBTITLE_TRACK_LOADED,
          { id: 1, details, stats: new LoadStats() }
        );
        expect(subtitleTrackController.timer).to.equal(-1);
      });

      it('sets the live reload timer if the level is live', function () {
        const details = new LevelDetails('');
        subtitleTrackController.canLoad = true;
        subtitleTrackController.trackId = 1;
        subtitleTrackController.onSubtitleTrackLoaded(
          Events.SUBTITLE_TRACK_LOADED,
          { id: 1, details, stats: new LoadStats() }
        );
        expect(subtitleTrackController.timer).to.exist;
      });

      it('stops the live reload timer if the level is not live', function () {
        const details = new LevelDetails('');
        details.live = false;
        subtitleTrackController.trackId = 1;
        subtitleTrackController.timer = self.setTimeout(() => {}, 0);
        subtitleTrackController.onSubtitleTrackLoaded(
          Events.SUBTITLE_TRACK_LOADED,
          { id: 1, details, stats: new LoadStats() }
        );
        expect(subtitleTrackController.timer).to.equal(-1);
      });
    });

    describe('stopLoad', function () {
      it('stops loading', function () {
        const clearReloadSpy = sandbox.spy(
          subtitleTrackController,
          'clearTimer'
        );
        subtitleTrackController.stopLoad();
        expect(subtitleTrackController.canLoad).to.be.false;
        expect(clearReloadSpy).to.have.been.calledOnce;
      });
    });

    describe('startLoad', function () {
      it('starts loading', function () {
        const loadCurrentTrackSpy = sandbox.spy(
          subtitleTrackController,
          'loadPlaylist'
        );
        subtitleTrackController.startLoad();
        expect(subtitleTrackController.canLoad).to.be.true;
        expect(loadCurrentTrackSpy).to.have.been.calledOnce;
      });
    });
  });
});
