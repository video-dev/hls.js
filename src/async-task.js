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
    this.handle_ = null;
  }
}
