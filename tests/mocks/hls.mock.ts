import Hls from '../../src/hls';
import type { HlsConfig } from '../../src/config';

import * as sinon from 'sinon';

// All public methods of Hls instance
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
  config: Partial<HlsConfig>;
  [key: string]: any;

  constructor(config: Partial<HlsConfig> = {}) {
    // Mock arguments can at will override the default config
    // and have to specify things that are not in the default config
    this.config = Object.assign({}, Hls.DefaultConfig, config);
    // stub public API with spies
    publicMethods.forEach((methodName) => {
      this[methodName] = sinon.stub();
    });
  }

  getEventData(n: number): { name: string; payload: any } {
    const event = this.trigger.getCall(n).args;
    return { name: event[0], payload: event[1] };
  }

  // Reset all spies
  __reset__() {
    publicMethods.forEach((methodName) => {
      this[methodName].reset();
    });
  }
}
