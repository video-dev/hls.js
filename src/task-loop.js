import EventHandler from './event-handler';

export default class TaskLoop extends EventHandler {
  constructor (hls, ...events) {
    super(hls, ...events);

    this._tickInterval = null;
    this._tickCallCount = 0;
  }

  /**
   * @override
   */
  destroy () {
    this.clearInterval();
    super.destroy();
  }

  /**
   * @returns {boolean}
   */
  hasInterval () {
    return this._tickInterval !== null;
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
   *
   * @param {Wether to force async} forceAsync
   * @returns {boolean} True when async, false when sync
   */
  tick () {
    this._tickCallCount++;
    if (this._tickCallCount === 1) {
      this.doTick();
      if (this._tickCallCount > 1)
        setTimeout(this.tick.bind(this), 0);

      this._tickCallCount = 0;
    }
  }

  /**
   * For subclass to implement task logic
   * @abstract
   */
  doTick () {
    throw new Error('TaskLoop is abstract and `doLoop` must be implemented');
  }
}
