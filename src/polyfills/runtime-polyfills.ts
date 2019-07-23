export function polyfillSlice() {
  if (!Uint8Array.prototype.slice) {
    Object.defineProperty(Uint8Array.prototype, 'slice', {
      value: function (begin, end) {
        return new Uint8Array(Array.prototype.slice.call(this, begin, end));
      }
    });
  }
}