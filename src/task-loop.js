import EventHandler from './event-handler';

/**
 * Sub-class specialization of EventHandler base class.
 *
 * TaskLoop allows to schedule a task function being called repeatedly on the main loop,
 * scheduled asynchroneously, avoiding recursive calls in the same tick.
 *
 * The task can be scheduled as an interval repeatedly with a period as parameter.
 *
 * Sub-classes need to implement the doTick method which will effectively have the task execution routine.
 *
 * The class has a tick function that will schedule the doTick call. It may be called synchroneously
 * only for a stack-depth of one. On re-entrant calls, sub-sequent calls are scheduled for next main loop ticks.
 */
export default class TaskLoop extends EventHandler {
  constructor (hls, ...events) {
    super(hls, ...events);

    this._tickInterval = null;
    this._tickTimer = null;
    this._tickCallCount = 0;
  }

  /**
   * @override
   */
  onHandlerDestroying () {
    // clear all timers before unregistering from event bus
    this.clearNextTick();
    this.clearInterval();
  }

  /**
   * @returns {boolean}
   */
  hasInterval () {
    return !!this._tickInterval;
  }

  /**
   * @returns {boolean}
   */
  hasNextTick () {
    return !!this._tickTimer;
  }

  /**
   * @param {number} millis Interval time (ms)
   * @returns {boolean} True when interval has been scheduled, false when already scheduled (no effect)
   */
  setInterval (millis) {
    if (!this._tickInterval) {
      this._tickInterval = setInterval(this.tick.bind(this, false), millis);
      return true;
    }
    return false;
  }

  /**
   * @returns {boolean} True when interval was cleared, false when none was set (no effect)
   */
  clearInterval () {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
      return true;
    }
    return false;
  }

  /**
   * @returns {boolean} True when timeout was cleared, false when none was set (no effect)
   */
  clearNextTick () {
    if (this._tickTimer) {
      clearTimeout(this._tickTimer);
      this._tickTimer = null;
      return true;
    }
    return false;
  }

  /**
   * Will call the subclass doTick implementation in this main loop tick
   * or in the next one (via setTimeout(,0)) in case it has already been called
   * in this tick (in case this is a re-entrant call).
   */
  tick () {
    this._tickCallCount++;
    if (this._tickCallCount === 1) {
      this.doTick();
      // re-entrant: schedule a call on the next tick
      if (this._tickCallCount > 1) {
        // make sure only one timer exists at any time at max
        this.clearNextTick();
        this._tickTimer = setTimeout(this.tick.bind(this), 0);
      }

      this._tickCallCount = 0;
    }
  }

  /**
   * For subclass to implement task logic
   * @abstract
   */
  doTick () {}
}
