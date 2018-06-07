import EventEmitter from 'events';

const { performance } = window;

export class AsyncTask {
  constructor (name, callback, timeMs = 0, repeat = false) {
    this.name = name;
    this.isInterval_ = repeat;
    this.callback = callback;
    this.handle_ = null;
    this.runBound_ = this.run.bind(this);
  }

  isScheduled () {
    return this.handle_ !== null;
  }

  schedule (timeMs) {
    if (this.isScheduled()) {
      console.warn('Task already scheduled:', this.name);
      return;
    }
    if (this.isInterval_) {
      this.handle_ = window.setInterval(this.runBound_, timeMs);
    } else {
      this.handle_ = window.setTimeout(this.runBound_, timeMs);
    }
  }

  run () {
    window.clearTimeout(this.handle_);
    this.handle_ = null;
    this.callback();
  }

  cancel () {
    if (this.isInterval_) {
      window.clearInterval(this.handle_);
    } else {
      window.clearTimeout(this.handle_);
    }
  }
}

export class EventDispatcherQueueItem {
  constructor (event, data) {
    this.event = event;
    this.data = data;
  }
}

export class EventQueue {
  constructor (onEmit) {
    this.queue_ = [];
    this.onEmit_ = onEmit;
  }

  emit (event, data) {
    this.queue_.push(new EventDispatcherQueueItem(event, data));
    if (this.onEmit_) {
      this.onEmit_();
    }
  }

  drop () {
    this.queue_ = [];
  }

  pop () {
    return this.queue_.shift();
  }
}

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
    this.running_ = true;
    this.onQueueEmit_();
  }

  stop () {
    this.running_ = false;
    this.runAllTask_.cancel();
    this.debounceQueueTask_.cancel();
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
        this.stop();
      }

      this.lastRun_ = performance.now();
      return true;
    }
    return false;
  }

  /**
   * Returns true when last call to runOne returned true
   */
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
