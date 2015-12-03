/*
*
* All objects in the event handling chain should inherit from this class
*
*/

//import {logger} from './utils/logger';

class EventHandler {

  constructor(hls, ...events) {
    this.hls = hls;
    this.onEvent = this.onEvent.bind(this);
    this.handledEvents = events;

    this.registerListeners();
  }

  destroy() {
    this.unregisterListeners();
  }

  isEventHandler() {
    return true;
    return typeof this.handledEvents === 'object' && this.handledEvents.length && typeof this.onEvent === 'function';
  }

  registerListeners() {
    if (this.isEventHandler()) {
      this.handledEvents.forEach(function(event) {
        this.hls.on(event, this.onEvent);
      }.bind(this));
    }
  }

  unregisterListeners() {
    if (this.isEventHandler()) {
      this.handledEvents.forEach(function(event) {
        this.hls.off(event, this.onEvent);
      }.bind(this));
    }
  }

  /*
  * arguments: event (string), data (any)
  */
  onEvent() {
    throw new Error('onEvent should be overloaded');
  }
}

export default EventHandler;