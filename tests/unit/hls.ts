import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { hlsDefaultConfig } from '../../src/config';
import { ErrorDetails, ErrorTypes } from '../../src/errors';
import { Events } from '../../src/events';
import Hls from '../../src/hls';

use(sinonChai);

describe('Hls', function () {
  describe('bandwidthEstimate', function () {
    it('should return a bandwidth estimate', function () {
      const MOCKED_ESTIMATE = 2000;
      const hls = new Hls();
      (hls as any).abrController = {
        bwEstimator: {
          getEstimate: () => MOCKED_ESTIMATE,
        },
      };
      expect(hls.bandwidthEstimate).to.equal(MOCKED_ESTIMATE);
    });

    it('should return a default bandwidth estimate', function () {
      const hls = new Hls();
      expect(hls.bandwidthEstimate).to.equal(
        hlsDefaultConfig.abrEwmaDefaultEstimate,
      );
    });
  });

  describe('attachMedia and detachMedia', function () {
    function detachTest(hls: Hls, media: HTMLMediaElement, refCount: number) {
      const components = (hls as any).coreComponents
        .concat((hls as any).networkControllers)
        .reduce((withMedia, component) => {
          if ('media' in component) {
            if (component.media === media) {
              withMedia.push(component);
            }
          }
          return withMedia;
        }, []);
      hls.detachMedia();
      expect(hls.media).to.equal(null, 'Hls');
      expect(components).to.have.lengthOf(refCount);
      components.forEach((component) => {
        expect(component.media || null).to.equal(
          null,
          component.constructor?.name,
        );
      });
    }

    it('should add and remove references to the "media" element immediately', function () {
      const hls = new Hls({ capLevelOnFPSDrop: true });
      expect(hls.media).to.equal(null);
      const media = document.createElement('video');
      expect(media).to.be.an('HTMLVideoElement');
      hls.attachMedia(media);
      expect(hls.media).to.equal(media);
      detachTest(hls, media, 6);
      hls.destroy();
    });

    it('should add and remove references to the "media" element after attached', function () {
      const hls = new Hls({
        capLevelOnFPSDrop: true,
        emeEnabled: true,
        cmcd: {},
      });
      expect(hls.media).to.equal(null);
      const media = document.createElement('video');
      expect(media).to.be.an('HTMLVideoElement');
      hls.attachMedia(media);
      expect(hls.media).to.equal(media);
      hls.trigger(Events.MEDIA_ATTACHED, { media });
      detachTest(hls, media, 14);
      hls.destroy();
    });

    it('should trigger an error event when attachMedia is called with null', function () {
      const hls = new Hls();
      const triggerSpy = sinon.spy(hls, 'trigger');

      hls.on(Events.ERROR, function (_event, _data) {});
      (hls as any).attachMedia(null);

      const expectedEvent = {
        type: ErrorTypes.OTHER_ERROR,
        details: ErrorDetails.ATTACH_MEDIA_ERROR,
        fatal: true,
        error: sinon.match
          .instanceOf(Error)
          .and(
            sinon.match.has(
              'message',
              'attachMedia failed: invalid argument (null)',
            ),
          ),
      };

      expect(triggerSpy).to.be.calledWith(
        Events.ERROR,
        sinon.match(expectedEvent),
      );

      triggerSpy.restore();
      hls.destroy();
    });
  });

  describe('loadSource and url', function () {
    it('url should initially be null', function () {
      const hls = new Hls();
      expect(hls.url).to.equal(null);
      hls.destroy();
    });

    it('should return given url after load', function () {
      const hls = new Hls();
      hls.loadSource(
        'https://video-dev.github.io/streams/x36xhzz/x36xhzz.m3u8',
      );
      expect(hls.url).to.equal(
        'https://video-dev.github.io/streams/x36xhzz/x36xhzz.m3u8',
      );
      hls.destroy();
    });

    it('should make relative url absolute', function () {
      const hls = new Hls();
      hls.loadSource('/streams/x36xhzz/x36xhzz.m3u8');
      expect(hls.url).to.equal(
        `${self.location.origin}/streams/x36xhzz/x36xhzz.m3u8`,
      );
      hls.destroy();
    });

    it('should parse temporal fragment from URL', function () {
      const hls = new Hls();
      const triggerSpy = sinon.spy(hls, 'trigger');
      hls.loadSource('https://example.com/video.m3u8#t=100,110');
      expect(hls.url).to.equal('https://example.com/video.m3u8');
      expect(hls.mediaFragment).to.deep.equal({ start: 100, end: 110 });
      expect(triggerSpy).to.be.calledWith(
        Events.MEDIA_FRAGMENT_PARSED,
        sinon.match({ start: 100, end: 110 }),
      );
      triggerSpy.restore();
      hls.destroy();
    });

    it('should set startPosition from fragment start time', function () {
      const hls = new Hls();
      hls.loadSource('https://example.com/video.m3u8#t=100,110');
      expect(hls.config.startPosition).to.equal(100);
      hls.destroy();
    });

    it('should clear previous fragment when loading new source without fragment', function () {
      const hls = new Hls();
      hls.loadSource('https://example.com/video1.m3u8#t=100,110');
      expect(hls.mediaFragment).to.deep.equal({ start: 100, end: 110 });
      hls.loadSource('https://example.com/video2.m3u8');
      expect(hls.mediaFragment).to.be.undefined;
      hls.destroy();
    });

    it('should update fragment when loading new source with different fragment', function () {
      const hls = new Hls();
      hls.loadSource('https://example.com/video1.m3u8#t=100,110');
      expect(hls.mediaFragment).to.deep.equal({ start: 100, end: 110 });
      hls.loadSource('https://example.com/video2.m3u8#t=200,210');
      expect(hls.mediaFragment).to.deep.equal({ start: 200, end: 210 });
      hls.destroy();
    });

    it('should handle fragment with start time only', function () {
      const hls = new Hls();
      hls.loadSource('https://example.com/video.m3u8#t=50');
      expect(hls.mediaFragment).to.deep.equal({ start: 50 });
      expect(hls.config.startPosition).to.equal(50);
      hls.destroy();
    });

    it('should handle fragment with end time only', function () {
      const hls = new Hls();
      hls.loadSource('https://example.com/video.m3u8#t=,30');
      expect(hls.mediaFragment).to.deep.equal({ end: 30 });
      expect(hls.config.startPosition).to.equal(-1);
      hls.destroy();
    });

    it('should preserve query parameters when parsing fragment', function () {
      const hls = new Hls();
      hls.loadSource('https://example.com/video.m3u8?token=abc#t=10,20');
      expect(hls.url).to.equal('https://example.com/video.m3u8?token=abc');
      expect(hls.mediaFragment).to.deep.equal({ start: 10, end: 20 });
      hls.destroy();
    });
  });

  describe('destroy', function () {
    it('should not crash on stopLoad() after destroy()', function () {
      const hls = new Hls();
      hls.destroy();
      expect(() => hls.stopLoad()).to.not.throw();
    });

    it('should not crash on startLoad() after destroy()', function () {
      const hls = new Hls();
      hls.destroy();
      expect(() => hls.startLoad()).to.not.throw();
    });

    it('has no circular references after calling destroy()', function () {
      const hls = new Hls();
      hls.destroy();
      expect(() => JSON.stringify(hls)).to.not.throw();
    });
  });

  describe('nextAudioTrack', function () {
    it('should return -1 when audioStreamController is not available', function () {
      const hls = new Hls();
      (hls as any).audioStreamController = null;
      expect(hls.nextAudioTrack).to.equal(-1);
      hls.destroy();
    });

    it('should not crash when audioTrackController is not available', function () {
      const hls = new Hls();
      (hls as any).audioTrackController = null;

      expect(() => {
        hls.nextAudioTrack = 2;
      }).to.not.throw();

      hls.destroy();
    });

    it('should set nextAudioTrack on audioTrackController', function () {
      const hls = new Hls();
      const mockAudioTrackController = {
        nextAudioTrack: 0,
      };
      (hls as any).audioTrackController = mockAudioTrackController;

      hls.nextAudioTrack = 2;

      expect(mockAudioTrackController.nextAudioTrack).to.equal(2);
      hls.destroy();
    });

    it('should return -1 when audioStreamController is undefined', function () {
      const hls = new Hls();
      (hls as any).audioStreamController = undefined;
      expect(hls.nextAudioTrack).to.equal(-1);
      hls.destroy();
    });
  });
});
