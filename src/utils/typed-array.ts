export function sliceUint8(
  array: Uint8Array,
  start?: number,
  end?: number
): Uint8Array {
  // @ts-expect-error This polyfills IE11 usage of Uint8Array slice.
  // It always exists in the TypeScript definition so fails, but it fails at runtime on IE11.
  return Uint8Array.prototype.slice
    ? array.slice(start, end)
    : new Uint8Array(Array.prototype.slice.call(array, start, end));
}
