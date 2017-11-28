import EventHandler from './event-handler';

const MAX_TICK_RE_ENTRY = 0;

export class TaskLoop extends EventHandler {

  constructor(hls, ...events) {
    super(hls, ...events);

    this._tickInterval = null;
  }

  /**
   * @override
   */
  destroy() {
    this.clearInterval();

    EventHandler.prototype.destroy.call(this);
  }

  /**
   * @returns {boolean}
   */
  hasInterval() {
    return !isNaN(this._tickInterval);
  }

  setInterval() {
    if (!this._tickInterval) {
      this._tickInterval = setInterval(this.tick.bind(this));
      return true;
    }
    return false;
  }

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
  tick(forceAsync = false) {
    if (this.ticks > MAX_TICKS_RE_ENTRY && !forceAsync) {
      this.ticks++;
      this.doTick();
      this.ticks--;
      return false;
    } else {
      this.ticks = 0;
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
