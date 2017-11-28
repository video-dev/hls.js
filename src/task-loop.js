import EventHandler from './event-handler';

const MAX_TICKS_RE_ENTRY = 0;

export default class TaskLoop extends EventHandler {

  constructor(hls, ...events) {
    super(hls, ...events);

    this._tickInterval = null;
    this._ticks = 0;
  }

  /**
   * @override
   */
  destroy() {
    this.clearInterval();
    super.destroy();
  }

  /**
   * @returns {boolean}
   */
  hasInterval() {
    return !isNaN(this._tickInterval);
  }

  /**
   * @param {number} millis Interval time (ms)
   * @returns {boolean} True when interval has been scheduled, false when already scheduled (no effect)
   */
  setInterval(millis) {
    if (!this._tickInterval) {
      this._tickInterval = setInterval(this.tick.bind(this, false), millis);
      return true;
    }
    return false;
  }

  /**
   * @returns {boolean} True when interval was cleared, false when none was set (no effect)
   */
  clearInterval() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      return true;
    }
    return false;
  }

  /**
   *
   * @param {Wether to force async} forceAsync
   * @returns {boolean} True when async, false when sync
   */
  tick(forceAsync = true) {
    if (this._ticks > MAX_TICKS_RE_ENTRY || !forceAsync) {
      this._ticks++;
      this.doTick();
      this._ticks--;
      return false;
    } else {
      this._ticks = 0;
      setTimeout(this.tick.bind(this), 0);
      return true;
    }
  }

  /**
   * For subclass to implement task logic
   * @abstract
   */
  doTick() {
    throw new Error('TaskLoop is abstract and `doLoop` must be implemented');
  }

}
