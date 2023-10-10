import { TimelineController } from '../../../src/controller/timeline-controller';
import Hls from '../../../src/hls';
import { Events } from '../../../src/events';

describe('TimelineController', function () {
  let timelineController;
  let hls;

  beforeEach(function () {
    hls = new Hls();
    hls.config.enableWebVTT = true;
    hls.config.renderNatively = true;
    timelineController = new TimelineController(hls);
    timelineController.media = document.createElement('video');
  });

  describe('reuse text track', function () {
    it('should reuse text track when track order is same between manifests', function () {
      hls.subtitleTrackController = { subtitleDisplay: false };

      timelineController.onSubtitleTracksUpdated(
        Events.SUBTITLE_TRACKS_UPDATED,
        {
          subtitleTracks: [
            { id: 0, name: 'en', attrs: { LANGUAGE: 'en', NAME: 'en' } },
            { id: 1, name: 'ru', attrs: { LANGUAGE: 'ru', NAME: 'ru' } },
          ],
        },
      );

      // text tracks model contain only newly added manifest tracks, in same order as in manifest
      expect(timelineController.textTracks[0].label).to.equal('en');
      expect(timelineController.textTracks[1].label).to.equal('ru');
      expect(timelineController.textTracks.length).to.equal(2);
      // text tracks of the media contain the newly added text tracks
      expect(timelineController.media.textTracks[0].label).to.equal('en');
      expect(timelineController.media.textTracks[1].label).to.equal('ru');
      expect(timelineController.media.textTracks.length).to.equal(2);

      timelineController.onSubtitleTracksUpdated(
        Events.SUBTITLE_TRACKS_UPDATED,
        {
          subtitleTracks: [
            { id: 0, name: 'en', attrs: { LANGUAGE: 'en', NAME: 'en' } },
            { id: 1, name: 'ru', attrs: { LANGUAGE: 'ru', NAME: 'ru' } },
          ],
        },
      );

      // text tracks model contain only newly added manifest tracks, in same order
      expect(timelineController.textTracks[0].label).to.equal('en');
      expect(timelineController.textTracks[1].label).to.equal('ru');
      expect(timelineController.textTracks.length).to.equal(2);
      // text tracks of the media contain the previously added text tracks, in same order as the manifest order
      expect(timelineController.media.textTracks[0].label).to.equal('en');
      expect(timelineController.media.textTracks[1].label).to.equal('ru');
      expect(timelineController.media.textTracks.length).to.equal(2);
    });

    it('should reuse text track when track order is not same between manifests', function () {
      hls.subtitleTrackController = { subtitleDisplay: false };

      timelineController.onSubtitleTracksUpdated(Events.MANIFEST_LOADED, {
        subtitleTracks: [
          {
            id: 0,
            name: 'en',
            lang: 'en',
            attrs: { LANGUAGE: 'en', NAME: 'en' },
          },
          {
            id: 1,
            name: 'ru',
            lang: 'ru',
            attrs: { LANGUAGE: 'ru', NAME: 'ru' },
          },
        ],
      });

      // text tracks model contain only newly added manifest tracks, in same order as in manifest
      expect(timelineController.textTracks[0].label).to.equal('en');
      expect(timelineController.textTracks[1].label).to.equal('ru');
      expect(timelineController.textTracks.length).to.equal(2);
      // text tracks of the media contain the newly added text tracks
      expect(timelineController.media.textTracks[0].label).to.equal('en');
      expect(timelineController.media.textTracks[1].label).to.equal('ru');
      expect(timelineController.media.textTracks.length).to.equal(2);

      timelineController.onSubtitleTracksUpdated(Events.MANIFEST_LOADED, {
        subtitleTracks: [
          {
            id: 0,
            name: 'ru',
            lang: 'ru',
            attrs: { LANGUAGE: 'ru', NAME: 'ru' },
          },
          {
            id: 1,
            name: 'en',
            lang: 'en',
            attrs: { LANGUAGE: 'en', NAME: 'en' },
          },
        ],
      });

      // text tracks model contain only newly added manifest tracks, in same order
      expect(timelineController.textTracks[0].label).to.equal('ru');
      expect(timelineController.textTracks[1].label).to.equal('en');
      expect(timelineController.textTracks.length).to.equal(2);
      // text tracks of the media contain the previously added text tracks).to.equal(in opposite order to the manifest order
      expect(timelineController.media.textTracks[0].label).to.equal('en');
      expect(timelineController.media.textTracks[1].label).to.equal('ru');
      expect(timelineController.media.textTracks.length).to.equal(2);
    });
  });

  describe('text track kind', function () {
    it('should be kind captions when there is both transcribes-spoken-dialog and describes-music-and-sound', function () {
      hls.subtitleTrackController = { subtitleDisplay: false };
      const characteristics =
        'public.accessibility.transcribes-spoken-dialog,public.accessibility.describes-music-and-sound';
      timelineController.onSubtitleTracksUpdated(Events.MANIFEST_LOADED, {
        subtitleTracks: [
          {
            id: 0,
            name: 'en',
            characteristics,
            attrs: {
              CHARACTERISTICS: characteristics,
            },
          },
        ],
      });

      // text tracks model contain only newly added manifest tracks, in same order as in manifest
      expect(timelineController.textTracks[0].kind).to.equal('captions');
      // text tracks of the media contain the newly added text tracks
      expect(timelineController.media.textTracks[0].kind).to.equal('captions');
    });

    it('should be kind subtitles when there is no describes-music-and-sound', function () {
      hls.subtitleTrackController = { subtitleDisplay: false };

      timelineController.onSubtitleTracksUpdated(Events.MANIFEST_LOADED, {
        subtitleTracks: [
          {
            id: 0,
            name: 'en',
            attrs: {
              CHARACTERISTICS: 'public.accessibility.transcribes-spoken-dialog',
            },
          },
        ],
      });

      // text tracks model contain only newly added manifest tracks, in same order as in manifest
      expect(timelineController.textTracks[0].kind).to.equal('subtitles');
      // text tracks of the media contain the newly added text tracks
      expect(timelineController.media.textTracks[0].kind).to.equal('subtitles');
    });

    it('should be kind subtitles when there is no CHARACTERISTICS', function () {
      hls.subtitleTrackController = { subtitleDisplay: false };

      timelineController.onSubtitleTracksUpdated(Events.MANIFEST_LOADED, {
        subtitleTracks: [
          {
            id: 0,
            name: 'en',
            attrs: {},
          },
        ],
      });

      // text tracks model contain only newly added manifest tracks, in same order as in manifest
      expect(timelineController.textTracks[0].kind).to.equal('subtitles');
      // text tracks of the media contain the newly added text tracks
      expect(timelineController.media.textTracks[0].kind).to.equal('subtitles');
    });
  });
});
