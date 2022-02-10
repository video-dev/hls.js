const assertValidRange = (name, length, index) => {
  if (index >= length || index < 0) {
    throw new DOMException(
      `Failed to execute '${name}' on 'TimeRanges': The index provided (${index}) is greater than the maximum bound (${length}).`
    );
  }
  return true;
};

export class TimeRangesMock {
  _ranges = [];

  // Accepts an argument list of [start, end] tuples or { start: number, end: number } objects
  constructor(...ranges) {
    this._ranges = ranges.map((range) =>
      Array.isArray(range) ? range : [range.start, range.end]
    );
  }

  get length() {
    const { _ranges: ranges } = this;
    return ranges.length;
  }

  start(i) {
    const { _ranges: ranges, length } = this;
    assertValidRange('start', length, i);
    return ranges[i] && ranges[i][0];
  }

  end(i) {
    const { _ranges: ranges, length } = this;
    assertValidRange('end', length, i);
    return ranges[i] && ranges[i][1];
  }
}
