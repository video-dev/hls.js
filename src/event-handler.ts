/*
*
* All objects in the event handling chain should inherit from this class
*
*/

import { logger } from './utils/logger';
import { ErrorTypes, ErrorDetails } from './errors';
import { Event } from './events';

import Hls from './hls';

const _logger: any = logger;

// These are forbidden as they clash with the base class interface
const FORBIDDEN_EVENT_NAMES = new Set([
  'hlsEventGeneric',
  'hlsHandlerDestroying',
  'hlsHandlerDestroyed'
]);

abstract class EventHandler {
  private _hls: Hls;
  private _handledEvents: string[];
  private _useGenericHandler: boolean;

  constructor (hls: Hls, ...events: Event[]) {
    this._hls = hls;
    this._handledEvents = events;
    this._useGenericHandler = true;

    this.onEvent = this.onEvent.bind(this);

    this.registerListeners();
  }

  get hls (): Hls {
    return this._hls;
  }

  destroy () {
    this.onHandlerDestroying();
    this.unregisterListeners();
    this.onHandlerDestroyed();
  }

  onHandlerDestroying () {}
  onHandlerDestroyed () {}

  isEventHandler () {
    return typeof this._handledEvents === 'object' && this._handledEvents.length && typeof this.onEvent === 'function';
  }

  registerListeners () {
    if (this.isEventHandler()) {
      this._handledEvents.forEach(function (event) {
        if (FORBIDDEN_EVENT_NAMES.has(event)) {
          throw new Error('Forbidden event-name: ' + event);
        }

        this.hls.on(event, this.onEvent);
      }, this);
    }
  }

  unregisterListeners () {
    if (this.isEventHandler()) {
      this._handledEvents.forEach(function (event) {
        this.hls.off(event, this.onEvent);
      }, this);
    }
  }

  /**
   * arguments: event (string), data (any)
   */
  onEvent (event, data) {
    this.onEventGeneric(event, data);
  }

  onEventGeneric (event, data) {
    let eventToFunction = function (event, data) {
      let funcName = 'on' + event.replace('hls', '');
      if (typeof this[funcName] !== 'function') {
        throw new Error(`Event ${event} has no generic handler in this ${this.constructor.name} class (tried ${funcName})`);
      }

      return this[funcName].bind(this, data);
    };
    try {
      eventToFunction.call(this, event, data).call();
    } catch (err) {
      _logger.error(`An internal error happened while handling event ${event}. Error message: "${err.message}". Here is a stacktrace:`, err);
      this.hls.trigger(Event.ERROR, { type: ErrorTypes.OTHER_ERROR, details: ErrorDetails.INTERNAL_EXCEPTION, fatal: false, event: event, err: err });
    }
  }
}

export default EventHandler;

export { EventHandler };
