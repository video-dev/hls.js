import sinon from 'sinon';
import Hls from '../../../src/hls';
import CapLevelController from '../../../src/controller/cap-level-controller';
import { Events } from '../../../src/events';

const levels = [
  {
    width: 360,
    height: 360,
    bandwidth: 1000,
  },
  {
    width: 540,
    height: 540,
    bandwidth: 2000,
  },
  {
    width: 540,
    height: 540,
    bandwidth: 3000,
  },
  {
    width: 720,
    height: 720,
    bandwidth: 4000,
  },
];

describe('CapLevelController', function () {
  describe('getMaxLevelByMediaSize', function () {
    it('Should choose the level whose dimensions are >= the media dimensions', function () {
      const expected = 0;
      const actual = CapLevelController.getMaxLevelByMediaSize(
        levels,
        300,
        300
      );
      expect(expected).to.equal(actual);
    });

    it('Should choose the level whose bandwidth is greater if level dimensions are equal', function () {
      const expected = 2;
      const actual = CapLevelController.getMaxLevelByMediaSize(
        levels,
        500,
        500
      );
      expect(expected).to.equal(actual);
    });

    it('Should choose the highest level if the media is greater than every level', function () {
      const expected = 3;
      const actual = CapLevelController.getMaxLevelByMediaSize(
        levels,
        5000,
        5000
      );
      expect(expected).to.equal(actual);
    });

    it('Should return -1 if there levels is empty', function () {
      const expected = -1;
      const actual = CapLevelController.getMaxLevelByMediaSize([], 5000, 5000);
      expect(expected).to.equal(actual);
    });

    it('Should return -1 if there levels is undefined', function () {
      const expected = -1;
      const actual = CapLevelController.getMaxLevelByMediaSize(
        undefined,
        5000,
        5000
      );
      expect(expected).to.equal(actual);
    });
  });

  describe('getDimensions', function () {
    let hls;
    let media;
    let capLevelController;
    beforeEach(function () {
      const fixture = document.createElement('div');
      fixture.id = 'test-fixture';
      document.body.appendChild(fixture);

      hls = new Hls({ capLevelToPlayerSize: true });
      media = document.createElement('video');
      capLevelController = new CapLevelController(hls);
      capLevelController.onMediaAttaching(Events.MEDIA_ATTACHING, {
        media,
      });
      capLevelController.onManifestParsed(Events.MANIFEST_PARSED, {
        levels,
      });
    });

    afterEach(function () {
      if (media.parentNode) {
        media.parentNode.removeChild(media);
      }
      document.body.removeChild(document.querySelector('#test-fixture'));
    });

    it('gets 0 for width and height when the media element is not in the DOM', function () {
      const bounds = capLevelController.getDimensions();
      expect(bounds.width).to.equal(0);
      expect(bounds.height).to.equal(0);
      expect(capLevelController.mediaWidth).to.equal(0);
      expect(capLevelController.mediaHeight).to.equal(0);
    });

    it('gets width and height attributes when the media element is not in the DOM', function () {
      media.setAttribute('width', 320);
      media.setAttribute('height', 240);
      const pixelRatio = capLevelController.contentScaleFactor;
      const bounds = capLevelController.getDimensions();
      expect(bounds.width).to.equal(320);
      expect(bounds.height).to.equal(240);
      expect(capLevelController.mediaWidth).to.equal(320 * pixelRatio);
      expect(capLevelController.mediaHeight).to.equal(240 * pixelRatio);
    });

    it('gets client bounds width and height when media element is in the DOM', function () {
      media.style.width = '1280px';
      media.style.height = '720px';
      document.querySelector('#test-fixture').appendChild(media);
      const pixelRatio = capLevelController.contentScaleFactor;
      const bounds = capLevelController.getDimensions();
      expect(bounds.width).to.equal(1280);
      expect(bounds.height).to.equal(720);
      expect(capLevelController.mediaWidth).to.equal(1280 * pixelRatio);
      expect(capLevelController.mediaHeight).to.equal(720 * pixelRatio);
    });
  });

  describe('initialization', function () {
    let hls;
    let capLevelController;
    let firstLevelSpy;
    let startCappingSpy;
    let stopCappingSpy;
    beforeEach(function () {
      hls = new Hls({ capLevelToPlayerSize: true });
      firstLevelSpy = sinon.spy(hls, 'firstLevel', ['set']);
      capLevelController = new CapLevelController(hls);
      startCappingSpy = sinon.spy(capLevelController, 'startCapping');
      stopCappingSpy = sinon.spy(capLevelController, 'stopCapping');
    });

    describe('start and stop', function () {
      it('immediately caps and sets a timer for monitoring size size', function () {
        const detectPlayerSizeSpy = sinon.spy(
          capLevelController,
          'detectPlayerSize'
        );
        capLevelController.startCapping();

        expect(capLevelController.timer).to.exist;
        expect(firstLevelSpy.set.calledOnce).to.be.true;
        expect(detectPlayerSizeSpy.calledOnce).to.be.true;
      });

      it('stops the capping timer and resets capping', function () {
        capLevelController.autoLevelCapping = 4;
        capLevelController.timer = 1;
        capLevelController.stopCapping();

        expect(capLevelController.autoLevelCapping).to.equal(
          Number.POSITIVE_INFINITY
        );
        expect(capLevelController.restrictedLevels).to.be.empty;
        expect(capLevelController.firstLevel).to.equal(-1);
        expect(capLevelController.timer).to.not.exist;
      });
    });

    it('constructs with no restrictions', function () {
      expect(capLevelController.restrictedLevels).to.be.empty;
      expect(capLevelController.timer).to.not.exist;
      expect(capLevelController.autoLevelCapping).to.equal(
        Number.POSITIVE_INFINITY
      );

      expect(firstLevelSpy.set.notCalled).to.be.true;
    });

    it('starts capping on BUFFER_CODECS only if video is found', function () {
      capLevelController.onBufferCodecs(Events.BUFFER_CODECS, { video: {} });
      expect(startCappingSpy.calledOnce).to.be.true;
    });

    it('does not start capping on BUFFER_CODECS if video is not found', function () {
      capLevelController.onBufferCodecs(Events.BUFFER_CODECS, { audio: {} });
      expect(startCappingSpy.notCalled).to.be.true;
    });

    it('starts capping if the video codec was found after the audio codec', function () {
      capLevelController.onBufferCodecs(Events.BUFFER_CODECS, { audio: {} });
      expect(startCappingSpy.notCalled).to.be.true;

      capLevelController.onBufferCodecs(Events.BUFFER_CODECS, { video: {} });
      expect(startCappingSpy.calledOnce).to.be.true;
    });

    it('receives level information from the MANIFEST_PARSED event', function () {
      capLevelController.restrictedLevels = [1];
      const data = {
        levels: [{ foo: 'bar' }],
        firstLevel: 0,
      };

      capLevelController.onManifestParsed(Events.MANIFEST_PARSED, data);
      expect(capLevelController.firstLevel).to.equal(data.firstLevel);
      expect(capLevelController.restrictedLevels).to.be.empty;
    });

    it('should start capping in MANIFEST_PARSED if a video codec was signaled in the manifest', function () {
      capLevelController.onManifestParsed(Events.MANIFEST_PARSED, {
        video: {},
      });
      expect(startCappingSpy.calledOnce).to.be.true;
    });

    it('does not start capping on MANIFEST_PARSED if no video codec was signaled in the manifest', function () {
      capLevelController.onManifestParsed(Events.MANIFEST_PARSED, {
        levels: [{}],
        altAudio: true,
      });
      expect(startCappingSpy.notCalled).to.be.true;
    });

    describe('capLevelToPlayerSize', function () {
      let streamController;
      let nextLevelSwitchSpy;

      beforeEach(function () {
        // For these tests, we need the original HLS object to refer to our manually created capLevelController.
        hls.capLevelController = capLevelController;
        streamController = hls.streamController;

        nextLevelSwitchSpy = sinon.spy(streamController, 'nextLevelSwitch');
        capLevelController.onManifestParsed(Events.MANIFEST_PARSED, {
          levels,
          video: {},
        });
      });

      it('continues capping without second timer', function () {
        hls.capLevelToPlayerSize = true;
        expect(startCappingSpy.calledOnce).to.be.true;
      });

      it('stops the capping timer and resets capping', function () {
        hls.capLevelToPlayerSize = false;
        expect(stopCappingSpy.calledOnce).to.be.true;
      });

      it('calls for nextLevelSwitch when stopped capping', function () {
        hls.capLevelToPlayerSize = false;
        expect(nextLevelSwitchSpy.calledOnce).to.be.true;
      });

      it('updates config state of capping on change', function () {
        hls.capLevelToPlayerSize = false;
        expect(hls.config.capLevelToPlayerSize).to.be.false;
      });

      it('stops capping when destroyed', function () {
        capLevelController.destroy();
        expect(stopCappingSpy.calledOnce).to.be.true;
      });
    });
  });
});
