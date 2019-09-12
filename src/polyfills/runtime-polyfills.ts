if (!Uint8Array.prototype.slice) {
  // eslint-disable-next-line
  Object.defineProperty(Uint8Array.prototype, 'slice', {
    value: function (begin, end) {
      return new Uint8Array(Array.prototype.slice.call(this, begin, end));
    }
  });
}
