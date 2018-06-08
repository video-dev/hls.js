import { AsyncTask } from './async-task';

const { performance } = window;

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
