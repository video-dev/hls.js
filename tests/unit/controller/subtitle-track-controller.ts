import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import SubtitleTrackController from '../../../src/controller/subtitle-track-controller';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { LevelDetails } from '../../../src/loader/level-details';
import { LoadStats } from '../../../src/loader/load-stats';
import { AttrList } from '../../../src/utils/attr-list';
import type {
  ComponentAPI,
  NetworkComponentAPI,
} from '../../../src/types/component-api';
import type { Level } from '../../../src/types/level';
import type {
  MediaAttributes,
  MediaPlaylist,
} from '../../../src/types/media-playlist';

chai.use(sinonChai);
const expect = chai.expect;

type HlsTestable = Omit<
  Hls,
  'levelController' | 'networkControllers' | 'coreComponents'
> & {
  levelController: {
    levels: Pick<Level, 'subtitleGroups'>[];
  };
  coreComponents: ComponentAPI[];
  networkControllers: NetworkComponentAPI[];
};

describe('SubtitleTrackController', function () {
  let hls: HlsTestable;
  let subtitleTrackController: SubtitleTrackController;
  let subtitleTracks: MediaPlaylist[];
  let switchLevel: () => void;
  let videoElement;
  let sandbox;

  beforeEach(function () {
    hls = new Hls() as unknown as HlsTestable;
    hls.networkControllers.forEach((component) => component.destroy());
    hls.networkControllers.length = 0;
    hls.coreComponents.forEach((component) => component.destroy());
    hls.coreComponents.length = 0;
    subtitleTrackController = new SubtitleTrackController(
      hls as unknown as Hls,
    );
    hls.networkControllers.push(subtitleTrackController);
    hls.levelController = {
      levels: [
        {
          subtitleGroups: ['default-text-group'],
        },
      ],
    };

    videoElement = document.createElement('video');
    hls.trigger(Events.MEDIA_ATTACHED, { media: videoElement });

    subtitleTracks = [
      {
        attrs: new AttrList({}) as MediaAttributes,
        autoselect: true,
        bitrate: 0,
        default: false,
        forced: false,
        id: 0,
        groupId: 'default-text-group',
        lang: 'en-US',
        name: 'English',
        type: 'SUBTITLES',
        url: 'baz',
        // details: { live: false },
      },
      {
        attrs: new AttrList({}) as MediaAttributes,
        autoselect: true,
        bitrate: 0,
        default: false,
        forced: false,
        id: 1,
        groupId: 'default-text-group',
        lang: 'sv',
        name: 'Swedish',
        type: 'SUBTITLES',
        url: 'bar',
      },
      {
        attrs: new AttrList({}) as MediaAttributes,
        autoselect: true,
        bitrate: 0,
        default: false,
        forced: false,
        id: 2,
        groupId: 'default-text-group',
        lang: 'en-US',
        name: 'Untitled CC',
        type: 'SUBTITLES',
        url: 'foo',
        // details: { live: true },
      },
    ];
    const levels = [
      {
        subtitleGroups: ['default-text-group'],
      },
    ] as any;
    hls.trigger(Events.MANIFEST_PARSED, {
      subtitleTracks,
      levels,
      audioTracks: [],
      sessionData: null,
      sessionKeys: null,
      firstLevel: 0,
      stats: new LoadStats(),
      audio: true,
      video: true,
      altAudio: true,
    });

    switchLevel = () => {
      hls.trigger(Events.LEVEL_LOADING, {
        id: 0,
        level: 0,
        pathwayId: undefined,
        url: '',
        deliveryDirectives: null,
        levelInfo: {} as any,
      });
    };

    const textTrack1 = videoElement.addTextTrack(
      'subtitles',
      'English',
      'en-US',
    );
    const textTrack2 = videoElement.addTextTrack('subtitles', 'Swedish', 'sv');
    const textTrack3 = videoElement.addTextTrack(
      'captions',
      'Untitled CC',
      'en-US',
    );

    textTrack1.groupId = 'default-text-group';
    textTrack2.groupId = 'default-text-group';
    textTrack3.groupId = 'default-text-group';

    textTrack1.mode = 'disabled';
    textTrack2.mode = 'disabled';
    textTrack3.mode = 'disabled';
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('onTextTracksChanged', function () {
    beforeEach(function () {
      switchLevel();
    });
    it('should set subtitleTrack to -1 if disabled', function () {
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

      const onTextTracksChanged = sinon.spy(
        subtitleTrackController,
        'onTextTracksChanged' as any,
      );

      videoElement.textTracks[0].mode = 'showing';

      return new Promise((resolve) => {
        self.setTimeout(() => {
          expect(subtitleTrackController.subtitleTrack).to.equal(0);
          expect(onTextTracksChanged).to.have.been.calledOnce;
          videoElement.textTracks[0].mode = 'disabled';
          self.setTimeout(() => {
            expect(subtitleTrackController.subtitleTrack).to.equal(-1);
            expect(onTextTracksChanged).to.have.been.calledTwice;
            resolve(true);
          }, 500);
        }, 500);
      });
    });

    it('should set subtitleTrack to 0 if hidden', function () {
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

      videoElement.textTracks[0].mode = 'hidden';

      return new Promise((resolve) => {
        hls.on(Events.SUBTITLE_TRACK_SWITCH, () => {
          expect(subtitleTrackController.subtitleTrack).to.equal(0);
          resolve(true);
        });
      });
    });

    it('should set subtitleTrack to 0 if showing', function () {
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

      videoElement.textTracks[0].mode = 'showing';

      return new Promise((resolve) => {
        hls.on(Events.SUBTITLE_TRACK_SWITCH, () => {
          expect(subtitleTrackController.subtitleTrack).to.equal(0);
          resolve(true);
        });
      });
    });

    it('should set subtitleTrack id captions track is showing', function () {
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

      videoElement.textTracks[2].mode = 'showing';

      return new Promise((resolve) => {
        hls.on(Events.SUBTITLE_TRACK_SWITCH, () => {
          expect(videoElement.textTracks[2].kind).to.equal('captions');
          expect(subtitleTrackController.subtitleTrack).to.equal(2);
          resolve(true);
        });
      });
    });
  });

  describe('initial track selection', function () {
    it('should not select any tracks if there are no default of forces tracks (ignoring autoselect)', function () {
      switchLevel();
      expect(subtitleTracks[0].autoselect).to.equal(true);
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);
    });

    it('should not select forced tracks', function () {
      subtitleTracks[1].forced = true;
      switchLevel();
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);
    });

    it('should select the default track when there are no forced tracks', function () {
      subtitleTracks[2].default = true;
      switchLevel();
      expect(subtitleTrackController.subtitleTrack).to.equal(2);
    });

    it('should select the first default track when there are no forced tracks', function () {
      subtitleTracks[0].default = true;
      subtitleTracks[1].default = true;
      subtitleTracks[2].default = true;
      switchLevel();
      expect(subtitleTrackController.subtitleTrack).to.equal(0);
    });

    it('should not select forced tracks over the default tracks (one forced track)', function () {
      subtitleTracks[1].default = true;
      subtitleTracks[2].forced = true;
      switchLevel();
      expect(subtitleTrackController.subtitleTrack).to.equal(1);
    });

    it('should not select forced tracks over the default tracks (two forced track)', function () {
      subtitleTracks[0].forced = true;
      subtitleTracks[1].forced = true;
      subtitleTracks[2].default = true;
      switchLevel();
      expect(subtitleTrackController.subtitleTrack).to.equal(2);
    });

    describe('with subtitlePreference', function () {
      it('should select the first track with matching lang', function () {
        hls.config.subtitlePreference = {
          lang: 'en-US',
        };
        subtitleTracks[2].default = true;
        switchLevel();
        expect(subtitleTrackController.subtitleTrack).to.equal(0);
      });
      it('should select the first track with matching properties', function () {
        hls.config.subtitlePreference = {
          lang: 'en-US',
          default: true,
        };
        subtitleTracks[2].default = true;
        switchLevel();
        expect(subtitleTrackController.subtitleTrack).to.equal(2);
      });
      it('should not select default track if an unmatched preference is present', function () {
        hls.config.subtitlePreference = {
          lang: 'none',
        };
        subtitleTracks[2].default = true;
        switchLevel();
        expect(subtitleTrackController.subtitleTrack).to.equal(-1);
      });
    });
  });

  describe('set subtitleTrack', function () {
    beforeEach(function () {
      switchLevel();
    });
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
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);

      const onTextTracksChanged = sinon.spy(
        subtitleTrackController,
        'onTextTracksChanged' as any,
      );

      videoElement.textTracks[0].mode = 'showing';

      return new Promise((resolve) => {
        self.setTimeout(() => {
          expect(subtitleTrackController.subtitleTrack).to.equal(0);
          expect(videoElement.textTracks[0].mode).to.equal('showing');
          expect(onTextTracksChanged).to.have.been.calledOnce;
          subtitleTrackController.subtitleTrack = 1;
          self.setTimeout(() => {
            expect(videoElement.textTracks[0].mode).to.equal('disabled');
            expect(videoElement.textTracks[1].mode).to.equal('showing');
            expect(onTextTracksChanged).to.have.been.calledTwice;
            resolve(true);
          }, 500);
        }, 500);
      });
    });

    it('should disable all textTracks when set to -1', function () {
      [].slice.call(videoElement.textTracks).forEach((t) => {
        t.mode = 'showing';
      });
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);
      subtitleTrackController.subtitleTrack = -1;
      [].slice.call(videoElement.textTracks).forEach((t) => {
        expect(t.mode).to.equal('disabled');
      });
    });

    it('should trigger SUBTITLE_TRACK_SWITCH', function () {
      const triggerSpy = sandbox.spy(hls, 'trigger');
      subtitleTrackController.startLoad();
      subtitleTrackController.subtitleTrack = 1;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.firstCall).to.have.been.calledWith(
        'hlsSubtitleTrackSwitch',
        {
          id: 1,
          groupId: 'default-text-group',
          name: 'Swedish',
          type: 'SUBTITLES',
          url: 'bar',
        },
      );
    });

    it('should trigger SUBTITLE_TRACK_LOADING if the track has no details', function () {
      const triggerSpy = sandbox.spy(hls, 'trigger');
      subtitleTrackController.startLoad();
      subtitleTrackController.subtitleTrack = 1;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.secondCall).to.have.been.calledWith(
        'hlsSubtitleTrackLoading',
        {
          url: 'bar',
          id: 1,
          groupId: 'default-text-group',
          deliveryDirectives: null,
          track: subtitleTrackController.subtitleTracks[1],
        },
      );
    });

    it('should not trigger SUBTITLE_TRACK_LOADING if the track has details and is not live', function () {
      const triggerSpy = sandbox.spy(hls, 'trigger');
      subtitleTracks[0].details = { live: false } as any;
      subtitleTrackController.startLoad();
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
        },
      );
    });

    it('should trigger SUBTITLE_TRACK_SWITCH if passed -1', function () {
      const triggerSpy = sandbox.spy(hls, 'trigger');
      subtitleTrackController.subtitleTrack = -1;
      expect(triggerSpy.firstCall).to.have.been.calledWith(
        'hlsSubtitleTrackSwitch',
        { id: -1 },
      );
    });

    it('should trigger SUBTITLE_TRACK_LOADING if the track is live and needs to be reloaded', function () {
      const triggerSpy = sandbox.spy(hls, 'trigger');
      subtitleTracks[2].details = {
        live: true,
        requestScheduled: -100000,
        targetduration: 2,
      } as any;
      subtitleTrackController.startLoad();
      subtitleTrackController.subtitleTrack = 2;

      expect(triggerSpy).to.have.been.calledTwice;
      expect(triggerSpy.secondCall).to.have.been.calledWith(
        'hlsSubtitleTrackLoading',
        {
          url: 'foo',
          id: 2,
          groupId: 'default-text-group',
          deliveryDirectives: null,
          track: subtitleTrackController.subtitleTracks[2],
        },
      );
    });

    it('should do nothing if called with out of bound indices', function () {
      const triggerSpy = sandbox.spy(hls, 'trigger');
      subtitleTrackController.subtitleTrack = 5;
      subtitleTrackController.subtitleTrack = -2;
      expect(triggerSpy).to.have.callCount(0);
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);
    });

    it('should do nothing if called with a invalid index', function () {
      const triggerSpy = sandbox.spy(hls, 'trigger');
      subtitleTrackController.subtitleTrack = undefined as any;
      subtitleTrackController.subtitleTrack = null as any;
      expect(triggerSpy).to.have.callCount(0);
      expect(subtitleTrackController.subtitleTrack).to.equal(-1);
    });
  });

  describe('toggleTrackModes', function () {
    // This can be the case when setting the subtitleTrack before Hls.js attaches to the mediaElement
    it('should not throw an exception if trackId is out of the mediaElement text track bounds', function () {
      switchLevel();
      hls.detachMedia();
      const toggleTrackModesSpy = sandbox.spy(
        subtitleTrackController,
        'toggleTrackModes',
      );
      (subtitleTrackController as any).trackId = 3;
      hls.trigger(Events.MEDIA_ATTACHED, { media: videoElement });
      subtitleTrackController.subtitleDisplay = true; // setting subtitleDisplay invokes `toggleTrackModes`
      expect(toggleTrackModesSpy).to.have.been.calledOnce;
    });
  });

  describe('onSubtitleTrackLoaded', function () {
    beforeEach(function () {
      switchLevel();
    });
    it('exits early if the loaded track does not match the requested track', function () {
      const playlistLoadedSpy = sandbox.spy(
        subtitleTrackController,
        'playlistLoaded',
      );
      subtitleTrackController.startLoad();
      (subtitleTrackController as any).trackId = 1;
      (subtitleTrackController as any).currentTrack = subtitleTracks[1];

      const mockLoadedEvent = {
        id: 999,
        groupId: 'default-text-group',
        details: { foo: 'bar' } as any,
        stats: new LoadStats(),
        networkDetails: {},
        deliveryDirectives: null,
        track: {} as any,
      };
      hls.trigger(Events.SUBTITLE_TRACK_LOADED, mockLoadedEvent);
      expect((subtitleTrackController as any).timer).to.equal(-1);
      expect(playlistLoadedSpy).to.have.not.been.called;

      mockLoadedEvent.id = 0;
      hls.trigger(Events.SUBTITLE_TRACK_LOADED, mockLoadedEvent);
      expect((subtitleTrackController as any).timer).to.equal(-1);
      expect(playlistLoadedSpy).to.have.not.been.called;

      mockLoadedEvent.id = 1;
      hls.trigger(Events.SUBTITLE_TRACK_LOADED, mockLoadedEvent);
      expect((subtitleTrackController as any).timer).to.equal(-1);
      expect(playlistLoadedSpy).to.have.been.calledOnce;
    });

    it('retains loaded details on track if active track synchronously set to something else', function () {
      const playlistLoadedSpy = sandbox.spy(
        subtitleTrackController,
        'playlistLoaded',
      );
      subtitleTrackController.startLoad();
      (subtitleTrackController as any).trackId = 1;
      (subtitleTrackController as any).currentTrack = subtitleTracks[1];

      const mockLoadedEvent = {
        id: 1,
        groupId: 'default-text-group',
        details: { foo: 'bar' } as any,
        stats: new LoadStats(),
        networkDetails: {},
        deliveryDirectives: null,
        track: {} as any,
      };

      hls.subtitleTrack = -1;
      hls.trigger(Events.SUBTITLE_TRACK_LOADED, mockLoadedEvent);

      expect(subtitleTracks[1].details).not.to.be.undefined;
      expect((subtitleTrackController as any).timer).to.equal(-1);
      // We will still emit playlist loaded since we did load and store the details
      expect(playlistLoadedSpy).to.have.been.called;
    });

    it('does not set the reload timer if loading has not started', function () {
      const details = new LevelDetails('');
      subtitleTrackController.stopLoad();
      (subtitleTrackController as any).trackId = 1;
      (subtitleTrackController as any).currentTrack = subtitleTracks[1];
      hls.trigger(Events.SUBTITLE_TRACK_LOADED, {
        id: 1,
        groupId: 'default-text-group',
        details,
        stats: new LoadStats(),
        networkDetails: {},
        deliveryDirectives: null,
        track: {} as any,
      });
      expect((subtitleTrackController as any).timer).to.equal(-1);
    });

    it('sets the live reload timer if the level is live', function () {
      const details = new LevelDetails('');
      subtitleTrackController.startLoad();
      (subtitleTrackController as any).trackId = 1;
      (subtitleTrackController as any).currentTrack = subtitleTracks[1];
      hls.trigger(Events.SUBTITLE_TRACK_LOADED, {
        id: 1,
        groupId: 'default-text-group',
        details,
        stats: new LoadStats(),
        networkDetails: {},
        deliveryDirectives: null,
        track: {} as any,
      });
      expect((subtitleTrackController as any).timer).to.exist;
    });

    it('stops the live reload timer if the level is not live', function () {
      const details = new LevelDetails('');
      details.live = false;
      (subtitleTrackController as any).trackId = 1;
      (subtitleTrackController as any).currentTrack = subtitleTracks[1];
      (subtitleTrackController as any).timer = self.setTimeout(() => {}, 0);
      hls.trigger(Events.SUBTITLE_TRACK_LOADED, {
        id: 1,
        groupId: 'default-text-group',
        details,
        stats: new LoadStats(),
        networkDetails: {},
        deliveryDirectives: null,
        track: {} as any,
      });
      expect((subtitleTrackController as any).timer).to.equal(-1);
    });
  });

  describe('stopLoad', function () {
    it('stops loading', function () {
      const clearReloadSpy = sandbox.spy(subtitleTrackController, 'clearTimer');
      subtitleTrackController.stopLoad();
      expect((subtitleTrackController as any).canLoad).to.be.false;
      expect(clearReloadSpy).to.have.been.calledOnce;
    });
  });

  describe('startLoad', function () {
    it('starts loading', function () {
      const loadCurrentTrackSpy = sandbox.spy(
        subtitleTrackController,
        'loadPlaylist',
      );
      subtitleTrackController.startLoad();
      expect((subtitleTrackController as any).canLoad).to.be.true;
      expect(loadCurrentTrackSpy).to.have.been.calledOnce;
    });
  });
});
