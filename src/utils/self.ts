/** returns `undefined` is `self` is missing, e.g. in node */
export function maybeSelf() {
  return typeof self !== 'undefined' ? self : undefined;
}
