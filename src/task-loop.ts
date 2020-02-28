import EventHandler from './event-handler';
import Hls from './hls';

/**
 * TaskLoop serves as super-class to a number of core components
 * that need to periodically schedule running "tick" like processing
 * scheduled on the main loop.
 *
 * All of it's methods are supposed to be called by the subclasser itself,
 * in order to manage its task process  scheduling, and or not intended for public usage.
 *
 * Inheriting classes need to implement the `doTick` method,
 * where any application specific process can be done.
 *
 * `doTick` is not supposed to be called directly.
 *
 * Instead, there is the `tick` method that will allow to schedule
 * the `doTick` in a way that will avoid re-entrant (i.e recursive)
 * calling of it.
 *
 * 1) tick() invokes doTick().
 *
 * 2) When in the callstack of `doTick` implementation there is any further call to tick()
 *    a further doTick() call is scheduled anyhow on the next main eventloop iteration
 *    via setTimeout(,0).
 *
 * Calling to `tick` can be seen as requesting an execution frame for `doTick`
 * on the main thread as early as possible.
 *
 * The idea is, any repetitive "ticking" task can be implemented here, the task
 * can "tick" itself, but we avoid locking the main thread with any endless re-entrant calls,
 * but re-schedule as a timeout instead.
 *
 * Also, TaskLoop provides a utility to schedule fixed interval tasks,
 * by wrapping window.setInterval for convenience.
 * See `setInterval`, `hasInterval` and `clearInterval`.
 */
export default abstract class TaskLoop extends EventHandler {
  private readonly _boundTick: () => void;
  private _tickTimer: number | null = null;
  private _tickInterval: number | null = null;
  private _tickCallCount = 0;

  constructor (hls: Hls, ...events: string[]) {
    super(hls, ...events);
    this._boundTick = this.tick.bind(this);
  }

  /**
   * @override
   */
  protected onHandlerDestroying () {
    // clear all timers before unregistering from event bus
    this.clearNextTick();
    this.clearInterval();
  }

  /**
   * @returns {boolean}
   */
  public hasInterval (): boolean {
    return this._tickInterval !== null;
  }

  /**
   * @returns {boolean}
   */
  protected hasNextTick (): boolean {
    return this._tickTimer !== null;
  }

  /**
   * @param {number} millis Interval time (ms)
   * @returns {boolean} True when interval has been scheduled, false when already scheduled (no effect)
   */
  protected setInterval (millis: number): boolean {
    if (!this._tickInterval) {
      this._tickInterval = self.setInterval(this._boundTick, millis);
      return true;
    }
    return false;
  }

  /**
   * @returns {boolean} True when interval was cleared, false when none was set (no effect)
   */
  protected clearInterval (): boolean {
    if (this._tickInterval !== null) {
      self.clearInterval(this._tickInterval);
      this._tickInterval = null;
      return true;
    }
    return false;
  }

  /**
   * @returns {boolean} True when timeout was cleared, false when none was set (no effect)
   */
  protected clearNextTick (): boolean {
    if (this._tickTimer) {
      self.clearTimeout(this._tickTimer);
      this._tickTimer = null;
      return true;
    }
    return false;
  }

  /**
   * Will call the subclass doTick implementation in this main loop tick
   * or in the next one (via setTimeout(,0)) in case it has already been called
   * in this tick call (in case this is a re-entrant call).
   */
  protected tick (): void {
    this._tickCallCount++;
    if (this._tickCallCount === 1) {
      this.doTick();
      // re-entrant call to tick from previous doTick call stack
      // -> schedule a call on the next main loop iteration to process this task processing request
      if (this._tickCallCount > 1 && !this.hasNextTick()) {
        this._tickTimer = self.setTimeout(this._boundTick, 0);
      }
      this._tickCallCount = 0;
    }
  }

  /**
   * For subclass to implement task logic
   * @abstract
   */
  protected abstract doTick ();
}
