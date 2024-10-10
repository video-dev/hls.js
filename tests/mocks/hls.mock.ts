import { EventEmitter } from 'eventemitter3';
import * as sinon from 'sinon';
import Hls from '../../src/hls';
import { logger } from '../../src/utils/logger';
import type { HlsConfig } from '../../src/config';
import type { HlsEventEmitter, HlsListeners } from '../../src/events';
import type { Level } from '../../src/types/level';

// All public methods of Hls instance
const publicMethods = [
  'destroy',
  'attachMedia',
  'loadSource',
  'startLoad',
  'stopLoad',
  'swapAudioCodec',
  'recoverMediaError',
];

export default class HlsMock extends EventEmitter implements HlsEventEmitter {
  config: Partial<HlsConfig>;
  [key: string]: any;

  constructor(config: Partial<HlsConfig> = {}) {
    super();
    // Mock arguments can at will override the default config
    // and have to specify things that are not in the default config
    this.config = Object.assign({}, Hls.DefaultConfig, config);
    this.logger = logger;
    const sandbox = (this.sandbox = sinon.createSandbox());
    // stub public API with spies
    publicMethods.forEach((methodName) => {
      this[methodName] = sandbox.stub();
    });
    // add spies to event emitters
    this.trigger = <E extends keyof HlsListeners>(
      event: E,
      eventObject: Parameters<HlsListeners[E]>[1],
    ): boolean => this.emit(event as string, event, eventObject);
    sandbox.spy(this, 'on');
    sandbox.spy(this, 'once');
    sandbox.spy(this, 'off');
    sandbox.spy(this, 'trigger');
  }

  getEventData(n: number): { name: string; payload: any } {
    const event = (this.trigger as any).getCall(n).args;
    return { name: event[0], payload: event[1] };
  }

  get levels(): Level[] {
    const levels = this.levelController?.levels;
    return levels ? levels : [];
  }

  get loadLevel(): number {
    return this.levelController?.level;
  }

  set loadLevel(newLevel: number) {
    if (this.levelController) {
      this.levelController.manualLevel = newLevel;
    }
  }

  get nextLoadLevel(): number {
    return this.levelController?.nextLoadLevel;
  }

  set nextLoadLevel(level: number) {
    if (this.levelController) {
      this.levelController.nextLoadLevel = level;
    }
  }

  // Reset all spies
  __reset__() {
    publicMethods.forEach((methodName) => {
      this[methodName].reset();
    });
    this.sandbox.restore();
  }
}
