import { EventEmitter } from 'eventemitter3';

/**
 * Simple adapter sub-class of Nodejs-like EventEmitter.
 */
export class Observer extends EventEmitter {
  /**
   * We simply want to pass along the event-name itself
   * in every call to a handler, which is the purpose of our `trigger` method
   * extending the standard API.
   */
  trigger (event: string, ...data: Array<any>): void {
    this.emit(event, event, ...data);
  }
}
