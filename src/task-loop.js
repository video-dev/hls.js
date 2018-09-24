/**
 * @module TaskLoop
 *
 * Task-running service using a singleton timer/interval for scheduling to optimize
 * browser main loop occupation.
 *
 * TaskLoop is an abstract class. Subclass can implement `doTick` with the task to run.
 *
 * The singleton timers all schedule one function executing a loop over all existing
 * (registered) TaskLoop instances (using a map of TaskLoopEntries).
 *
 * The instance has 3 ways to interact with the two timers, which are all used for different
 * purpose by Hls components that have to schedule functions periodically.
 *
 * 1. Set/clear interval (and set the *preferred* execution period). The fastest possible period is limited by
 * the POLL_MS constant at which the singleton interval is scheduled.
 *
 * 2. Set/clear one-shot-timer that will guarantee execution on next interval tick
 * (even if before/below preferred exeuction period)
 *
 * 3. Run immediate (at next native main-thread tick).
 * This may be called by several task instances in the same tick and will allow every task
 * requesting it to run asap by resetting the respective lastCalledAt property of the task entry to -Infinity.
 */

import EventHandler from './event-handler';

const POLL_MS = 500;

/**
 *
 * @typedef {task: TaskLoop, lastTickAt: number} TaskLoopEntry
 * @type {[name: string]: TaskLoopEntry}
 */
const taskLoopRegistry = {};
let taskLoopRegistryId = 0;

const performance = window.performance;

let singletonInterval;
let singletonTimer;

// Call on destroy
function cancelTickSource () {
  clearInterval(singletonInterval);
  singletonInterval = null;
}

function setTickSource () {
  if (singletonInterval) {
    return;
  }
  singletonInterval = setInterval(taskLoop, POLL_MS);
}

// Call on destroy
function cancelTimer () {
  clearTimeout(singletonTimer);
  singletonTimer = null;
}

function scheduleTimer (time = POLL_MS) {
  if (singletonTimer) {
    throw new Error('Timer already set');
  }
  singletonTimer = setTimeout(taskLoop, time);
}

function taskLoop () {
  Object.getOwnPropertyNames(taskLoopRegistry)
    .forEach((name) => {
      const entry = taskLoopRegistry[name];
      const now = performance.now();
      let run = false;
      if (entry.task.hasNextTick()) {
        run = true;
      } else if (entry.task.hasInterval() &&
        now - entry.lastTickAt >= entry.task.getInterval()) {
        run = true;
      }
      if (run) {
        entry.lastTickAt = performance.now();
        entry.task.doTick();
      }
    });
}

function scheduleImmediateTick (name) {
  taskLoopRegistry[name].lastTickAt = -Infinity;
  cancelTimer();
  scheduleTimer(0);
}

/**
 *
 * @param {string} name
 * @param {TaskLoop} task
 */
function registerTask (name, task) {
  if (taskLoopRegistry[name]) {
    throw new Error('Task already registered: ' + name);
  }
  taskLoopRegistry[name] = {
    task,
    lastTickAt: -Infinity
  };
}

function deregisterTask (name) {
  delete taskLoopRegistry[name];
}

/**
 * @class
 * @abstract
 */
export default class TaskLoop extends EventHandler {
  /**
   *
   * @param {string} name
   * @param {Hls} hls
   * @param  {...Event} events
   */
  constructor (hls, ...events) {
    super(hls, ...events);

    this._name = String(taskLoopRegistryId++);
    this._tickInterval = -1;
    this._tickTimer = false;
    this._boundTick = this.tick.bind(this);

    registerTask(this._name, this);

    setTickSource();
  }

  /**
   * @override
   */
  onHandlerDestroying () {
    // clear all timers before unregistering from event bus
    this.clearNextTick();
    this.clearInterval();

    cancelTickSource();

    deregisterTask(this._name);
  }

  /**
   * @returns {boolean}
   */
  hasInterval () {
    return this._tickInterval > 0;
  }

  /**
   * @param {number} millis Interval time (ms)
   * @returns {boolean} True when interval has been scheduled, false when already scheduled (no effect)
   */
  setInterval (millis) {
    this._tickInterval = millis;
  }

  /**
   * @returns {number}
   */
  getInterval () {
    return this._tickInterval;
  }

  /**
   * @returns {boolean} True when interval was cleared, false when none was set (no effect)
   */
  clearInterval () {
    this._tickInterval = -1;
  }

  /**
   * @returns {boolean}
   */
  hasNextTick () {
    return this._tickTimer;
  }

  /**
   * Request execution on next task loop iteration (which may be either invoked by the active interval or
   * a scheduled immediate run, see `tick` method).
   */
  requestNextTick () {
    this._tickTimer = true;
  }

  /**
   * Clears the next tick execution request
   */
  clearNextTick () {
    this._tickTimer = false;
  }

  /**
   * Will call the subclass doTick implementation asap on the next main thread iteration
   * (will invoke task look asap).
   */
  tick () {
    scheduleImmediateTick(this._name);
  }

  /**
   * For subclass to implement task logic
   * @abstract
   */
  doTick () {}
}
