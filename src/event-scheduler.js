import EventEmitter from 'events';

import { AsyncTask } from './async-task';

import { EventQueue } from './event-queue';

export class EventScheduler {
  constructor (eventQueue, eventEmitter) {
    this.eventQueue = new EventQueue(this.onQueueEmit_.bind(this));
    this.eventEmitter = new EventEmitter();

    this.schedulingFrameMs = 1000;

    this.lastRun_ = 0;
    this.running_ = false;

    this.debounceQueueTask_ = new AsyncTask('event-queue-debounce', this.scheduleRunAll.bind(this), this.schedulingFrameMs);
    this.runAllTask_ = new AsyncTask('event-queue-run-all', this.runAll.bind(this));
  }

  getEventQueue () {
    return this.eventQueue;
  }

  getEventEmitter () {
    return this.eventEmitter;
  }

  start () {
    console.log('Scheduler started');
    this.running_ = true;
    this.onQueueEmit_();
  }

  stop () {
    console.log('Scheduler stopped');
    this.running_ = false;
    this.runAllTask_.cancel();
    this.debounceQueueTask_.cancel();
  }

  isRunning () {
    return this.running_;
  }

  /**
   * Returns true when there was an item on the queu and was emitted
   */
  runOne () {
    if (!this.running_) {
      return;
    }
    const eventQueueItem = this.eventQueue.pop();
    if (eventQueueItem) {
      try {
        console.log('dispatching:', eventQueueItem);
        this.eventEmitter.emit(eventQueueItem.event, eventQueueItem.event, eventQueueItem.data);
      } catch (err) {
        console.error(err);
        this.stop();
      }

      this.lastRun_ = performance.now();
      return true;
    }
    return false;
  }

  runAll () {
    const startTimeMs = performance.now();
    let res;
    let timeSpentMs;
    do {
      res = this.runOne();
      timeSpentMs = performance.now() - startTimeMs;
    } while (res && timeSpentMs < this.schedulingFrameMs);

    this.onRunAllDone_(res);
  }

  scheduleRunAll () {
    this.runAllTask_.schedule();
  }

  onQueueEmit_ () {
    const now = performance.now();
    // debounce event queue emitions based on last run
    if (now - (this.lastRun_ > this.schedulingFrameMs)) {
      this.debounceQueueTask_.cancel();
      this.debounceQueueTask_.run();
    } else {
      this.debounceQueueTask_.schedule();
    }
  }

  onRunAllDone_ (result) {
    if (result) {
      this.runAllTask_.schedule();
    }
  }
}
