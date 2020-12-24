import Hls from '../../src/hls';

const sinon = require('sinon');

/**
 * All public methods of Hls instance
 */
const publicMethods = [
  'trigger',
  'on',
  'off',
  'destroy',
  'attachMedia',
  'loadSource',
  'startLoad',
  'stopLoad',
  'swapAudioCodec',
  'recoverMediaError',
];

export default class HlsMock {
  // TODO: static properties

  constructor(config) {
    // Mock arguments can at will override the default config
    // and have to specify things that are not in the default config
    this.config = Object.assign({}, Hls.DefaultConfig, config);

    // stub public API with spies
    publicMethods.forEach((methodName) => {
      this[methodName] = sinon.stub();
    });
  }

  getEventData(n) {
    const event = this.trigger.getCall(n).args;
    return { name: event[0], payload: event[1] };
  }

  /**
   * Reset all spies
   */
  __reset__() {
    publicMethods.forEach((methodName) => {
      this[methodName].reset();
    });
  }
}
