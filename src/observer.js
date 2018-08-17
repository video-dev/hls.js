import { EventEmitter } from 'eventemitter3';

import { logger } from './utils/logger';

const ENABLE_TRACE_LOG_EVENT_TRIGGER = false;

/**
 * @class
 *
 * Simple adapter sub-class of Nodejs-like EventEmitter.
 *
 * We simply want to pass along the event-name itself
 * in every call to a handler, which is the purpose of our `trigger` method
 * extending the standard API.
 *
 */
export class Observer extends EventEmitter {
  /**
   *
   * @param {string} event
   * @param {any} data
   */
  trigger (event, ...data) {
    logger.trace('Event triggered:', event);

    this.emit(event, event, ...data);
  }
}
