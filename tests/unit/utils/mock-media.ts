import sinon from 'sinon';

export class MockMediaSource extends EventTarget {
  public readyState: string = 'open';
  public duration: number = Infinity;
  private _sourceBuffers: MockSourceBuffer[] = [];

  get sourceBuffers(): MockSourceBuffer[] {
    return this._sourceBuffers;
  }
  addSourceBuffer(): MockSourceBuffer {
    const sb = new MockSourceBuffer();
    this._sourceBuffers.push(sb);
    return sb;
  }

  removeSourceBuffer(sb: MockSourceBuffer) {
    const index = this._sourceBuffers.indexOf(sb);
    if (index !== -1) {
      this._sourceBuffers.splice(index, 1);
    }
  }

  addEventListener() {}

  removeEventListener() {}

  endOfStream() {}
}

type TimeRange = { start: number; end: number };

class MockBufferedRanges {
  public _ranges: Array<TimeRange> = [];
  start(index: number) {
    if (index < 0 || index >= this._ranges.length) {
      throw new Error(
        `Index out of bounds: index=${index} but buffered.length=${this._ranges.length}`,
      );
    }
    return this._ranges[index].start;
  }

  end(index: number) {
    if (index < 0 || index >= this._ranges.length) {
      throw new Error(
        `Index out of bounds: index=${index} but buffered.length=${this._ranges.length}`,
      );
    }
    return this._ranges[index].end;
  }

  get length() {
    return this._ranges.length;
  }

  add(range: TimeRange) {
    // Empty
    if (this._ranges.length === 0) {
      this._ranges.push(range);
      return;
    }

    // No overlap from beginning
    if (range.end < this.start(0)) {
      this._ranges.unshift(range);
      return;
    }

    // No overlap from end
    if (range.start > this.end(this.length - 1)) {
      this._ranges.push(range);
      return;
    }

    const result = [this._ranges[0]];
    this._ranges.push(range);
    this._ranges.sort((a, b) => a.start - b.start);

    let j = 0;
    // Find and merge overlapping range
    for (let i = 1; i < this._ranges.length; i++) {
      const curRange = result[j];
      const nextRange = this._ranges[i];
      if (curRange.end >= nextRange.start) {
        curRange.end = Math.max(curRange.end, nextRange.end);
      } else {
        result.push(nextRange);
        j++;
      }
    }

    this._ranges = result;
  }
}

export class MockSourceBuffer extends EventTarget {
  public updating: boolean = false;
  public appendBuffer = sinon.stub();
  public remove = sinon.stub();
  public buffered: MockBufferedRanges = new MockBufferedRanges();

  setBuffered(start: number, end: number) {
    this.buffered.add({ start, end });
  }
}

export class MockMediaElement {
  public currentTime: number = 0;
  public duration: number = Infinity;
  public textTracks: any[] = [];
  addEventListener() {}
  removeEventListener() {}
}
