import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { TimelineController } from '../../../src/controller/timeline-controller';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { Fragment } from '../../../src/loader/fragment';
import { PlaylistLevelType } from '../../../src/types/loader';

use(sinonChai);

describe('TimelineController', function () {
  let timelineController;
  let hls;
  let videoElement;

  beforeEach(function () {
    videoElement = document.createElement('video');
    hls = new Hls();
    hls.config.enableWebVTT = true;
    hls.config.renderTextTracksNatively = true;
    timelineController = new TimelineController(hls);
    timelineController.config.renderTextTracksNatively = true;
    timelineController.media = videoElement;
  });

  describe('createCaptionsTrack', function () {
    it('should create new TextTrack after calling and remove it when detaching', function () {
      expect(videoElement.textTracks.length).to.equal(0);
      timelineController.createCaptionsTrack('textTrack1');
      expect(videoElement.textTracks.length).to.equal(1);
      timelineController.onMediaDetaching(Events.MEDIA_DETACHING, {});
      expect(videoElement.textTracks.length).to.equal(0);
    });
  });

  describe('mapped empty WebVTT parts', function () {
    function subtitleFragment(withMap: boolean) {
      const frag = new Fragment(PlaylistLevelType.SUBTITLE, '');
      frag.sn = 1;
      frag.level = 0;
      frag.cc = 0;
      frag.start = 0;
      frag.duration = 0.5;
      if (withMap) {
        const init = new Fragment(PlaylistLevelType.SUBTITLE, '');
        init.sn = 'initSegment';
        init.data = new TextEncoder().encode(
          'WEBVTT\nX-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:0\n\n',
        );
        frag.initSegment = init;
      }
      return frag;
    }

    it('processes a zero-byte part with a WebVTT map successfully', function () {
      const processed = sinon.spy();
      hls.on(Events.SUBTITLE_FRAG_PROCESSED, processed);
      timelineController.tracks = [{ textCodec: 'wvtt' }];
      timelineController.initPTS[0] = {
        baseTime: 0,
        timescale: 90_000,
        trackId: -1,
      };
      const frag = subtitleFragment(true);

      timelineController.onFragLoaded(Events.FRAG_LOADED, {
        frag,
        payload: new ArrayBuffer(0),
      });

      expect(processed).to.have.been.calledOnce;
      expect(processed.firstCall.args[1]).to.include({
        success: true,
        frag,
      });
    });

    it('rejects a zero-byte subtitle resource without a map', function () {
      const processed = sinon.spy();
      hls.on(Events.SUBTITLE_FRAG_PROCESSED, processed);
      timelineController.tracks = [{ textCodec: 'wvtt' }];
      const frag = subtitleFragment(false);

      timelineController.onFragLoaded(Events.FRAG_LOADED, {
        frag,
        payload: new ArrayBuffer(0),
      });

      expect(processed).to.have.been.calledOnce;
      expect(processed.firstCall.args[1]).to.include({
        success: false,
        frag,
      });
    });
  });
});
