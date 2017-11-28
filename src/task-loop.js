const MAX_TICK_RE_ENTRY = 0;

export class TaskLoop {

  tick() {
    if (this.ticks > MAX_TICKS_RE_ENTRY) {
      this.ticks++;
      this.doTick();
      this.ticks--;
    } else {
      this.ticks = 0;
      setTimeout(this.tick.bind(this), 0);
    }
  }

  doTick() {
    throw new Error('TaskLoop is abstract and `doLoop` must be implemented');
  }

}
