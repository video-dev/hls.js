/**
 * A lightweight readable stream implemention that handles event dispatching.
 * Objects that inherit from streams should call init in their constructors.
 */

 'use strict';

 class Stream  {
  constructor() {
    this.listeners = {};
  }
  /**
   * Add a listener for a specified event type.
   * @param type {string} the event name
   * @param listener {function} the callback to be invoked when an event of
   * the specified type occurs
   */
   on(type, listener) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }
  /**
   * Remove a listener for a specified event type.
   * @param type {string} the event name
   * @param listener {function} a function previously registered for this
   * type of event through `on`
   */
   off(type, listener) {
    var index;
    if (!this.listeners[type]) {
      return false;
    }
    index = this.listeners[type].indexOf(listener);
    this.listeners[type].splice(index, 1);
    return index > -1;
  }
  /**
   * Trigger an event of the specified type on this stream. Any additional
   * arguments to this function are passed as parameters to event listeners.
   * @param type {string} the event name
   */
   trigger(type) {
    var callbacks, i, length, args;
    callbacks = this.listeners[type];
    if (!callbacks) {
      return;
    }
    // Slicing the arguments on every invocation of this method
    // can add a significant amount of overhead. Avoid the
    // intermediate object creation for the common case of a
    // single callback argument
    if (arguments.length === 2) {
      length = callbacks.length;
      for (i = 0; i < length; ++i) {
        callbacks[i].call(this, arguments[1]);
      }
    } else {
      args = Array.prototype.slice.call(arguments, 1);
      length = callbacks.length;
      for (i = 0; i < length; ++i) {
        callbacks[i].apply(this, args);
      }
    }
  }
  /**
   * Destroys the stream and cleans up.
   */
   dispose() {
    this.listeners = {};
  }


  /**
   * Forwards all `data` events on this stream to the destination stream. The
   * destination stream should provide a method `push` to receive the data
   * events as they arrive.
   * @param destination {stream} the stream that will receive all `data` events
   * @see http://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
   */
   pipe(destination) {
    this.on('data', function(data) {
      destination.push(data);
    });
  }
}

export default Stream;

