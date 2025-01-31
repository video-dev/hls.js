import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { hlsDefaultConfig } from '../../src/config';
import { ErrorDetails, ErrorTypes } from '../../src/errors';
import { Events } from '../../src/events';
import Hls from '../../src/hls';

chai.use(sinonChai);
const expect = chai.expect;

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
      expect(media || null).to.not.equal(null);
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
      expect(media || null).to.not.equal(null);
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
});
