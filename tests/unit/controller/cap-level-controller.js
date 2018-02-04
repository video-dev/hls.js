const assert = require('assert');
const itEach = require('it-each');
const sinon = require('sinon');

import EventEmitter from 'events';
import CapLevelController from '../../../src/controller/cap-level-controller';
import {hlsDefaultConfig} from '../../../src/config';
import Event from '../../../src/events';

itEach({testPerIteration: true});

const levels = [
  {
    width: 360,
    height: 360,
    bandwidth: 1000
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
    bandwidth: 4000
  }
];

describe('CapLevelController', function () {
  describe('getMaxLevelByMediaSize', function () {
    it('Should choose the level whose dimensions are >= the media dimensions', function () {
      const expected = 0;
      const actual = CapLevelController.getMaxLevelByMediaSize(levels, 300, 300);
      assert.equal(expected, actual);
    });

    it('Should choose the level whose bandwidth is greater if level dimensions are equal', function () {
      const expected = 2;
      const actual = CapLevelController.getMaxLevelByMediaSize(levels, 500, 500);
      assert.equal(expected, actual);
    });

    it('Should choose the highest level if the media is greater than every level', function () {
      const expected = 3;
      const actual = CapLevelController.getMaxLevelByMediaSize(levels, 5000, 5000);
      assert.equal(expected, actual);
    });

    it('Should return -1 if there levels is empty', function () {
      const expected = -1;
      const actual = CapLevelController.getMaxLevelByMediaSize([], 5000, 5000);
      assert.equal(expected, actual);
    });

    it('Should return -1 if there levels is undefined', function () {
      const expected = -1;
      const actual = CapLevelController.getMaxLevelByMediaSize(undefined, 5000, 5000);
      assert.equal(expected, actual);
    });
  });

  describe('capLevelToPlayerSize', function () {
    class MockHls {
      constructor(config) {
        this.config = Object.assign({}, hlsDefaultConfig, config);

        this.streamController = {
          nextLevelSwitch() {}
        };

        this.levelController = {
          _firstLevel: -1,
          get firstLevel() {
            return this._firstLevel;
          },
          set firstLevel(value) {
            this._firstLevel = value;
          }
        };

        // Set up observer
        this.observer = Object.assign(new EventEmitter(), {
          trigger(event, ...data) {
            this.emit(event, event, ...data);
          },
          off(event, ...data) {
            this.removeListener(event, ...data);
          }
        });

        ['on', 'off', 'trigger'].forEach((key) => void Object.assign(this, {[key]: this.observer[key].bind(this.observer)}));

        this.capLevelController = new CapLevelController(this);
      }

      set firstLevel(value) {
        this.levelController.firstLevel = value;
      }
    }

    beforeEach(function () {
      this.sandbox = sinon.createSandbox({useFakeTimers: true});
    });

    afterEach(function () {
      if (this.mockHls) {
        this.mockHls.capLevelController.destroy();
      }

      this.sandbox.restore();
    });

    it('has capLevelToPlayerSize get/set on CapLevelController', function () {
      const mockHls = this.mockHls = new MockHls();

      // NOTE: Subsequent tests are predicated on this assumption
      assert.equal(typeof Object.getOwnPropertyDescriptor(Object.getPrototypeOf(mockHls.capLevelController), 'capLevelToPlayerSize').get, 'function');
      assert.equal(typeof Object.getOwnPropertyDescriptor(Object.getPrototypeOf(mockHls.capLevelController), 'capLevelToPlayerSize').set, 'function');
    });

    function runTestCase({config, steps}) {
      const mockHls = this.mockHls = new MockHls(config);

      const spies = [
        'detectPlayerSize'
      ].reduce((spies, key) => Object.assign({[key]: this.sandbox.spy(mockHls.capLevelController, key)}), {});

      for (const step of steps) {
        switch (typeof step) {
          // Operations
          case 'string':
            switch (step) {
              case 'MEDIA_ATTACHING':
                mockHls.capLevelController.onEvent(Event.MEDIA_ATTACHING, {media: document.createElement('video')});
                break;
              case 'MANIFEST_PARSED':
                mockHls.capLevelController.onEvent(Event.MANIFEST_PARSED, {levels, firstLevel: 1});
                break;
              case 'MEDIA_DETACHING':
                mockHls.capLevelController.onEvent(Event.MEDIA_DETACHING);
                break;
              case 'capLevelToPlayerSize:true':
                mockHls.capLevelController.capLevelToPlayerSize = true;
                break;
              case 'capLevelToPlayerSize:false':
                mockHls.capLevelController.capLevelToPlayerSize = false;
                break;
              case 'wait:5000':
                this.sandbox.clock.tick(5000);
                break;
              default:
                throw new Error(`Unrecognized test step: ${step}`);
            }
            break;

          // Call count assertions
          case 'object':
            for (const key of Object.keys(step)) {
              assert.equal(
                spies[key].callCount,
                step[key],
                `expected hls.capLevelController.${key} to have been called ${step[key]} time(s), but it was called ${spies[key].callCount} time(s) instead.`
              );
            }
            break;
          default:
            throw new Error(`Unrecognized test step: ${step}`);
        }
      }
    }

    context('config.capLevelToPlayerSize', function () {
      it('is passed to capLevelController.capLevelToPlayerSize', function () {
        const mockHls = this.mockHls = new MockHls({capLevelToPlayerSize: true});
        assert.equal(mockHls.capLevelController.capLevelToPlayerSize, true);
      });

      it.each(
        [
          {
            description: 'does not enable ABR capping before MEDIA_ATTACHING event',
            config: {capLevelToPlayerSize: true},
            steps: [
              {detectPlayerSize: 0}
            ]
          },
          {
            description: 'does not enable ABR capping before MANIFEST_PARSED event',
            config: {capLevelToPlayerSize: true},
            steps: [
              'MEDIA_ATTACHING',
              'wait:5000',
              {detectPlayerSize: 0}
            ]
          },
          {
            description: 'enables ABR capping on MANIFEST_PARSED when config.capLevelController is true',
            config: {capLevelToPlayerSize: true},
            steps: [
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1}
            ]
          },
          {
            description: 'keeps polling the video player dimensions',
            config: {capLevelToPlayerSize: true},
            steps: [
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1},
              'wait:5000',
              {detectPlayerSize: 6}
            ]
          },
          {
            description: 'disables ABR capping after MEDIA_DETACHING event',
            config: {capLevelToPlayerSize: true},
            steps: [
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1},
              'MEDIA_DETACHING',
              'wait:5000',
              {detectPlayerSize: 1}
            ]
          },

          // Ensure the parsed manifest from the previously attached media is discarded on MEDIA_DETACHING.
          {
            description: 'does not re-enable ABR capping after [MEDIA_ATTACHING, MANIFEST_PARSED, MEDIA_DETACHING, MEDIA_ATTACHING] sequence of events',
            config: {capLevelToPlayerSize: true},
            steps: [
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1},
              'MEDIA_DETACHING',
              'wait:5000',
              'MEDIA_ATTACHING',
              'wait:5000',
              {detectPlayerSize: 1}
            ]
          },
          {
            description: 're-enables ABR capping after [MEDIA_ATTACHING, MANIFEST_PARSED]',
            config: {capLevelToPlayerSize: true},
            steps: [
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1},
              'MEDIA_DETACHING',
              'wait:5000',
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 2},
              'wait:5000',
              {detectPlayerSize: 7}
            ]
          },
          {
            description: 'does not activate on MANIFEST_PARSED when config.capLevelController is false',
            config: {capLevelToPlayerSize: false},
            steps: [
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              'wait:5000',
              {detectPlayerSize: 0}
            ]
          }
        ],
        '%s',
        ['description'],
        runTestCase
      );
    });

    context('capLevelController.capLevelToPlayerSize', function () {
      it('allows capLevelToPlayerSize to be changed after initialization from hls.config', function () {
        const mockHls = this.mockHls = new MockHls({capLevelToPlayerSize: false});
        mockHls.capLevelController.capLevelToPlayerSize = true;

        assert.equal(mockHls.capLevelController.capLevelToPlayerSize, true);
      });

      it.each(
        [
          {
            description: 'enables ABR capping when config.capLevelToPlayerSize is false and capLevelController.capLevelToPlayerSize is set to true',
            config: {capLevelToPlayerSize: false},
            steps: [
              'capLevelToPlayerSize:true',
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1} // Initial player size detection should have occurred
            ]
          },
          {
            description: 'disabled ABR capping when config.capLevelToPlayerSize is false and capLevelController.capLevelToPlayerSize is set to true then false',
            config: {capLevelToPlayerSize: false},
            steps: [
              'capLevelToPlayerSize:true',
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1},
              'capLevelToPlayerSize:false',
              'wait:5000',
              {detectPlayerSize: 1}
            ]
          },
          {
            description: 're-enables ABR capping after config.capLevelToPlayerSize is set to true, false, then true',
            config: {capLevelToPlayerSize: false},
            steps: [
              'capLevelToPlayerSize:true',
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1},
              'capLevelToPlayerSize:false',
              'wait:5000',
              'capLevelToPlayerSize:true',
              {detectPlayerSize: 2},
              'wait:5000',
              {detectPlayerSize: 7}
            ]
          },

          // Same as config.capLevelToPlayerSize tests, using capLevelController.capLevelToPlayerSize instead

          {
            description: 'does not enable ABR capping before MEDIA_ATTACHING event',
            config: {capLevelToPlayerSize: false},
            steps: [
              'capLevelToPlayerSize:true',
              {detectPlayerSize: 0}
            ]
          },
          {
            description: 'does not enable ABR capping before MANIFEST_PARSED event',
            config: {capLevelToPlayerSize: false},
            steps: [
              'capLevelToPlayerSize:true',
              'MEDIA_ATTACHING',
              'wait:5000',
              {detectPlayerSize: 0}
            ]
          },
          {
            description: 'enables ABR capping on MANIFEST_PARSED when config.capLevelController is true',
            config: {capLevelToPlayerSize: false},
            steps: [
              'capLevelToPlayerSize:true',
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1}
            ]
          },
          {
            description: 'keeps polling the video player dimensions',
            config: {capLevelToPlayerSize: false},
            steps: [
              'capLevelToPlayerSize:true',
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1},
              'wait:5000',
              {detectPlayerSize: 6}
            ]
          },
          {
            description: 'disables ABR capping after MEDIA_DETACHING event',
            config: {capLevelToPlayerSize: false},
            steps: [
              'capLevelToPlayerSize:true',
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1},
              'MEDIA_DETACHING',
              'wait:5000',
              {detectPlayerSize: 1}
            ]
          },

          // Ensure the parsed manifest from the previously attached media is discarded on MEDIA_DETACHING.
          {
            description: 'does not re-enable ABR capping after [MEDIA_ATTACHING, MANIFEST_PARSED, MEDIA_DETACHING, MEDIA_ATTACHING] sequence of events',
            config: {capLevelToPlayerSize: false},
            steps: [
              'capLevelToPlayerSize:true',
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1},
              'MEDIA_DETACHING',
              'wait:5000',
              'MEDIA_ATTACHING',
              'wait:5000',
              {detectPlayerSize: 1}
            ]
          },
          {
            description: 're-enables ABR capping after [MEDIA_ATTACHING, MANIFEST_PARSED]',
            config: {capLevelToPlayerSize: false},
            steps: [
              'capLevelToPlayerSize:true',
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 1},
              'MEDIA_DETACHING',
              'wait:5000',
              'MEDIA_ATTACHING',
              'MANIFEST_PARSED',
              {detectPlayerSize: 2},
              'wait:5000',
              {detectPlayerSize: 7}
            ]
          }
        ],
        '%s',
        ['description'],
        runTestCase
      );
    });
  });
});
