import { EventEmitter } from 'eventemitter3';
import HlsEvents from './events';

type Arguments < T > = [T] extends [ (...args: infer U) => any ]
  ? U
  : [T] extends [void] ? [] : [T];

interface TypedEventEmitter<Events> {
  addListener<E extends keyof Events> (event: E, listener: Events[E]): this
  on<E extends keyof Events> (event: E, listener: Events[E]): this
  once<E extends keyof Events> (event: E, listener: Events[E]): this

  removeAllListeners<E extends keyof Events> (event: E): this
  removeListener<E extends keyof Events> (event: E, listener: Events[E]): this

  emit<E extends keyof Events> (event: E, ...args: Arguments<Events[E]>): boolean
  listeners<E extends keyof Events> (event: E): Function[]
  listenerCount<E extends keyof Events> (event: E): number

  trigger<E extends keyof Events> (event: E, ...args: Arguments<Events[E]>): void
}

interface MyEvents {
  [HlsEvents.MEDIA_ATTACHING]: (media: HTMLMediaElement) => void
  [HlsEvents.MEDIA_ATTACHED]: (media: HTMLMediaElement) => void
}

/**
 * Simple adapter sub-class of Nodejs-like EventEmitter.
 */
export class Observer extends EventEmitter implements TypedEventEmitter<MyEvents> {
  /**
   * We simply want to pass along the event-name itself
   * in every call to a handler, which is the purpose of our `trigger` method
   * extending the standard API.
   */
  trigger<E extends keyof MyEvents> (event: E, ...data: Arguments<MyEvents[E]>): void {
    this.emit(event, event, ...data);
  }
}
