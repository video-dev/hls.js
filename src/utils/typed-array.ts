export function sliceUint8 (array: Uint8Array, start?: number, end?: number): Uint8Array {
  return Uint8Array.prototype.slice
    ? array.slice(start, end)
    : new Uint8Array(Array.prototype.slice.call(array, start, end));
}
