import Hls from '../../src/hls';
import { hlsDefaultConfig } from '../../src/config';
import { Events } from '../../src/events';

import chai from 'chai';
import sinonChai from 'sinon-chai';

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
    it('should add and remove refrences to the "media" element immediately', function () {
      const hls = new Hls({ capLevelOnFPSDrop: true });
      expect(hls.media).to.equal(null);
      const media = document.createElement('video');
      expect(media || null).to.not.equal(null);
      hls.attachMedia(media);
      expect(hls.media).to.equal(media);
      detachTest(hls, media, 4);
      hls.destroy();
    });

    it('should add and remove refrences to the "media" element after attached', function () {
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
      detachTest(hls, media, 12);
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
